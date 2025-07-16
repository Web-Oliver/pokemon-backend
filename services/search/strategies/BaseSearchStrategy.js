const { ValidationError } = require('../../../middleware/errorHandler');
const FuseSearchAdapter = require('../FuseSearchAdapter');

/**
 * Base Search Strategy
 *
 * Abstract base class for all search strategies following the Strategy pattern.
 * Provides common search interface and shared utilities for concrete implementations.
 *
 * Following SOLID principles:
 * - Single Responsibility: Defines search contract and common utilities
 * - Open/Closed: Open for extension via inheritance, closed for modification
 * - Liskov Substitution: All strategies can be substituted for the base
 * - Interface Segregation: Focused interface for search operations
 * - Dependency Inversion: Depends on abstractions (repository pattern)
 */
class BaseSearchStrategy {
  /**
   * Creates a new search strategy instance
   * @param {BaseRepository} repository - Repository for data access
   * @param {Object} options - Strategy configuration options
   */
  constructor(repository, options = {}) {
    if (new.target === BaseSearchStrategy) {
      throw new Error('BaseSearchStrategy cannot be instantiated directly');
    }

    this.repository = repository;
    this.options = {
      maxResults: options.maxResults || 50,
      enableFuzzySearch: options.enableFuzzySearch !== false,
      enableScoring: options.enableScoring !== false,
      defaultSort: options.defaultSort || { score: -1 },
      searchFields: options.searchFields || [],
      enableFuseSearch: options.enableFuseSearch !== false,
      fuseThreshold: options.fuseThreshold || 0.6,
      hybridSearch: options.hybridSearch !== false,
      ...options,
    };

    // Initialize Fuse.js adapter if enabled
    this.fuseAdapter = null;
    if (this.options.enableFuseSearch) {
      this.initializeFuseAdapter();
    }
  }

  /**
   * Performs search operation - must be implemented by subclasses
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async search(query, options = {}) {
    throw new Error('search method must be implemented by subclass');
  }

  /**
   * Initializes Fuse.js adapter with entity-specific configuration
   */
  initializeFuseAdapter() {
    const entityType = this.getSearchType();

    this.fuseAdapter = FuseSearchAdapter.createFor(entityType, {
      threshold: this.options.fuseThreshold,
      keys: this.getFuseKeys(),
    });
  }

  /**
   * Gets Fuse.js keys configuration - should be overridden by subclasses
   * @returns {Array} - Fuse.js keys configuration
   */
  getFuseKeys() {
    return this.options.searchFields.map((field) => ({ name: field, weight: 1 }));
  }

  /**
   * Performs hybrid search combining MongoDB and Fuse.js
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Combined search results
   */
  async performHybridSearch(query, options = {}) {
    if (!this.options.hybridSearch || !this.fuseAdapter) {
      return await this.performMongoSearch(query, options);
    }

    try {
      // Get broader dataset for Fuse.js processing
      const mongoResults = await this.performMongoSearch(query, {
        ...options,
        limit: Math.min((options.limit || 20) * 3, 200), // Get 3x results for Fuse.js filtering
      });

      // If no mongo results, return empty
      if (!mongoResults.length) {
        return [];
      }

      // Initialize Fuse.js with results
      this.fuseAdapter.initialize(mongoResults);

      // Perform Fuse.js search
      const fuseResults = this.fuseAdapter.search(query, {
        limit: options.limit || 20,
        exactMatch: options.exactMatch,
        prefixMatch: options.prefixMatch,
      });

      // Return processed results
      return this.processHybridResults(fuseResults, query, options);
    } catch (error) {
      console.warn('Hybrid search failed, falling back to MongoDB search:', error);
      return await this.performMongoSearch(query, options);
    }
  }

  /**
   * Performs MongoDB-only search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async performMongoSearch(query, options = {}) {
    const pipeline = this.buildSearchPipeline(query, options);
    const results = await this.repository.aggregate(pipeline);

    return this.processResults(results, query, options);
  }

  /**
   * Processes hybrid search results
   * @param {Array} fuseResults - Fuse.js search results
   * @param {string} query - Original query
   * @param {Object} options - Search options
   * @returns {Array} - Processed hybrid results
   */
  processHybridResults(fuseResults, query, options = {}) {
    return fuseResults.map((result) => {
      // Combine MongoDB and Fuse.js scoring
      const combinedScore = this.calculateCombinedScore(result, query);

      return {
        ...result,
        searchScore: combinedScore,
        searchMethod: 'hybrid',
      };
    });
  }

  /**
   * Calculates combined score from MongoDB and Fuse.js results
   * @param {Object} result - Search result with Fuse.js data
   * @param {string} query - Search query
   * @returns {number} - Combined score
   */
  calculateCombinedScore(result, query) {
    const fuseScore = result.fuseScore || 0;
    const relevanceScore = result.relevanceScore || 0;
    const mongoScore = result.score || 0;

    // Weight: 40% Fuse.js relevance, 30% MongoDB score, 30% custom factors
    return (relevanceScore * 0.4) + (mongoScore * 0.3) + (this.calculateCustomScore(result, query) * 0.3);
  }

  /**
   * Calculates custom scoring factors - can be overridden by subclasses
   * @param {Object} result - Search result
   * @param {string} query - Search query
   * @returns {number} - Custom score
   */
  calculateCustomScore(result, query) {
    return 50; // Default neutral score
  }

  /**
   * Provides search suggestions - must be implemented by subclasses
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search suggestions
   */
  async suggest(query, options = {}) {
    throw new Error('suggest method must be implemented by subclass');
  }

  /**
   * Validates search input
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @throws {ValidationError} - If validation fails
   */
  validateSearchInput(query, options = {}) {
    if (!query || typeof query !== 'string') {
      throw new ValidationError('Search query must be a non-empty string');
    }

    if (query.trim().length === 0) {
      throw new ValidationError('Search query cannot be empty');
    }

    if (query.length > 200) {
      throw new ValidationError('Search query cannot exceed 200 characters');
    }

    if (options.limit && (options.limit < 1 || options.limit > 100)) {
      throw new ValidationError('Limit must be between 1 and 100');
    }

    if (options.page && options.page < 1) {
      throw new ValidationError('Page must be greater than 0');
    }
  }

  /**
   * Normalizes search query for consistent processing
   * @param {string} query - Raw search query
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
   * Creates fuzzy search patterns for MongoDB regex
   * @param {string} query - Search query
   * @returns {Array} - Array of regex patterns
   */
  createFuzzyPatterns(query) {
    const normalizedQuery = this.normalizeQuery(query);
    const patterns = [];

    // Exact match (highest priority)
    patterns.push(new RegExp(`^${this.escapeRegex(normalizedQuery)}$`, 'i'));

    // Starts with match
    patterns.push(new RegExp(`^${this.escapeRegex(normalizedQuery)}`, 'i'));

    // Contains match
    patterns.push(new RegExp(this.escapeRegex(normalizedQuery), 'i'));

    // Word boundary match
    patterns.push(new RegExp(`\\b${this.escapeRegex(normalizedQuery)}\\b`, 'i'));

    // Fuzzy match (if enabled)
    if (this.options.enableFuzzySearch && normalizedQuery.length > 2) {
      const fuzzyPattern = normalizedQuery
        .split('')
        .map((char) => this.escapeRegex(char))
        .join('.*?');

      patterns.push(new RegExp(fuzzyPattern, 'i'));
    }

    return patterns;
  }

  /**
   * Escapes special regex characters
   * @param {string} string - String to escape
   * @returns {string} - Escaped string
   */
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Builds basic search conditions for MongoDB
   * @param {string} query - Search query
   * @param {Array} fields - Fields to search
   * @returns {Object} - MongoDB search conditions
   */
  buildSearchConditions(query, fields) {
    const patterns = this.createFuzzyPatterns(query);
    const conditions = [];

    fields.forEach((field) => {
      patterns.forEach((pattern) => {
        conditions.push({ [field]: pattern });
      });
    });

    return { $or: conditions };
  }

  /**
   * Builds search aggregation pipeline
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} - MongoDB aggregation pipeline
   */
  buildSearchPipeline(query, options = {}) {
    const pipeline = [];

    // Add match stage
    const matchConditions = this.buildMatchConditions(query, options);

    if (matchConditions && Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Add scoring stage (if enabled)
    if (this.options.enableScoring) {
      pipeline.push(this.buildScoringStage(query, options));
    }

    // Add lookup stages (if needed)
    const lookupStages = this.buildLookupStages(options);

    if (lookupStages.length > 0) {
      pipeline.push(...lookupStages);
    }

    // Add sorting
    const sortStage = this.buildSortStage(options);

    if (sortStage) {
      pipeline.push(sortStage);
    }

    // Add pagination
    const paginationStages = this.buildPaginationStages(options);

    if (paginationStages.length > 0) {
      pipeline.push(...paginationStages);
    }

    return pipeline;
  }

  /**
   * Builds match conditions - to be overridden by subclasses
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB match conditions
   */
  buildMatchConditions(query, options = {}) {
    return this.buildSearchConditions(query, this.options.searchFields);
  }

  /**
   * Builds scoring stage for search relevance
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB scoring stage
   */
  buildScoringStage(query, options = {}) {
    const normalizedQuery = this.normalizeQuery(query);

    return {
      $addFields: {
        score: {
          $add: [
            // Exact match score
            {
              $cond: {
                if: { $eq: [{ $toLower: '$name' }, normalizedQuery] },
                then: 100,
                else: 0,
              },
            },
            // Starts with score
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$name' }, regex: `^${this.escapeRegex(normalizedQuery)}` } },
                then: 75,
                else: 0,
              },
            },
            // Contains score
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$name' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 50,
                else: 0,
              },
            },
            // Length-based score (shorter matches are more relevant)
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$name' }, regex: this.escapeRegex(normalizedQuery) } },
                then: { $divide: [100, { $strLenCP: '$name' }] },
                else: 0,
              },
            },
          ],
        },
      },
    };
  }

  /**
   * Builds lookup stages for population - to be overridden by subclasses
   * @param {Object} options - Search options
   * @returns {Array} - MongoDB lookup stages
   */
  buildLookupStages(options = {}) {
    return [];
  }

  /**
   * Builds sort stage
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB sort stage
   */
  buildSortStage(options = {}) {
    const sort = options.sort || this.options.defaultSort;

    return sort ? { $sort: sort } : null;
  }

  /**
   * Builds pagination stages
   * @param {Object} options - Search options
   * @returns {Array} - MongoDB pagination stages
   */
  buildPaginationStages(options = {}) {
    const stages = [];

    if (options.page && options.limit) {
      const skip = (options.page - 1) * options.limit;

      stages.push({ $skip: skip });
    }

    const limit = options.limit || this.options.maxResults;

    stages.push({ $limit: limit });

    return stages;
  }

  /**
   * Processes search results - can be overridden by subclasses
   * @param {Array} results - Raw search results
   * @param {string} query - Original search query
   * @param {Object} options - Search options
   * @returns {Array} - Processed search results
   */
  processResults(results, query, options = {}) {
    return results.map((result) => {
      // Convert Mongoose document to plain object
      const processed = result.toObject ? result.toObject() : result;

      // Remove internal fields
      delete processed.__v;
      delete processed._id;

      return processed;
    });
  }

  /**
   * Gets search type identifier - must be implemented by subclasses
   * @returns {string} - Search type identifier
   */
  getSearchType() {
    throw new Error('getSearchType method must be implemented by subclass');
  }

  /**
   * Gets supported search options - can be overridden by subclasses
   * @returns {Object} - Supported search options
   */
  getSupportedOptions() {
    return {
      query: { type: 'string', required: true },
      limit: { type: 'number', min: 1, max: 100, default: this.options.maxResults },
      page: { type: 'number', min: 1, default: 1 },
      sort: { type: 'object', default: this.options.defaultSort },
      filters: { type: 'object', default: {} },
    };
  }
}

module.exports = BaseSearchStrategy;
