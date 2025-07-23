const express = require('express');
const router = express.Router();
const {
  getAllCardMarketRefProducts,
  getCardMarketRefProductById,
  getCardMarketSetNames,
} = require('../controllers/cardMarketRefProductsController');

router.get('/set-names', getCardMarketSetNames);
router.get('/', getAllCardMarketRefProducts);
router.get('/:id', getCardMarketRefProductById);

module.exports = router;
