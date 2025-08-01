const express = require('express');
const router = express.Router();
const { 
  getAllCards, 
  getCardById, 
  createCard,
  updateCard,
  deleteCard,
  getCardMetrics
} = require('../controllers/cardsController');
const { cachePresets } = require('../middleware/cachePresets');

// Card routes - READ-ONLY reference data
router.get('/', cachePresets.cardData, getAllCards);
router.get('/metrics', cachePresets.cardMetrics, getCardMetrics);
router.get('/:id', cachePresets.cardDetails, getCardById);

// ENHANCED ROUTES REMOVED - Over-engineered duplication
// Frontend should use standard routes: GET /cards, GET /cards/:id, GET /cards/metrics
// Removed to maintain DRY principles and avoid redundancy

// CRUD operations removed - cards are reference data, not collection items

module.exports = router;