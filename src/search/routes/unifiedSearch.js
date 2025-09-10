import express from 'express';
const router = express.Router();
import searchController from '@/search/controllers/searchController.js';
import { searchCacheMiddleware } from '@/search/middleware/searchCache.js';
import { validationMiddlewares } from '@/system/middleware/validationMiddleware.js';
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
// Search routes - using standardized cache presets with validation
router.get('/', validationMiddlewares.validateSearchEndpoint, searchCacheMiddleware(), searchController.search);

/**
 * @route   GET /api/search/suggest
 * @desc    Search suggestions across multiple types
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} types - Comma-separated list of types to search (optional, defaults to 'cards,products,sets')
 * @query   {number} limit - Maximum suggestions per type (optional, default 5)
 */
router.get('/suggest', validationMiddlewares.validateSearchQuery, searchCacheMiddleware(), searchController.suggest);

/**
 * @route   GET /api/search/cards
 * @desc    Search cards with hierarchical filtering and population support
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} setId - Set ObjectId filter (optional, preferred for hierarchical search)
 * @query   {string} setName - Set name filter (optional, fallback)
 * @query   {number} year - Year filter (optional)
 * @query   {string} cardNumber - Card number filter (optional)
 * @query   {string} variety - Variety filter (optional)
 * @query   {string} populate - Fields to populate, e.g. 'setId' (optional)
 * @query   {string} exclude - Card ID to exclude from results (for related cards)
 * @query   {number} limit - Maximum results (optional, default 20)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {string} sort - Sort criteria as JSON string (optional)
 */
router.get('/cards', validationMiddlewares.validateSearchEndpoint, searchCacheMiddleware(), searchController.searchCards);

/**
 * @route   GET /api/search/products
 * @desc    Search products with hierarchical filtering and population support
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} category - Category filter (optional)
 * @query   {string} setProductId - SetProduct ObjectId filter (optional, preferred for hierarchical search)
 * @query   {string} setName - Set name filter (optional, fallback)
 * @query   {string} populate - Fields to populate, e.g. 'setProductId' (optional)
 * @query   {string} exclude - Product ID to exclude from results (for related products)
 * @query   {number} minPrice - Minimum price filter (optional)
 * @query   {number} maxPrice - Maximum price filter (optional)
 * @query   {boolean} availableOnly - Show only available products (optional)
 * @query   {number} limit - Maximum results (optional, default 20)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {string} sort - Sort criteria as JSON string (optional)
 */
router.get('/products', validationMiddlewares.validateSearchEndpoint, searchCacheMiddleware(), searchController.searchProducts);

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
router.get('/sets', validationMiddlewares.validateSearchEndpoint, searchCacheMiddleware(), searchController.searchSets);

/**
 * @route   GET /api/search/set-products
 * @desc    Search set products (top-level categories like "Elite Trainer Box")
 * @access  Public
 * @query   {string} query - Search query (optional, defaults to show all)
 * @query   {number} limit - Maximum results (optional, default 10)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {string} sort - Sort criteria as JSON string (optional)
 */
router.get('/set-products', validationMiddlewares.validateSearchEndpoint, searchCacheMiddleware(), searchController.searchSetProducts);

/**
 * @route   GET /api/search/stats
 * @desc    Get search statistics
 * @access  Public
 */
router.get('/stats', searchController.getSearchStats);

export default router;
