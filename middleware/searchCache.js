const NodeCache = require('node-cache');

// Initialize cache with 5 minute TTL and check period of 1 minute
const searchCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every minute
  useClones: false, // Better performance, but be careful with object mutations
});

// Cache statistics for monitoring
let cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  gets: 0,
  hitRate: 0,
};

const updateStats = () => {
  cacheStats.gets = cacheStats.hits + cacheStats.misses;
  cacheStats.hitRate = cacheStats.gets > 0 ? (cacheStats.hits / cacheStats.gets) * 100 : 0;
};

const createCacheKey = (req) => {
  const { q, limit, category, setId, setName, setContext, categoryContext, year, pokemonNumber, type } = req.query;
  const route = req.route.path;

  // CRITICAL FIX: Include setContext and categoryContext for hierarchical search caching
  return `${route}:${JSON.stringify({
    q,
    limit,
    category,
    setId,
    setName,
    setContext, // ✅ ADDED: For hierarchical search
    categoryContext, // ✅ ADDED: For hierarchical search
    type, // ✅ ADDED: Search type (sets, cards, products)
    year,
    pokemonNumber,
  })}`;
};

const searchCacheMiddleware =
  (ttl = 300) =>
  (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for requests without search query
    if (!req.query.q && !req.query.category) {
      return next();
    }

    const cacheKey = createCacheKey(req);

    try {
      // Try to get from cache
      const cachedResult = searchCache.get(cacheKey);

      cacheStats.gets++;

      if (cachedResult) {
        cacheStats.hits++;
        updateStats();

        // Add cache metadata
        const response = {
          ...cachedResult,
          meta: {
            ...cachedResult.meta,
            cached: true,
            cacheKey: cacheKey.substring(0, 50), // Truncated for security
            hitRate: Math.round(cacheStats.hitRate * 100) / 100,
          },
        };

        return res.status(200).json(response);
      }

      cacheStats.misses++;
      updateStats();

      // Store original json method
      const originalJson = res.json;

      // Override json method to cache the response
      // eslint-disable-next-line func-names
      res.json = function (data) {
        // Only cache successful responses
        if (res.statusCode === 200 && data.success !== false) {
          try {
            searchCache.set(cacheKey, data, ttl);
            cacheStats.sets++;

            // Add cache metadata to response
            if (data.meta) {
              data.meta.cached = false;
              data.meta.cacheable = true;
            }
          } catch (error) {
            console.warn('Cache set error:', error);
          }
        }

        // Call original json method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.warn('Cache middleware error:', error);
      next();
    }
  };

// Cache management functions
const clearSearchCache = () => {
  searchCache.flushAll();
  cacheStats = { hits: 0, misses: 0, sets: 0, gets: 0, hitRate: 0 };
};

const getCacheStats = () => ({
  ...cacheStats,
  keys: searchCache.keys().length,
  size: searchCache.getStats(),
});

const warmupCache = async (warmupQueries = []) => {
  console.log(`🔥 Warming up search cache with ${warmupQueries.length} queries...`);
  
  let warmedCount = 0;
  const results = [];
  
  for (const query of warmupQueries) {
    try {
      const cacheKey = createCacheKey({
        query: query.query || query,
        route: { path: query.route || '/api/unified-search' }
      });
      
      if (!searchCache.has(cacheKey) && query.mockResponse) {
        searchCache.set(cacheKey, query.mockResponse, query.ttl || 300);
        warmedCount++;
        results.push({ query: query.query || query, success: true });
      }
    } catch (error) {
      results.push({ 
        query: query.query || query, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  console.log(`✅ Cache warmup completed: ${warmedCount}/${warmupQueries.length} queries cached`);
  return { warmedCount, totalQueries: warmupQueries.length, results };
};

const invalidateCacheByPattern = (pattern) => {
  const keys = searchCache.keys();
  let invalidatedCount = 0;
  
  keys.forEach(key => {
    if (typeof pattern === 'string' && key.includes(pattern)) {
      searchCache.del(key);
      invalidatedCount++;
    } else if (pattern instanceof RegExp && pattern.test(key)) {
      searchCache.del(key);
      invalidatedCount++;
    }
  });
  
  console.log(`🗑️ Invalidated ${invalidatedCount} cache entries matching pattern:`, pattern);
  return invalidatedCount;
};

const invalidateCacheByEntity = (entityType, entityId = null) => {
  const patterns = [];
  
  switch (entityType) {
    case 'card':
    case 'cards':
      patterns.push('/api/cards');
      patterns.push('/api/unified-search');
      if (entityId) {
        patterns.push(`"setId":"${entityId}"`);
      }
      break;
    case 'set':
    case 'sets':
      patterns.push('/api/sets');
      patterns.push('/api/cards');
      patterns.push('/api/unified-search');
      if (entityId) {
        patterns.push(`"setId":"${entityId}"`);
        patterns.push(`"setName"`);
      }
      break;
    case 'product':
    case 'sealed-products':
      patterns.push('/api/sealed-products');
      patterns.push('/api/unified-search');
      break;
    case 'psa':
    case 'psa-graded-cards':
      patterns.push('/api/psa-graded-cards');
      patterns.push('/api/unified-search');
      break;
    default:
      patterns.push('/api/unified-search');
  }
  
  let totalInvalidated = 0;

  patterns.forEach(pattern => {
    totalInvalidated += invalidateCacheByPattern(pattern);
  });
  
  return totalInvalidated;
};

module.exports = {
  searchCacheMiddleware,
  clearSearchCache,
  getCacheStats,
  warmupCache,
  invalidateCacheByPattern,
  invalidateCacheByEntity,
  searchCache,
};
