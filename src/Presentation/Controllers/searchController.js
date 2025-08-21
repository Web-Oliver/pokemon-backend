/**
 * Consolidated Search Controller
 *
 * This controller follows SOLID principles by delegating to focused controllers
 * Each controller has a single responsibility and can be extended independently
 *
 * BEFORE: 750 lines mixing unified search, entity search, and related items
 * AFTER: ~30 lines delegating to focused controllers
 */

import { search, suggest, getStats } from './search/UnifiedSearchController.js';
import { searchCards, searchProducts, searchSets } from './search/EntitySearchController.js';
import { getRelatedCards, getRelatedProducts, getRecommendations, getTrending } from './search/RelatedItemsController.js';
// Export all search functionality from focused controllers
const searchController = {
  // Unified Search functionality
  search,
  suggest,
  getStats,
  getSearchTypes: () => ({ types: ['cards', 'products', 'sets'] }), // Simple types listing
  getSearchStats: getStats, // Alias for getStats

  // Entity-specific search
  searchCards,
  searchProducts,
  searchSets,
  searchSetProducts: searchProducts, // Set products are handled by products search

  // Related items and recommendations
  getRelatedCards,
  getRelatedProducts,
  getRecommendations,
  getTrending
};

export default searchController;
