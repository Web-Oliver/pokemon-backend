const { createCollectionItemRoutes } = require('./factories/crudRouteFactory');
const psaGradedCardController = require('../controllers/psaGradedCardsController');
const { enhancedCacheMiddleware } = require('../middleware/enhancedSearchCache');

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
    // Enhanced caching for read operations
    getAll: [enhancedCacheMiddleware({ 
      ttl: 300, // 5 minutes for PSA graded cards list
      cacheName: 'psa-cards-data',
      invalidateOnMutation: true 
    })],
    getById: [enhancedCacheMiddleware({ 
      ttl: 600, // 10 minutes for individual PSA cards
      cacheName: 'psa-card-details',
      invalidateOnMutation: true 
    })],
    markAsSold: [enhancedCacheMiddleware({ 
      ttl: 0, // No caching for mutation operations
      invalidateOnMutation: true 
    })],
  },
  customRoutes: [
    // Custom routes specific to PSA graded cards can be added here
    // { method: 'get', path: '/stats', handler: 'getStats' }
  ],
});

module.exports = router;
