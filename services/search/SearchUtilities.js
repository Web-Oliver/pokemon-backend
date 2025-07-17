const { ValidationError } = require('../../middleware/errorHandler');

/**
 * Search Utilities
 *
 * Shared utilities for search operations across all search strategies.
 * Provides common search functionality, query processing, and helper methods.
 *
 * Following DRY principles by centralizing common search logic.
 */
class SearchUtilities {
  /**
   * Normalizes search query for consistent processing
   * @param {string} query - Raw search query
   * @returns {string} - Normalized query
   */
  static normalizeQuery(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }

    return query
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s-]/g, '');
  }

  /**
   * Escapes special regex characters
   * @param {string} string - String to escape
   * @returns {string} - Escaped string
   */
  static escapeRegex(string) {
    if (!string || typeof string !== 'string') {
      return '';
    }

    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Creates fuzzy search patterns for MongoDB regex
   * @param {string} query - Search query
   * @param {Object} options - Pattern options
   * @returns {Array} - Array of regex patterns
   */
  static createFuzzyPatterns(query, options = {}) {
    const normalizedQuery = this.normalizeQuery(query);

    if (!normalizedQuery) {
      return [];
    }

    const patterns = [];
    const escapedQuery = this.escapeRegex(normalizedQuery);

    // Exact match (highest priority)
    patterns.push({
      pattern: new RegExp(`^${escapedQuery}$`, 'i'),
      weight: 100,
      type: 'exact',
    });

    // Starts with match
    patterns.push({
      pattern: new RegExp(`^${escapedQuery}`, 'i'),
      weight: 80,
      type: 'startsWith',
    });

    // Contains match
    patterns.push({
      pattern: new RegExp(escapedQuery, 'i'),
      weight: 60,
      type: 'contains',
    });

    // Word boundary match
    patterns.push({
      pattern: new RegExp(`\\b${escapedQuery}\\b`, 'i'),
      weight: 40,
      type: 'wordBoundary',
    });

    // Fuzzy match (if enabled and query is long enough)
    if (options.enableFuzzy !== false && normalizedQuery.length > 2) {
      const fuzzyPattern = normalizedQuery
        .split('')
        .map((char) => this.escapeRegex(char))
        .join('.*?');

      patterns.push({
        pattern: new RegExp(fuzzyPattern, 'i'),
        weight: 30,
        type: 'fuzzy',
      });
    }

    return patterns;
  }

  /**
   * Creates MongoDB regex patterns for flexible search
   * @param {string} query - Search query
   * @param {Object} options - Pattern options
   * @returns {Array} - Array of MongoDB regex objects
   */
  static createMongoRegexPatterns(query, options = {}) {
    const fuzzyPatterns = this.createFuzzyPatterns(query, options);

    return fuzzyPatterns.map((pattern) => pattern.pattern);
  }

  /**
   * Builds search conditions for MongoDB queries
   * @param {string} query - Search query
   * @param {Array} fields - Fields to search
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB search conditions
   */
  static buildSearchConditions(query, fields, options = {}) {
    if (!query || !fields || !Array.isArray(fields)) {
      return {};
    }

    const patterns = this.createMongoRegexPatterns(query, options);
    const conditions = [];

    fields.forEach((field) => {
      patterns.forEach((pattern) => {
        conditions.push({ [field]: pattern });
      });
    });

    return conditions.length > 0 ? { $or: conditions } : {};
  }

  /**
   * Creates scoring conditions for MongoDB aggregation
   * @param {string} query - Search query
   * @param {Object} fieldWeights - Field weight configuration
   * @param {Object} options - Scoring options
   * @returns {Array} - Array of scoring conditions
   */
  static buildScoringConditions(query, fieldWeights = {}, options = {}) {
    const normalizedQuery = this.normalizeQuery(query);

    if (!normalizedQuery) {
      return [];
    }

    const escapedQuery = this.escapeRegex(normalizedQuery);
    const conditions = [];

    // Score different match types for each field
    Object.entries(fieldWeights).forEach(([field, weight]) => {
      // Exact match
      conditions.push({
        $cond: {
          if: { $eq: [{ $toLower: `$${field}` }, normalizedQuery] },
          then: Number(weight),
          else: 0,
        },
      });

      // Starts with
      conditions.push({
        $cond: {
          if: {
            $regexMatch: {
              input: { $toLower: `$${field}` },
              regex: `^${escapedQuery}`,
            },
          },
          then: weight * 0.8,
          else: 0,
        },
      });

      // Contains
      conditions.push({
        $cond: {
          if: {
            $regexMatch: {
              input: { $toLower: `$${field}` },
              regex: escapedQuery,
            },
          },
          then: weight * 0.6,
          else: 0,
        },
      });

      // Word boundary
      conditions.push({
        $cond: {
          if: {
            $regexMatch: {
              input: { $toLower: `$${field}` },
              regex: `\\b${escapedQuery}\\b`,
            },
          },
          then: weight * 0.4,
          else: 0,
        },
      });
    });

    // Add length penalty (shorter matches are more relevant)
    if (options.enableLengthPenalty !== false) {
      const primaryField = options.primaryField || Object.keys(fieldWeights)[0];

      if (primaryField) {
        conditions.push({
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${primaryField}` },
                regex: escapedQuery,
              },
            },
            then: { $divide: [20, { $strLenCP: `$${primaryField}` }] },
            else: 0,
          },
        });
      }
    }

    return conditions;
  }

  /**
   * Creates multi-word scoring conditions
   * @param {string} query - Search query
   * @param {Object} fieldWeights - Field weight configuration
   * @returns {Array} - Array of multi-word scoring conditions
   */
  static buildMultiWordScoringConditions(query, fieldWeights = {}) {
    const normalizedQuery = this.normalizeQuery(query);
    const queryWords = normalizedQuery.split(' ').filter((word) => word.length > 0);

    if (queryWords.length <= 1) {
      return [];
    }

    const conditions = [];

    // Score each word with decreasing weight
    queryWords.forEach((word, index) => {
      const wordWeight = queryWords.length - index; // Earlier words have higher weight
      const escapedWord = this.escapeRegex(word);

      Object.entries(fieldWeights).forEach(([field, baseWeight]) => {
        // Word boundary match
        conditions.push({
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${field}` },
                regex: `\\b${escapedWord}\\b`,
              },
            },
            then: (baseWeight * wordWeight) / queryWords.length,
            else: 0,
          },
        });
      });
    });

    return conditions;
  }

  /**
   * Validates search input parameters
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @throws {ValidationError} - If validation fails
   */
  static validateSearchInput(query, options = {}) {
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

    if (options.minQueryLength && query.trim().length < options.minQueryLength) {
      throw new ValidationError(`Query must be at least ${options.minQueryLength} characters long`);
    }
  }

  /**
   * Builds pagination stages for MongoDB aggregation
   * @param {Object} options - Pagination options
   * @returns {Array} - Array of pagination stages
   */
  static buildPaginationStages(options = {}) {
    const stages = [];

    if (options.page && options.limit) {
      const skip = (options.page - 1) * options.limit;

      stages.push({ $skip: skip });
    }

    const limit = options.limit || 50;

    stages.push({ $limit: limit });

    return stages;
  }

  /**
   * Builds sort stage for MongoDB aggregation
   * @param {Object} options - Sort options
   * @returns {Object|null} - Sort stage or null
   */
  static buildSortStage(options = {}) {
    const sort = options.sort || { score: -1 };

    return sort ? { $sort: sort } : null;
  }

  /**
   * Processes search results with common formatting
   * @param {Array} results - Raw search results
   * @param {Object} options - Processing options
   * @returns {Array} - Processed search results
   */
  static processSearchResults(results, options = {}) {
    return results.map((result) => {
      // Convert Mongoose document to plain object
      const processed = result.toObject ? result.toObject() : result;

      // Remove internal fields
      if (options.removeInternalFields !== false) {
        delete processed.__v;
        delete processed.score;
      }

      // Add computed fields
      if (options.addComputedFields) {
        processed.searchRelevance = result.score || 0;
      }

      return processed;
    });
  }

  /**
   * Creates search suggestions format
   * @param {Array} results - Search results
   * @param {Object} config - Suggestion configuration
   * @returns {Array} - Formatted suggestions
   */
  static formatSearchSuggestions(results, config = {}) {
    const { textField = 'name', secondaryTextField = null, metadataFields = [], maxSuggestions = 10 } = config;

    return results.slice(0, maxSuggestions).map((result) => {
      const suggestion = {
        id: result._id,
        text: result[textField],
      };

      // Add secondary text if specified
      if (secondaryTextField && result[secondaryTextField]) {
        suggestion.secondaryText = result[secondaryTextField];
      }

      // Add metadata fields
      if (metadataFields.length > 0) {
        suggestion.metadata = {};
        metadataFields.forEach((field) => {
          if (result[field] !== undefined) {
            suggestion.metadata[field] = result[field];
          }
        });
      }

      return suggestion;
    });
  }

  /**
   * Debounces search operations to prevent excessive API calls
   * @param {Function} func - Function to debounce
   * @param {number} delay - Delay in milliseconds
   * @returns {Function} - Debounced function
   */
  static debounce(func, delay = 300) {
    let timeoutId;

    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttles search operations to limit execution frequency
   * @param {Function} func - Function to throttle
   * @param {number} limit - Time limit in milliseconds
   * @returns {Function} - Throttled function
   */
  static throttle(func, limit = 1000) {
    let inThrottle;

    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Calculates search relevance score
   * @param {string} query - Search query
   * @param {string} text - Text to score
   * @param {Object} options - Scoring options
   * @returns {number} - Relevance score (0-100)
   */
  static calculateRelevanceScore(query, text, options = {}) {
    if (!query || !text) {
      return 0;
    }

    const normalizedQuery = this.normalizeQuery(query);
    const normalizedText = this.normalizeQuery(text);

    let score = 0;

    // Exact match
    if (normalizedText === normalizedQuery) {
      score += 100;
    }

    // Starts with
    if (normalizedText.startsWith(normalizedQuery)) {
      score += 80;
    }

    // Contains
    if (normalizedText.includes(normalizedQuery)) {
      score += 60;
    }

    // Word boundary match
    const wordBoundaryRegex = new RegExp(`\\b${this.escapeRegex(normalizedQuery)}\\b`, 'i');

    if (wordBoundaryRegex.test(normalizedText)) {
      score += 40;
    }

    // Length penalty (shorter texts are more relevant)
    if (score > 0) {
      const lengthPenalty = Math.max(0, 100 - normalizedText.length);

      score += lengthPenalty / 10;
    }

    return Math.min(100, score);
  }

  /**
   * Highlights search terms in text
   * @param {string} text - Text to highlight
   * @param {string} query - Search query
   * @param {Object} options - Highlight options
   * @returns {string} - Highlighted text
   */
  static highlightSearchTerms(text, query, options = {}) {
    if (!text || !query) {
      return text;
    }

    const { highlightStart = '<mark>', highlightEnd = '</mark>', caseSensitive = false } = options;

    const normalizedQuery = this.normalizeQuery(query);
    const escapedQuery = this.escapeRegex(normalizedQuery);
    const flags = caseSensitive ? 'g' : 'gi';

    return text.replace(new RegExp(`(${escapedQuery})`, flags), `${highlightStart}$1${highlightEnd}`);
  }

  /**
   * Extracts search terms from query
   * @param {string} query - Search query
   * @param {Object} options - Extraction options
   * @returns {Array} - Array of search terms
   */
  static extractSearchTerms(query, options = {}) {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const {
      minLength = 2,
      stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'],
    } = options;

    const normalizedQuery = this.normalizeQuery(query);
    const words = normalizedQuery.split(' ').filter((word) => word.length >= minLength && !stopWords.includes(word));

    return [...new Set(words)]; // Remove duplicates
  }

  /**
   * Builds search cache key
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {string} - Cache key
   */
  static buildCacheKey(query, options = {}) {
    const normalizedQuery = this.normalizeQuery(query);
    const optionsString = JSON.stringify(options);

    return `search:${normalizedQuery}:${optionsString}`;
  }

  /**
   * Validates search options
   * @param {Object} options - Search options
   * @throws {ValidationError} - If validation fails
   */
  static validateSearchOptions(options = {}) {
    if (typeof options !== 'object' || options === null) {
      throw new ValidationError('Search options must be an object');
    }

    if (options.limit && (typeof options.limit !== 'number' || options.limit < 1 || options.limit > 100)) {
      throw new ValidationError('Limit must be a number between 1 and 100');
    }

    if (options.page && (typeof options.page !== 'number' || options.page < 1)) {
      throw new ValidationError('Page must be a number greater than 0');
    }

    if (options.sort && typeof options.sort !== 'object') {
      throw new ValidationError('Sort must be an object');
    }

    if (options.filters && typeof options.filters !== 'object') {
      throw new ValidationError('Filters must be an object');
    }
  }

  /**
   * Merges search options with defaults
   * @param {Object} options - User options
   * @param {Object} defaults - Default options
   * @returns {Object} - Merged options
   */
  static mergeSearchOptions(options = {}, defaults = {}) {
    return {
      ...defaults,
      ...options,
      filters: {
        ...defaults.filters,
        ...options.filters,
      },
    };
  }
}

module.exports = SearchUtilities;
