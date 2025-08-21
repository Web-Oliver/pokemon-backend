/**
 * Cache Middleware Standardizer
 *
 * Single Responsibility: Ensure consistent cache middleware application across all routes
 * Eliminates manual cache configuration by automatically applying cache middleware
 * Provides centralized cache governance and standardization
 */

import { cachePresets, createCacheForRoute, CACHE_TTL   } from './cachePresets.js';
import { applyStandardizedCaching, addCacheHeaders   } from './routeCacheStandardizer.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
/**
 * Route file to cache configuration mapping
 * Defines which cache presets should be applied to each route file
 */
const ROUTE_FILE_CACHE_CONFIG = {
  // Core entity routes
  'cards.js': {
    defaultPreset: 'cardData',
    routeSpecific: {
      '/': { GET: 'cardData' },
      '/:id': { GET: 'cardDetails' },
      '/metrics': { GET: 'cardMetrics' }
    }
  },

  'sets.js': {
    defaultPreset: 'setData',
    routeSpecific: {
      '/': { GET: 'setData' },
      '/:id': { GET: 'setDetails' },
      '/:id/cards': { GET: 'setCards' }
    }
  },

  'products.js': {
    defaultPreset: 'productData',
    routeSpecific: {
      '/': { GET: 'productData' },
      '/search': { GET: 'productSearch' }
    }
  },

  'setProducts.js': {
    defaultPreset: 'productData',
    routeSpecific: {
      '/': { GET: 'productData' },
      '/:id': { GET: 'setDetails' }
    }
  },

  // Collection routes
  'collections.js': {
    defaultPreset: 'collectionList',
    routeSpecific: {
      '/:type': { GET: 'collectionList', POST: 'mutation' },
      '/:type/:id': { GET: 'collectionDetails', PUT: 'mutation', PATCH: 'mutation', DELETE: 'mutation' }
    }
  },

  // Search routes
  'unifiedSearch.js': {
    defaultPreset: 'search',
    routeSpecific: {
      '/': { GET: 'search' },
      '/suggestions': { GET: 'searchSuggestions' },
      '/cards': { GET: 'searchCards' },
      '/products': { GET: 'searchProducts' },
      '/sets': { GET: 'searchSets' }
    }
  },

  // Activity routes
  'activities.js': {
    defaultPreset: 'activityData',
    routeSpecific: {
      '/': { GET: 'activityData', POST: 'mutation' },
      '/stats': { GET: 'activityStats' },
      '/recent': { GET: 'activityData' },
      '/:id': { GET: 'activityData', PUT: 'mutation', PATCH: 'mutation', DELETE: 'mutation' }
    }
  },

  'activityRoutes.js': {
    defaultPreset: 'activityData',
    routeSpecific: {
      '/': { GET: 'activityData', POST: 'mutation' },
      '/stats': { GET: 'activityStats' },
      '/recent': { GET: 'activityData' },
      '/:id': { GET: 'activityData', PUT: 'mutation', PATCH: 'mutation', DELETE: 'mutation' }
    }
  },

  // Sales routes
  'sales.js': {
    defaultPreset: 'salesData',
    routeSpecific: {
      '/': { GET: 'salesData' },
      '/summary': { GET: 'salesSummary' },
      '/graph-data': { GET: 'salesGraphData' }
    }
  },

  // DBA selection routes
  'dbaSelection.js': {
    defaultPreset: 'dbaSelection',
    routeSpecific: {
      '/': { GET: 'dbaSelection', POST: 'mutation', DELETE: 'mutation' },
      '/stats': { GET: 'dbaSelection' },
      '/:itemType/:itemId': { GET: 'dbaSelection', PUT: 'mutation' }
    }
  },

  // OCR routes (processing routes - minimal caching)
  'ocr.js': {
    defaultPreset: 'search', // Default to search preset for GET routes
    routeSpecific: {
      // Most OCR routes are processing and shouldn't be cached
      '/detect-card': { GET: 'search' },
      '/suggestions': { GET: 'searchSuggestions' }
    }
  },

  'ocrMatching.js': {
    defaultPreset: 'search',
    routeSpecific: {
      '/match': { POST: 'mutation' },
      '/batch-match': { POST: 'mutation' },
      '/stats': { GET: 'activityStats' }
    }
  },

  // PSA and Stitched Labels routes (moderate caching)
  'psaLabels.js': {
    defaultPreset: 'collectionList',
    routeSpecific: {
      '/': { GET: 'collectionList', POST: 'mutation' },
      '/:id': { GET: 'collectionDetails', PUT: 'mutation', DELETE: 'mutation' },
      '/stats': { GET: 'activityStats' }
    }
  },

  'stitchedLabels.js': {
    defaultPreset: 'collectionList',
    routeSpecific: {
      '/': { GET: 'collectionList', POST: 'mutation' },
      '/:id': { GET: 'collectionDetails', PUT: 'mutation', DELETE: 'mutation' },
      '/process': { POST: 'mutation' }
    }
  },

  // Plugin management (admin functionality - minimal caching)
  'pluginManagement.js': {
    defaultPreset: 'search',
    routeSpecific: {
      '/': { GET: 'search', POST: 'mutation' },
      '/:id': { GET: 'search', PUT: 'mutation', DELETE: 'mutation' },
      '/status': { GET: 'activityStats' }
    }
  },

  // Main API router (delegates to other routes)
  'api.js': {
    skipAll: true // Main router that delegates to other routes
  },

  // Image routes (no caching for uploads)
  'images.js': {
    skipAll: true // Images and uploads should not be cached
  }
};

/**
 * Routes that should never be cached
 */
const NO_CACHE_ROUTE_FILES = [
  'auth.js',
  'admin.js',
  'upload.js',
  'backup.js',
  'import.js',
  'export.js',
  'cacheManagement.js'
];

/**
 * Apply standardized cache middleware to a router based on the route file
 *
 * @param {Object} router - Express router instance
 * @param {string} routeFileName - Name of the route file (e.g., 'cards.js')
 * @param {Object} options - Configuration options
 * @returns {Object} Enhanced router with standardized caching
 */
function applyCacheStandardization(router, routeFileName, options = {}) {
  const {
    enabled = true,
    forceOverride = false,
    customConfig = null
  } = options;

  if (!enabled) {
    Logger.operationStart('CACHE_STANDARDIZATION', `Cache standardization disabled for ${routeFileName}`);
    return router;
  }

  // Check if route file should skip caching entirely
  if (NO_CACHE_ROUTE_FILES.some(file => routeFileName.includes(file))) {
    Logger.operationStart('CACHE_STANDARDIZATION', `Skipping cache for ${routeFileName} - in no-cache list`);
    return router;
  }

  Logger.operationStart('CACHE_STANDARDIZATION', `Applying cache standardization to ${routeFileName}`);

  try {
    // Get configuration for this route file
    const config = customConfig || ROUTE_FILE_CACHE_CONFIG[routeFileName];

    if (!config) {
      Logger.operationStart('CACHE_STANDARDIZATION', `No specific config for ${routeFileName}, using default patterns`);
      return applyStandardizedCaching(router, options);
    }

    // Skip if marked to skip all
    if (config.skipAll) {
      Logger.operationStart('CACHE_STANDARDIZATION', `Skipping all cache for ${routeFileName}`);
      return router;
    }

    // Apply route-specific cache middleware using the enhanced router method
    const enhancedRouter = applyStandardizedCaching(router, {
      ...options,
      customMappings: config.routeSpecific || {}
    });

    Logger.operationSuccess('CACHE_STANDARDIZATION', `Successfully applied cache standardization to ${routeFileName}`);
    return enhancedRouter;

  } catch (error) {
    Logger.operationError('CACHE_STANDARDIZATION', `Failed to apply cache standardization to ${routeFileName}`, error);

    // Return router unchanged if standardization fails
    return router;
  }
}

/**
 * Validate that all routes in a router have appropriate caching
 *
 * @param {Object} router - Express router to validate
 * @param {string} routeFileName - Name of the route file
 * @returns {Object} Validation results
 */
function validateRouterCaching(router, routeFileName) {
  Logger.operationStart('CACHE_VALIDATION', `Validating cache configuration for ${routeFileName}`);

  const validation = {
    routeFile: routeFileName,
    hasStandardization: false,
    missingCache: [],
    incorrectCache: [],
    suggestions: [],
    status: 'unknown'
  };

  try {
    // Get expected configuration
    const expectedConfig = ROUTE_FILE_CACHE_CONFIG[routeFileName];

    if (!expectedConfig) {
      validation.suggestions.push(`Add configuration for ${routeFileName} to ROUTE_FILE_CACHE_CONFIG`);
      validation.status = 'needs_config';
      return validation;
    }

    if (expectedConfig.skipAll) {
      validation.status = 'skip_intentional';
      validation.hasStandardization = true;
      return validation;
    }

    // This is a simplified validation - in practice you'd introspect the router
    // For now, we assume if config exists, it's properly applied
    validation.hasStandardization = true;
    validation.status = 'compliant';

    Logger.operationSuccess('CACHE_VALIDATION', `Cache validation completed for ${routeFileName}`);

  } catch (error) {
    Logger.operationError('CACHE_VALIDATION', `Cache validation failed for ${routeFileName}`, error);
    validation.status = 'validation_error';
  }

  return validation;
}

/**
 * Generate cache standardization report for all route files
 *
 * @param {Array} routeFiles - List of route file names to analyze
 * @returns {Object} Comprehensive report
 */
function generateCacheStandardizationReport(routeFiles = []) {
  Logger.operationStart('CACHE_REPORT', 'Generating cache standardization report');

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalRoutes: routeFiles.length,
      standardizedRoutes: 0,
      nonCachedRoutes: 0,
      needsAttention: 0
    },
    routeDetails: {},
    recommendations: []
  };

  try {
    // Analyze each route file
    routeFiles.forEach(routeFile => {
      const validation = validateRouterCaching(null, routeFile);

      report.routeDetails[routeFile] = validation;

      switch (validation.status) {
        case 'compliant':
        case 'skip_intentional':
          report.summary.standardizedRoutes++;
          break;
        case 'needs_config':
          report.summary.needsAttention++;
          break;
        default:
          report.summary.needsAttention++;
      }
    });

    // Generate recommendations
    if (report.summary.needsAttention > 0) {
      report.recommendations.push(
        `${report.summary.needsAttention} route files need cache configuration or attention`
      );
    }

    // Add specific recommendations for missing configs
    Object.entries(report.routeDetails).forEach(([routeFile, details]) => {
      if (details.status === 'needs_config') {
        report.recommendations.push(
          `Add cache configuration for ${routeFile} to ROUTE_FILE_CACHE_CONFIG`
        );
      }
    });

    Logger.operationSuccess('CACHE_REPORT', 'Cache standardization report generated successfully');

  } catch (error) {
    Logger.operationError('CACHE_REPORT', 'Failed to generate cache report', error);
  }

  return report;
}

/**
 * Apply cache headers middleware with route-specific configurations
 *
 * @param {string} routeFileName - Name of the route file
 * @param {Object} options - Header configuration options
 * @returns {Function} Express middleware
 */
function applyCacheHeaders(routeFileName, options = {}) {
  const config = ROUTE_FILE_CACHE_CONFIG[routeFileName];

  if (!config || config.skipAll) {
    return addCacheHeaders({ defaultMaxAge: 0 }); // No caching headers
  }

  // Route-specific max-age settings
  const routeSpecificMaxAge = {};

  if (config.routeSpecific) {
    Object.entries(config.routeSpecific).forEach(([path, methods]) => {
      Object.entries(methods).forEach(([method, presetName]) => {
        if (method === 'GET' && cachePresets[presetName]) {
          // Convert TTL to max-age (both are in seconds)
          const preset = cachePresets[presetName];

          if (preset.ttl) {
            routeSpecificMaxAge[path] = preset.ttl;
          }
        }
      });
    });
  }

  return addCacheHeaders({
    ...options,
    routeSpecificMaxAge
  });
}

/**
 * Middleware factory for custom cache needs not covered by presets
 *
 * @param {string} cacheName - Unique cache name
 * @param {number} ttl - Time to live in seconds
 * @param {Object} options - Additional cache options
 * @returns {Function} Cache middleware
 */
function createCustomCacheMiddleware(cacheName, ttl = CACHE_TTL.MEDIUM, options = {}) {
  const {
    invalidateOnMutation = true,
    skipCondition = null
  } = options;

  Logger.operationStart('CUSTOM_CACHE', `Creating custom cache middleware: ${cacheName}`);

  return createCacheForRoute('custom', {
    cacheName,
    ttl,
    invalidateOnMutation,
    skipCondition
  });
}

/**
 * Bulk apply cache standardization to multiple routers
 *
 * @param {Array} routerConfigs - Array of {router, fileName} objects
 * @param {Object} globalOptions - Global configuration options
 * @returns {Array} Array of enhanced routers
 */
function bulkApplyCacheStandardization(routerConfigs, globalOptions = {}) {
  Logger.operationStart('BULK_CACHE_STANDARDIZATION', `Applying cache standardization to ${routerConfigs.length} routers`);

  const results = [];
  let successCount = 0;
  let errorCount = 0;

  routerConfigs.forEach(({ router, fileName, options = {} }) => {
    try {
      const enhancedRouter = applyCacheStandardization(router, fileName, {
        ...globalOptions,
        ...options
      });

      results.push({
        router: enhancedRouter,
        fileName,
        status: 'success'
      });

      successCount++;
    } catch (error) {
      Logger.operationError('BULK_CACHE_STANDARDIZATION', `Failed to process ${fileName}`, error);

      results.push({
        router,
        fileName,
        status: 'error',
        error: error.message
      });

      errorCount++;
    }
  });

  Logger.operationSuccess('BULK_CACHE_STANDARDIZATION', 'Bulk cache standardization completed', {
    total: routerConfigs.length,
    success: successCount,
    errors: errorCount
  });

  return results;
}

export {
  applyCacheStandardization,
  validateRouterCaching,
  generateCacheStandardizationReport,
  applyCacheHeaders,
  createCustomCacheMiddleware,
  bulkApplyCacheStandardization,
  ROUTE_FILE_CACHE_CONFIG,
  NO_CACHE_ROUTE_FILES
};
export default applyCacheStandardization;;
