const Fuse = require('fuse.js');

/**
 * Fuse.js Search Adapter
 *
 * Adapter class that integrates Fuse.js fuzzy matching capabilities
 * with the existing search architecture. Provides configurable fuzzy
 * search functionality with advanced pattern matching, scoring, and
 * result ranking.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles only Fuse.js integration
 * - Open/Closed: Extensible configuration without modification
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 */
class FuseSearchAdapter {
  /**
   * Creates a new Fuse search adapter instance
   * @param {Object} options - Fuse.js configuration options
   */
  constructor(options = {}) {
    this.defaultOptions = {
      // Basic Configuration
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      threshold: 0.6, // 0.0 = perfect match, 1.0 = match anything
      distance: 100,

      // Advanced Configuration
      ignoreLocation: false,
      ignoreFieldNorm: false,
      fieldNormWeight: 1,

      // Extended Search
      useExtendedSearch: false,

      // Result Processing
      sortFn: (a, b) => a.score - b.score,

      // Default keys for different entity types
      keys: options.keys || [],
    };

    this.options = { ...this.defaultOptions, ...options };
    this.fuseInstance = null;
  }

  /**
   * Initializes Fuse.js with data and configuration
   * @param {Array} data - Data to search through
   * @param {Object} customOptions - Custom Fuse.js options
   * @returns {Fuse} - Configured Fuse.js instance
   */
  initialize(data, customOptions = {}) {
    const fuseOptions = { ...this.options, ...customOptions };

    this.fuseInstance = new Fuse(data, fuseOptions);
    return this.fuseInstance;
  }

  /**
   * Performs fuzzy search using Fuse.js
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} - Fuzzy search results
   */
  search(query, options = {}) {
    if (!this.fuseInstance) {
      throw new Error('FuseSearchAdapter must be initialized with data before searching');
    }

    if (!query || typeof query !== 'string') {
      return [];
    }

    // Apply query preprocessing
    const processedQuery = this.preprocessQuery(query, options);

    // Perform search
    const results = this.fuseInstance.search(processedQuery, {
      limit: options.limit || 100,
    });

    // Process and enhance results
    return this.processResults(results, query, options);
  }

  /**
   * Preprocesses search query for optimal fuzzy matching
   * @param {string} query - Original query
   * @param {Object} options - Search options
   * @returns {string} - Processed query
   */
  preprocessQuery(query, options = {}) {
    let processedQuery = query.trim();

    // Handle extended search patterns if enabled
    if (this.options.useExtendedSearch) {
      // Convert simple wildcards to Fuse.js format
      processedQuery = processedQuery.replace(/\*/g, '');

      // Handle exact match requests
      if (options.exactMatch) {
        processedQuery = `="${processedQuery}"`;
      }

      // Handle prefix matching
      if (options.prefixMatch) {
        processedQuery = `${processedQuery}$`;
      }

      // Handle suffix matching
      if (options.suffixMatch) {
        processedQuery = `^${processedQuery}`;
      }
    }

    return processedQuery;
  }

  /**
   * Processes and enhances Fuse.js search results
   * @param {Array} results - Raw Fuse.js results
   * @param {string} originalQuery - Original search query
   * @param {Object} options - Search options
   * @returns {Array} - Enhanced search results
   */
  processResults(results, originalQuery, options = {}) {
    return results.map((result, index) => {
      const { item } = result;
      const { score } = result;
      const matches = result.matches || [];

      // Calculate enhanced relevance score
      const relevanceScore = this.calculateRelevanceScore(item, originalQuery, score, matches);

      // Build match highlights
      const highlights = this.buildHighlights(matches, options.highlightTags);

      // Create enhanced result object
      const enhancedResult = {
        ...item,
        fuseScore: score,
        relevanceScore,
        searchRank: index + 1,
        matches: this.formatMatches(matches),
        highlights,
        searchMetadata: {
          query: originalQuery,
          matchedFields: matches.map((m) => m.key),
          confidence: this.calculateConfidence(score),
          searchType: 'fuzzy',
        },
      };

      return enhancedResult;
    });
  }

  /**
   * Calculates enhanced relevance score combining Fuse.js score with custom factors
   * @param {Object} item - Search result item
   * @param {string} query - Search query
   * @param {number} fuseScore - Fuse.js score
   * @param {Array} matches - Match details
   * @returns {number} - Enhanced relevance score
   */
  calculateRelevanceScore(item, query, fuseScore, matches) {
    let relevanceScore = 1 - fuseScore; // Convert Fuse.js score to relevance (higher = better)

    // Boost exact matches
    const hasExactMatch = matches.some((match) => match.value && match.value.toLowerCase() === query.toLowerCase());

    if (hasExactMatch) {
      relevanceScore *= 1.5;
    }

    // Boost prefix matches
    const hasPrefixMatch = matches.some(
      (match) => match.value && match.value.toLowerCase().startsWith(query.toLowerCase()),
    );

    if (hasPrefixMatch) {
      relevanceScore *= 1.3;
    }

    // Boost matches in important fields (if configured)
    const importantFieldBoost = matches.reduce((boost, match) => {
      const fieldWeight = this.getFieldWeight(match.key);

      return boost + (fieldWeight - 1) * 0.1;
    }, 0);

    relevanceScore *= 1 + importantFieldBoost;

    // Normalize score to 0-100 range
    return Math.min(100, Math.max(0, relevanceScore * 100));
  }

  /**
   * Gets field weight for scoring calculation
   * @param {string} fieldKey - Field key
   * @returns {number} - Field weight
   */
  getFieldWeight(fieldKey) {
    const fieldWeights = {
      name: 3,
      cardName: 3,
      setName: 2,
      baseName: 2,
      category: 1.5,
      variety: 1.2,
      pokemonNumber: 1.1,
    };

    return fieldWeights[fieldKey] || 1;
  }

  /**
   * Calculates confidence level based on Fuse.js score
   * @param {number} score - Fuse.js score
   * @returns {string} - Confidence level
   */
  calculateConfidence(score) {
    if (score <= 0.1) {
      return 'very-high';
    }
    if (score <= 0.3) {
      return 'high';
    }
    if (score <= 0.5) {
      return 'medium';
    }
    if (score <= 0.7) {
      return 'low';
    }
    return 'very-low';
  }

  /**
   * Builds highlight information for matched text
   * @param {Array} matches - Fuse.js matches
   * @param {Object} highlightTags - HTML tags for highlighting
   * @returns {Object} - Highlight information
   */
  buildHighlights(matches, highlightTags = { pre: '<mark>', post: '</mark>' }) {
    const highlights = {};

    matches.forEach((match) => {
      const field = match.key;
      const { value } = match;
      const indices = match.indices || [];

      if (value && indices.length > 0) {
        let highlighted = value;

        // Apply highlights in reverse order to maintain indices
        indices.reverse().forEach(([start, end]) => {
          highlighted =
            highlighted.substring(0, start) +
            highlightTags.pre +
            highlighted.substring(start, end + 1) +
            highlightTags.post +
            highlighted.substring(end + 1);
        });

        highlights[field] = highlighted;
      }
    });

    return highlights;
  }

  /**
   * Formats match information for API response
   * @param {Array} matches - Fuse.js matches
   * @returns {Array} - Formatted matches
   */
  formatMatches(matches) {
    return matches.map((match) => ({
      field: match.key,
      value: match.value,
      indices: match.indices || [],
      score: match.score || 0,
    }));
  }

  /**
   * Gets optimized configuration for different entity types
   * @param {string} entityType - Entity type (cards, products, sets)
   * @returns {Object} - Optimized Fuse.js configuration
   */
  static getOptimizedConfig(entityType) {
    const configs = {
      cards: {
        threshold: 0.4,
        distance: 200,
        keys: [
          { name: 'cardName', weight: 3 },
          { name: 'baseName', weight: 2.5 },
          { name: 'pokemonNumber', weight: 2 },
          { name: 'variety', weight: 1.5 },
          { name: 'setName', weight: 1.2 },
        ],
      },
      products: {
        threshold: 0.5,
        distance: 150,
        keys: [
          { name: 'name', weight: 3 },
          { name: 'setName', weight: 2 },
          { name: 'category', weight: 1.5 },
        ],
      },
      sets: {
        threshold: 0.3,
        distance: 100,
        keys: [
          { name: 'setName', weight: 3 },
          { name: 'year', weight: 1.5 },
        ],
      },
    };

    return configs[entityType] || configs.cards;
  }

  /**
   * Creates a pre-configured adapter for specific entity type
   * @param {string} entityType - Entity type
   * @param {Object} customOptions - Custom options
   * @returns {FuseSearchAdapter} - Configured adapter
   */
  static createFor(entityType, customOptions = {}) {
    const optimizedConfig = FuseSearchAdapter.getOptimizedConfig(entityType);

    return new FuseSearchAdapter({ ...optimizedConfig, ...customOptions });
  }

  /**
   * Updates the search data without recreating the adapter
   * @param {Array} newData - New data to search through
   * @param {Object} options - Update options
   */
  updateData(newData, options = {}) {
    if (options.preserveOptions !== false) {
      this.fuseInstance = new Fuse(newData, this.options);
    } else {
      this.initialize(newData, options);
    }
  }

  /**
   * Gets current configuration
   * @returns {Object} - Current Fuse.js options
   */
  getConfiguration() {
    return { ...this.options };
  }

  /**
   * Updates configuration
   * @param {Object} newOptions - New options to merge
   */
  updateConfiguration(newOptions) {
    this.options = { ...this.options, ...newOptions };

    // Reinitialize if instance exists
    if (this.fuseInstance) {
      const currentData = this.fuseInstance.getIndex().docs;

      this.initialize(currentData, this.options);
    }
  }

  /**
   * Gets search statistics
   * @returns {Object} - Search statistics
   */
  getStats() {
    return {
      hasInstance: Boolean(this.fuseInstance),
      configuration: this.getConfiguration(),
      dataSize: this.fuseInstance ? this.fuseInstance.getIndex().size : 0,
    };
  }
}

module.exports = FuseSearchAdapter;
