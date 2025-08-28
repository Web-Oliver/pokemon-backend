/**
 * Base Search Service
 *
 * Single Responsibility: Common search patterns and utilities
 * Extracted from multiple search services to eliminate duplication
 */

import FlexSearchIndexManager from './FlexSearchIndexManager.js';
import Logger from '@/system/logging/Logger.js';

class BaseSearchService {
  /**
   * Standard search method pattern
   * @param {string} entityType - Type of entity being searched
   * @param {mongoose.Model} Model - Mongoose model to search
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @param {Object} searchConfig - Search configuration (fields, weights)
   * @returns {Object} Search results with metadata
   */
  async performSearch(entityType, Model, query, filters = {}, options = {}, searchConfig = {}) {
    const { limit = 50, offset = 0, populate = true } = options;
    const { searchFields = [], searchWeights = {} } = searchConfig;

    console.log(`[DEBUG BASESEARCH] performSearch called with query: "${query}", entityType: ${entityType}`);

    Logger.operationStart(`${entityType.toUpperCase()}_SEARCH`, `Starting ${entityType} search`, {
      query: query?.substring(0, 50),
      filtersCount: Object.keys(filters).length,
      limit,
      offset
    });

    const startTime = Date.now();
    let results = [];
    let searchMetadata = {
      totalCount: 0,
      searchMethod: 'direct',
      searchTime: 0,
      hasMore: false,
      filters: filters
    };

    try {
      // Try FlexSearch first if query exists and search fields are configured
      if (query && query.trim() && searchFields.length > 0) {
        console.log(`[DEBUG BASESEARCH] Trying FlexSearch for query: "${query}", entityType: ${entityType}`);
        try {
          const flexSearchResults = await FlexSearchIndexManager.search(
            entityType,
            query,
            { limit: limit * 2 } // Get more results for better filtering
          );

          if (flexSearchResults && flexSearchResults.length > 0) {
            // Convert FlexSearch IDs to ObjectIds and fetch from MongoDB
            const mongoQuery = {
              _id: { $in: flexSearchResults },
              ...filters
            };

            let mongoResults = Model.find(mongoQuery);

            if (populate && typeof populate === 'string') {
              mongoResults = mongoResults.populate(populate);
            } else if (populate === true && searchConfig.defaultPopulate) {
              mongoResults = mongoResults.populate(searchConfig.defaultPopulate);
            }

            results = await mongoResults
              .skip(offset)
              .limit(limit)
              .lean();

            searchMetadata.searchMethod = 'flexsearch';
            searchMetadata.totalCount = flexSearchResults.length;
          }
        } catch (flexError) {
          Logger.warn('BaseSearchService', `FlexSearch failed for ${entityType}, falling back to MongoDB`, flexError);
        }
      }

      // Fallback to MongoDB search if FlexSearch didn't return results
      if (results.length === 0) {
        console.log(`[DEBUG BASESEARCH] Fallback to MongoDB search. Query: "${query}", searchFields: ${JSON.stringify(searchFields)}`);
        const mongoQuery = {};

        // Add text search if query exists
        if (query && query.trim()) {
          console.log(`[DEBUG BASESEARCH] Query exists and not empty: "${query.trim()}"`);
          // Handle wildcard queries - convert to "match all" behavior
          if (query.trim() === '*') {
            console.log('[DEBUG BASESEARCH] Wildcard query detected - skipping text search conditions');
            // Wildcard means "return all" - use only filters
            Object.assign(mongoQuery, filters);
          } else if (searchFields.length > 0) {
            console.log('[DEBUG BASESEARCH] Using custom field search with regex escaping');
            // Custom field search with regex escaping for safety
            const escapedQuery = this.escapeRegexSpecialChars(query);
            console.log(`[DEBUG BASESEARCH] Escaped query: "${escapedQuery}"`);

            // FIXED: Only apply regex search to string fields, skip number fields
            const stringFields = searchFields.filter(field => field !== 'year' && field !== 'totalCardsInSet');
            const searchConditions = stringFields.map(field => ({
              [field]: { $regex: escapedQuery, $options: 'i' }
            }));

            // Handle number fields separately - only if query is a number
            const numberFields = searchFields.filter(field => field === 'year' || field === 'totalCardsInSet');
            if (numberFields.length > 0 && (/^\d+$/).test(query.trim())) {
              const numericValue = parseInt(query.trim(), 10);
              numberFields.forEach(field => {
                searchConditions.push({ [field]: numericValue });
              });
            }

            // FIXED: Properly combine filters with search conditions
            const conditions = [];

            // Add individual filters as separate conditions
            Object.entries(filters).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                conditions.push({ [key]: value });
              }
            });

            // Add text search as OR condition
            conditions.push({ $or: searchConditions });

            // Combine with $and
            if (conditions.length > 1) {
              mongoQuery.$and = conditions;
            } else if (conditions.length === 1) {
              Object.assign(mongoQuery, conditions[0]);
            }

            console.log(`[DEBUG BASESEARCH] MongoDB query: ${JSON.stringify(mongoQuery)}`);
          } else {
            console.log('[DEBUG BASESEARCH] Using text search fallback');
            // Combine filters with text search
            Object.assign(mongoQuery, filters);
            mongoQuery.$text = { $search: query };
          }
        } else {
          console.log('[DEBUG BASESEARCH] No query provided or empty query - using filters only');
          Object.assign(mongoQuery, filters);
        }

        let mongoResults = Model.find(mongoQuery);

        if (populate && typeof populate === 'string') {
          mongoResults = mongoResults.populate(populate);
        } else if (populate === true && searchConfig.defaultPopulate) {
          mongoResults = mongoResults.populate(searchConfig.defaultPopulate);
        }

        results = await mongoResults
          .skip(offset)
          .limit(limit)
          .lean();

        // Get total count for pagination
        searchMetadata.totalCount = await Model.countDocuments(mongoQuery);
        searchMetadata.searchMethod = 'mongodb';
      }

      searchMetadata.searchTime = Date.now() - startTime;
      searchMetadata.hasMore = (offset + results.length) < searchMetadata.totalCount;

      Logger.operationSuccess(`${entityType.toUpperCase()}_SEARCH`, `${entityType} search completed`, {
        resultCount: results.length,
        totalCount: searchMetadata.totalCount,
        searchMethod: searchMetadata.searchMethod,
        searchTime: searchMetadata.searchTime
      });

      return {
        results,
        metadata: searchMetadata,
        pagination: {
          offset,
          limit,
          total: searchMetadata.totalCount,
          hasMore: searchMetadata.hasMore
        }
      };

    } catch (error) {
      Logger.operationError(`${entityType.toUpperCase()}_SEARCH`, `${entityType} search failed`, error, {
        query: query?.substring(0, 50),
        filters
      });
      throw error;
    }
  }

  /**
   * Build search filters from query parameters
   * @param {Object} queryParams - Query parameters from request
   * @param {Array} allowedFields - Fields that can be used for filtering
   * @returns {Object} Processed filters
   */
  buildFilters(queryParams, allowedFields = []) {
    const filters = {};

    allowedFields.forEach(field => {
      if (queryParams[field] !== undefined) {
        // Special handling for boolean fields
        if (field === 'sold' || field === 'isActive' || field.startsWith('is')) {
          filters[field] = queryParams[field] === 'true';
        } else {
          filters[field] = queryParams[field];
        }
      }
    });

    return filters;
  }

  /**
   * Escape regex special characters to prevent invalid regex errors
   * @param {string} input - Input string to escape
   * @returns {string} Escaped string safe for regex
   */
  escapeRegexSpecialChars(input) {
    // Escape regex special characters that could cause issues
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get suggestions based on partial query
   * @param {string} entityType - Type of entity
   * @param {mongoose.Model} Model - Mongoose model
   * @param {string} partialQuery - Partial search query
   * @param {Array} suggestionFields - Fields to search for suggestions
   * @param {number} limit - Maximum suggestions to return
   * @returns {Array} Suggestion results
   */
  async getSuggestions(entityType, Model, partialQuery, suggestionFields = ['name'], limit = 10) {
    if (!partialQuery || partialQuery.trim().length < 2) {
      return [];
    }

    try {
      const regex = new RegExp(partialQuery, 'i');
      const orConditions = suggestionFields.map(field => ({
        [field]: regex
      }));

      const suggestions = await Model
        .find({ $or: orConditions })
        .select(suggestionFields.join(' '))
        .limit(limit)
        .lean();

      return suggestions.map(suggestion => {
        // Extract the first matching field value
        for (const field of suggestionFields) {
          if (suggestion[field]) {
            return {
              value: suggestion[field],
              field: field,
              id: suggestion._id
            };
          }
        }
        return null;
      }).filter(Boolean);

    } catch (error) {
      Logger.operationError(`${entityType.toUpperCase()}_SUGGESTIONS`, 'Suggestion generation failed', error);
      return [];
    }
  }
}

export default BaseSearchService;
