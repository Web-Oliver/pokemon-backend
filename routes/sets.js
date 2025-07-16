const express = require('express');
const router = express.Router();
const { getAllSets, getSetById, getSetsWithPagination } = require('../controllers/setsController');
const { getCardsBySetId } = require('../controllers/cardsController');

router.get('/', getSetsWithPagination);
router.get('/:setId/cards', getCardsBySetId);
router.get('/:id', getSetById);

module.exports = router;
