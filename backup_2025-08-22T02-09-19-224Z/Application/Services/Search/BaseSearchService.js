/**
 * Base Search Service
 * 
 * Single Responsibility: Common search patterns and utilities
 * Extracted from multiple search services to eliminate duplication
 */

import FlexSearchIndexManager from './FlexSearchIndexManager.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';

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
        const mongoQuery = { ...filters };

        // Add text search if query exists
        if (query && query.trim()) {
          if (searchFields.length > 0) {
            // Custom field search
            const searchConditions = searchFields.map(field => ({
              [field]: { $regex: query, $options: 'i' }
            }));
            mongoQuery.$or = searchConditions;
          } else {
            // Fallback to text search if available
            mongoQuery.$text = { $search: query };
          }
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