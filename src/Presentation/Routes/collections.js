/**
 * REST-Compliant Collection Routes
 *
 * Implements unified collection endpoints following REST principles:
 * - Resource-based URL structure (/collections/:type)
 * - Proper HTTP method usage
 * - Consistent response formats
 * - RFC 7807 Problem Details error handling
 */

import express from 'express';
import { createCollectionItemRoutes   } from '@/Presentation/Routes/factories/crudRouteFactory.js';
import { createCollectionCache   } from '@/Presentation/Middleware/cachePresets.js';
// Import consolidated controllers
import rawCardController from '@/Presentation/Controllers/collections/rawCardsController.js';
import psaGradedCardController from '@/Presentation/Controllers/collections/psaGradedCardsController.js';
import sealedProductController from '@/Presentation/Controllers/collections/sealedProductsController.js';
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

// REST-compliant unified collection routes
// Note: More specific routes should come before parameterized routes
router.get('/collections/:type', (req, res, next) => {
  // Skip special collection endpoints
  if (req.params.type === 'social-exports' || req.params.type === 'exports') {
    return next();
  }
  const controller = getControllerByType(req.params.type, res);

  if (controller) controller.getAll(req, res, next);
});

router.get('/collections/:type/:id', (req, res, next) => {
  // Skip special collection endpoints
  if (req.params.type === 'social-exports' || req.params.type === 'exports') {
    return next();
  }
  const controller = getControllerByType(req.params.type, res);

  if (controller) controller.getById(req, res, next);
});

router.post('/collections/:type', (req, res, next) => {
  // Skip special collection endpoints
  if (req.params.type === 'social-exports' || req.params.type === 'exports') {
    return next();
  }
  const controller = getControllerByType(req.params.type, res);

  if (controller) controller.create(req, res, next);
});

router.put('/collections/:type/:id', (req, res, next) => {
  // Skip special collection endpoints
  if (req.params.type === 'social-exports' || req.params.type === 'exports') {
    return next();
  }
  const controller = getControllerByType(req.params.type, res);

  if (controller) controller.update(req, res, next);
});

router.patch('/collections/:type/:id', (req, res, next) => {
  // Skip special collection endpoints
  if (req.params.type === 'social-exports' || req.params.type === 'exports') {
    return next();
  }
  const controller = getControllerByType(req.params.type, res);

  if (controller) {
    if (req.body.sold !== undefined && controller.markAsSold) {
      controller.markAsSold(req, res, next);
    } else {
      controller.update(req, res, next);
    }
  }
});

router.delete('/collections/:type/:id', (req, res, next) => {
  // Skip special collection endpoints
  if (req.params.type === 'social-exports' || req.params.type === 'exports') {
    return next();
  }
  const controller = getControllerByType(req.params.type, res);

  if (controller) controller.delete(req, res, next);
});

// Legacy routes for backward compatibility
collectionTypes.forEach(({ path, routes }) => {
  router.use(`/${path}`, routes);
});

/**
 * Helper function to get controller by collection type
 */
function getControllerByType(type, res) {
  switch (type) {
    case 'psa-cards':
    case 'psa-graded-cards':
      return psaGradedCardController;
    case 'raw-cards':
      return rawCardController;
    case 'sealed-products':
      return sealedProductController;
    default:
      res.status(400).json({
        type: 'https://pokemon-collection.com/problems/invalid-collection-type',
        title: 'Invalid Collection Type',
        status: 400,
        detail: `Collection type '${type}' is not supported`,
        instance: res.req.originalUrl,
        supportedTypes: ['psa-cards', 'raw-cards', 'sealed-products']
      });
      return null;
  }
}

export default router;
