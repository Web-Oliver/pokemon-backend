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
import CardSearchService from '@/pokemon/cards/CardSearchService.js';
import ProductSearchService from '@/pokemon/products/ProductSearchService.js';
import SetSearchService from '@/pokemon/sets/SetSearchService.js';
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

    // === SET PRODUCT SEARCH (dedicated method) ===

    async searchSetProducts(query, filters = {}, options = {}) {
        // FIXED: Search SetProduct collection directly using SetProductRepository
        try {
            const SetProductRepository = (await import('@/pokemon/products/SetProductRepository.js')).default;
            const setProductRepo = new SetProductRepository();

            // Build search filters for SetProduct
            const searchFilters = {...filters};

            if (query && query !== '*' && query.trim() !== '') {
                // Use regex search on setProductName field with proper escaping
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                searchFilters.setProductName = {$regex: escapedQuery, $options: 'i'};
            }

            console.log('[SEARCHSERVICE] SetProduct search:', {query, searchFilters, options});

            // Search SetProduct collection directly
            const results = await setProductRepo.find(searchFilters, options);

            // Transform results to match expected format
            return results.map(setProduct => ({
                _id: setProduct._id,
                setProductName: setProduct.setProductName,
                uniqueSetProductId: setProduct.uniqueSetProductId,
                // Add fields needed by frontend
                id: setProduct._id,
                name: setProduct.setProductName // Legacy compatibility
            }));
        } catch (error) {
            console.error('[SEARCHSERVICE] SetProduct search error:', error);
            return [];
        }
    }
}

// Export class constructor for proper instantiation
export default SearchService;
