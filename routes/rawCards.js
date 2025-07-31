const { createCollectionItemRoutes } = require('./factories/crudRouteFactory');
const rawCardController = require('../controllers/rawCardsController');
const { enhancedCacheMiddleware } = require('../middleware/enhancedSearchCache');

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
    // Enhanced caching for read operations
    getAll: [enhancedCacheMiddleware({ 
      ttl: 300, // 5 minutes for raw cards list
      cacheName: 'raw-cards-data',
      invalidateOnMutation: true 
    })],
    getById: [enhancedCacheMiddleware({ 
      ttl: 600, // 10 minutes for individual raw cards
      cacheName: 'raw-card-details',
      invalidateOnMutation: true 
    })],
    markAsSold: [enhancedCacheMiddleware({ 
      ttl: 0, // No caching for mutation operations
      invalidateOnMutation: true 
    })],
  },
  customRoutes: [
    // Custom routes specific to raw cards can be added here
    // { method: 'get', path: '/stats', handler: 'getStats' }
  ],
});

module.exports = router;
