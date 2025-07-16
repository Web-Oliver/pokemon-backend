const express = require('express');
const router = express.Router();
const {
  getAllCardMarketRefProducts,
  getCardMarketRefProductById,
} = require('../controllers/cardMarketRefProductsController');

router.get('/', getAllCardMarketRefProducts);
router.get('/:id', getCardMarketRefProductById);

module.exports = router;
