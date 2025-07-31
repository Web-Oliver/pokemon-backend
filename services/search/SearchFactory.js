const { ValidationError } = require('../../middleware/errorHandler');
const Logger = require('../../utils/Logger');
const { EnhancedSearchCache } = require('../../middleware/enhancedSearchCache');
const { getEntityConfig, getSearchConfig } = require('../../config/entityConfigurations');

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
    Logger.operationStart('SEARCH_FACTORY', 'INITIALIZE', { options: Object.keys(options) });

    this.container = container;
    this.options = {
      enableCaching: options.enableCaching !== false,
      defaultMaxResults: options.defaultMaxResults || 50,
      enableFuzzySearch: options.enableFuzzySearch !== false,
      enableScoring: options.enableScoring !== false,
      enablePerformanceTracking: options.enablePerformanceTracking !== false,
      cacheOptions: {
        ttl: options.cacheTtl || 300000, // 5 minutes default
        maxSize: options.cacheMaxSize || 1000,
        enableWarmup: options.enableCacheWarmup !== false,
        ...options.cacheOptions
      },
      ...options,
    };

    // Strategy registry
    this.strategies = new Map();

    // Initialize enhanced caching if enabled
    if (this.options.enableCaching) {
      try {
        this.enhancedCache = new EnhancedSearchCache(this.options.cacheOptions);
        Logger.service('SearchFactory', 'constructor', 
          'Enhanced caching initialized', { cacheOptions: this.options.cacheOptions });
      } catch (error) {
        Logger.operationError('SEARCH_FACTORY', 'INITIALIZE_CACHE', error);
        // Fallback to basic caching
        this.cache = new Map();
        Logger.service('SearchFactory', 'constructor', 
          'Fallback to basic caching', { error: error.message });
      }
    }

    // Initialize strategy registry
    this.initializeStrategies();

    Logger.operationSuccess('SEARCH_FACTORY', 'INITIALIZE', { 
      strategiesCount: this.strategies.size,
      cachingEnabled: this.options.enableCaching 
    });
  }

  /**
   * Initializes the strategy registry with available search strategies
   */
  initializeStrategies() {
    Logger.service('SearchFactory', 'initializeStrategies', 'Initializing search strategies');

    // Get search configurations from entity configurations
    const cardSearchConfig = getSearchConfig('card') || {};
    const productSearchConfig = getSearchConfig('sealedProduct') || {};
    const setSearchConfig = getSearchConfig('set') || {};

    // Register card search strategy with entity configuration
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
        searchFields: cardSearchConfig.searchFields || ['cardName', 'setName'],
        searchWeights: cardSearchConfig.searchWeights || { cardName: 3, setName: 2 },
        ...cardSearchConfig,
      },
    });

    // Register product search strategy with entity configuration
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
        searchFields: productSearchConfig.searchFields || ['name', 'setName', 'category'],
        searchWeights: productSearchConfig.searchWeights || { name: 3, setName: 2, category: 1 },
        ...productSearchConfig,
      },
    });

    // Register set search strategy with entity configuration
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
        searchFields: setSearchConfig.searchFields || ['setName'],
        searchWeights: setSearchConfig.searchWeights || { setName: 3 },
        ...setSearchConfig,
      },
    });

    Logger.service('SearchFactory', 'initializeStrategies', 
      'Strategies initialized', { 
        strategies: Array.from(this.strategies.keys()),
        withEntityConfig: true 
      });
  }

  /**
   * Creates a search strategy instance
   * @param {string} type - Search type identifier
   * @param {Object} options - Strategy configuration options
   * @returns {BaseSearchStrategy} - Search strategy instance
   */
  createStrategy(type, options = {}) {
    const startTime = Date.now();

    Logger.operationStart('SEARCH_FACTORY', 'CREATE_STRATEGY', { type, options: Object.keys(options) });

    try {
      // Validate search type
      if (!type || typeof type !== 'string') {
        const error = new ValidationError('Search type must be a non-empty string');

        Logger.operationError('SEARCH_FACTORY', 'CREATE_STRATEGY', error, { type });
        throw error;
      }

      // Get strategy configuration
      const strategyConfig = this.strategies.get(type.toLowerCase());

      if (!strategyConfig) {
        const error = new ValidationError(`Unknown search type: ${type}`);

        Logger.operationError('SEARCH_FACTORY', 'CREATE_STRATEGY', error, { 
          type, 
          availableTypes: Array.from(this.strategies.keys()) 
        });
        throw error;
      }

      Logger.service('SearchFactory', 'createStrategy', 
        'Strategy configuration found', { type, dependencies: strategyConfig.dependencies });

      // Resolve dependencies
      const dependencies = this.resolveDependencies(strategyConfig.dependencies);

      // Merge options with entity configuration and performance tracking
      const mergedOptions = {
        ...strategyConfig.options,
        ...options,
        enablePerformanceTracking: this.options.enablePerformanceTracking,
      };

      // Create strategy instance
      const StrategyClass = strategyConfig.strategyClass;
      const strategy = new StrategyClass(...dependencies, mergedOptions);

      if (this.options.enablePerformanceTracking) {
        Logger.performance('SearchFactory.createStrategy', Date.now() - startTime, { 
          type, 
          optionsCount: Object.keys(mergedOptions).length 
        });
      }

      Logger.operationSuccess('SEARCH_FACTORY', 'CREATE_STRATEGY', { 
        type, 
        strategyClass: StrategyClass.name,
        duration: Date.now() - startTime 
      });

      return strategy;
    } catch (error) {
      Logger.operationError('SEARCH_FACTORY', 'CREATE_STRATEGY', error, { type, options });
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
    Logger.operationStart('SEARCH_FACTORY', 'CREATE_STRATEGIES', { types, optionsCount: Object.keys(options).length });
    
    const strategies = new Map();
    const errors = [];

    types.forEach((type) => {
      try {
        strategies.set(type, this.createStrategy(type, options));
        Logger.service('SearchFactory', 'createStrategies', 
          'Strategy created successfully', { type });
      } catch (error) {
        Logger.operationError('SEARCH_FACTORY', 'CREATE_STRATEGY_BATCH', error, { type });
        errors.push({ type, error: error.message });
      }
    });

    Logger.operationSuccess('SEARCH_FACTORY', 'CREATE_STRATEGIES', { 
      successCount: strategies.size,
      errorCount: errors.length,
      types: Array.from(strategies.keys()) 
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
    const startTime = Date.now();
    const cacheKey = this.buildCacheKey(type, options);

    Logger.service('SearchFactory', 'getStrategy', 
      'Retrieving strategy', { type, cacheKey, cacheEnabled: this.options.enableCaching });

    // Check enhanced cache first
    if (this.options.enableCaching && this.enhancedCache) {
      const cachedStrategy = this.enhancedCache.get(cacheKey);

      if (cachedStrategy) {
        Logger.cache('GET', cacheKey, { hit: true, type });
        if (this.options.enablePerformanceTracking) {
          Logger.performance('SearchFactory.getStrategy.cache_hit', Date.now() - startTime, { type });
        }
        return cachedStrategy;
      }
      Logger.cache('GET', cacheKey, { hit: false, type });
    }
    // Fallback to basic cache
    else if (this.options.enableCaching && this.cache && this.cache.has(cacheKey)) {
      Logger.cache('GET', cacheKey, { hit: true, type, cacheType: 'basic' });
      return this.cache.get(cacheKey);
    }

    // Create new strategy
    const strategy = this.createStrategy(type, options);

    // Cache if enabled
    if (this.options.enableCaching) {
      if (this.enhancedCache) {
        this.enhancedCache.set(cacheKey, strategy);
        Logger.cache('SET', cacheKey, { type, cacheType: 'enhanced' });
      } else {
        if (!this.cache) {
          this.cache = new Map();
        }
        this.cache.set(cacheKey, strategy);
        Logger.cache('SET', cacheKey, { type, cacheType: 'basic' });
      }
    }

    if (this.options.enablePerformanceTracking) {
      Logger.performance('SearchFactory.getStrategy.cache_miss', Date.now() - startTime, { type });
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
    const startTime = Date.now();

    Logger.operationStart('SEARCH_FACTORY', 'SEARCH_MULTIPLE', { 
      query: query.substring(0, 50) + (query.length > 50 ? '...' : ''), 
      types, 
      optionsCount: Object.keys(options).length 
    });

    try {
      const results = {};
      const limit = Math.floor((options.limit || 50) / types.length);

      Logger.service('SearchFactory', 'searchMultiple', 
        'Starting parallel search execution', { 
          types, 
          limitPerType: limit,
          totalLimit: options.limit || 50 
        });

      // Create search promises for each type
      const searchPromises = types.map(async (type) => {
        const typeStartTime = Date.now();

        try {
          const strategy = this.getStrategy(type, options);
          const typeResults = await strategy.search(query, {
            ...options,
            limit,
          });

          if (this.options.enablePerformanceTracking) {
            Logger.performance(`SearchFactory.searchMultiple.${type}`, Date.now() - typeStartTime, { 
              query: query.substring(0, 30),
              resultCount: typeResults.length 
            });
          }

          Logger.service('SearchFactory', 'searchMultiple', 
            'Type search completed', { type, resultCount: typeResults.length });

          return {
            type,
            results: typeResults,
            count: typeResults.length,
            success: true,
            duration: Date.now() - typeStartTime,
          };
        } catch (error) {
          Logger.operationError('SEARCH_FACTORY', 'SEARCH_TYPE', error, { type, query });
          return {
            type,
            results: [],
            count: 0,
            success: false,
            error: error.message,
            duration: Date.now() - typeStartTime,
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
          duration: result.duration,
          ...(result.error && { error: result.error }),
        };
      });

      const totalResults = searchResults.reduce((sum, result) => sum + result.count, 0);
      const successfulTypes = searchResults.filter(r => r.success).length;

      if (this.options.enablePerformanceTracking) {
        Logger.performance('SearchFactory.searchMultiple.total', Date.now() - startTime, { 
          query: query.substring(0, 30),
          types: types.length,
          totalResults,
          successfulTypes 
        });
      }

      Logger.operationSuccess('SEARCH_FACTORY', 'SEARCH_MULTIPLE', { 
        totalResults,
        successfulTypes,
        failedTypes: types.length - successfulTypes,
        duration: Date.now() - startTime 
      });

      return results;
    } catch (error) {
      Logger.operationError('SEARCH_FACTORY', 'SEARCH_MULTIPLE', error, { query, types, options });
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
    const startTime = Date.now();

    Logger.operationStart('SEARCH_FACTORY', 'SUGGEST_MULTIPLE', { 
      query: query.substring(0, 50) + (query.length > 50 ? '...' : ''), 
      types, 
      optionsCount: Object.keys(options).length 
    });

    try {
      const results = {};
      const limit = Math.floor((options.limit || 20) / types.length);

      Logger.service('SearchFactory', 'suggestMultiple', 
        'Starting parallel suggestion execution', { 
          types, 
          limitPerType: limit,
          totalLimit: options.limit || 20 
        });

      // Create suggestion promises for each type
      const suggestionPromises = types.map(async (type) => {
        const typeStartTime = Date.now();

        try {
          const strategy = this.getStrategy(type, options);
          const suggestions = await strategy.suggest(query, {
            ...options,
            limit,
          });

          if (this.options.enablePerformanceTracking) {
            Logger.performance(`SearchFactory.suggestMultiple.${type}`, Date.now() - typeStartTime, { 
              query: query.substring(0, 30),
              suggestionCount: suggestions.length 
            });
          }

          Logger.service('SearchFactory', 'suggestMultiple', 
            'Type suggestions completed', { type, suggestionCount: suggestions.length });

          return {
            type,
            suggestions,
            count: suggestions.length,
            success: true,
            duration: Date.now() - typeStartTime,
          };
        } catch (error) {
          Logger.operationError('SEARCH_FACTORY', 'SUGGEST_TYPE', error, { type, query });
          return {
            type,
            suggestions: [],
            count: 0,
            success: false,
            error: error.message,
            duration: Date.now() - typeStartTime,
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
          duration: result.duration,
          ...(result.error && { error: result.error }),
        };
      });

      const totalSuggestions = suggestionResults.reduce((sum, result) => sum + result.count, 0);
      const successfulTypes = suggestionResults.filter(r => r.success).length;

      if (this.options.enablePerformanceTracking) {
        Logger.performance('SearchFactory.suggestMultiple.total', Date.now() - startTime, { 
          query: query.substring(0, 30),
          types: types.length,
          totalSuggestions,
          successfulTypes 
        });
      }

      Logger.operationSuccess('SEARCH_FACTORY', 'SUGGEST_MULTIPLE', { 
        totalSuggestions,
        successfulTypes,
        failedTypes: types.length - successfulTypes,
        duration: Date.now() - startTime 
      });

      return results;
    } catch (error) {
      Logger.operationError('SEARCH_FACTORY', 'SUGGEST_MULTIPLE', error, { query, types, options });
      throw error;
    }
  }
}

module.exports = SearchFactory;
