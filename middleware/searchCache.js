const NodeCache = require('node-cache');

/**
 * Search Cache Class
 * 
 * Provides advanced caching capabilities specifically designed for search operations.
 * Features TTL-based expiration, pattern-based invalidation, and performance metrics.
 * 
 * This class is designed to work with search services and provide caching
 * caching capabilities for search results and strategy instances.
 */
class SearchCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.options = {
      ttl: options.ttl || 300000, // 5 minutes default
      maxSize: options.maxSize || 1000,
      enableWarmup: options.enableWarmup !== false,
      enableInvalidation: options.enableInvalidation !== false,
      enableMetrics: options.enableMetrics !== false,
      ...options
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      invalidations: 0,
      evictions: 0
    };

    // Automatic cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  /**
   * Store a value in the cache with TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} customTtl - Custom TTL in milliseconds (optional)
   */
  set(key, value, customTtl) {
    const ttl = customTtl || this.options.ttl;
    const expireAt = Date.now() + ttl;

    // Check if cache is at max size and evict oldest entries if needed
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      expireAt,
      createdAt: Date.now(),
      accessCount: 0
    });

    if (this.options.enableMetrics) {
      this.metrics.sets++;
    }
  }

  /**
   * Retrieve a value from the cache
   * @param {string} key - Cache key
   * @returns {any} - Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.options.enableMetrics) {
        this.metrics.misses++;
      }
      return null;
    }

    // Check if entry has expired
    if (Date.now() > entry.expireAt) {
      this.cache.delete(key);
      if (this.options.enableMetrics) {
        this.metrics.misses++;
      }
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    if (this.options.enableMetrics) {
      this.metrics.hits++;
    }

    return entry.value;
  }

  /**
   * Delete a specific key from the cache
   * @param {string} key - Cache key to delete
   * @returns {boolean} - True if key was deleted
   */
  delete(key) {
    const deleted = this.cache.delete(key);

    if (deleted && this.options.enableMetrics) {
      this.metrics.deletes++;
    }
    return deleted;
  }

  /**
   * Clear all entries from the cache
   */
  clear() {
    const {size} = this.cache;

    this.cache.clear();
    if (this.options.enableMetrics) {
      this.metrics.deletes += size;
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache performance metrics
   */
  getStats() {
    return {
      ...this.metrics,
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: this.metrics.hits + this.metrics.misses > 0 
        ? this.metrics.hits / (this.metrics.hits + this.metrics.misses) 
        : 0,
      memoryUsage: this.getMemoryUsage()
    };
  }

  /**
   * Invalidate cache entries matching a pattern
   * @param {string|RegExp} pattern - Pattern to match against cache keys
   * @returns {number} - Number of invalidated entries
   */
  invalidatePattern(pattern) {
    if (!this.options.enableInvalidation) {
      return 0;
    }

    let invalidatedCount = 0;
    const keysToDelete = [];

    for (const [key] of this.cache) {
      let matches = false;
      
      if (typeof pattern === 'string') {
        matches = key.includes(pattern);
      } else if (pattern instanceof RegExp) {
        matches = pattern.test(key);
      }

      if (matches) {
        keysToDelete.push(key);
        invalidatedCount++;
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    if (this.options.enableMetrics) {
      this.metrics.invalidations += invalidatedCount;
    }

    return invalidatedCount;
  }

  /**
   * Remove expired entries from the cache
   * @returns {number} - Number of cleaned entries
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    const keysToDelete = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expireAt) {
        keysToDelete.push(key);
        cleanedCount++;
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    return cleanedCount;
  }

  /**
   * Evict the oldest entries when cache is full
   * @param {number} count - Number of entries to evict (default: 10% of max size)
   */
  evictOldest(count) {
    const evictCount = count || Math.ceil(this.options.maxSize * 0.1);
    
    // Convert to array and sort by creation time
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    for (let i = 0; i < Math.min(evictCount, entries.length); i++) {
      this.cache.delete(entries[i][0]);
      if (this.options.enableMetrics) {
        this.metrics.evictions++;
      }
    }
  }

  /**
   * Get approximate memory usage of the cache
   * @returns {number} - Memory usage estimate in bytes
   */
  getMemoryUsage() {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache) {
      // Rough estimate: key size + JSON serialized value size
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Approximate overhead per entry
    }

    return totalSize;
  }

  /**
   * Check if a key exists in the cache (without updating access stats)
   * @param {string} key - Cache key
   * @returns {boolean} - True if key exists and is not expired
   */
  has(key) {
    const entry = this.cache.get(key);

    return entry && Date.now() <= entry.expireAt;
  }

  /**
   * Get all cache keys (non-expired)
   * @returns {Array<string>} - Array of cache keys
   */
  keys() {
    const now = Date.now();
    const validKeys = [];

    for (const [key, entry] of this.cache) {
      if (now <= entry.expireAt) {
        validKeys.push(key);
      }
    }

    return validKeys;
  }

  /**
   * Destroy the cache and cleanup resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

class CacheManager {
  constructor() {
    this.caches = new Map();
    this.invalidationPatterns = new Map();
    this.warmupStrategies = new Map();
    this.metrics = {
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0,
      invalidations: 0,
      warmups: 0
    };
    
    // Create default search cache instance
    const defaultSearchCache = new SearchCache({
      ttl: 300000, // 5 minutes
      maxSize: 1000
    });
    
    this.registerCache('search', defaultSearchCache);
  }

  registerCache(name, cacheInstance, config = {}) {
    this.caches.set(name, {
      instance: cacheInstance,
      config: {
        ttl: config.ttl || 300,
        maxKeys: config.maxKeys || 1000,
        ...config
      }
    });
  }

  addInvalidationPattern(pattern, cacheNames = ['search']) {
    if (!this.invalidationPatterns.has(pattern)) {
      this.invalidationPatterns.set(pattern, new Set());
    }
    
    cacheNames.forEach(cacheName => {
      this.invalidationPatterns.get(pattern).add(cacheName);
    });
  }

  invalidatePattern(pattern) {
    let invalidatedCount = 0;
    
    this.caches.forEach((cache, cacheName) => {
      const keys = cache.instance.keys();
      const matchingKeys = keys.filter(key => {
        if (typeof pattern === 'string') {
          return key.includes(pattern);
        }
        if (pattern instanceof RegExp) {
          return pattern.test(key);
        }
        return false;
      });
      
      matchingKeys.forEach(key => {
        cache.instance.delete(key);
        invalidatedCount++;
      });
    });
    
    this.metrics.invalidations += invalidatedCount;
    return invalidatedCount;
  }

  invalidateByEntity(entityType, entityId = null) {
    const patterns = [];
    
    switch (entityType) {
      case 'card':
        patterns.push('/api/cards');
        patterns.push('/api/unified-search');
        if (entityId) {
          patterns.push(`"setId":"${entityId}"`);
        }
        break;
      case 'set':
        patterns.push('/api/sets');
        patterns.push('/api/cards');
        patterns.push('/api/unified-search');
        if (entityId) {
          patterns.push(`"setId":"${entityId}"`);
          patterns.push(`"setName"`);
        }
        break;
      case 'product':
        patterns.push('/api/sealed-products');
        patterns.push('/api/unified-search');
        break;
      case 'psa':
        patterns.push('/api/psa-graded-cards');
        patterns.push('/api/unified-search');
        break;
      default:
        patterns.push('/api/unified-search');
    }
    
    let totalInvalidated = 0;

    patterns.forEach(pattern => {
      totalInvalidated += this.invalidatePattern(pattern);
    });
    
    return totalInvalidated;
  }

  addWarmupStrategy(name, strategy) {
    this.warmupStrategies.set(name, strategy);
  }

  async warmupCache(strategyNames = []) {
    const allStrategyNames = strategyNames.length === 0 
      ? Array.from(this.warmupStrategies.keys()) 
      : strategyNames;
    
    const results = [];
    
    for (const strategyName of allStrategyNames) {
      const strategy = this.warmupStrategies.get(strategyName);

      if (strategy) {
        try {
          const result = await strategy();

          results.push({ strategy: strategyName, success: true, ...result });
          this.metrics.warmups++;
        } catch (error) {
          results.push({ 
            strategy: strategyName, 
            success: false, 
            error: error.message 
          });
        }
      }
    }
    
    return results;
  }

  getMetrics() {
    const cacheMetrics = {};
    
    this.caches.forEach((cache, name) => {
      const stats = cache.instance.getStats();

      cacheMetrics[name] = {
        keys: cache.instance.keys().length,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: stats.hitRate,
        size: stats.size,
        memoryUsage: stats.memoryUsage
      };
    });
    
    return {
      ...this.metrics,
      caches: cacheMetrics,
      patterns: Array.from(this.invalidationPatterns.keys()),
      strategies: Array.from(this.warmupStrategies.keys())
    };
  }

  clearAllCaches() {
    this.caches.forEach(cache => {
      cache.instance.clear();
    });
    
    this.metrics = {
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0,
      invalidations: 0,
      warmups: 0
    };
  }
}

const cacheManager = new CacheManager();

cacheManager.addInvalidationPattern('cards', ['search']);
cacheManager.addInvalidationPattern('sets', ['search']);
cacheManager.addInvalidationPattern('products', ['search']);
cacheManager.addInvalidationPattern('psa', ['search']);

cacheManager.addWarmupStrategy('popularSearches', async () => {
  const popularQueries = [
    { q: 'charizard', limit: 20 },
    { q: 'pikachu', limit: 20 },
    { q: 'base set', limit: 20 },
    { category: 'pokemon', limit: 20 },
    { category: 'trainer', limit: 20 }
  ];
  
  let warmedCount = 0;
  
  for (const query of popularQueries) {
    try {
      const mockReq = { 
        method: 'GET', 
        query, 
        route: { path: '/api/unified-search' } 
      };
      
      warmedCount++;
    } catch (error) {
      console.warn(`Cache warmup failed for query:`, query, error.message);
    }
  }
  
  return { warmedCount, totalQueries: popularQueries.length };
});

cacheManager.addWarmupStrategy('recentSets', async () => {
  const Set = require('../models/Set');
  
  try {
    const recentSets = await Set.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name _id');
    
    let warmedCount = 0;
    
    for (const set of recentSets) {
      const queries = [
        { setName: set.name, limit: 20 },
        { setId: set._id.toString(), limit: 20 }
      ];
      
      for (const query of queries) {
        try {
          const mockReq = { 
            method: 'GET', 
            query, 
            route: { path: '/api/cards' } 
          };
          
          warmedCount++;
        } catch (error) {
          console.warn(`Cache warmup failed for set:`, set.name, error.message);
        }
      }
    }
    
    return { warmedCount, setsProcessed: recentSets.length };
  } catch (error) {
    throw new Error(`Recent sets warmup failed: ${error.message}`);
  }
});

const createCacheKey = (req) => {
  const { q, limit, category, setId, setName, setContext, categoryContext, year, pokemonNumber, type } = req.query;
  const route = req.route.path;
  
  return `${route}:${JSON.stringify({
    q,
    limit,
    category,
    setId,
    setName,
    setContext,
    categoryContext,
    type,
    year,
    pokemonNumber,
  })}`;
};

const enhancedCacheMiddleware = (options = {}) => {
  const {
    ttl = 300,
    invalidateOnMutation = true,
    enableWarmup = false,
    cacheName = 'search'
  } = options;
  
  return (req, res, next) => {
    if (req.method !== 'GET') {
      if (invalidateOnMutation && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        const entityType = req.route?.path?.split('/')[2] || 'unknown';

        setTimeout(() => {
          cacheManager.invalidateByEntity(entityType, req.params?.id);
        }, 100);
      }
      return next();
    }
    
    if (!req.query.q && !req.query.category && !req.query.setId && !req.query.setName) {
      return next();
    }
    
    const cache = cacheManager.caches.get(cacheName);

    if (!cache) {
      return next();
    }
    
    const cacheKey = createCacheKey(req);
    
    try {
      const cachedResult = cache.instance.get(cacheKey);
      
      if (cachedResult) {
        cacheManager.metrics.totalHits++;
        
        const response = {
          ...cachedResult,
          meta: {
            ...cachedResult.meta,
            cached: true,
            cacheKey: cacheKey.substring(0, 50),
            cacheManager: 'enhanced'
          }
        };
        
        return res.status(200).json(response);
      }
      
      cacheManager.metrics.totalMisses++;
      
      const originalJson = res.json;
      
      res.json = function jsonResponse(data) {
        if (res.statusCode === 200 && data.success !== false) {
          try {
            cache.instance.set(cacheKey, data, ttl);
            cacheManager.metrics.totalSets++;
            
            if (data.meta) {
              data.meta.cached = false;
              data.meta.cacheable = true;
              data.meta.cacheManager = 'enhanced';
            }
          } catch (error) {
            console.warn('Enhanced cache set error:', error);
          }
        }
        
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.warn('Enhanced cache middleware error:', error);
      next();
    }
  };
};

module.exports = {
  SearchCache,
  CacheManager,
  cacheManager,
  searchCacheMiddleware: enhancedCacheMiddleware
};