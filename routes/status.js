const express = require('express');
const router = express.Router();
const Card = require('../models/Card');
const Set = require('../models/Set');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');

// Status endpoint to check database contents
router.get('/', async (req, res) => {
  try {
    const [cardCount, setCount, productCount] = await Promise.all([
      Card.countDocuments(),
      Set.countDocuments(),
      CardMarketReferenceProduct.countDocuments()
    ]);

    res.json({
      success: true,
      data: {
        cards: cardCount,
        sets: setCount,
        products: productCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database status',
      error: error.message
    });
  }
});

module.exports = router;