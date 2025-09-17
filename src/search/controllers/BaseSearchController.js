import BaseController from '@/system/middleware/BaseController.js';
import Logger from '@/system/logging/Logger.js';

/**
 * Base Search Controller with generic search operation patterns
 * Eliminates the 600+ lines of duplication in EntitySearchController
 */
export default class BaseSearchController extends BaseController {
    constructor() {
        super('SearchService', {
            entityName: 'Search',
            pluralName: 'searches',
            enableCaching: true,
            enableMetrics: true,
            defaultLimit: 20,
            filterableFields: ['query', 'setName', 'year', 'minPrice', 'maxPrice', 'sold', 'availableOnly']
        });

        // Initialize hooks map
        this.hooks = new Map();
    }

    /**
     * Executes hooks for an event
     * @param {string} event - Event name
     * @param {string} operation - Operation context
     * @param {*} data - Data to pass to hooks
     * @param {Object} context - Additional context
     */
    async executeHooks(event, operation, data, context) {
        const handlers = this.hooks.get(event) || [];

        for (const handler of handlers) {
            try {
                await handler(operation, data, context);
            } catch (error) {
                Logger.error('BaseSearchController', `Hook execution failed for ${event}`, error);
            }
        }

        return data;
    }

    /**
     * Registers a lifecycle hook
     * @param {string} event - Event name
     * @param {Function} handler - Hook handler function
     */
    registerHook(event, handler) {
        if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
        }
        this.hooks.get(event).push(handler);
    }


    /**
     * Helper method to determine search type from operation
     */
    getSearchTypeFromOperation(operation) {
        if (operation.includes('Cards')) return 'cards';
        if (operation.includes('Products')) return 'products';
        if (operation.includes('Sets')) return 'sets';
        if (operation.includes('SetProducts')) return 'setProducts';
        return 'entity';
    }

    /**
     * Generic search operation handler
     * Eliminates the repetitive patterns across all search methods
     */
    async executeSearchOperation(entityType, req, res, config = {}) {
        const operation = `search${entityType}`;
        const searchType = entityType.toLowerCase();
        const context = {req, res, operation};

        const {
            query,
            limit,
            page,
            sort,
            populate,
            exclude,
            ...filters
        } = req.query;

        Logger.operationStart('Search', `SEARCH ${entityType.toUpperCase()}`, {
            query,
            filters
        });

        try {
            // Execute before operation hooks
            await this.executeHooks('beforeOperation', operation, req.query, context);

            // Process search query
            const searchQuery = this.processSearchQuery(query, filters, config);

            // Handle empty query early return if configured
            if (config.handleEmptyQuery) {
                const emptyResult = await config.handleEmptyQuery(query, filters, req, res, context);
                if (emptyResult) return emptyResult;
            }

            // Build options
            const options = this.buildSearchOptions({limit, page, sort}, config);

            // Build filters
            const processedFilters = await this.buildSearchFilters(filters, config);

            // Execute search via service
            const serviceMethod = `search${entityType}`;
            let results = await this.service[serviceMethod](searchQuery, processedFilters, options);

            // Handle population if requested
            if (populate && config.populationHandlers) {
                results = await this.handlePopulation(results, populate, config.populationHandlers);
            }

            // Execute after operation hooks
            await this.executeHooks('afterOperation', operation, results, context);

            Logger.operationSuccess('Search', `SEARCH ${entityType.toUpperCase()}`, {
                found: results.total || results.length,
                searchUsed: Boolean(searchQuery)
            });

            // Build response
            let responseData = {
                success: true,
                data: results,
                meta: {
                    query: searchQuery,
                    filters: filters,
                    totalResults: results.total || results.length,
                    searchType
                }
            };

            // Execute before response hooks
            responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            await this.executeHooks('onError', operation, error, context);
            Logger.operationError('Search', `SEARCH ${entityType.toUpperCase()}`, error, {
                query, filters
            });
            throw error;
        }
    }

    /**
     * Process search query with entity-specific logic
     */
    processSearchQuery(query, filters, config) {
        if (!query || typeof query !== 'string' || query.trim() === '') {
            if (config.allowEmptyQuery && (filters.setName || filters.year)) {
                return '*';
            }
            return '';
        }
        return query;
    }

    /**
     * Build search options with defaults
     */
    buildSearchOptions({limit, page, sort}, config) {
        return {
            limit: limit ? parseInt(limit, 10) : (config.defaultLimit || 20),
            page: page ? parseInt(page, 10) : 1,
            sort: sort ? JSON.parse(sort) : config.defaultSort
        };
    }

    /**
     * Build search filters with entity-specific logic
     */
    async buildSearchFilters(filters, config) {
        const processedFilters = {};

        // Apply filter processors if configured
        if (config.filterProcessors) {
            for (const [key, processor] of Object.entries(config.filterProcessors)) {
                if (filters[key] !== undefined) {
                    processedFilters[processor.field || key] = await processor.process(filters[key]);
                }
            }
        }

        // Handle exclude parameter
        if (filters.exclude) {
            try {
                const mongoose = (await import('mongoose')).default;
                processedFilters._id = {$ne: new mongoose.Types.ObjectId(filters.exclude)};
            } catch (error) {
                // Invalid exclude ID, ignore
            }
        }

        return processedFilters;
    }

    /**
     * Handle population of related data
     */
    async handlePopulation(results, populate, populationHandlers) {
        if (!Array.isArray(results) || results.length === 0) {
            return results;
        }

        const populateFields = populate.split(',');
        let populatedResults = results;

        for (const field of populateFields) {
            if (populationHandlers[field]) {
                populatedResults = await populationHandlers[field](populatedResults);
            }
        }

        return populatedResults;
    }

    /**
     * Create a search handler with entity-specific configuration
     */
    createSearchHandler(entityType, config = {}) {
        return async (req, res, next) => {
            try {
                await this.executeSearchOperation(entityType, req, res, config);
            } catch (error) {
                next(error);
            }
        };
    }
}