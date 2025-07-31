const express = require('express');
const router = express.Router();
const { getAllSets, getSetById, getSetsWithPagination } = require('../controllers/setsController');
const { getCardsBySetId } = require('../controllers/cardsController');
const { cachePresets } = require('../middleware/cachePresets');

// Set routes - using standardized cache presets
router.get('/', cachePresets.setData, getSetsWithPagination);
router.get('/:setId/cards', cachePresets.setCards, getCardsBySetId);
router.get('/:id', cachePresets.setDetails, getSetById);

module.exports = router;
