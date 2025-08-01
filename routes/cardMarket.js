/**
 * CardMarket Routes
 * Layer 4: Presentation - Modern route structure for CardMarket operations
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const CardMarketSearchService = require('../services/cardMarket/CardMarketSearchService');
const { cachePresets } = require('../middleware/cachePresets');

/**
 * @route   GET /api/cardmarket/search
 * @desc    Search CardMarket reference products with pagination
 * @access  Public
 * @query   {number} page - Page number (optional, default 1)
 * @query   {number} limit - Results per page (optional, default 20)
 * @query   {string} category - Filter by category (optional)
 * @query   {string} setName - Filter by set name (optional)
 * @query   {boolean} availableOnly - Show only available products (optional)
 */
router.get('/search', cachePresets.cardMarketSearch, asyncHandler(async (req, res) => {
  const { page, limit, category, setName, availableOnly } = req.query;

  const service = new CardMarketSearchService();
  const results = await service.searchProducts({
    page: parseInt(page),
    limit: parseInt(limit),
    category,
    setName,
    availableOnly: availableOnly === 'true'
  });

  res.json(results);
}));

/**
 * @route   GET /api/cardmarket/categories
 * @desc    Get all product categories with counts
 * @access  Public
 */
router.get('/categories', cachePresets.cardMarketData, asyncHandler(async (req, res) => {
  const service = new CardMarketSearchService();
  const categories = await service.getCategories();

  res.json({
    success: true,
    data: categories
  });
}));

/**
 * @route   GET /api/cardmarket/categories/:category
 * @desc    Get detailed information about a specific category
 * @access  Public
 */
router.get('/categories/:category', cachePresets.cardMarketData, asyncHandler(async (req, res) => {
  const service = new CardMarketSearchService();
  const details = await service.getCategoryDetails(req.params.category);

  res.json({
    success: true,
    data: details
  });
}));

module.exports = router;