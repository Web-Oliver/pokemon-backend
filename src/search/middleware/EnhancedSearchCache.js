/**
 * EnhancedSearchCache - Advanced Search Result Caching
 *
 * Provides intelligent caching for search operations with:
 * - Multi-engine cache management (FlexSearch, FuseJS, MongoDB)
 * - Smart invalidation strategies based on data changes
 * - Compressed storage for large result sets
 * - Cache warming and preloading capabilities
 * - Performance analytics and cache hit rate tracking
 *
 * BEFORE: Basic in-memory cache with manual invalidation
 * AFTER: Intelligent multi-layer caching with automatic optimization
 */

import NodeCache from 'node-cache';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';
import Logger from '@/system/logging/Logger.js';
import OperationManager from '@/system/utilities/OperationManager.js';
import { ValidationError, AppError } from '@/system/errors/ErrorTypes.js';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class EnhancedSearchCache {
  constructor(options = {}) {
    const {
      // Cache configuration
      defaultTtl = 300, // 5 minutes
      checkPeriod = 60, // Check for expired keys every 60 seconds
      maxKeys = 10000,

      // Compression settings
      compressionThreshold = 1024, // Compress results > 1KB
      compressionLevel = 6,

      // Performance settings
      enableAnalytics = true,
      warmupQueries = []
    } = options;

    // Main cache instances
    this.searchCache = new NodeCache({
      stdTTL: defaultTtl,
      checkperiod: checkPeriod,
      maxKeys: Math.floor(maxKeys * 0.7) // 70% for search results
    });

    this.indexCache = new NodeCache({
      stdTTL: defaultTtl * 4, // Indexes live longer
      checkperiod: checkPeriod,
      maxKeys: Math.floor(maxKeys * 0.2) // 20% for indexes
    });

    this.metadataCache = new NodeCache({
      stdTTL: defaultTtl * 8, // Metadata lives longest
      checkperiod: checkPeriod,
      maxKeys: Math.floor(maxKeys * 0.1) // 10% for metadata
    });

    // Configuration
    this.compressionThreshold = compressionThreshold;
    this.compressionLevel = compressionLevel;
    this.enableAnalytics = enableAnalytics;

    // Analytics tracking
    this.analytics = {
      hits: 0,
      misses: 0,
      compressionSavings: 0,
      avgResponseTime: 0,
      queryPatterns: new Map()
    };

    // Cache invalidation tracking
    this.invalidationRules = new Map();
    this.entitySubscriptions = new Map();

    // Initialize event listeners
    this.setupEventListeners();

    // Warm up cache if queries provided
    if (warmupQueries.length > 0) {
      this.warmupCache(warmupQueries);
    }
  }

  /**
   * Setup cache event listeners for analytics and cleanup
   */
  setupEventListeners() {
    if (this.enableAnalytics) {
      // Track cache hits and misses
      this.searchCache.on('hit', (key) => {
        this.analytics.hits++;
        this.trackQueryPattern(key);
      });

      this.searchCache.on('miss', (key) => {
        this.analytics.misses++;
      });

      // Log cache statistics periodically
      setInterval(() => {
        this.logAnalytics();
      }, 300000); // Every 5 minutes
    }
  }

  /**
   * Generate cache key from search parameters
   * @param {Object} searchParams - Search parameters
   * @returns {string} Cache key
   */
  generateCacheKey(searchParams) {
    if (!searchParams || typeof searchParams !== 'object') {
      throw new ValidationError('Search parameters must be a valid object');
    }

    const {
      query,
      filters = {},
      options = {},
      searchType = 'unified',
      engine = 'auto'
    } = searchParams;

    try {
      const keyData = {
        query: query?.toLowerCase?.() || query,
        filters: this.normalizeFilters(filters),
        options: this.normalizeOptions(options),
        searchType,
        engine
      };

      const keyString = JSON.stringify(keyData, Object.keys(keyData).sort());
      return `search:${crypto.createHash('sha256').update(keyString).digest('hex').substring(0, 16)}`;
    } catch (error) {
      throw new AppError(`Failed to generate cache key: ${error.message}`, 500, { searchParams });
    }
  }

  /**
   * Get cached search results
   * @param {Object} searchParams - Search parameters
   * @returns {Promise<Object|null>} Cached results or null
   */
  async get(searchParams) {
    const context = OperationManager.createContext('EnhancedSearchCache', 'get', {
      searchType: searchParams.searchType
    });

    return OperationManager.executeOperation(context, async () => {
      const key = this.generateCacheKey(searchParams);
      const cached = this.searchCache.get(key);

      if (!cached) {
        return null;
      }

      // Decompress if needed
      if (cached.compressed) {
        const decompressed = await gunzip(Buffer.from(cached.data, 'base64'));
        cached.data = JSON.parse(decompressed.toString());
        cached.compressed = false;
      }

      // Update access metadata
      this.updateAccessMetadata(key);

      return {
        ...cached,
        cacheHit: true,
        cacheKey: key
      };
    }, { useStandardResponse: false });
  }

  /**
   * Store search results in cache
   * @param {Object} searchParams - Search parameters
   * @param {Object} results - Search results to cache
   * @param {Object} options - Cache options
   * @returns {Promise<boolean>} Success status
   */
  async set(searchParams, results, options = {}) {
    const context = OperationManager.createContext('EnhancedSearchCache', 'set', {
      searchType: searchParams.searchType,
      resultCount: results.results?.length || 0
    });

    return OperationManager.executeOperation(context, async () => {
      const key = this.generateCacheKey(searchParams);
      const { ttl, skipCompression = false } = options;

      const cacheData = {
        data: results,
        timestamp: Date.now(),
        searchParams,
        compressed: false,
        originalSize: JSON.stringify(results).length
      };

      // Compress large results
      if (!skipCompression && cacheData.originalSize > this.compressionThreshold) {
        const compressed = await gzip(JSON.stringify(results), {
          level: this.compressionLevel
        });

        cacheData.data = compressed.toString('base64');
        cacheData.compressed = true;
        cacheData.compressedSize = compressed.length;

        if (this.enableAnalytics) {
          this.analytics.compressionSavings += (cacheData.originalSize - cacheData.compressedSize);
        }
      }

      // Store in cache
      const success = this.searchCache.set(key, cacheData, ttl);

      // Register for invalidation if entity-specific
      this.registerForInvalidation(searchParams, key);

      return success;
    }, { useStandardResponse: false });
  }

  /**
   * Invalidate cache entries based on entity changes
   * @param {string} entityType - Entity type that changed
   * @param {Object} changeInfo - Information about the change
   * @returns {Promise<Object>} Invalidation results
   */
  async invalidateByEntity(entityType, changeInfo = {}) {
    const context = OperationManager.createContext('EnhancedSearchCache', 'invalidateByEntity', {
      entityType,
      changeType: changeInfo.changeType
    });

    return OperationManager.executeOperation(context, async () => {
      const invalidatedKeys = [];
      const rules = this.invalidationRules.get(entityType) || [];

      // Get all cache keys
      const allKeys = this.searchCache.keys();

      for (const key of allKeys) {
        const cached = this.searchCache.get(key);
        if (!cached) continue;

        let shouldInvalidate = false;

        // Check entity-specific rules
        for (const rule of rules) {
          if (rule(cached.searchParams, changeInfo)) {
            shouldInvalidate = true;
            break;
          }
        }

        // Generic invalidation for entity type
        if (!shouldInvalidate && cached.searchParams) {
          const { searchType, filters } = cached.searchParams;

          if (searchType === entityType ||
              searchType === 'unified' ||
              filters?.[entityType + 'Id'] ||
              filters?.entityType === entityType) {
            shouldInvalidate = true;
          }
        }

        if (shouldInvalidate) {
          this.searchCache.del(key);
          invalidatedKeys.push(key);
        }
      }

      return {
        invalidatedCount: invalidatedKeys.length,
        invalidatedKeys: invalidatedKeys.slice(0, 10), // Limit for logging
        entityType,
        changeInfo
      };
    }, { useStandardResponse: false });
  }

  /**
   * Warm up cache with common queries
   * @param {Array} warmupQueries - Queries to pre-cache
   * @returns {Promise<Object>} Warmup results
   */
  async warmupCache(warmupQueries) {
    const context = OperationManager.createContext('EnhancedSearchCache', 'warmupCache', {
      queryCount: warmupQueries.length
    });

    return OperationManager.executeOperation(context, async () => {
      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };

      for (const queryConfig of warmupQueries) {
        try {
          const { searchParams, mockResults, ttl = 600 } = queryConfig;

          if (mockResults) {
            await this.set(searchParams, mockResults, { ttl });
            results.successful++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            query: queryConfig.searchParams?.query,
            error: error.message
          });
        }
      }

      return results;
    }, { useStandardResponse: false });
  }

  /**
   * Get cache analytics and performance metrics
   * @returns {Object} Cache analytics
   */
  getAnalytics() {
    const totalRequests = this.analytics.hits + this.analytics.misses;
    const hitRate = totalRequests > 0 ? (this.analytics.hits / totalRequests * 100).toFixed(2) : 0;

    return {
      performance: {
        hitRate: `${hitRate}%`,
        totalHits: this.analytics.hits,
        totalMisses: this.analytics.misses,
        totalRequests,
        avgResponseTime: `${this.analytics.avgResponseTime}ms`
      },
      storage: {
        searchCacheKeys: this.searchCache.keys().length,
        indexCacheKeys: this.indexCache.keys().length,
        metadataCacheKeys: this.metadataCache.keys().length,
        compressionSavingsKB: Math.round(this.analytics.compressionSavings / 1024)
      },
      patterns: {
        topQueries: Array.from(this.analytics.queryPatterns.entries())
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([pattern, count]) => ({ pattern, count }))
      }
    };
  }

  /**
   * Clear all caches
   * @returns {Object} Clear results
   */
  clearAll() {
    const beforeStats = {
      searchKeys: this.searchCache.keys().length,
      indexKeys: this.indexCache.keys().length,
      metadataKeys: this.metadataCache.keys().length
    };

    this.searchCache.flushAll();
    this.indexCache.flushAll();
    this.metadataCache.flushAll();

    // Reset analytics
    this.analytics = {
      hits: 0,
      misses: 0,
      compressionSavings: 0,
      avgResponseTime: 0,
      queryPatterns: new Map()
    };

    return {
      cleared: beforeStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Register invalidation rule for entity type
   * @param {string} entityType - Entity type
   * @param {Function} rule - Invalidation rule function
   */
  addInvalidationRule(entityType, rule) {
    if (!this.invalidationRules.has(entityType)) {
      this.invalidationRules.set(entityType, []);
    }
    this.invalidationRules.get(entityType).push(rule);
  }

  /**
   * Normalize filters for consistent cache keys
   * @param {Object} filters - Filters object
   * @returns {Object} Normalized filters
   */
  normalizeFilters(filters) {
    const normalized = {};

    Object.keys(filters).sort().forEach(key => {
      const value = filters[key];
      if (value !== undefined && value !== null && value !== '') {
        normalized[key] = Array.isArray(value) ? value.sort() : value;
      }
    });

    return normalized;
  }

  /**
   * Normalize options for consistent cache keys
   * @param {Object} options - Options object
   * @returns {Object} Normalized options
   */
  normalizeOptions(options) {
    const {
      limit = 50,
      page = 1,
      sort = {},
      includeMetadata = true
    } = options;

    return {
      limit,
      page,
      sort,
      includeMetadata
    };
  }

  /**
   * Track query patterns for analytics
   * @param {string} key - Cache key
   */
  trackQueryPattern(key) {
    const pattern = key.substring(0, 20); // Track pattern prefix
    const current = this.analytics.queryPatterns.get(pattern) || 0;
    this.analytics.queryPatterns.set(pattern, current + 1);
  }

  /**
   * Update access metadata for cache entry
   * @param {string} key - Cache key
   */
  updateAccessMetadata(key) {
    const cached = this.searchCache.get(key);
    if (cached) {
      cached.lastAccess = Date.now();
      cached.accessCount = (cached.accessCount || 0) + 1;
      this.searchCache.set(key, cached, this.searchCache.getTtl(key));
    }
  }

  /**
   * Register cache entry for entity-based invalidation
   * @param {Object} searchParams - Search parameters
   * @param {string} key - Cache key
   */
  registerForInvalidation(searchParams, key) {
    const { searchType } = searchParams;
    if (searchType && searchType !== 'unified') {
      if (!this.entitySubscriptions.has(searchType)) {
        this.entitySubscriptions.set(searchType, new Set());
      }
      this.entitySubscriptions.get(searchType).add(key);
    }
  }

  /**
   * Log cache analytics periodically
   */
  logAnalytics() {
    const analytics = this.getAnalytics();
    Logger.info('EnhancedSearchCache', 'Cache Analytics', analytics);
  }
}

export default EnhancedSearchCache;