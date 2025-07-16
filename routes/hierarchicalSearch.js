const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const hierarchicalSearchController = require('../controllers/hierarchicalSearchController');
const { searchCacheMiddleware } = require('../middleware/searchCache');

// Validation middleware
const validateSearchRequest = [
  query('type')
    .isIn(['sets', 'cards', 'products', 'categories', 'productSets'])
    .withMessage('Type must be one of: sets, cards, products, categories, productSets'),
  query('q')
    .isLength({ min: 1, max: 100 })
    .withMessage('Query must be between 1 and 100 characters')
    .trim(),
  query('setContext')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Set context must be no more than 100 characters')
    .trim(),
  query('categoryContext')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category context must be no more than 100 characters')
    .trim(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt()
];

// Unified hierarchical search endpoint
router.get('/', 
  validateSearchRequest,
  searchCacheMiddleware(),
  hierarchicalSearchController.search
);

module.exports = router;