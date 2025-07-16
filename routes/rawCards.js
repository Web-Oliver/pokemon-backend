const { createCollectionItemRoutes } = require('./factories/crudRouteFactory');
const rawCardController = require('../controllers/rawCardsController');

/**
 * Raw Cards Routes
 * 
 * Uses the generic CRUD route factory to create standardized routes
 * for raw card operations. This eliminates route definition duplication
 * and ensures consistency across the API.
 */

// Create routes using the factory
const router = createCollectionItemRoutes(rawCardController, {
  includeMarkAsSold: true,
  middleware: [], // Global middleware for all routes
  routeMiddleware: {
    // Route-specific middleware can be added here
    // getAll: [someMiddleware],
    // create: [validationMiddleware],
  },
  customRoutes: [
    // Custom routes specific to raw cards can be added here
    // { method: 'get', path: '/stats', handler: 'getStats' }
  ]
});

module.exports = router;