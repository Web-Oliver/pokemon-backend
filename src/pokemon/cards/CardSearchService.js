/**
 * Card Search Service
 *
 * Single Responsibility: Card search operations using FlexSearch + MongoDB hybrid
 * Handles card-specific search logic, filtering, and result processing
 * Extracted from SearchService to follow SRP and improve maintainability
 */

import Card from '@/pokemon/cards/Card.js';
import BaseSearchService from '@/search/services/BaseSearchService.js';

class CardSearchService extends BaseSearchService {
    /**
     * Search cards using hybrid FlexSearch + MongoDB approach
     *
     * @param {string} query - Search query
     * @param {Object} filters - Additional filters
     * @param {Object} options - Search options
     * @returns {Object} Search results with cards and metadata
     */
    async searchCards(query, filters = {}, options = {}) {
        const searchConfig = {
            searchFields: ['cardName', 'cardNumber', 'variety'],
            searchWeights: {cardName: 3, cardNumber: 2, variety: 1},
            defaultPopulate: 'setId'
        };

        // Convert page to offset for BaseSearchService
        const {page = 1, limit = 20, ...restOptions} = options;
        const offset = (page - 1) * limit;
        const searchOptions = {...restOptions, offset, limit};

        const result = await this.performSearch('card', Card, query, filters, searchOptions, searchConfig);

        // Transform result to match expected format
        return {
            cards: result.results,
            total: result.pagination.total,
            currentPage: Math.floor(result.pagination.offset / result.pagination.limit) + 1,
            totalPages: Math.ceil(result.pagination.total / result.pagination.limit),
            hasNextPage: result.pagination.hasMore,
            hasPrevPage: result.pagination.offset > 0,
            count: result.results.length,
            limit: result.pagination.limit,
            query: query,
            searchMethod: result.metadata.searchMethod,
            filters: result.metadata.filters
        };
    }
}

export default CardSearchService;