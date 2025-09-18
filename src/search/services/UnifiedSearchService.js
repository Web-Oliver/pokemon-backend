/**
 * Unified Search Service
 *
 * Single Responsibility: Orchestrates searches across multiple entity types
 * Coordinates CardSearchService, ProductSearchService, and SetSearchService
 * Provides unified search interface and suggestion functionality
 */

import CardSearchService from '@/pokemon/cards/CardSearchService.js';
import ProductSearchService from '@/pokemon/products/ProductSearchService.js';
import SetSearchService from '@/pokemon/sets/SetSearchService.js';
import Logger from '@/system/logging/Logger.js';

class UnifiedSearchService {
    constructor() {
        this.cardSearchService = new CardSearchService();
        this.productSearchService = new ProductSearchService();
        this.setSearchService = new SetSearchService();
    }

    /**
     * Unified search across multiple entity types
     *
     * @param {string} query - Search query
     * @param {Array} types - Types to search (cards, products, sets, setProducts)
     * @param {Object} options - Search options
     * @returns {Object} Combined search results
     */
    async unifiedSearch(query, types = ['cards', 'products', 'sets'], options = {}) {
        const { limit = 20 } = options;
        const perTypeLimit = Math.ceil(limit / types.length);

        Logger.operationStart('UNIFIED_SEARCH', 'Starting unified search', {
            query: query?.substring(0, 50),
            types,
            totalLimit: limit,
            perTypeLimit
        });

        try {
            const searchPromises = [];

            // Search cards if requested
            if (types.includes('cards')) {
                searchPromises.push(
                    this.cardSearchService.searchCards(query, {}, {
                        limit: perTypeLimit,
                        offset: 0,
                        populate: true
                    }).then(result => ({ type: 'cards', ...result }))
                );
            }

            // Search products if requested
            if (types.includes('products')) {
                searchPromises.push(
                    this.productSearchService.searchProducts(query, {}, {
                        limit: perTypeLimit,
                        offset: 0,
                        populate: true
                    }).then(result => ({ type: 'products', ...result }))
                );
            }

            // Search sets if requested
            if (types.includes('sets')) {
                searchPromises.push(
                    this.setSearchService.searchSets(query, {}, {
                        limit: perTypeLimit,
                        offset: 0,
                        populate: false
                    }).then(result => ({ type: 'sets', ...result }))
                );
            }

            // Execute all searches in parallel
            const searchResults = await Promise.all(searchPromises);

            // Combine results
            const combinedResults = {
                query,
                types,
                results: {},
                totalFound: 0,
                searchMethods: {}
            };

            searchResults.forEach(result => {
                const { type, cards, products, sets, total, searchMethod, ...metadata } = result;

                combinedResults.results[type] = {
                    items: cards || products || sets || [],
                    total: total || 0,
                    metadata
                };

                combinedResults.totalFound += total || 0;
                combinedResults.searchMethods[type] = searchMethod;
            });

            Logger.operationSuccess('UNIFIED_SEARCH', 'Unified search completed', {
                query: query?.substring(0, 50),
                totalFound: combinedResults.totalFound,
                typesSearched: types.length,
                searchMethods: Object.keys(combinedResults.searchMethods).join(', ')
            });

            return combinedResults;

        } catch (error) {
            Logger.operationError('UNIFIED_SEARCH', 'Unified search failed', error, {
                query: query?.substring(0, 50),
                types
            });
            throw error;
        }
    }

    /**
     * Get suggestions across all entity types
     *
     * @param {string} query - Search query
     * @param {string} type - Preferred type (cards, products, sets, all)
     * @param {Object} options - Search options
     * @returns {Array} Array of suggestions
     */
    async getSuggestions(query, type = 'cards', options = {}) {
        const { limit = 10 } = options;

        if (!query || query.trim().length < 2) {
            return [];
        }

        Logger.operationStart('UNIFIED_SUGGESTIONS', 'Getting unified suggestions', {
            query: query?.substring(0, 50),
            type,
            limit
        });

        try {
            let suggestions = [];

            switch (type) {
                case 'cards':
                    suggestions = await this.cardSearchService.getCardSuggestions(query, { limit });
                    break;

                case 'products':
                    suggestions = await this.productSearchService.getProductSuggestions(query, { limit });
                    break;

                case 'sets':
                    suggestions = await this.setSearchService.getSetSuggestions(query, { limit });
                    break;

                case 'all':
                default:
                    // Get suggestions from all types
                    const perTypeLimit = Math.ceil(limit / 3);

                    const [cardSuggestions, productSuggestions, setSuggestions] = await Promise.all([
                        this.cardSearchService.getCardSuggestions(query, { limit: perTypeLimit }),
                        this.productSearchService.getProductSuggestions(query, { limit: perTypeLimit }),
                        this.setSearchService.getSetSuggestions(query, { limit: perTypeLimit })
                    ]);

                    suggestions = [
                        ...cardSuggestions,
                        ...productSuggestions,
                        ...setSuggestions
                    ].slice(0, limit);
                    break;
            }

            Logger.operationSuccess('UNIFIED_SUGGESTIONS', 'Unified suggestions completed', {
                query: query?.substring(0, 50),
                type,
                suggestionsFound: suggestions.length
            });

            return suggestions;

        } catch (error) {
            Logger.operationError('UNIFIED_SUGGESTIONS', 'Failed to get unified suggestions', error, {
                query: query?.substring(0, 50),
                type
            });
            return [];
        }
    }

    /**
     * Search specific entity type using appropriate service
     *
     * @param {string} entityType - Entity type (cards, products, sets)
     * @param {string} query - Search query
     * @param {Object} filters - Search filters
     * @param {Object} options - Search options
     * @returns {Object} Search results
     */
    async searchEntityType(entityType, query, filters = {}, options = {}) {
        Logger.operationStart('ENTITY_TYPE_SEARCH', `Starting ${entityType} search`, {
            entityType,
            query: query?.substring(0, 50),
            filtersCount: Object.keys(filters).length
        });

        try {
            let result;

            switch (entityType) {
                case 'cards':
                    result = await this.cardSearchService.searchCards(query, filters, options);
                    break;

                case 'products':
                    result = await this.productSearchService.searchProducts(query, filters, options);
                    break;

                case 'sets':
                    result = await this.setSearchService.searchSets(query, filters, options);
                    break;

                default:
                    throw new Error(`Invalid entity type: ${entityType}. Must be one of: cards, products, sets`);
            }

            Logger.operationSuccess('ENTITY_TYPE_SEARCH', `${entityType} search completed`, {
                entityType,
                query: query?.substring(0, 50),
                resultsFound: result.total
            });

            return result;

        } catch (error) {
            Logger.operationError('ENTITY_TYPE_SEARCH', `${entityType} search failed`, error, {
                entityType,
                query: query?.substring(0, 50)
            });
            throw error;
        }
    }

    /**
     * Get search analytics and performance metrics
     *
     * @returns {Object} Search analytics
     */
    async getSearchAnalytics() {
        try {
            Logger.operationStart('SEARCH_ANALYTICS', 'Gathering search analytics');

            // This would typically integrate with your analytics/monitoring system
            // For now, we'll return basic system status
            const analytics = {
                indexStatus: {
                    cards: true, // FlexSearch indexes initialized
                    products: true,
                    sets: true
                },
                searchServices: {
                    cardSearch: 'active',
                    productSearch: 'active',
                    setSearch: 'active'
                },
                lastIndexUpdate: new Date().toISOString(),
                supportedFeatures: [
                    'FlexSearch + MongoDB hybrid',
                    'Multi-field search',
                    'Autocomplete suggestions',
                    'Unified search across entities',
                    'Performance logging'
                ]
            };

            Logger.operationSuccess('SEARCH_ANALYTICS', 'Search analytics gathered');

            return analytics;

        } catch (error) {
            Logger.operationError('SEARCH_ANALYTICS', 'Failed to gather search analytics', error);
            throw error;
        }
    }

    /**
     * Health check for search services
     *
     * @returns {Object} Health status
     */
    async healthCheck() {
        try {
            const health = {
                status: 'healthy',
                services: {
                    cardSearch: 'up',
                    productSearch: 'up',
                    setSearch: 'up',
                    flexSearchIndexes: 'up'
                },
                timestamp: new Date().toISOString()
            };

            // You could add actual health checks here
            // For example, test searches or index status checks

            return health;

        } catch (error) {
            Logger.operationError('SEARCH_HEALTH_CHECK', 'Search health check failed', error);

            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }
}

export default UnifiedSearchService;
