const express = require('express');
const router = express.Router();
const { getAllSets, getSetById, getSetsWithPagination } = require('../controllers/setsController');
const { getCardsBySetId } = require('../controllers/cardsController');
const { enhancedCacheMiddleware } = require('../middleware/enhancedSearchCache');

router.get('/', 
  enhancedCacheMiddleware({ 
    ttl: 1200, // 20 minutes for set data (changes infrequently)
    cacheName: 'set-data',
    invalidateOnMutation: true 
  }), 
  getSetsWithPagination
);
router.get('/:setId/cards', 
  enhancedCacheMiddleware({ 
    ttl: 600, // 10 minutes for cards by set
    cacheName: 'set-cards',
    invalidateOnMutation: true 
  }), 
  getCardsBySetId
);
router.get('/:id', 
  enhancedCacheMiddleware({ 
    ttl: 1200, // 20 minutes for individual sets
    cacheName: 'set-details',
    invalidateOnMutation: true 
  }), 
  getSetById
);

module.exports = router;
