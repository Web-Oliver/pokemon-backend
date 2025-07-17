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
  // This would be called during server startup to pre-populate cache
  console.log(`Warming up cache with ${warmupQueries.length} queries...`);
  // Implementation would depend on your specific warming strategy
};

module.exports = {
  searchCacheMiddleware,
  clearSearchCache,
  getCacheStats,
  warmupCache,
  searchCache,
};
