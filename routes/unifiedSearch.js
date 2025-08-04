const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { cachePresets } = require('../middleware/cachePresets');

/**
 * Unified Search Routes
 *
 * Modern search routes using the new search architecture.
 * Provides unified search functionality across all models using
 * the Strategy pattern and dependency injection.
 *
 * These routes will replace the old hierarchical search routes.
 */

/**
 * @route   GET /api/search/
 * @desc    Unified search across multiple types
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} types - Comma-separated list of types to search (optional, defaults to 'cards,products,sets')
 * @query   {number} limit - Maximum results per type (optional, default 20)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {string} sort - Sort criteria as JSON string (optional)
 * @query   {string} filters - Filters as JSON string (optional)
 */
// Search routes - using standardized cache presets
router.get('/', cachePresets.search, searchController.search);

/**
 * @route   GET /api/search/suggest
 * @desc    Search suggestions across multiple types
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} types - Comma-separated list of types to search (optional, defaults to 'cards,products,sets')
 * @query   {number} limit - Maximum suggestions per type (optional, default 5)
 */
router.get('/suggest', cachePresets.searchSuggestions, searchController.suggest);

/**
 * @route   GET /api/search/cards
 * @desc    Search cards
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} setId - Set ID filter (optional)
 * @query   {string} setName - Set name filter (optional)
 * @query   {number} year - Year filter (optional)
 * @query   {string} cardNumber - Card number filter (optional)
 * @query   {string} variety - Variety filter (optional)
 * @query   {number} minPsaPopulation - Minimum PSA population filter (optional)
 * @query   {number} limit - Maximum results (optional, default 20)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {string} sort - Sort criteria as JSON string (optional)
 */
router.get('/cards', cachePresets.searchCards, searchController.searchCards);

/**
 * @route   GET /api/search/products
 * @desc    Search products
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} category - Category filter (optional)
 * @query   {string} setName - Set name filter (optional)
 * @query   {number} minPrice - Minimum price filter (optional)
 * @query   {number} maxPrice - Maximum price filter (optional)
 * @query   {boolean} availableOnly - Show only available products (optional)
 * @query   {number} limit - Maximum results (optional, default 20)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {string} sort - Sort criteria as JSON string (optional)
 */
router.get('/products', cachePresets.searchProducts, searchController.searchProducts);

/**
 * @route   GET /api/search/sets
 * @desc    Search sets
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {number} year - Year filter (optional)
 * @query   {number} minYear - Minimum year filter (optional)
 * @query   {number} maxYear - Maximum year filter (optional)
 * @query   {number} minPsaPopulation - Minimum PSA population filter (optional)
 * @query   {number} minCardCount - Minimum card count filter (optional)
 * @query   {number} limit - Maximum results (optional, default 20)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {string} sort - Sort criteria as JSON string (optional)
 */
router.get('/sets', cachePresets.searchSets, searchController.searchSets);

/**
 * @route   GET /api/search/types
 * @desc    Get available search types and their options
 * @access  Public
 */
router.get('/types', searchController.getSearchTypes);

/**
 * @route   GET /api/search/stats
 * @desc    Get search statistics
 * @access  Public
 */
router.get('/stats', searchController.getSearchStats);

module.exports = router;
