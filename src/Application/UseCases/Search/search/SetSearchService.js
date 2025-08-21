/**
 * Set Search Service
 *
 * Single Responsibility: Set search operations using FlexSearch + MongoDB hybrid
 * Handles set-specific search logic, filtering, and result processing
 * Extracted from SearchService to follow SRP and improve maintainability
 */

import Set from '@/Domain/Entities/Set.js';
import FlexSearchIndexManager from './FlexSearchIndexManager.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
class SetSearchService {
  /**
   * Search sets using hybrid FlexSearch + MongoDB approach
   *
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @returns {Object} Search results with sets and metadata
   */
  async searchSets(query, filters = {}, options = {}) {
    const { limit = 50, offset = 0, populate = false } = options;

    Logger.operationStart('SET_SEARCH', 'Starting set search', {
      query: query?.substring(0, 50),
      filtersCount: Object.keys(filters).length,
      limit,
      offset
    });

    // Handle empty query with filters only
    if ((!query || !query.trim()) && Object.keys(filters).length === 0) {
      return this._getEmptySearchResult('No search query or filters provided');
    }

    // Handle wildcard or empty query
    if (!query || !query.trim() || query.trim() === '*') {
      return this._searchAllSets(filters, { limit, offset, populate });
    }

    try {
      // Ensure FlexSearch indexes are initialized
      await FlexSearchIndexManager.initializeIndexes();

      const setIndex = FlexSearchIndexManager.getSetIndex();
      const searchQuery = query.trim();
      const setIds = new Set();

      // FlexSearch: Set name search with tokenization
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word.length >= 1);

      for (const word of searchWords) {
        if (word.length >= 1) {
          // Search set names with FlexSearch
          const nameResults = setIndex.search(word, { field: 'setName', limit: 200 });

          // Add FlexSearch results
          nameResults.forEach(id => {
            if (!setIds.has(id)) {
              setIds.add(id);
            }
          });
        }
      }

      let sets = [];

      // If FlexSearch found results, fetch from MongoDB with filters
      if (setIds.size > 0) {
        const mongoFilters = {
          ...filters,
          _id: { $in: Array.from(setIds) }
        };

        const mongoQuery = Set.find(mongoFilters);

        sets = await mongoQuery.lean().exec();

        // Preserve FlexSearch order by creating ordered results
        const orderedResults = [];
        const setMap = new Map(sets.map(set => [set._id.toString(), set]));

        for (const id of setIds) {
          const set = setMap.get(id);

          if (set && orderedResults.length < limit) {
            orderedResults.push(set);
          }
        }

        sets = orderedResults.slice(offset, offset + limit);

      } else {
        // Fallback: Direct MongoDB search if no FlexSearch results
        Logger.operationStart('SET_SEARCH_FALLBACK', 'Using MongoDB fallback search');

        const mongoFilters = {
          ...filters,
          setName: { $regex: searchQuery, $options: 'i' }
        };

        const mongoQuery = Set.find(mongoFilters).skip(offset).limit(limit);

        sets = await mongoQuery.lean().exec();
      }

      const result = {
        sets,
        total: sets.length,
        query: searchQuery,
        searchMethod: setIds.size > 0 ? 'flexsearch+mongodb' : 'mongodb_fallback',
        flexSearchMatches: setIds.size,
        offset,
        limit,
        hasMore: sets.length === limit
      };

      Logger.operationSuccess('SET_SEARCH', 'Set search completed', {
        query: searchQuery.substring(0, 50),
        setsFound: sets.length,
        searchMethod: result.searchMethod,
        flexSearchMatches: setIds.size
      });

      return result;

    } catch (error) {
      Logger.operationError('SET_SEARCH', 'Set search failed', error, {
        query: query?.substring(0, 50),
        filtersCount: Object.keys(filters).length
      });
      throw error;
    }
  }

  /**
   * Get set suggestions for autocomplete
   *
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Array of suggestions
   */
  async getSetSuggestions(query, options = {}) {
    const { limit = 10 } = options;

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
          _id: { $in: nameResults.slice(0, limit) }
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
    const { limit = 50, offset = 0 } = options;

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
        .sort({ releaseDate: -1 })
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
    const { limit = 50, offset = 0 } = options;

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
            cardCount: { $size: '$cards' }
          }
        },
        {
          $project: {
            cards: 0 // Remove the cards array to save bandwidth
          }
        },
        {
          $sort: { cardCount: -1, setName: 1 }
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
            releaseDate: { $exists: true, $ne: null }
          }
        },
        {
          $group: {
            _id: { $year: '$releaseDate' },
            count: { $sum: 1 }
          }
        },
        {
          $sort: { _id: -1 }
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
    const { limit, offset, populate } = options;

    Logger.operationStart('SET_SEARCH_ALL', 'Searching all sets with filters');

    const sets = await Set.find(filters)
      .skip(offset)
      .limit(limit)
      .sort({ setName: 1 })
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
