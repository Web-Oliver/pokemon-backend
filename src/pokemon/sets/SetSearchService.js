/**
 * Set Search Service
 *
 * Single Responsibility: Set search operations using FlexSearch + MongoDB hybrid
 * Handles set-specific search logic, filtering, and result processing
 * Extracted from SearchService to follow SRP and improve maintainability
 */

import Set from '@/pokemon/sets/Set.js';
import BaseSearchService from '@/search/services/BaseSearchService.js';

class SetSearchService extends BaseSearchService {
    /**
     * Search sets using hybrid FlexSearch + MongoDB approach
     *
     * @param {string} query - Search query
     * @param {Object} filters - Additional filters
     * @param {Object} options - Search options
     * @returns {Object} Search results with sets and metadata
     */
    async searchSets(query, filters = {}, options = {}) {
        const searchConfig = {
            searchFields: ['setName', 'year'],
            searchWeights: {setName: 3, year: 1},
            defaultPopulate: false
        };

        // Convert page to offset for BaseSearchService
        const {page = 1, limit = 20, ...restOptions} = options;
        const offset = (page - 1) * limit;
        const searchOptions = {...restOptions, offset, limit};

        const result = await this.performSearch('set', Set, query, filters, searchOptions, searchConfig);

        console.log('DEBUG SetSearchService result:', JSON.stringify(result, null, 2));
        console.log('DEBUG result type:', typeof result);
        console.log('DEBUG result.pagination:', result?.pagination);
        console.log('DEBUG result.results:', Array.isArray(result?.results) ? `Array(${result.results.length})` : result?.results);

        // Transform result to match expected format
        return {
            sets: result.results,
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

    /**
     * Get set suggestions for autocomplete
     *
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Array of suggestions
     */
    async getSetSuggestions(query, options = {}) {
        const {limit = 10} = options;

        if (!query || query.trim().length < 2) {
            return [];
        }

        try {
            await FlexSearchIndexManager.initializeIndexes();

            const setIndex = FlexSearchIndexManager.getSetIndex();
            const searchQuery = query.trim().toLowerCase();

            // Get FlexSearch suggestions
            const suggestions = new Set();

            // Search set names for suggestions
            const nameResults = setIndex.search(searchQuery, {
                field: 'setName',
                limit: limit * 2
            });

            if (nameResults.length > 0) {
                const sets = await Set.find({
                    _id: {$in: nameResults.slice(0, limit)}
                })
                    .select('setName releaseDate')
                    .lean()
                    .exec();

                sets.forEach(set => {
                    if (suggestions.size < limit) {
                        suggestions.add({
                            text: set.setName,
                            type: 'set',
                            context: set.releaseDate ? `Released: ${set.releaseDate.getFullYear()}` : ''
                        });
                    }
                });
            }

            return Array.from(suggestions).slice(0, limit);

        } catch (error) {
            Logger.operationError('SET_SUGGESTIONS', 'Failed to get set suggestions', error);
            return [];
        }
    }

    /**
     * Search sets by release year
     *
     * @param {number} year - Release year
     * @param {Object} options - Search options
     * @returns {Object} Search results
     */
    async searchByYear(year, options = {}) {
        const {limit = 50, offset = 0} = options;

        Logger.operationStart('SET_SEARCH_BY_YEAR', 'Searching sets by year', {
            year,
            limit,
            offset
        });

        try {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(year + 1, 0, 1);

            const filters = {
                releaseDate: {
                    $gte: startDate,
                    $lt: endDate
                }
            };

            const sets = await Set.find(filters)
                .skip(offset)
                .limit(limit)
                .sort({releaseDate: -1})
                .lean()
                .exec();

            const result = {
                sets,
                total: sets.length,
                year,
                searchMethod: 'mongodb_year_filter',
                offset,
                limit,
                hasMore: sets.length === limit
            };

            Logger.operationSuccess('SET_SEARCH_BY_YEAR', 'Year search completed', {
                year,
                setsFound: sets.length
            });

            return result;

        } catch (error) {
            Logger.operationError('SET_SEARCH_BY_YEAR', 'Year search failed', error, {
                year
            });
            throw error;
        }
    }

    /**
     * Get sets with card counts
     *
     * @param {Object} options - Search options
     * @returns {Object} Sets with card counts
     */
    async getSetsWithCardCounts(options = {}) {
        const {limit = 50, offset = 0} = options;

        Logger.operationStart('SETS_WITH_CARD_COUNTS', 'Fetching sets with card counts');

        try {
            const pipeline = [
                {
                    $lookup: {
                        from: 'cards',
                        localField: '_id',
                        foreignField: 'setId',
                        as: 'cards'
                    }
                },
                {
                    $addFields: {
                        cardCount: {$size: '$cards'}
                    }
                },
                {
                    $project: {
                        cards: 0 // Remove the cards array to save bandwidth
                    }
                },
                {
                    $sort: {cardCount: -1, setName: 1}
                },
                {
                    $skip: offset
                },
                {
                    $limit: limit
                }
            ];

            const sets = await Set.aggregate(pipeline);

            const result = {
                sets,
                total: sets.length,
                searchMethod: 'aggregation_with_card_counts',
                offset,
                limit,
                hasMore: sets.length === limit
            };

            Logger.operationSuccess('SETS_WITH_CARD_COUNTS', 'Sets with card counts fetched', {
                setsFound: sets.length
            });

            return result;

        } catch (error) {
            Logger.operationError('SETS_WITH_CARD_COUNTS', 'Failed to fetch sets with card counts', error);
            throw error;
        }
    }

    /**
     * Get unique release years
     *
     * @returns {Array} Array of unique years
     */
    async getReleaseYears() {
        try {
            Logger.operationStart('SET_RELEASE_YEARS', 'Fetching unique release years');

            const pipeline = [
                {
                    $match: {
                        releaseDate: {$exists: true, $ne: null}
                    }
                },
                {
                    $group: {
                        _id: {$year: '$releaseDate'},
                        count: {$sum: 1}
                    }
                },
                {
                    $sort: {_id: -1}
                }
            ];

            const yearData = await Set.aggregate(pipeline);
            const years = yearData.map(item => ({
                year: item._id,
                count: item.count
            }));

            Logger.operationSuccess('SET_RELEASE_YEARS', 'Release years fetched', {
                yearsFound: years.length
            });

            return years;

        } catch (error) {
            Logger.operationError('SET_RELEASE_YEARS', 'Failed to fetch release years', error);
            throw error;
        }
    }

    /**
     * Search all sets with filters (no search query)
     * @private
     */
    async _searchAllSets(filters, options) {
        const {limit, offset, populate} = options;

        Logger.operationStart('SET_SEARCH_ALL', 'Searching all sets with filters');

        const sets = await Set.find(filters)
            .skip(offset)
            .limit(limit)
            .sort({setName: 1})
            .lean()
            .exec();

        return {
            sets,
            total: sets.length,
            query: '*',
            searchMethod: 'mongodb_filter_only',
            flexSearchMatches: 0,
            offset,
            limit,
            hasMore: sets.length === limit
        };
    }

    /**
     * Get empty search result
     * @private
     */
    _getEmptySearchResult(message) {
        return {
            sets: [],
            total: 0,
            query: '',
            searchMethod: 'empty',
            flexSearchMatches: 0,
            offset: 0,
            limit: 0,
            hasMore: false,
            message
        };
    }
}

export default SetSearchService;
