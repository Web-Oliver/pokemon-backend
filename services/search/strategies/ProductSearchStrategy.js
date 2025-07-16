const BaseSearchStrategy = require('./BaseSearchStrategy');
const { ValidationError } = require('../../../middleware/errorHandler');

/**
 * Product Search Strategy
 * 
 * Specialized search strategy for CardMarketReferenceProduct model searches.
 * Handles sealed product-specific search patterns including category filtering,
 * price scoring, availability tracking, and set-based product grouping.
 * 
 * IMPORTANT: This searches CardMarketReferenceProduct which has a setName field
 * that is NOT the same as the Set model. CardMarketReferenceProduct.setName is
 * used for product grouping and is different from the official Pokemon sets.
 */
class ProductSearchStrategy extends BaseSearchStrategy {
  /**
   * Creates a new product search strategy instance
   * @param {BaseRepository} productRepository - Repository for CardMarketReferenceProduct access
   * @param {Object} options - Strategy configuration options
   */
  constructor(productRepository, options = {}) {
    super(productRepository, {
      maxResults: options.maxResults || 50,
      enableFuzzySearch: options.enableFuzzySearch !== false,
      enableScoring: options.enableScoring !== false,
      searchFields: ['name', 'setName', 'category'],
      defaultSort: { score: -1, price: 1 },
      enablePriceScoring: options.enablePriceScoring !== false,
      enableAvailabilityScoring: options.enableAvailabilityScoring !== false,
      enableCategoryFiltering: options.enableCategoryFiltering !== false,
      minQueryLength: options.minQueryLength || 2,
      priceWeight: options.priceWeight || 10,
      availabilityWeight: options.availabilityWeight || 5,
      ...options
    });
  }

  /**
   * Performs product search with category and price scoring
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async search(query, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      // Apply minimum query length
      if (query.trim().length < this.options.minQueryLength) {
        return [];
      }
      
      // Use hybrid search if enabled, otherwise MongoDB search
      if (this.options.enableFuseSearch && this.options.hybridSearch) {
        return await this.performHybridSearch(query, options);
      } else {
        return await this.performMongoSearch(query, options);
      }
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Provides product search suggestions with category context
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search suggestions
   */
  async suggest(query, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      // Get suggestions with limited results
      const suggestionOptions = {
        ...options,
        limit: Math.min(options.limit || 10, 20),
        sort: { score: -1, available: -1 }
      };
      
      const suggestions = await this.search(query, suggestionOptions);
      
      // Format suggestions for autocomplete
      return suggestions.map(product => ({
        id: product._id,
        text: product.name,
        secondaryText: product.setName,
        metadata: {
          category: product.category,
          price: product.price,
          available: product.available,
          setName: product.setName
        }
      }));
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches products within a specific category
   * @param {string} query - Search query
   * @param {string} category - Category to search within
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchInCategory(query, category, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      // Add category filter to options
      const categoryOptions = {
        ...options,
        filters: {
          ...options.filters,
          category: category
        }
      };
      
      return await this.search(query, categoryOptions);
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches products within a specific set name (product grouping)
   * @param {string} query - Search query
   * @param {string} setName - Set name to search within
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchInSetName(query, setName, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      // Add set name filter to options
      const setOptions = {
        ...options,
        filters: {
          ...options.filters,
          setName: setName
        }
      };
      
      return await this.search(query, setOptions);
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches products by price range
   * @param {string} query - Search query
   * @param {number} minPrice - Minimum price
   * @param {number} maxPrice - Maximum price
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchByPriceRange(query, minPrice, maxPrice, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      if (minPrice < 0 || maxPrice < 0) {
        throw new ValidationError('Price values must be non-negative');
      }
      
      if (minPrice > maxPrice) {
        throw new ValidationError('Minimum price cannot be greater than maximum price');
      }
      
      // Add price range filter to options
      const priceOptions = {
        ...options,
        filters: {
          ...options.filters,
          priceRange: { min: minPrice, max: maxPrice }
        }
      };
      
      return await this.search(query, priceOptions);
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets available product categories
   * @returns {Promise<Array>} - Available categories
   */
  async getCategories() {
    try {
      const categories = await this.repository.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { category: '$_id', count: 1, _id: 0 } }
      ]);
      
      return categories;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets available product set names (product groupings)
   * @returns {Promise<Array>} - Available set names
   */
  async getSetNames() {
    try {
      const setNames = await this.repository.aggregate([
        { $group: { _id: '$setName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $project: { setName: '$_id', count: 1, _id: 0 } }
      ]);
      
      return setNames;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Builds match conditions for product search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB match conditions
   */
  buildMatchConditions(query, options = {}) {
    const conditions = [];
    
    // Apply category filter if provided
    if (options.filters && options.filters.category) {
      conditions.push({
        category: new RegExp(this.escapeRegex(options.filters.category), 'i')
      });
    }
    
    // Apply set name filter if provided
    if (options.filters && options.filters.setName) {
      conditions.push({
        setName: new RegExp(this.escapeRegex(options.filters.setName), 'i')
      });
    }
    
    // Apply price range filter if provided
    if (options.filters && options.filters.priceRange) {
      const priceConditions = [];
      
      // Convert price string to number for comparison
      priceConditions.push({
        $expr: {
          $and: [
            { $gte: [{ $toDouble: '$price' }, options.filters.priceRange.min] },
            { $lte: [{ $toDouble: '$price' }, options.filters.priceRange.max] }
          ]
        }
      });
      
      conditions.push({ $or: priceConditions });
    }
    
    // Apply availability filter if provided
    if (options.filters && options.filters.availableOnly) {
      conditions.push({
        available: { $gt: 0 }
      });
    }
    
    // Apply minimum availability filter if provided
    if (options.filters && options.filters.minAvailable) {
      conditions.push({
        available: { $gte: options.filters.minAvailable }
      });
    }
    
    // Apply last updated filter if provided
    if (options.filters && options.filters.lastUpdatedAfter) {
      conditions.push({
        lastUpdated: { $gte: new Date(options.filters.lastUpdatedAfter) }
      });
    }
    
    // Build search conditions for text fields
    const textConditions = this.buildSearchConditions(query, this.options.searchFields);
    conditions.push(textConditions);
    
    // Combine all conditions
    return conditions.length > 1 ? { $and: conditions } : conditions[0];
  }

  /**
   * Builds scoring stage with product-specific relevance factors
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB scoring stage
   */
  buildScoringStage(query, options = {}) {
    const normalizedQuery = this.normalizeQuery(query);
    
    return {
      $addFields: {
        score: {
          $add: [
            // Exact product name match (highest priority)
            {
              $cond: {
                if: { $eq: [{ $toLower: '$name' }, normalizedQuery] },
                then: 100,
                else: 0
              }
            },
            // Exact set name match
            {
              $cond: {
                if: { $eq: [{ $toLower: '$setName' }, normalizedQuery] },
                then: 80,
                else: 0
              }
            },
            // Product name starts with query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$name' }, regex: `^${this.escapeRegex(normalizedQuery)}` } },
                then: 70,
                else: 0
              }
            },
            // Set name starts with query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$setName' }, regex: `^${this.escapeRegex(normalizedQuery)}` } },
                then: 60,
                else: 0
              }
            },
            // Product name contains query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$name' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 50,
                else: 0
              }
            },
            // Set name contains query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$setName' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 40,
                else: 0
              }
            },
            // Category contains query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$category' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 30,
                else: 0
              }
            },
            // Price-based scoring (if enabled) - lower prices get higher scores
            ...(this.options.enablePriceScoring ? [{
              $cond: {
                if: { $and: [{ $ne: ['$price', ''] }, { $ne: ['$price', null] }] },
                then: {
                  $multiply: [
                    this.options.priceWeight,
                    {
                      $cond: {
                        if: { $gt: [{ $toDouble: '$price' }, 0] },
                        then: { $divide: [1000, { $toDouble: '$price' }] },
                        else: 0
                      }
                    }
                  ]
                },
                else: 0
              }
            }] : []),
            // Availability-based scoring (if enabled) - higher availability gets higher scores
            ...(this.options.enableAvailabilityScoring ? [{
              $cond: {
                if: { $gt: ['$available', 0] },
                then: {
                  $multiply: [
                    this.options.availabilityWeight,
                    { $divide: ['$available', 100] }
                  ]
                },
                else: 0
              }
            }] : []),
            // Length-based relevance score (shorter matches are more relevant)
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$name' }, regex: this.escapeRegex(normalizedQuery) } },
                then: { $divide: [20, { $strLenCP: '$name' }] },
                else: 0
              }
            },
            // Recency score (more recently updated products get slight boost)
            {
              $cond: {
                if: { $ne: ['$lastUpdated', null] },
                then: {
                  $divide: [
                    { $subtract: ['$lastUpdated', new Date('2020-01-01')] },
                    86400000000 // Convert to days and scale down
                  ]
                },
                else: 0
              }
            }
          ]
        }
      }
    };
  }

  /**
   * Processes search results with product-specific enhancements
   * @param {Array} results - Raw search results
   * @param {string} query - Original search query
   * @param {Object} options - Search options
   * @returns {Array} - Processed search results
   */
  processResults(results, query, options = {}) {
    return results.map(result => {
      // Convert to plain object
      const processed = result.toObject ? result.toObject() : result;
      
      // Format price as number
      if (processed.price) {
        processed.priceNumeric = parseFloat(processed.price) || 0;
      }
      
      // Add computed fields
      processed.displayName = this.buildDisplayName(processed);
      processed.searchRelevance = processed.score || 0;
      processed.isAvailable = processed.available > 0;
      
      // Format last updated
      if (processed.lastUpdated) {
        processed.lastUpdatedFormatted = new Date(processed.lastUpdated).toLocaleDateString();
      }
      
      // Clean up internal fields
      delete processed.score;
      delete processed.__v;
      
      return processed;
    });
  }

  /**
   * Builds display name for product search results
   * @param {Object} product - Product object
   * @returns {string} - Display name
   */
  buildDisplayName(product) {
    let displayName = product.name;
    
    if (product.setName && product.setName !== product.name) {
      displayName += ` - ${product.setName}`;
    }
    
    if (product.category) {
      displayName += ` (${product.category})`;
    }
    
    return displayName;
  }

  /**
   * Gets search type identifier
   * @returns {string} - Search type identifier
   */
  getSearchType() {
    return 'products';
  }

  /**
   * Gets Fuse.js keys configuration for product search
   * @returns {Array} - Fuse.js keys configuration
   */
  getFuseKeys() {
    return [
      { name: 'name', weight: 3 },
      { name: 'setName', weight: 2 },
      { name: 'category', weight: 1.5 }
    ];
  }

  /**
   * Calculates custom scoring factors for product search
   * @param {Object} result - Search result
   * @param {string} query - Search query
   * @returns {number} - Custom score
   */
  calculateCustomScore(result, query) {
    let score = 0;
    
    // Price scoring (lower prices get higher scores)
    if (result.priceNumeric && result.priceNumeric > 0) {
      score += Math.min(20, 1000 / result.priceNumeric);
    }
    
    // Availability scoring
    if (result.available && result.available > 0) {
      score += Math.min(20, result.available / 10);
    }
    
    // Recent update scoring
    if (result.lastUpdated) {
      const daysSinceUpdate = (Date.now() - new Date(result.lastUpdated).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysSinceUpdate);
    }
    
    return Math.min(100, score);
  }

  /**
   * Gets supported search options
   * @returns {Object} - Supported search options
   */
  getSupportedOptions() {
    return {
      ...super.getSupportedOptions(),
      filters: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          setName: { type: 'string' },
          priceRange: {
            type: 'object',
            properties: {
              min: { type: 'number', minimum: 0 },
              max: { type: 'number', minimum: 0 }
            }
          },
          availableOnly: { type: 'boolean' },
          minAvailable: { type: 'number', minimum: 0 },
          lastUpdatedAfter: { type: 'string', format: 'date-time' }
        }
      }
    };
  }
}

module.exports = ProductSearchStrategy;