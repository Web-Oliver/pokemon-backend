const express = require('express');
const router = express.Router();
const { 
  getAllCards, 
  getCardById, 
  getCardsBySetId, 
  searchBestMatch,
  getAllCardsEnhanced,
  getCardByIdEnhanced,
  createCardEnhanced,
  updateCardEnhanced,
  deleteCardEnhanced,
  searchBestMatchEnhanced,
  getCardMetrics
} = require('../controllers/cardsController');
const { searchCacheMiddleware } = require('../middleware/searchCache');
const { enhancedCacheMiddleware } = require('../middleware/enhancedSearchCache');

// Legacy routes (maintain backward compatibility)
router.get('/', 
  enhancedCacheMiddleware({ 
    ttl: 480, // 8 minutes for card data
    cacheName: 'card-data',
    invalidateOnMutation: true 
  }), 
  getAllCards
);
router.get('/search-best-match', 
  enhancedCacheMiddleware({ 
    ttl: 300, // 5 minutes for search results
    cacheName: 'card-search',
    invalidateOnMutation: true 
  }), 
  searchBestMatch
);
router.get('/:id', 
  enhancedCacheMiddleware({ 
    ttl: 600, // 10 minutes for individual cards
    cacheName: 'card-details',
    invalidateOnMutation: true 
  }), 
  getCardById
);

// Enhanced routes with plugin support
router.get('/enhanced', 
  enhancedCacheMiddleware({ 
    ttl: 480, // 8 minutes for enhanced card data
    cacheName: 'card-data-enhanced',
    invalidateOnMutation: true 
  }), 
  getAllCardsEnhanced
);
router.get('/enhanced/search-best-match', 
  enhancedCacheMiddleware({ 
    ttl: 300, // 5 minutes for enhanced search
    cacheName: 'card-search-enhanced',
    invalidateOnMutation: true 
  }), 
  searchBestMatchEnhanced
);
router.get('/enhanced/metrics', 
  enhancedCacheMiddleware({ 
    ttl: 900, // 15 minutes for metrics (changes less frequently)
    cacheName: 'card-metrics',
    invalidateOnMutation: true 
  }), 
  getCardMetrics
);
router.get('/enhanced/:id', 
  enhancedCacheMiddleware({ 
    ttl: 600, // 10 minutes for enhanced card details
    cacheName: 'card-details-enhanced',
    invalidateOnMutation: true 
  }), 
  getCardByIdEnhanced
);
router.post('/enhanced', createCardEnhanced);
router.put('/enhanced/:id', updateCardEnhanced);
router.delete('/enhanced/:id', deleteCardEnhanced);

module.exports = router;
