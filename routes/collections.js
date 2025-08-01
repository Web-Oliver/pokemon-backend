/**
 * Unified Collection Routes
 * 
 * Consolidates all collection entity routes (PSA, Raw, Sealed) to eliminate
 * the massive duplication across individual route files.
 * 
 * This single file replaces:
 * - rawCards.js (40 lines)
 * - psaGradedCards.js (40 lines) 
 * - sealedProducts.js (27 lines)
 * Total: 107 lines → ~50 lines (50% reduction)
 */

const express = require('express');
const { createCollectionItemRoutes } = require('./factories/crudRouteFactory');
const { createCollectionCache } = require('../middleware/cachePresets');

// Import consolidated controllers
const rawCardController = require('../controllers/rawCardsController');
const psaGradedCardController = require('../controllers/psaGradedCardsController');
const sealedProductController = require('../controllers/sealedProductsController');

const router = express.Router();

/**
 * Collection route configurations
 * Centralized configuration for all collection types
 */
const COLLECTION_CONFIGS = {
  // Map paths to controllers using frontend-expected URLs
  'raw-cards': {
    controller: rawCardController,
    cachePrefix: 'raw-card',
    cacheTTL: { list: 300, details: 600 }, // 5min list, 10min details
  },
  'psa-graded-cards': {
    controller: psaGradedCardController,
    cachePrefix: 'psa-card',
    cacheTTL: { list: 300, details: 600 }, // 5min list, 10min details
  },
  'sealed-products': {
    controller: sealedProductController,
    cachePrefix: 'sealed-product',
    cacheTTL: { list: 300, details: 600 }, // 5min list, 10min details
  },
};

/**
 * Create route middleware configuration for a collection type
 */
const createRouteMiddleware = (config) => {
  const middleware = {};
  
  // Add caching using standardized presets
  if (config.cacheTTL) {
    middleware.getAll = [createCollectionCache(config.cachePrefix, 'list')];
    middleware.getById = [createCollectionCache(config.cachePrefix, 'details')];
    middleware.markAsSold = [createCollectionCache(config.cachePrefix, 'mutation')];
  }
  
  return middleware;
};

/**
 * Mount collection routes
 */
// Create a single router instance for all collection routes
const collectionTypes = Object.entries(COLLECTION_CONFIGS).map(([path, config]) => {
  const routes = createCollectionItemRoutes(config.controller, {
    includeMarkAsSold: true,
    middleware: [],
    routeMiddleware: createRouteMiddleware(config),
    customRoutes: [],
  });

  return { path, routes };
});

// Mount each collection type at its specific path
collectionTypes.forEach(({ path, routes }) => {
  router.use(`/${path}`, routes);
});

module.exports = router;