import { asyncHandler, ValidationError } from '@/system/middleware/CentralizedErrorHandler.js';
import UnifiedSearchService from '@/search/services/UnifiedSearchService.js';
import Logger from '@/system/logging/Logger.js';

/**
 * Unified Search Controller for hierarchical search functionality
 * Supports manual card addition workflows
 */
class UnifiedSearchController {
    /**
     * Unified search across multiple types
     */
    search = asyncHandler(async (req, res) => {
        const { query, types, type, domain, limit, page, sort, filters } = req.query;

        // Allow empty queries for unified search (consistent with individual search endpoints)
        let searchQuery = query;

        Logger.operationStart('Search', 'UNIFIED SEARCH', {
            query: searchQuery,
            types: types || type || 'auto-detect'
        });

        try {
            // await this.executeHooks('beforeOperation', operation, req.query, context);

            if (!query || typeof query !== 'string' || query.trim() === '') {
                searchQuery = '*'; // Use wildcard for "show all" functionality
            }

            // DOMAIN-AWARE SEARCH: Respect domain boundaries
            let searchTypes;

            if (domain) {
                // HIERARCHICAL SEARCH: Domain-specific search types
                const domainMap = {
                    'cards': ['cards', 'sets'], // Card Domain: Set → Card hierarchy
                    'products': ['products', 'setProducts'], // Product Domain: SetProduct → Product hierarchy
                    'card-domain': ['cards', 'sets'], // Alias for clarity
                    'product-domain': ['products', 'setProducts'] // Alias for clarity
                };

                searchTypes = domainMap[domain] || domainMap.cards; // Default to card domain
                console.log(`[DOMAIN SEARCH] Using domain "${domain}" with types:`, searchTypes);
            } else if (type) {
                // Frontend sends specific type - map to correct domain-specific search
                const typeMap = {
                    'sets': ['sets'], // Card Domain: Set entities only
                    'cards': ['cards'], // Card Domain: Card entities only
                    'products': ['products'], // Product Domain: Product entities only
                    'set-products': ['setProducts'], // Product Domain: SetProduct entities only
                    'all': ['cards', 'products', 'sets', 'setProducts'] // All domains (fallback)
                };

                searchTypes = typeMap[type] || [type]; // Use mapping or fallback to raw type
            } else if (types) {
                // Legacy support for comma-separated types
                searchTypes = types.split(',').map(t => t.trim());
            } else {
                // CHANGED: Default to card domain only (was mixing both domains)
                searchTypes = ['cards', 'sets']; // Card domain only
                console.log('[DOMAIN SEARCH] No domain specified, defaulting to card domain');
            }

            // Parse options
            const options = {
                limit: limit ? parseInt(limit, 10) : 20,
                page: page ? parseInt(page, 10) : 1,
                sort: sort ? JSON.parse(sort) : undefined,
                filters: filters ? JSON.parse(filters) : {}
            };

            const results = await this.service.unifiedSearch(searchQuery, searchTypes, options);

            // Execute after operation hooks
            // await this.executeHooks('afterOperation', operation, results, context);

            Logger.operationSuccess('Search', 'UNIFIED SEARCH', {
                resultCount: Object.keys(results).length,
                searchQuery: searchQuery,
                searchTypes: searchTypes
            });

            const responseData = {
                success: true,
                data: results,
                meta: {
                    query: searchQuery,
                    types: searchTypes,
                    totalTypes: Object.keys(results).length
                }
            };

            // Execute before response hooks
            // responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            // await this.executeHooks('onError', operation, error, context);

            Logger.operationError('Search', 'UNIFIED SEARCH', error, {
                query: searchQuery,
                types: types || type || 'auto-detect'
            });
            throw error;
        }
    });
    /**
     * Search suggestions across multiple types
     */
    suggest = asyncHandler(async (req, res) => {
        const { query, types, limit } = req.query;

        Logger.operationStart('Search', 'SUGGESTIONS', {
            query: query,
            types: types || 'cards'
        });

        try {
            // await this.executeHooks('beforeOperation', operation, req.query, context);

            // Require query for suggestions (suggestions need something to search for)
            if (!query || typeof query !== 'string' || query.trim() === '') {
                throw new ValidationError('Query parameter is required and must be a string for suggestions');
            }

            const searchTypes = types ? types.split(',').map(t => t.trim()) : ['cards'];
            const suggestionLimit = limit ? parseInt(limit, 10) : 5;

            const results = {};

            // Get suggestions for each type
            for (const type of searchTypes) {
                results[type] = await this.service.getSuggestions(query, type, { limit: suggestionLimit });
            }

            // Execute after operation hooks
            // await this.executeHooks('afterOperation', operation, results, context);

            Logger.operationSuccess('Search', 'SUGGESTIONS', {
                resultCount: Object.keys(results).length,
                totalSuggestions: Object.values(results).reduce((sum, suggestions) => sum + suggestions.length, 0)
            });

            const responseData = {
                success: true,
                data: results,
                meta: {
                    query,
                    types: searchTypes,
                    totalSuggestions: Object.values(results).reduce((sum, suggestions) => sum + suggestions.length, 0)
                }
            };

            // Execute before response hooks
            // responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            // await this.executeHooks('onError', operation, error, context);

            Logger.operationError('Search', 'SUGGESTIONS', error, {
                query: query,
                types: types || 'cards'
            });
            throw error;
        }
    });
    /**
     * Search statistics across all searchable types
     */
    getStats = asyncHandler(async (req, res) => {

        Logger.operationStart('Search', 'GET STATS', {});

        try {
            // await this.executeHooks('beforeOperation', operation, {}, context);

            // Use dynamic imports to avoid circular dependencies
            const Card = (await import('@/pokemon/cards/Card.js')).default;
            const Set = (await import('@/pokemon/sets/Set.js')).default;
            const Product = (await import('@/pokemon/products/Product.js')).default;
            const SetProduct = (await import('@/pokemon/products/SetProduct.js')).default;

            const [cardCount, setCount, productCount, setProductCount] = await Promise.all([
                Card.countDocuments(),
                Set.countDocuments(),
                Product.countDocuments(),
                SetProduct.countDocuments()
            ]);

            const stats = {
                totalCards: cardCount,
                totalSets: setCount,
                totalProducts: productCount,
                totalSetProducts: setProductCount,
                searchTypes: ['cards', 'products', 'sets', 'setProducts']
            };

            // Execute after operation hooks
            // await this.executeHooks('afterOperation', operation, stats, context);

            Logger.operationSuccess('Search', 'GET STATS', {
                totalEntities: cardCount + setCount + productCount + setProductCount
            });

            const responseData = {
                success: true,
                data: stats
            };

            // Execute before response hooks
            // responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            // await this.executeHooks('onError', operation, error, context);

            Logger.operationError('Search', 'GET STATS', error);
            throw error;
        }
    });

    constructor() {
        this.service = new UnifiedSearchService();
    }
}

// Lazy controller instance creation
let unifiedSearchController = null;

const getController = () => {
    if (!unifiedSearchController) {
        unifiedSearchController = new UnifiedSearchController();
    }
    return unifiedSearchController;
};

// Export controller methods for route binding with lazy initialization
const search = (req, res, next) => getController().search(req, res, next);
const suggest = (req, res, next) => getController().suggest(req, res, next);
const getStats = (req, res, next) => getController().getStats(req, res, next);

// Export individual methods for route compatibility
export {
    search,
    suggest,
    getStats
};

// Export controller instance accessor for advanced usage
export const getUnifiedSearchController = getController;

// Default export for backward compatibility
export default search;
