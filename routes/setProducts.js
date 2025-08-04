/**
 * SetProduct Routes
 * Layer 4: Presentation - SetProduct operations following Set → Card hierarchy pattern
 */

const express = require('express');
const router = express.Router();
const {
  getAllSetProducts,
  getSetProductsWithPagination,
  getSetProductById,
  getSetProductByName,
  getSetProductStats
} = require('../controllers/setProductsController');
const { asyncHandler } = require('../middleware/errorHandler');
const SetProductService = require('../services/products/SetProductService');
const { cachePresets } = require('../middleware/cachePresets');

/**
 * @route   GET /api/set-products
 * @desc    Get set products with pagination and search
 * @access  Public
 * @query   {number} page - Page number (optional, default 1)
 * @query   {number} limit - Results per page (optional, default 20)
 * @query   {string} q - Search query for set product name (optional)
 * @query   {string} name - Alternative search parameter (optional)
 */
router.get('/', cachePresets.setData, getSetProductsWithPagination);

/**
 * @route   GET /api/set-products/search
 * @desc    Advanced search for set products using service layer
 * @access  Public
 * @query   {string} query - Search query
 * @query   {number} page - Page number
 * @query   {number} limit - Results per page
 * @query   {string} sortBy - Sort field (default: setProductName)
 * @query   {string} sortOrder - Sort order: asc/desc (default: asc)
 */
router.get('/search', cachePresets.productSearch, asyncHandler(async (req, res) => {
  const { query, page, limit, sortBy, sortOrder } = req.query;

  const service = new SetProductService();
  const results = await service.searchSetProducts({
    query,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    sortBy,
    sortOrder
  });

  res.json({
    success: true,
    data: results
  });
}));

/**
 * @route   GET /api/set-products/stats
 * @desc    Get SetProduct statistics and analytics
 * @access  Public
 */
router.get('/stats', cachePresets.setData, asyncHandler(async (req, res) => {
  const service = new SetProductService();
  const stats = await service.getSetProductStatistics();

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * @route   GET /api/set-products/with-counts
 * @desc    Get SetProducts with their product counts
 * @access  Public
 * @query   {number} limit - Max results (optional, default 50)
 * @query   {string} sortBy - Sort field (optional, default: productCount)
 * @query   {string} sortOrder - Sort order: asc/desc (optional, default: desc)
 */
router.get('/with-counts', cachePresets.setData, asyncHandler(async (req, res) => {
  const { limit, sortBy, sortOrder } = req.query;

  const service = new SetProductService();
  const setProducts = await service.getSetProductsWithCounts({
    limit: parseInt(limit) || 50,
    sortBy,
    sortOrder
  });

  res.json({
    success: true,
    data: setProducts
  });
}));

/**
 * @route   GET /api/set-products/name/:name
 * @desc    Get set product by name (case-insensitive)
 * @access  Public
 * @param   {string} name - Set product name
 */
router.get('/name/:name', cachePresets.setDetails, getSetProductByName);

/**
 * @route   GET /api/set-products/:id
 * @desc    Get set product by ID
 * @access  Public
 * @param   {string} id - Set product ObjectId
 */
router.get('/:id', cachePresets.setDetails, getSetProductById);

/**
 * @route   GET /api/set-products/:id/products
 * @desc    Get all products for a specific set product
 * @access  Public
 * @param   {string} id - Set product ObjectId
 * @query   {number} page - Page number (optional, default 1)
 * @query   {number} limit - Results per page (optional, default 20)
 * @query   {string} category - Filter by category (optional)
 * @query   {boolean} availableOnly - Show only available products (optional)
 */
router.get('/:id/products', cachePresets.productData, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, category, availableOnly } = req.query;

  const service = new SetProductService();
  const results = await service.getProductsBySetProduct(id, {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    category,
    availableOnly: availableOnly === 'true'
  });

  res.json({
    success: true,
    data: results
  });
}));

module.exports = router;