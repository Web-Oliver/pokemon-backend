const express = require('express');
const router = express.Router();
const {
  getAllRawCards,
  getRawCardById,
  createRawCard,
  updateRawCard,
  deleteRawCard,
  markAsSold,
} = require('../controllers/rawCardsController');

router.get('/', getAllRawCards);
router.get('/:id', getRawCardById);
router.post('/', createRawCard);
router.put('/:id', updateRawCard);
router.delete('/:id', deleteRawCard);
router.post('/:id/mark-sold', markAsSold);

module.exports = router;
