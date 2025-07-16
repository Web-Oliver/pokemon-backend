const { ValidationError } = require('../../middleware/errorHandler');

// Strategy imports
const CardSearchStrategy = require('./strategies/CardSearchStrategy');
const ProductSearchStrategy = require('./strategies/ProductSearchStrategy');
const SetSearchStrategy = require('./strategies/SetSearchStrategy');

/**
 * Search Factory
 *
 * Factory pattern implementation for creating search strategies.
 * Provides centralized strategy resolution and configuration management.
 *
 * Following SOLID principles:
 * - Single Responsibility: Creates and configures search strategies
 * - Open/Closed: Open for extension (new strategies), closed for modification
 * - Dependency Inversion: Depends on abstractions (strategy interfaces)
 * - Factory Pattern: Encapsulates object creation logic
 */
class SearchFactory {
  /**
   * Creates a new search factory instance
   * @param {Object} container - Dependency injection container
   * @param {Object} options - Factory configuration options
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      enableCaching: options.enableCaching !== false,
      defaultMaxResults: options.defaultMaxResults || 50,
      enableFuzzySearch: options.enableFuzzySearch !== false,
      enableScoring: options.enableScoring !== false,
      ...options,
    };

    // Strategy registry
    this.strategies = new Map();

    // Initialize strategy registry
    this.initializeStrategies();
  }

  /**
   * Initializes the strategy registry with available search strategies
   */
  initializeStrategies() {
    // Register card search strategy
    this.strategies.set('cards', {
      strategyClass: CardSearchStrategy,
      dependencies: ['cardRepository', 'setRepository'],
      options: {
        maxResults: this.options.defaultMaxResults,
        enableFuzzySearch: this.options.enableFuzzySearch,
        enableScoring: this.options.enableScoring,
        enableSetContext: true,
        enablePopularityScoring: true,
        minQueryLength: 1,
      },
    });

    // Register product search strategy
    this.strategies.set('products', {
      strategyClass: ProductSearchStrategy,
      dependencies: ['cardMarketReferenceProductRepository'],
      options: {
        maxResults: this.options.defaultMaxResults,
        enableFuzzySearch: this.options.enableFuzzySearch,
        enableScoring: this.options.enableScoring,
        enablePriceScoring: true,
        enableAvailabilityScoring: true,
        enableCategoryFiltering: true,
        minQueryLength: 2,
      },
    });

    // Register set search strategy
    this.strategies.set('sets', {
      strategyClass: SetSearchStrategy,
      dependencies: ['setRepository', 'cardRepository'],
      options: {
        maxResults: 30,
        enableFuzzySearch: this.options.enableFuzzySearch,
        enableScoring: this.options.enableScoring,
        enableYearFiltering: true,
        enableCardCountMetrics: true,
        enablePsaPopulationMetrics: true,
        minQueryLength: 1,
      },
    });
  }

  /**
   * Creates a search strategy instance
   * @param {string} type - Search type identifier
   * @param {Object} options - Strategy configuration options
   * @returns {BaseSearchStrategy} - Search strategy instance
   */
  createStrategy(type, options = {}) {
    try {
      // Validate search type
      if (!type || typeof type !== 'string') {
        throw new ValidationError('Search type must be a non-empty string');
      }

      // Get strategy configuration
      const strategyConfig = this.strategies.get(type.toLowerCase());

      if (!strategyConfig) {
        throw new ValidationError(`Unknown search type: ${type}`);
      }

      // Resolve dependencies
      const dependencies = this.resolveDependencies(strategyConfig.dependencies);

      // Merge options
      const mergedOptions = {
        ...strategyConfig.options,
        ...options,
      };

      // Create strategy instance
      const StrategyClass = strategyConfig.strategyClass;
      const strategy = new StrategyClass(...dependencies, mergedOptions);

      return strategy;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Creates multiple search strategies
   * @param {Array} types - Array of search type identifiers
   * @param {Object} options - Strategy configuration options
   * @returns {Map} - Map of type to strategy instance
   */
  createStrategies(types, options = {}) {
    const strategies = new Map();

    types.forEach((type) => {
      try {
        strategies.set(type, this.createStrategy(type, options));
      } catch (error) {
        console.warn(`Failed to create strategy for type '${type}':`, error.message);
      }
    });

    return strategies;
  }

  /**
   * Gets a cached strategy instance (if caching is enabled)
   * @param {string} type - Search type identifier
   * @param {Object} options - Strategy configuration options
   * @returns {BaseSearchStrategy} - Search strategy instance
   */
  getStrategy(type, options = {}) {
    const cacheKey = this.buildCacheKey(type, options);

    // Check cache if enabled
    if (this.options.enableCaching && this.cache && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Create new strategy
    const strategy = this.createStrategy(type, options);

    // Cache if enabled
    if (this.options.enableCaching) {
      if (!this.cache) {
        this.cache = new Map();
      }
      this.cache.set(cacheKey, strategy);
    }

    return strategy;
  }

  /**
   * Registers a new search strategy
   * @param {string} type - Search type identifier
   * @param {Object} config - Strategy configuration
   */
  registerStrategy(type, config) {
    // Validate strategy configuration
    this.validateStrategyConfig(config);

    // Register strategy
    this.strategies.set(type.toLowerCase(), config);
  }

  /**
   * Unregisters a search strategy
   * @param {string} type - Search type identifier
   */
  unregisterStrategy(type) {
    this.strategies.delete(type.toLowerCase());

    // Clear cache if enabled
    if (this.options.enableCaching && this.cache) {
      // Remove cached strategies for this type
      const keysToDelete = [];

      for (const [key] of this.cache) {
        if (key.startsWith(`${type}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.cache.delete(key));
    }
  }

  /**
   * Gets all registered search types
   * @returns {Array} - Array of registered search types
   */
  getRegisteredTypes() {
    return Array.from(this.strategies.keys());
  }

  /**
   * Gets strategy configuration for a type
   * @param {string} type - Search type identifier
   * @returns {Object} - Strategy configuration
   */
  getStrategyConfig(type) {
    return this.strategies.get(type.toLowerCase()) || null;
  }

  /**
   * Checks if a search type is supported
   * @param {string} type - Search type identifier
   * @returns {boolean} - True if supported
   */
  isTypeSupported(type) {
    return this.strategies.has(type.toLowerCase());
  }

  /**
   * Gets supported search options for a type
   * @param {string} type - Search type identifier
   * @returns {Object} - Supported search options
   */
  getSupportedOptions(type) {
    const strategy = this.createStrategy(type);

    return strategy.getSupportedOptions();
  }

  /**
   * Validates search input for a specific type
   * @param {string} type - Search type identifier
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @throws {ValidationError} - If validation fails
   */
  validateSearchInput(type, query, options = {}) {
    const strategy = this.createStrategy(type);

    strategy.validateSearchInput(query, options);
  }

  /**
   * Resolves dependencies from the container
   * @param {Array} dependencies - Array of dependency names
   * @returns {Array} - Array of resolved dependencies
   */
  resolveDependencies(dependencies) {
    return dependencies.map((dep) => {
      const resolved = this.container.resolve(dep);

      if (!resolved) {
        throw new Error(`Failed to resolve dependency: ${dep}`);
      }
      return resolved;
    });
  }

  /**
   * Validates strategy configuration
   * @param {Object} config - Strategy configuration
   * @throws {ValidationError} - If validation fails
   */
  validateStrategyConfig(config) {
    if (!config || typeof config !== 'object') {
      throw new ValidationError('Strategy configuration must be an object');
    }

    if (!config.strategyClass || typeof config.strategyClass !== 'function') {
      throw new ValidationError('Strategy configuration must include a strategyClass');
    }

    if (!config.dependencies || !Array.isArray(config.dependencies)) {
      throw new ValidationError('Strategy configuration must include dependencies array');
    }

    if (!config.options || typeof config.options !== 'object') {
      throw new ValidationError('Strategy configuration must include options object');
    }
  }

  /**
   * Builds cache key for strategy instance
   * @param {string} type - Search type identifier
   * @param {Object} options - Strategy configuration options
   * @returns {string} - Cache key
   */
  buildCacheKey(type, options) {
    const optionsHash = JSON.stringify(options);

    return `${type}:${optionsHash}`;
  }

  /**
   * Clears the strategy cache
   */
  clearCache() {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Gets cache statistics
   * @returns {Object} - Cache statistics
   */
  getCacheStats() {
    if (!this.options.enableCaching || !this.cache) {
      return { enabled: false };
    }

    return {
      enabled: true,
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Performs a unified search across multiple types
   * @param {string} query - Search query
   * @param {Array} types - Array of search types
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results grouped by type
   */
  async searchMultiple(query, types, options = {}) {
    try {
      const results = {};
      const limit = Math.floor((options.limit || 50) / types.length);

      // Create search promises for each type
      const searchPromises = types.map(async (type) => {
        try {
          const strategy = this.getStrategy(type, options);
          const typeResults = await strategy.search(query, {
            ...options,
            limit,
          });

          return {
            type,
            results: typeResults,
            count: typeResults.length,
            success: true,
          };
        } catch (error) {
          console.warn(`Search failed for type '${type}':`, error.message);
          return {
            type,
            results: [],
            count: 0,
            success: false,
            error: error.message,
          };
        }
      });

      // Execute all searches in parallel
      const searchResults = await Promise.all(searchPromises);

      // Group results by type
      searchResults.forEach((result) => {
        results[result.type] = {
          data: result.results,
          count: result.count,
          success: result.success,
          ...(result.error && { error: result.error }),
        };
      });

      return results;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Provides suggestions across multiple types
   * @param {string} query - Search query
   * @param {Array} types - Array of search types
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Suggestions grouped by type
   */
  async suggestMultiple(query, types, options = {}) {
    try {
      const results = {};
      const limit = Math.floor((options.limit || 20) / types.length);

      // Create suggestion promises for each type
      const suggestionPromises = types.map(async (type) => {
        try {
          const strategy = this.getStrategy(type, options);
          const suggestions = await strategy.suggest(query, {
            ...options,
            limit,
          });

          return {
            type,
            suggestions,
            count: suggestions.length,
            success: true,
          };
        } catch (error) {
          console.warn(`Suggestions failed for type '${type}':`, error.message);
          return {
            type,
            suggestions: [],
            count: 0,
            success: false,
            error: error.message,
          };
        }
      });

      // Execute all suggestions in parallel
      const suggestionResults = await Promise.all(suggestionPromises);

      // Group results by type
      suggestionResults.forEach((result) => {
        results[result.type] = {
          data: result.suggestions,
          count: result.count,
          success: result.success,
          ...(result.error && { error: result.error }),
        };
      });

      return results;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = SearchFactory;
