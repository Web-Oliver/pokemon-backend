const express = require('express');
const router = express.Router();
const { getAllCards, getCardById, getCardsBySetId, searchBestMatch } = require('../controllers/cardsController');
const { searchCacheMiddleware } = require('../middleware/searchCache');

router.get('/', getAllCards);
router.get('/search-best-match', searchCacheMiddleware(300), searchBestMatch);
router.get('/:id', getCardById);

module.exports = router;
