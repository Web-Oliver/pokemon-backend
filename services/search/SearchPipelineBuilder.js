const { ValidationError } = require('../../middleware/errorHandler');

/**
 * Search Pipeline Builder
 *
 * Builder pattern implementation for creating MongoDB aggregation pipelines.
 * Provides reusable pipeline components and fluent interface for building
 * complex search queries while eliminating code duplication.
 *
 * Following SOLID principles:
 * - Single Responsibility: Builds MongoDB aggregation pipelines
 * - Open/Closed: Extensible for new pipeline components
 * - Dependency Inversion: Depends on abstractions, not implementations
 * - Builder Pattern: Constructs complex objects step by step
 */
class SearchPipelineBuilder {
  /**
   * Creates a new search pipeline builder instance
   * @param {Object} options - Builder configuration options
   */
  constructor(options = {}) {
    this.pipeline = [];
    this.options = {
      enableIndexOptimization: options.enableIndexOptimization !== false,
      enableScoring: options.enableScoring !== false,
      maxPipelineStages: options.maxPipelineStages || 50,
      defaultLimit: options.defaultLimit || 100,
      ...options,
    };
  }

  /**
   * Adds a match stage to the pipeline
   * @param {Object} conditions - Match conditions
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  match(conditions) {
    if (!conditions || typeof conditions !== 'object') {
      throw new ValidationError('Match conditions must be an object');
    }

    this.pipeline.push({ $match: conditions });
    return this;
  }

  /**
   * Adds a text search match stage
   * @param {string} query - Search query
   * @param {Array} fields - Fields to search
   * @param {Object} options - Search options
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  textMatch(query, fields, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Query must be a non-empty string');
    }

    if (!fields || !Array.isArray(fields)) {
      throw new ValidationError('Fields must be an array');
    }

    const normalizedQuery = this.normalizeQuery(query);
    const fuzzyPatterns = this.createFuzzyPatterns(normalizedQuery, options);

    const conditions = [];

    // Build conditions for each field and pattern combination
    fields.forEach((field) => {
      fuzzyPatterns.forEach((pattern) => {
        conditions.push({ [field]: pattern });
      });
    });

    this.pipeline.push({ $match: { $or: conditions } });
    return this;
  }

  /**
   * Adds a regex match stage for a specific field
   * @param {string} field - Field name
   * @param {string} pattern - Regex pattern
   * @param {string} flags - Regex flags
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  regexMatch(field, pattern, flags = 'i') {
    if (!field || typeof field !== 'string') {
      throw new ValidationError('Field must be a non-empty string');
    }

    if (!pattern || typeof pattern !== 'string') {
      throw new ValidationError('Pattern must be a non-empty string');
    }

    this.pipeline.push({
      $match: {
        [field]: new RegExp(pattern, flags),
      },
    });

    return this;
  }

  /**
   * Adds a lookup stage for population
   * @param {string} from - Collection to join
   * @param {string} localField - Local field
   * @param {string} foreignField - Foreign field
   * @param {string} as - Output field name
   * @param {Object} options - Lookup options
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  lookup(from, localField, foreignField, as, options = {}) {
    if (!from || !localField || !foreignField || !as) {
      throw new ValidationError('All lookup parameters are required');
    }

    const lookupStage = {
      $lookup: {
        from,
        localField,
        foreignField,
        as,
      },
    };

    // Add pipeline if provided
    if (options.pipeline) {
      lookupStage.$lookup.pipeline = options.pipeline;
    }

    this.pipeline.push(lookupStage);

    // Add unwind if specified
    if (options.unwind) {
      this.unwind(as, options.unwind);
    }

    return this;
  }

  /**
   * Adds an unwind stage
   * @param {string} path - Path to unwind
   * @param {Object} options - Unwind options
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  unwind(path, options = {}) {
    if (!path || typeof path !== 'string') {
      throw new ValidationError('Path must be a non-empty string');
    }

    const unwindStage = {
      $unwind: {
        path: path.startsWith('$') ? path : `$${path}`,
        preserveNullAndEmptyArrays: options.preserveNullAndEmptyArrays || false,
      },
    };

    // Add includeArrayIndex if specified
    if (options.includeArrayIndex) {
      unwindStage.$unwind.includeArrayIndex = options.includeArrayIndex;
    }

    this.pipeline.push(unwindStage);
    return this;
  }

  /**
   * Adds a scoring stage with customizable scoring rules
   * @param {string} query - Search query
   * @param {Object} scoringRules - Scoring configuration
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  addScoring(query, scoringRules = {}) {
    if (!this.options.enableScoring) {
      return this;
    }

    const normalizedQuery = this.normalizeQuery(query);
    const scoreConditions = [];

    // Default scoring rules
    const defaultRules = {
      exactMatch: { weight: 100, fields: ['name'] },
      startsWith: { weight: 80, fields: ['name'] },
      contains: { weight: 60, fields: ['name'] },
      wordBoundary: { weight: 40, fields: ['name'] },
      lengthPenalty: { enabled: true, weight: 20 },
      fuzzyMatch: { enabled: true, weight: 30 },
    };

    const rules = { ...defaultRules, ...scoringRules };

    // Exact match scoring
    if (rules.exactMatch && rules.exactMatch.fields) {
      rules.exactMatch.fields.forEach((field) => {
        scoreConditions.push({
          $cond: {
            if: { $eq: [{ $toLower: `$${field}` }, normalizedQuery] },
            then: rules.exactMatch.weight,
            else: 0,
          },
        });
      });
    }

    // Starts with scoring
    if (rules.startsWith && rules.startsWith.fields) {
      rules.startsWith.fields.forEach((field) => {
        scoreConditions.push({
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${field}` },
                regex: `^${this.escapeRegex(normalizedQuery)}`,
              },
            },
            then: rules.startsWith.weight,
            else: 0,
          },
        });
      });
    }

    // Contains scoring
    if (rules.contains && rules.contains.fields) {
      rules.contains.fields.forEach((field) => {
        scoreConditions.push({
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${field}` },
                regex: this.escapeRegex(normalizedQuery),
              },
            },
            then: rules.contains.weight,
            else: 0,
          },
        });
      });
    }

    // Word boundary scoring
    if (rules.wordBoundary && rules.wordBoundary.fields) {
      rules.wordBoundary.fields.forEach((field) => {
        scoreConditions.push({
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${field}` },
                regex: `\\b${this.escapeRegex(normalizedQuery)}\\b`,
              },
            },
            then: rules.wordBoundary.weight,
            else: 0,
          },
        });
      });
    }

    // Length penalty scoring
    if (rules.lengthPenalty && rules.lengthPenalty.enabled) {
      const primaryField = rules.lengthPenalty.field || 'name';

      scoreConditions.push({
        $cond: {
          if: {
            $regexMatch: {
              input: { $toLower: `$${primaryField}` },
              regex: this.escapeRegex(normalizedQuery),
            },
          },
          then: {
            $divide: [rules.lengthPenalty.weight, { $strLenCP: `$${primaryField}` }],
          },
          else: 0,
        },
      });
    }

    // Add custom scoring conditions
    if (rules.custom && Array.isArray(rules.custom)) {
      scoreConditions.push(...rules.custom);
    }

    this.pipeline.push({
      $addFields: {
        score: {
          $add: scoreConditions,
        },
      },
    });

    return this;
  }

  /**
   * Adds advanced scoring with multi-field weights
   * @param {string} query - Search query
   * @param {Object} fieldWeights - Field weight configuration
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  addAdvancedScoring(query, fieldWeights = {}) {
    if (!this.options.enableScoring) {
      return this;
    }

    const normalizedQuery = this.normalizeQuery(query);
    const queryWords = normalizedQuery.split(' ');
    const scoreConditions = [];

    // Multi-word scoring
    queryWords.forEach((word, index) => {
      const wordWeight = queryWords.length - index; // Earlier words have higher weight

      Object.entries(fieldWeights).forEach(([field, weight]) => {
        // Word boundary match
        scoreConditions.push({
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${field}` },
                regex: `\\b${this.escapeRegex(word)}\\b`,
              },
            },
            then: weight * wordWeight,
            else: 0,
          },
        });

        // Partial word match
        scoreConditions.push({
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${field}` },
                regex: this.escapeRegex(word),
              },
            },
            then: (weight * wordWeight) / 2,
            else: 0,
          },
        });
      });
    });

    this.pipeline.push({
      $addFields: {
        score: {
          $add: scoreConditions,
        },
      },
    });

    return this;
  }

  /**
   * Adds a sort stage
   * @param {Object} sortSpec - Sort specification
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  sort(sortSpec) {
    if (!sortSpec || typeof sortSpec !== 'object') {
      throw new ValidationError('Sort specification must be an object');
    }

    this.pipeline.push({ $sort: sortSpec });
    return this;
  }

  /**
   * Adds a limit stage
   * @param {number} limit - Limit count
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  limit(limit) {
    if (typeof limit !== 'number' || limit < 1) {
      throw new ValidationError('Limit must be a positive number');
    }

    this.pipeline.push({ $limit: limit });
    return this;
  }

  /**
   * Adds a skip stage
   * @param {number} skip - Skip count
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  skip(skip) {
    if (typeof skip !== 'number' || skip < 0) {
      throw new ValidationError('Skip must be a non-negative number');
    }

    this.pipeline.push({ $skip: skip });
    return this;
  }

  /**
   * Adds pagination stages
   * @param {number} page - Page number (1-based)
   * @param {number} limit - Items per page
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  paginate(page, limit) {
    if (typeof page !== 'number' || page < 1) {
      throw new ValidationError('Page must be a positive number');
    }

    if (typeof limit !== 'number' || limit < 1) {
      throw new ValidationError('Limit must be a positive number');
    }

    const skip = (page - 1) * limit;

    this.skip(skip);
    this.limit(limit);

    return this;
  }

  /**
   * Adds a project stage
   * @param {Object} projection - Projection specification
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  project(projection) {
    if (!projection || typeof projection !== 'object') {
      throw new ValidationError('Projection must be an object');
    }

    this.pipeline.push({ $project: projection });
    return this;
  }

  /**
   * Adds a group stage
   * @param {Object} groupSpec - Group specification
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  group(groupSpec) {
    if (!groupSpec || typeof groupSpec !== 'object') {
      throw new ValidationError('Group specification must be an object');
    }

    this.pipeline.push({ $group: groupSpec });
    return this;
  }

  /**
   * Adds fields to the pipeline
   * @param {Object} fields - Fields to add
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  addFields(fields) {
    if (!fields || typeof fields !== 'object') {
      throw new ValidationError('Fields must be an object');
    }

    this.pipeline.push({ $addFields: fields });
    return this;
  }

  /**
   * Adds a custom stage to the pipeline
   * @param {Object} stage - Custom pipeline stage
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  addStage(stage) {
    if (!stage || typeof stage !== 'object') {
      throw new ValidationError('Stage must be an object');
    }

    this.pipeline.push(stage);
    return this;
  }

  /**
   * Adds multiple stages to the pipeline
   * @param {Array} stages - Array of pipeline stages
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  addStages(stages) {
    if (!Array.isArray(stages)) {
      throw new ValidationError('Stages must be an array');
    }

    stages.forEach((stage) => this.addStage(stage));
    return this;
  }

  /**
   * Adds a facet stage for multi-dimensional aggregation
   * @param {Object} facets - Facet specifications
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  facet(facets) {
    if (!facets || typeof facets !== 'object') {
      throw new ValidationError('Facets must be an object');
    }

    this.pipeline.push({ $facet: facets });
    return this;
  }

  /**
   * Optimizes the pipeline for better performance
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  optimize() {
    if (!this.options.enableIndexOptimization) {
      return this;
    }

    // Move $match stages to the beginning
    const matchStages = [];
    const otherStages = [];

    this.pipeline.forEach((stage) => {
      if (stage.$match) {
        matchStages.push(stage);
      } else {
        otherStages.push(stage);
      }
    });

    // Combine multiple $match stages
    if (matchStages.length > 1) {
      const combinedMatch = { $and: matchStages.map((stage) => stage.$match) };

      this.pipeline = [{ $match: combinedMatch }, ...otherStages];
    } else {
      this.pipeline = [...matchStages, ...otherStages];
    }

    return this;
  }

  /**
   * Validates the pipeline
   * @throws {ValidationError} - If validation fails
   */
  validate() {
    if (this.pipeline.length === 0) {
      throw new ValidationError('Pipeline cannot be empty');
    }

    if (this.pipeline.length > this.options.maxPipelineStages) {
      throw new ValidationError(`Pipeline exceeds maximum stages (${this.options.maxPipelineStages})`);
    }

    // Validate each stage
    this.pipeline.forEach((stage, index) => {
      if (!stage || typeof stage !== 'object') {
        throw new ValidationError(`Invalid stage at index ${index}: must be an object`);
      }

      const stageKeys = Object.keys(stage);

      if (stageKeys.length !== 1) {
        throw new ValidationError(`Invalid stage at index ${index}: must have exactly one key`);
      }

      const stageType = stageKeys[0];

      if (!stageType.startsWith('$')) {
        throw new ValidationError(`Invalid stage at index ${index}: stage type must start with '$'`);
      }
    });
  }

  /**
   * Builds and returns the pipeline
   * @returns {Array} - MongoDB aggregation pipeline
   */
  build() {
    this.validate();
    return [...this.pipeline]; // Return a copy to prevent mutation
  }

  /**
   * Clears the pipeline
   * @returns {SearchPipelineBuilder} - Builder instance for chaining
   */
  clear() {
    this.pipeline = [];
    return this;
  }

  /**
   * Gets the current pipeline length
   * @returns {number} - Pipeline length
   */
  length() {
    return this.pipeline.length;
  }

  /**
   * Normalizes search query
   * @param {string} query - Search query
   * @returns {string} - Normalized query
   */
  normalizeQuery(query) {
    return query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '');
  }

  /**
   * Creates fuzzy search patterns
   * @param {string} query - Search query
   * @param {Object} options - Pattern options
   * @returns {Array} - Array of regex patterns
   */
  createFuzzyPatterns(query, options = {}) {
    const patterns = [];

    // Exact match
    patterns.push(new RegExp(`^${this.escapeRegex(query)}$`, 'i'));

    // Starts with
    patterns.push(new RegExp(`^${this.escapeRegex(query)}`, 'i'));

    // Contains
    patterns.push(new RegExp(this.escapeRegex(query), 'i'));

    // Word boundary
    patterns.push(new RegExp(`\\b${this.escapeRegex(query)}\\b`, 'i'));

    // Fuzzy match (if enabled and query is long enough)
    if (options.enableFuzzy && query.length > 2) {
      const fuzzyPattern = query
        .split('')
        .map((char) => this.escapeRegex(char))
        .join('.*?');

      patterns.push(new RegExp(fuzzyPattern, 'i'));
    }

    return patterns;
  }

  /**
   * Escapes regex special characters
   * @param {string} string - String to escape
   * @returns {string} - Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

module.exports = SearchPipelineBuilder;
