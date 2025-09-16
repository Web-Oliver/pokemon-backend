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
      searchWeights: { cardName: 3, cardNumber: 2, variety: 1 },
      defaultPopulate: 'setId'
    };

    // Convert page to offset for BaseSearchService
    const { page = 1, limit = 20, ...restOptions } = options;
    const offset = (page - 1) * limit;
    const searchOptions = { ...restOptions, offset, limit };

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

    try {
      // Ensure FlexSearch indexes are initialized
      await FlexSearchIndexManager.initializeIndexes();

      const cardIndex = FlexSearchIndexManager.getCardIndex();
      const searchQuery = query.trim();
      const cardIds = new Set();

      // FlexSearch: Multi-field search with tokenization
      const searchWords = searchQuery.toLowerCase().split(/\s+/).filter(word => word.length >= 1);

      for (const word of searchWords) {
        if (word.length >= 1) {
          // Search each field with FlexSearch
          const nameResults = cardIndex.search(word, { field: 'cardName', limit: 200 });
          const numberResults = cardIndex.search(word, { field: 'cardNumber', limit: 200 });
          const varietyResults = cardIndex.search(word, { field: 'variety', limit: 200 });
          const setResults = cardIndex.search(word, { field: 'setName', limit: 200 });

          // Combine all FlexSearch results
          [...nameResults, ...numberResults, ...varietyResults, ...setResults].forEach(id => {
            if (!cardIds.has(id)) {
              cardIds.add(id);
            }
          });
        }
      }

      let cards = [];

      // If FlexSearch found results, fetch from MongoDB with filters
      if (cardIds.size > 0) {
        const mongoFilters = {
          ...filters,
          _id: { $in: Array.from(cardIds) }
        };

        let mongoQuery = Card.find(mongoFilters);

        if (populate) {
          mongoQuery = mongoQuery.populate('setId');
        }

        cards = await mongoQuery.lean().exec();

        // Preserve FlexSearch order by creating ordered results
        const orderedResults = [];
        const cardMap = new Map(cards.map(card => [card._id.toString(), card]));

        for (const id of cardIds) {
          const card = cardMap.get(id);

          if (card && orderedResults.length < limit) {
            // Enhance card with set name for consistency
            if (card.setId?.setName) {
              card.setName = card.setId.setName;
            }

            // Add computed fields
            if (!card.setName) {
              card.setName = card.setId?.setName || 'Unknown Set';
            }

            orderedResults.push(card);
          }
        }

        cards = orderedResults.slice(offset, offset + limit);

      } else {
        // Fallback: Direct MongoDB search if no FlexSearch results
        Logger.operationStart('CARD_SEARCH_FALLBACK', 'Using MongoDB fallback search');

        // Escape regex special characters to prevent invalid regex errors
        const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        const mongoFilters = {
          ...filters,
          $or: [
            { cardName: { $regex: escapedQuery, $options: 'i' } },
            { cardNumber: { $regex: escapedQuery, $options: 'i' } },
            { variety: { $regex: escapedQuery, $options: 'i' } }
          ]
        };

        let mongoQuery = Card.find(mongoFilters).skip(offset).limit(limit);

        if (populate) {
          mongoQuery = mongoQuery.populate('setId');
        }

        cards = await mongoQuery.lean().exec();

        // Add set name for consistency
        cards.forEach(card => {
          if (card.setId?.setName && !card.setName) {
            card.setName = card.setId.setName;
          }
        });
      }

      // Enhanced card number search for numeric queries
      if ((/^\d+$/).test(searchQuery)) {
        cards = this._enhanceCardNumberSearch(searchQuery, cards);
      }

      const result = {
        cards,
        total: cards.length,
        query: searchQuery,
        searchMethod: cardIds.size > 0 ? 'flexsearch+mongodb' : 'mongodb_fallback',
        flexSearchMatches: cardIds.size,
        offset,
        limit,
        hasMore: cards.length === limit
      };

      Logger.operationSuccess('CARD_SEARCH', 'Card search completed', {
        query: searchQuery.substring(0, 50),
        cardsFound: cards.length,
        searchMethod: result.searchMethod,
        flexSearchMatches: cardIds.size
      });

      return result;

    } catch (error) {
      Logger.operationError('CARD_SEARCH', 'Card search failed', error, {
        query: query?.substring(0, 50),
        filtersCount: Object.keys(filters).length
      });
      throw error;
    }
  }

  /**
   * Get card suggestions for autocomplete
   *
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Array of suggestions
   */
  async getCardSuggestions(query, options = {}) {
    const { limit = 10 } = options;

    if (!query || query.trim().length < 2) {
      return [];
    }

    try {
      await FlexSearchIndexManager.initializeIndexes();

      const cardIndex = FlexSearchIndexManager.getCardIndex();
      const searchQuery = query.trim().toLowerCase();

      // Get FlexSearch suggestions
      const suggestions = new Set();

      // Search card names for suggestions
      const nameResults = cardIndex.search(searchQuery, {
        field: 'cardName',
        limit: limit * 2
      });

      if (nameResults.length > 0) {
        const cards = await Card.find({
          _id: { $in: nameResults.slice(0, limit) }
        })
        .select('cardName cardNumber variety')
        .populate('setId', 'setName')
        .lean()
        .exec();

        cards.forEach(card => {
          if (suggestions.size < limit) {
            suggestions.add({
              text: card.cardName,
              type: 'card',
              context: `${card.cardNumber || ''} - ${card.setId?.setName || ''}`.trim(' - ')
            });
          }
        });
      }

      return Array.from(suggestions).slice(0, limit);

    } catch (error) {
      Logger.operationError('CARD_SUGGESTIONS', 'Failed to get card suggestions', error);
      return [];
    }
  }

  /**
   * Search all cards with filters (no search query)
   * @private
   */
  async _searchAllCards(filters, options) {
    const { limit, offset, populate } = options;

    Logger.operationStart('CARD_SEARCH_ALL', 'Searching all cards with filters');

    let query = Card.find(filters).skip(offset).limit(limit);

    if (populate) {
      query = query.populate('setId');
    }

    const cards = await query.lean().exec();

    // Add set name for consistency
    cards.forEach(card => {
      if (card.setId?.setName && !card.setName) {
        card.setName = card.setId.setName;
      }
    });

    return {
      cards,
      total: cards.length,
      query: '*',
      searchMethod: 'mongodb_filter_only',
      flexSearchMatches: 0,
      offset,
      limit,
      hasMore: cards.length === limit
    };
  }

  /**
   * Enhance card number search results for numeric queries
   * @private
   */
  _enhanceCardNumberSearch(query, results) {
    const queryNum = parseInt(query, 10);

    return results.sort((a, b) => {
      const aNum = parseInt(a.cardNumber, 10);
      const bNum = parseInt(b.cardNumber, 10);

      // Exact matches first
      if (aNum === queryNum && bNum !== queryNum) return -1;
      if (bNum === queryNum && aNum !== queryNum) return 1;

      // Then by PSA grade if available
      if (a.grades?.grade_total !== b.grades?.grade_total) {
        return (b.grades?.grade_total || 0) - (a.grades?.grade_total || 0);
      }

      // Finally by card number numerically
      return this._compareCardNumbers(a, b);
    });
  }

  /**
   * Compare card numbers numerically
   * @private
   */
  _compareCardNumbers(a, b) {
    const aNum = parseInt(a.cardNumber, 10);
    const bNum = parseInt(b.cardNumber, 10);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum;
    }

    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;

    return a.cardNumber.localeCompare(b.cardNumber);
  }

  /**
   * Get empty search result
   * @private
   */
  _getEmptySearchResult(message) {
    return {
      cards: [],
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

export default CardSearchService;
