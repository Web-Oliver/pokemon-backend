/**
 * Search Query Builder Service
 *
 * Single Responsibility: MongoDB query construction for search operations
 * Handles text search query building, regex patterns, and query optimization
 * Extracted from SearchService to follow SRP and provide reusable query building
 */

class SearchQueryBuilder {
  /**
   * Build MongoDB text search query with regex patterns
   * Creates flexible search patterns for partial matching
   *
   * @param {string} query - Search query string
   * @param {Array} searchFields - Fields to search in
   * @returns {Object} MongoDB query object
   */
  static buildTextSearchQuery(query, searchFields) {
    if (!query || !query.trim()) {
      return {};
    }

    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    const regexConditions = [];

    // Create regex patterns for each search term
    searchTerms.forEach(term => {
      if (term.length === 0) return;

      // Escape special regex characters
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, 'i');

      if (searchFields && searchFields.length > 0) {
        // Search in specific fields
        const fieldConditions = searchFields.map(field => ({
          [field]: { $regex: regex }
        }));

        regexConditions.push({ $or: fieldConditions });
      } else {
        // Generic search - will be customized by caller
        regexConditions.push({ $regex: regex });
      }
    });

    // Combine all conditions with AND logic
    if (regexConditions.length > 0) {
      return regexConditions.length === 1 ? regexConditions[0] : { $and: regexConditions };
    }

    return {};
  }

  /**
   * Build query with filters applied
   * Combines text search with additional filters
   *
   * @param {string} textQuery - Text search query
   * @param {Array} searchFields - Fields for text search
   * @param {Object} filters - Additional filters
   * @returns {Object} Combined MongoDB query
   */
  static buildFilteredQuery(textQuery, searchFields, filters = {}) {
    const baseQuery = this.buildTextSearchQuery(textQuery, searchFields);

    // Merge with additional filters
    return { ...baseQuery, ...filters };
  }

  /**
   * Build aggregation pipeline for complex searches
   * Useful for searches requiring joins, grouping, or complex transformations
   *
   * @param {string} query - Search query
   * @param {Array} searchFields - Fields to search
   * @param {Object} filters - Additional filters
   * @param {Object} options - Pipeline options
   * @returns {Array} MongoDB aggregation pipeline
   */
  static buildAggregationPipeline(query, searchFields, filters = {}, options = {}) {
    const {
      limit = 50,
      skip = 0,
      sort = { _id: -1 },
      lookup = null,
      project = null
    } = options;

    const pipeline = [];

    // Match stage with search query and filters
    const matchQuery = this.buildFilteredQuery(query, searchFields, filters);

    if (Object.keys(matchQuery).length > 0) {
      pipeline.push({ $match: matchQuery });
    }

    // Lookup stage for population
    if (lookup) {
      if (Array.isArray(lookup)) {
        lookup.forEach(lookupStage => pipeline.push({ $lookup: lookupStage }));
      } else {
        pipeline.push({ $lookup: lookup });
      }
    }

    // Project stage for field selection
    if (project) {
      pipeline.push({ $project: project });
    }

    // Sort stage
    if (sort && Object.keys(sort).length > 0) {
      pipeline.push({ $sort: sort });
    }

    // Pagination
    if (skip > 0) {
      pipeline.push({ $skip: skip });
    }

    if (limit > 0) {
      pipeline.push({ $limit: limit });
    }

    return pipeline;
  }

  /**
   * Build query for exact match searches
   * Used for precise matching (IDs, exact names, etc.)
   *
   * @param {Object} exactMatches - Field-value pairs for exact matching
   * @param {Object} additionalFilters - Additional filter conditions
   * @returns {Object} MongoDB query for exact matches
   */
  static buildExactMatchQuery(exactMatches = {}, additionalFilters = {}) {
    return { ...exactMatches, ...additionalFilters };
  }

  /**
   * Build range query for numeric/date fields
   * Useful for filtering by ranges (dates, prices, quantities, etc.)
   *
   * @param {string} field - Field name
   * @param {Object} range - Range object { min, max, gte, lte, gt, lt }
   * @returns {Object} MongoDB range query
   */
  static buildRangeQuery(field, range) {
    const query = {};
    const conditions = {};

    if (range.min !== undefined || range.gte !== undefined) {
      conditions.$gte = range.min !== undefined ? range.min : range.gte;
    }

    if (range.max !== undefined || range.lte !== undefined) {
      conditions.$lte = range.max !== undefined ? range.max : range.lte;
    }

    if (range.gt !== undefined) {
      conditions.$gt = range.gt;
    }

    if (range.lt !== undefined) {
      conditions.$lt = range.lt;
    }

    if (Object.keys(conditions).length > 0) {
      query[field] = conditions;
    }

    return query;
  }

  /**
   * Build query with multiple search patterns
   * Supports different search strategies (exact, partial, wildcard)
   *
   * @param {string} query - Search query
   * @param {Array} searchFields - Fields to search
   * @param {Object} options - Search options
   * @returns {Object} MongoDB query with multiple patterns
   */
  static buildMultiPatternQuery(query, searchFields, options = {}) {
    const {
      exactMatch = false,
      partialMatch = true,
      caseSensitive = false,
      wordBoundary = false
    } = options;

    if (!query || !query.trim() || !searchFields || searchFields.length === 0) {
      return {};
    }

    const conditions = [];
    const searchTerm = query.trim();

    searchFields.forEach(field => {
      const fieldConditions = [];

      // Exact match
      if (exactMatch) {
        fieldConditions.push({
          [field]: caseSensitive ? searchTerm : { $regex: `^${this._escapeRegex(searchTerm)}$`, $options: 'i' }
        });
      }

      // Partial match
      if (partialMatch) {
        const regexOptions = caseSensitive ? '' : 'i';
        const pattern = wordBoundary
          ? `\\b${this._escapeRegex(searchTerm)}\\b`
          : this._escapeRegex(searchTerm);

        fieldConditions.push({
          [field]: { $regex: pattern, $options: regexOptions }
        });
      }

      if (fieldConditions.length > 0) {
        conditions.push(fieldConditions.length === 1 ? fieldConditions[0] : { $or: fieldConditions });
      }
    });

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];

    return { $or: conditions };
  }

  /**
   * Build query for array field searches
   * Handles searching within array fields
   *
   * @param {string} field - Array field name
   * @param {*} value - Value to search for in array
   * @param {Object} options - Search options
   * @returns {Object} MongoDB array query
   */
  static buildArraySearchQuery(field, value, options = {}) {
    const { matchAll = false, elemMatch = false } = options;

    if (Array.isArray(value)) {
      return matchAll
        ? { [field]: { $all: value } }
        : { [field]: { $in: value } };
    }

    if (elemMatch && typeof value === 'object') {
      return { [field]: { $elemMatch: value } };
    }

    return { [field]: value };
  }

  /**
   * Build query for geographic searches
   * Supports location-based queries
   *
   * @param {string} field - Geographic field name
   * @param {Object} location - Location parameters
   * @returns {Object} MongoDB geo query
   */
  static buildGeoQuery(field, location) {
    const { coordinates, maxDistance, minDistance, geometry } = location;

    if (coordinates && typeof maxDistance === 'number') {
      return {
        [field]: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates
            },
            $maxDistance: maxDistance,
            ...(typeof minDistance === 'number' && { $minDistance: minDistance })
          }
        }
      };
    }

    if (geometry) {
      return {
        [field]: {
          $geoWithin: {
            $geometry: geometry
          }
        }
      };
    }

    return {};
  }

  /**
   * Escape special regex characters
   * @private
   */
  static _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Validate search query
   * Ensures query meets minimum requirements
   *
   * @param {string} query - Query to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateQuery(query, options = {}) {
    const {
      minLength = 1,
      maxLength = 200,
      allowEmpty = false,
      allowSpecialChars = true
    } = options;

    const validation = {
      isValid: true,
      errors: []
    };

    if (!query) {
      if (!allowEmpty) {
        validation.isValid = false;
        validation.errors.push('Query is required');
      }
      return validation;
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < minLength) {
      validation.isValid = false;
      validation.errors.push(`Query must be at least ${minLength} characters long`);
    }

    if (trimmedQuery.length > maxLength) {
      validation.isValid = false;
      validation.errors.push(`Query cannot exceed ${maxLength} characters`);
    }

    if (!allowSpecialChars && (/[<>{}[\]|\\^~`]/).test(trimmedQuery)) {
      validation.isValid = false;
      validation.errors.push('Query contains invalid special characters');
    }

    return validation;
  }
}

export default SearchQueryBuilder;
