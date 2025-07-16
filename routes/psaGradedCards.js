const express = require('express');
const router = express.Router();
const {
  getAllPsaGradedCards,
  getPsaGradedCardById,
  createPsaGradedCard,
  updatePsaGradedCard,
  deletePsaGradedCard,
  markAsSold,
} = require('../controllers/psaGradedCardsController');

router.get('/', getAllPsaGradedCards);
router.get('/:id', getPsaGradedCardById);
router.post('/', createPsaGradedCard);
router.put('/:id', updatePsaGradedCard);
router.delete('/:id', deletePsaGradedCard);
router.post('/:id/mark-sold', markAsSold);

module.exports = router;
