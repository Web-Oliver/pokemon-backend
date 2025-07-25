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
router.get('/', getAllCards);
router.get('/search-best-match', searchCacheMiddleware(300), searchBestMatch);
router.get('/:id', getCardById);

// Enhanced routes with plugin support
router.get('/enhanced', enhancedCacheMiddleware(), getAllCardsEnhanced);
router.get('/enhanced/search-best-match', enhancedCacheMiddleware(), searchBestMatchEnhanced);
router.get('/enhanced/metrics', getCardMetrics);
router.get('/enhanced/:id', enhancedCacheMiddleware(), getCardByIdEnhanced);
router.post('/enhanced', createCardEnhanced);
router.put('/enhanced/:id', updateCardEnhanced);
router.delete('/enhanced/:id', deleteCardEnhanced);

module.exports = router;
