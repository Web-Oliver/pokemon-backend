const { createCollectionItemRoutes } = require('./factories/crudRouteFactory');
const psaGradedCardController = require('../controllers/psaGradedCardsController');

/**
 * PSA Graded Cards Routes
 *
 * Uses the generic CRUD route factory to create standardized routes
 * for PSA graded card operations. This eliminates route definition duplication
 * and ensures consistency across the API.
 */

// Create routes using the factory
const router = createCollectionItemRoutes(psaGradedCardController, {
  includeMarkAsSold: true,
  middleware: [], // Global middleware for all routes
  routeMiddleware: {
    // Route-specific middleware can be added here
    // getAll: [someMiddleware],
    // create: [validationMiddleware],
  },
  customRoutes: [
    // Custom routes specific to PSA graded cards can be added here
    // { method: 'get', path: '/stats', handler: 'getStats' }
  ],
});

module.exports = router;
