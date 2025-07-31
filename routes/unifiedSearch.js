const express = require('express');
const router = express.Router();
const unifiedSearchController = require('../controllers/search/UnifiedSearchController');
const { enhancedCacheMiddleware } = require('../middleware/enhancedSearchCache');

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
router.get('/', 
  enhancedCacheMiddleware({ 
    ttl: 600, // 10 minutes for general search
    cacheName: 'unified-search',
    invalidateOnMutation: true 
  }), 
  unifiedSearchController.search
);

/**
 * @route   GET /api/search/suggest
 * @desc    Search suggestions across multiple types
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} types - Comma-separated list of types to search (optional, defaults to 'cards,products,sets')
 * @query   {number} limit - Maximum suggestions per type (optional, default 5)
 */
router.get('/suggest', 
  enhancedCacheMiddleware({ 
    ttl: 900, // 15 minutes for suggestions (more stable)
    cacheName: 'search-suggestions',
    invalidateOnMutation: true 
  }), 
  unifiedSearchController.suggest
);

/**
 * @route   GET /api/search/cards
 * @desc    Search cards using new architecture
 * @access  Public
 * @query   {string} query - Search query (required)
 * @query   {string} setId - Set ID filter (optional)
 * @query   {string} setName - Set name filter (optional)
 * @query   {number} year - Year filter (optional)
 * @query   {string} pokemonNumber - Pokemon number filter (optional)
 * @query   {string} variety - Variety filter (optional)
 * @query   {number} minPsaPopulation - Minimum PSA population filter (optional)
 * @query   {number} limit - Maximum results (optional, default 20)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {string} sort - Sort criteria as JSON string (optional)
 */
router.get('/cards', 
  enhancedCacheMiddleware({ 
    ttl: 480, // 8 minutes for card searches
    cacheName: 'card-search',
    invalidateOnMutation: true 
  }), 
  unifiedSearchController.searchCards
);

/**
 * @route   GET /api/search/products
 * @desc    Search products using new architecture
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
router.get('/products', 
  enhancedCacheMiddleware({ 
    ttl: 300, // 5 minutes for product searches (prices change more frequently)
    cacheName: 'product-search',
    invalidateOnMutation: true 
  }), 
  unifiedSearchController.searchProducts
);

/**
 * @route   GET /api/search/sets
 * @desc    Search sets using new architecture
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
router.get('/sets', 
  enhancedCacheMiddleware({ 
    ttl: 1200, // 20 minutes for set searches (sets change infrequently)
    cacheName: 'set-search',
    invalidateOnMutation: true 
  }), 
  unifiedSearchController.searchSets
);

/**
 * @route   GET /api/search/types
 * @desc    Get available search types and their options
 * @access  Public
 */
router.get('/types', unifiedSearchController.getSearchTypes);

/**
 * @route   GET /api/search/stats
 * @desc    Get search factory statistics
 * @access  Public
 */
router.get('/stats', unifiedSearchController.getSearchStats);

module.exports = router;
