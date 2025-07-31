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

// Card routes - using standardized cache presets
router.get('/', cachePresets.cardData, getAllCards);
router.get('/metrics', cachePresets.cardMetrics, getCardMetrics);
router.get('/:id', cachePresets.cardDetails, getCardById);

router.post('/', createCard);
router.put('/:id', updateCard);
router.delete('/:id', deleteCard);

module.exports = router;