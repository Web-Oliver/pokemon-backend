/**
 * Search Service - Refactored for SOLID Compliance
 *
 * This service now acts as a facade, delegating to focused search services
 * Previously 967 lines - now delegates to 4 focused services for better maintainability
 *
 * Architecture:
 * - FlexSearchIndexManager: Index management and initialization (280 lines)
 * - CardSearchService: Card search operations with hybrid search (330 lines)
 * - ProductSearchService: Product search operations with hybrid search (310 lines)
 * - SetSearchService: Set search operations with hybrid search (290 lines)
 * - UnifiedSearchService: Cross-entity search coordination (240 lines)
 * - SearchService: Backward compatibility facade (60 lines)
 *
 * Total: 1510 lines across 6 focused modules (vs 967 lines in single file)
 * Benefits: Better maintainability, testability, and separation of concerns
 *
 * Maintains 100% backward compatibility with existing controllers
 */

import UnifiedSearchService from './UnifiedSearchService.js';
import CardSearchService from './CardSearchService.js';
import ProductSearchService from './ProductSearchService.js';
import SetSearchService from './SetSearchService.js';
import FlexSearchIndexManager from './FlexSearchIndexManager.js';
class SearchService {
  constructor() {
    this.unifiedSearchService = new UnifiedSearchService();
    this.cardSearchService = new CardSearchService();
    this.productSearchService = new ProductSearchService();
    this.setSearchService = new SetSearchService();
  }

  // === INDEX MANAGEMENT (delegated to FlexSearchIndexManager) ===

  async initializeIndexes() {
    return FlexSearchIndexManager.initializeIndexes();
  }

  // === CARD SEARCH (delegated to CardSearchService) ===

  async searchCards(query, filters = {}, options = {}) {
    return this.cardSearchService.searchCards(query, filters, options);
  }

  // === PRODUCT SEARCH (delegated to ProductSearchService) ===

  async searchProducts(query, filters = {}, options = {}) {
    return this.productSearchService.searchProducts(query, filters, options);
  }

  // === SET SEARCH (delegated to SetSearchService) ===

  async searchSets(query, filters = {}, options = {}) {
    return this.setSearchService.searchSets(query, filters, options);
  }

  // === UNIFIED SEARCH (delegated to UnifiedSearchService) ===

  async unifiedSearch(query, types = ['cards', 'products', 'sets'], options = {}) {
    return this.unifiedSearchService.unifiedSearch(query, types, options);
  }

  async getSuggestions(query, type = 'cards', options = {}) {
    return this.unifiedSearchService.getSuggestions(query, type, options);
  }

  // === UTILITY METHODS ===

  async getSearchAnalytics() {
    return this.unifiedSearchService.getSearchAnalytics();
  }

  async healthCheck() {
    return this.unifiedSearchService.healthCheck();
  }

  // === LEGACY METHODS (for backward compatibility) ===

  async searchSetProducts(query, filters = {}, options = {}) {
    // SetProducts are handled through Product search
    return this.productSearchService.searchProducts(query, filters, options);
  }
}

// Export class constructor for proper instantiation
export default SearchService;
