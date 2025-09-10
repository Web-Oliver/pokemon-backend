import NodeCache from 'node-cache';

// Simple, effective search cache middleware
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every minute
  maxKeys: 1000
});

const createCacheKey = (req) => {
  const { q, limit, category, setId, setName, type } = req.query;
  const route = req.route?.path || req.path;
  
  return `${route}:${JSON.stringify({
    q: q?.toLowerCase?.() || q,
    limit,
    category,
    setId,
    setName,
    type
  })}`;
};

export const searchCacheMiddleware = (ttl = 300) => {
  return (req, res, next) => {
    // Only cache GET requests with search params
    if (req.method !== 'GET' || (!req.query.q && !req.query.category && !req.query.setId)) {
      return next();
    }

    const key = createCacheKey(req);
    const cached = cache.get(key);

    if (cached) {
      return res.json({
        ...cached,
        meta: { ...cached.meta, cached: true }
      });
    }

    // Override res.json to cache successful responses
    const originalJson = res.json;
    res.json = function(data) {
      if (res.statusCode === 200 && data.success !== false) {
        cache.set(key, data, ttl);
        if (data.meta) {
          data.meta.cached = false;
        }
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

export const invalidateCache = (pattern) => {
  const keys = cache.keys();
  let count = 0;
  
  keys.forEach(key => {
    if (key.includes(pattern)) {
      cache.del(key);
      count++;
    }
  });
  
  return count;
};

export const getCacheStats = () => ({
  keys: cache.keys().length,
  stats: cache.getStats()
});

export const clearCache = () => cache.flushAll();

// Export cache manager interface for dependency injection
export const cacheManager = {
  set: (key, value, ttl) => cache.set(key, value, ttl),
  get: (key) => cache.get(key),
  del: (key) => cache.del(key),
  getStats: () => cache.getStats(),
  flushAll: () => cache.flushAll(),
  keys: () => cache.keys()
};

export default searchCacheMiddleware;