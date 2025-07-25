const NodeCache = require('node-cache');
const { searchCache, getCacheStats } = require('./searchCache');

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
    
    this.registerCache('search', searchCache);
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
        cache.instance.del(key);
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
    if (strategyNames.length === 0) {
      strategyNames = Array.from(this.warmupStrategies.keys());
    }
    
    const results = [];
    
    for (const strategyName of strategyNames) {
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
      const stats = getCacheStats();

      cacheMetrics[name] = {
        keys: cache.instance.keys().length,
        hits: stats.hits,
        misses: stats.misses,
        hitRate: stats.hitRate,
        size: cache.instance.getStats()
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
      cache.instance.flushAll();
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
      
      res.json = function(data) {
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

module.exports = {
  CacheManager,
  cacheManager,
  enhancedCacheMiddleware
};