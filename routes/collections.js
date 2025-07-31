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
Object.entries(COLLECTION_CONFIGS).forEach(([path, config]) => {
  const collectionRouter = createCollectionItemRoutes(config.controller, {
    includeMarkAsSold: true,
    middleware: [], // Global middleware for all routes
    routeMiddleware: createRouteMiddleware(config),
    customRoutes: [
      // Custom routes can be added per collection type here
    ],
  });
  
  // Mount each collection at its path
  router.use(`/${path}`, collectionRouter);
});

module.exports = router;