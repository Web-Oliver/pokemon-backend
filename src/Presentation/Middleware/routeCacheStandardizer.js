/**
 * Route Cache Standardizer
 *
 * Single Responsibility: Automatic cache middleware application based on route patterns
 * Eliminates manual cache configuration by analyzing routes and applying appropriate presets
 * Ensures consistent caching behavior across all endpoints
 */

import { cachePresets, createCollectionCache, CACHE_TTL, createCachePreset   } from '@/Presentation/Middleware/cachePresets.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
/**
 * Route pattern to cache preset mapping
 * Automatically applies appropriate caching based on URL patterns and HTTP methods
 */
const ROUTE_CACHE_PATTERNS = {
  // Collection endpoints
  '/collections/:type': {
    'GET': 'collectionList',
    'POST': 'mutation'
  },
  '/collections/:type/:id': {
    'GET': 'collectionDetails',
    'PUT': 'mutation',
    'PATCH': 'mutation',
    'DELETE': 'mutation'
  },

  // Reference data endpoints (high cache TTL)
  '/cards': {
    'GET': 'cardData'
  },
  '/cards/:id': {
    'GET': 'cardDetails'
  },
  '/cards/metrics': {
    'GET': 'cardMetrics'
  },

  '/sets': {
    'GET': 'setData'
  },
  '/sets/:id': {
    'GET': 'setDetails'
  },
  '/sets/:id/cards': {
    'GET': 'setCards'
  },

  '/products': {
    'GET': 'productData'
  },
  '/products/search': {
    'GET': 'productSearch'
  },

  // Search endpoints
  '/search': {
    'GET': 'search'
  },
  '/search/suggestions': {
    'GET': 'searchSuggestions'
  },
  '/search/cards': {
    'GET': 'searchCards'
  },
  '/search/products': {
    'GET': 'searchProducts'
  },
  '/search/sets': {
    'GET': 'searchSets'
  },

  // Activity endpoints (moderate cache TTL)
  '/activities': {
    'GET': 'activityData',
    'POST': 'mutation'
  },
  '/activities/stats': {
    'GET': 'activityStats'
  },
  '/activities/recent': {
    'GET': 'activityData'
  },
  '/activities/:id': {
    'GET': 'activityData',
    'PATCH': 'mutation',
    'PUT': 'mutation',
    'DELETE': 'mutation'
  },

  // DBA Selection endpoints
  '/dba-selection': {
    'GET': 'dbaSelection',
    'POST': 'mutation',
    'DELETE': 'mutation'
  },
  '/dba-selection/stats': {
    'GET': 'dbaSelection'
  },
  '/dba-selection/:itemType/:itemId': {
    'GET': 'dbaSelection',
    'PUT': 'mutation'
  },

  // Sales endpoints
  '/sales': {
    'GET': 'salesData'
  },
  '/sales/summary': {
    'GET': 'salesSummary'
  },
  '/sales/graph-data': {
    'GET': 'salesGraphData'
  }
};

/**
 * Endpoints that should never be cached
 */
const NO_CACHE_PATTERNS = [
  /^\/auth\/.*/,
  /^\/admin\/.*/,
  /^\/ocr\/.*/,
  /^\/images\/upload/,
  /^\/backup\/.*/,
  /^\/cache-management\/.*/,
  /.*\/(upload|import|export|process)/
];

/**
 * Apply standardized caching to an Express router
 * Automatically detects route patterns and applies appropriate cache middleware
 *
 * @param {Object} router - Express router instance
 * @param {Object} options - Configuration options
 * @returns {Object} Enhanced router with standardized caching
 */
function applyStandardizedCaching(router, options = {}) {
  const {
    enabled = true,
    defaultTTL = CACHE_TTL.MEDIUM,
    skipPatterns = [],
    customMappings = {}
  } = options;

  if (!enabled) {
    Logger.operationStart('CACHE_STANDARDIZER', 'Cache standardization disabled');
    return router;
  }

  Logger.operationStart('CACHE_STANDARDIZER', 'Applying standardized caching to router');

  // Merge custom mappings with default patterns
  const cachePatterns = { ...ROUTE_CACHE_PATTERNS, ...customMappings };

  // Store original route methods
  const originalUse = router.use;
  const originalGet = router.get;
  const originalPost = router.post;
  const originalPut = router.put;
  const originalPatch = router.patch;
  const originalDelete = router.delete;

  // Enhanced route method that auto-applies caching
  const enhanceRouteMethod = (method, originalMethod) => function (path, ...middleware) {
      const appliedMiddleware = [...middleware];

      // Check if caching should be applied
      const cacheMiddleware = determineCacheMiddleware(path, method.toUpperCase(), cachePatterns, skipPatterns);

      if (cacheMiddleware) {
        // Insert cache middleware before the last handler (controller)
        const lastHandler = appliedMiddleware.pop();

        appliedMiddleware.push(cacheMiddleware, lastHandler);

        Logger.operationSuccess('CACHE_APPLIED', `Applied ${cacheMiddleware.name || 'cache'} to ${method.toUpperCase()} ${path}`);
      }

      return originalMethod.call(this, path, ...appliedMiddleware);
    };

  // Override router methods with caching enhancement
  router.get = enhanceRouteMethod('get', originalGet.bind(router));
  router.post = enhanceRouteMethod('post', originalPost.bind(router));
  router.put = enhanceRouteMethod('put', originalPut.bind(router));
  router.patch = enhanceRouteMethod('patch', originalPatch.bind(router));
  router.delete = enhanceRouteMethod('delete', originalDelete.bind(router));

  Logger.operationSuccess('CACHE_STANDARDIZER', 'Standardized caching applied to router');

  return router;
}

/**
 * Determine appropriate cache middleware for a route
 * @private
 */
function determineCacheMiddleware(path, method, cachePatterns, skipPatterns) {
  // Check if route should be skipped
  if (shouldSkipCaching(path, skipPatterns)) {
    return null;
  }

  // Look for exact pattern matches
  for (const [pattern, methodMap] of Object.entries(cachePatterns)) {
    if (matchesPattern(path, pattern)) {
      const presetName = methodMap[method];

      if (presetName && cachePresets[presetName]) {
        return cachePresets[presetName];
      }
    }
  }

  // Apply default caching for GET requests if no specific pattern matches
  if (method === 'GET' && !shouldSkipCaching(path, NO_CACHE_PATTERNS)) {
    return cachePresets.search; // Default to search preset
  }

  return null;
}

/**
 * Check if a path matches a route pattern
 * @private
 */
function matchesPattern(path, pattern) {
  // Convert Express pattern to regex
  const regexPattern = pattern
    .replace(/:[^/]+/g, '[^/]+') // Replace :param with regex
    .replace(/\*/g, '.*'); // Replace * with regex

  const regex = new RegExp(`^${regexPattern}$`);

  return regex.test(path);
}

/**
 * Check if caching should be skipped for a path
 * @private
 */
function shouldSkipCaching(path, skipPatterns) {
  const allSkipPatterns = [...NO_CACHE_PATTERNS, ...skipPatterns];

  return allSkipPatterns.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }
    return path.includes(pattern);
  });
}

/**
 * Middleware factory for manual cache application
 * When automatic detection isn't sufficient
 *
 * @param {string} operation - Operation type (list, details, search, etc.)
 * @param {Object} options - Cache options
 * @returns {Function} Cache middleware
 */
function createCacheForRoute(operation, options = {}) {
  const {
    entityType,
    ttl = CACHE_TTL.MEDIUM,
    cacheName
  } = options;

  // Use collection cache for entity-specific operations
  if (entityType && ['list', 'details', 'mutation'].includes(operation)) {
    return createCollectionCache(entityType, operation);
  }

  // Use preset if available
  if (cachePresets[operation]) {
    return cachePresets[operation];
  }

  // Create custom cache middleware
  const finalCacheName = cacheName || `${operation}-cache`;
  
  return createCachePreset(operation, finalCacheName, ttl);
}

/**
 * Analyze existing router and suggest cache improvements
 * Useful for auditing existing route files
 *
 * @param {Object} router - Express router to analyze
 * @returns {Object} Analysis results with suggestions
 */
function analyzeRouterCaching(router) {
  const analysis = {
    totalRoutes: 0,
    cachedRoutes: 0,
    uncachedRoutes: [],
    suggestions: []
  };

  // This would require more complex Express router introspection
  // For now, provide a basic structure

  Logger.operationStart('CACHE_ANALYZER', 'Analyzing router caching patterns');

  // Analysis logic would go here
  // Currently returning placeholder structure

  Logger.operationSuccess('CACHE_ANALYZER', 'Router analysis completed');

  return analysis;
}

/**
 * Express middleware to add cache headers to responses
 * Provides client-side caching hints based on route patterns
 *
 * @param {Object} options - Cache header options
 * @returns {Function} Express middleware
 */
function addCacheHeaders(options = {}) {
  const {
    defaultMaxAge = 300, // 5 minutes
    routeSpecificMaxAge = {}
  } = options;

  return (req, res, next) => {
    const { path } = req;
    const { method } = req;

    // Determine appropriate max-age
    let maxAge = defaultMaxAge;

    for (const [pattern, age] of Object.entries(routeSpecificMaxAge)) {
      if (matchesPattern(path, pattern)) {
        maxAge = age;
        break;
      }
    }

    // Set cache headers for GET requests
    if (method === 'GET' && !shouldSkipCaching(path, NO_CACHE_PATTERNS)) {
      res.set({
        'Cache-Control': `public, max-age=${maxAge}`,
        'Vary': 'Accept-Encoding'
      });
    } else {
      // No cache for mutations
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    }

    next();
  };
}

export {
  applyStandardizedCaching,
  createCacheForRoute,
  analyzeRouterCaching,
  addCacheHeaders,
  ROUTE_CACHE_PATTERNS,
  NO_CACHE_PATTERNS
};
export default applyStandardizedCaching;;
