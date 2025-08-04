/**
 * Product Routes
 * Layer 4: Presentation - Modern route structure for Product operations (SetProduct → Product hierarchy)
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const ProductSearchService = require('../services/products/ProductSearchService');
const { cachePresets } = require('../middleware/cachePresets');

/**
 * @route   GET /api/products/search
 * @desc    Search products with pagination (SetProduct → Product hierarchy)
 * @access  Public
 * @query   {number} page - Page number (optional, default 1)
 * @query   {number} limit - Results per page (optional, default 20)
 * @query   {string} category - Filter by category (optional)
 * @query   {string} setName - Filter by set name (optional)
 * @query   {boolean} availableOnly - Show only available products (optional)
 */
router.get('/search', cachePresets.productSearch, asyncHandler(async (req, res) => {
  const { page, limit, category, setName, availableOnly } = req.query;

  const service = new ProductSearchService();
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
 * @route   GET /api/products/categories
 * @desc    Get all product categories with counts
 * @access  Public
 */
router.get('/categories', cachePresets.productData, asyncHandler(async (req, res) => {
  const service = new ProductSearchService();
  const categories = await service.getCategories();

  res.json({
    success: true,
    data: categories
  });
}));

/**
 * @route   GET /api/products/categories/:category
 * @desc    Get detailed information about a specific category
 * @access  Public
 */
router.get('/categories/:category', cachePresets.productData, asyncHandler(async (req, res) => {
  const service = new ProductSearchService();
  const details = await service.getCategoryDetails(req.params.category);

  res.json({
    success: true,
    data: details
  });
}));

module.exports = router;