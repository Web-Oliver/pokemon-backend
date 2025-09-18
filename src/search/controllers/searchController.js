/**
 * Consolidated Search Controller
 *
 * This controller follows SOLID principles by delegating to focused controllers
 * Each controller has a single responsibility and can be extended independently
 *
 * BEFORE: 750 lines mixing unified search, entity search, and related items
 * AFTER: ~30 lines delegating to focused controllers
 */

import { getStats, search, suggest } from './UnifiedSearchController.js';
import { searchCards, searchProducts, searchSetProducts, searchSets } from './EntitySearchController.js';
import { getRecommendations, getTrending } from './RelatedItemsController.js';
// Export all search functionality from focused controllers
const searchController = {
    // Unified Search functionality
    search,
    suggest,
    getStats,
    getSearchStats: getStats, // Alias for getStats

    // Entity-specific search
    searchCards,
    searchProducts,
    searchSets,
    searchSetProducts, // FIXED: Now uses dedicated SetProduct search

    // Related items and recommendations
    getRecommendations,
    getTrending
};

export default searchController;
