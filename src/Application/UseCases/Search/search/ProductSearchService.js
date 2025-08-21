/**
 * Product Search Service
 *
 * Single Responsibility: Product-specific search operations using FlexSearch + MongoDB
 * Handles product search, filtering, sorting, and result optimization
 * Extracted from SearchService to follow SRP and improve maintainability
 */

import Product from '@/Domain/Entities/Product.js';
import SearchQueryBuilder from './SearchQueryBuilder.js';
import FlexSearchIndexManager from './FlexSearchIndexManager.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
class ProductSearchService {
  constructor() {
    this.indexManager = FlexSearchIndexManager;
  }

  /**
   * Search products using FlexSearch + MongoDB hybrid approach
   * FlexSearch for fast partial matching, MongoDB for complex filtering
   *
   * @param {string} query - Search query string
   * @param {Object} filters - Additional filters (category, setProductId, etc.)
   * @param {Object} options - Search options (limit, offset, sort, populate)
   * @returns {Array} Array of products matching the search criteria
   */
  async searchProducts(query, filters = {}, options = {}) {
    const { limit = 50, offset = 0, sort = { _id: -1 }, populate = true } = options;

    Logger.operationStart('PRODUCT_SEARCH', 'Searching products', {
      query: query?.substring(0, 50),
      filtersCount: Object.keys(filters).length,
      options: { limit, offset, populate }
    });

    // Return all products if no query and no filters
    if ((!query || !query.trim()) && Object.keys(filters).length === 0) {
      return this._getAllProducts(limit, offset, sort, populate);
    }

    // Handle wildcard or empty query with filters
    if (!query || !query.trim() || query.trim() === '*') {
      return this._searchProductsWithFiltersOnly(filters, { limit, offset, sort, populate });
    }

    try {
      // Initialize FlexSearch indexes if needed
      await this.indexManager.initializeIndexes();

      const startTime = Date.now();
      const flexResults = await this._performFlexSearch(query);
      const hybridResults = await this._combineWithMongoQuery(query, flexResults, filters, options);

      const searchTime = Date.now() - startTime;

      Logger.operationSuccess('PRODUCT_SEARCH', 'Product search completed', {
        query: query?.substring(0, 50),
        flexResultsCount: flexResults.length,
        finalResultsCount: hybridResults.length,
        searchTime: `${searchTime}ms`,
        hasFilters: Object.keys(filters).length > 0
      });

      return hybridResults;

    } catch (error) {
      Logger.operationError('PRODUCT_SEARCH', 'Product search failed', error, {
        query: query?.substring(0, 50),
        filters
      });
      throw error;
    }
  }

  /**
   * Get product search suggestions/autocomplete
   *
   * @param {string} query - Partial query for suggestions
   * @param {Object} options - Options (limit, type)
   * @returns {Array} Array of suggestion strings
   */
  async getProductSuggestions(query, options = {}) {
    const { limit = 10 } = options;

    if (!query || query.trim().length < 1) {
      return [];
    }

    Logger.operationStart('PRODUCT_SUGGESTIONS', 'Getting product suggestions', {
      query: query?.substring(0, 50),
      limit
    });

    try {
      await this.indexManager.initializeIndexes();

      const productIndex = this.indexManager.getProductIndex();
      const results = productIndex.search(query, { limit });

      // Extract unique suggestions from search results
      const suggestions = new Set();

      results.forEach(result => {
        if (Array.isArray(result.result)) {
          result.result.forEach(id => {
            // Get document data and extract relevant suggestion text
            const doc = productIndex.get(id);

            if (doc && doc.productName) {
              suggestions.add(doc.productName);
            }
          });
        }
      });

      const suggestionArray = Array.from(suggestions).slice(0, limit);

      Logger.operationSuccess('PRODUCT_SUGGESTIONS', 'Product suggestions retrieved', {
        query: query?.substring(0, 50),
        suggestionsCount: suggestionArray.length
      });

      return suggestionArray;

    } catch (error) {
      Logger.operationError('PRODUCT_SUGGESTIONS', 'Failed to get product suggestions', error, {
        query: query?.substring(0, 50)
      });
      return [];
    }
  }

  /**
   * Search products by category with optimization
   *
   * @param {string} category - Product category to search
   * @param {Object} additionalFilters - Additional filters
   * @param {Object} options - Search options
   * @returns {Array} Products in the specified category
   */
  async searchProductsByCategory(category, additionalFilters = {}, options = {}) {
    const filters = { category, ...additionalFilters };

    return this.searchProducts('', filters, options);
  }

  /**
   * Search sealed products (booster boxes, packs, etc.)
   *
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} Sealed products matching query
   */
  async searchSealedProducts(query, options = {}) {
    const filters = {
      category: { $in: ['Booster Box', 'Booster Pack', 'Theme Deck', 'Starter Deck', 'Bundle', 'Collection Box'] }
    };

    return this.searchProducts(query, filters, options);
  }

  /**
   * Perform FlexSearch on product index
   * @private
   */
  async _performFlexSearch(query) {
    const productIndex = this.indexManager.getProductIndex();
    const searchWords = query.toLowerCase().trim().split(/\s+/).filter(word => word.length >= 1);

    const productIds = [];

    for (const word of searchWords) {
      if (word.length >= 1) {
        const results = productIndex.search(word, { limit: 1000 });

        results.forEach(result => {
          if (Array.isArray(result.result)) {
            result.result.forEach(id => {
              if (!productIds.includes(id)) {
                productIds.push(id);
              }
            });
          }
        });
      }
    }

    return productIds;
  }

  /**
   * Combine FlexSearch results with MongoDB query
   * @private
   */
  async _combineWithMongoQuery(query, flexResultIds, filters, options) {
    const { limit = 50, offset = 0, sort = { _id: -1 }, populate = true } = options;

    // Build MongoDB query
    const mongoQuery = SearchQueryBuilder.buildTextSearchQuery(query, [
      'productName', 'category'
    ]);

    // Add filters
    Object.assign(mongoQuery, filters);

    const orderedResults = [];

    // Get FlexSearch results first (prioritized)
    if (flexResultIds.length > 0) {
      const flexQuery = {
        ...mongoQuery,
        _id: { $in: flexResultIds }
      };

      let productQuery = Product.find(flexQuery);

      if (populate) {
        productQuery = productQuery.populate('setProductId', 'setProductName');
      }

      const flexProducts = await productQuery.lean().exec();

      // Order results by FlexSearch ranking
      flexResultIds.forEach(id => {
        const product = flexProducts.find(p => p._id.toString() === id);

        if (product && orderedResults.length < limit) {
          // Enhanced product data
          orderedResults.push({
            ...product,
            id: product._id.toString(),
            setProductName: product.setProductId?.setProductName || '',
            // Add computed fields
            displayName: this._buildProductDisplayName(product),
            searchRelevance: 'flex'
          });
        }
      });
    }

    // Supplement with MongoDB text search if needed
    if (orderedResults.length < limit) {
      const remainingLimit = limit - orderedResults.length;
      const existingIds = orderedResults.map(r => r._id.toString());

      // Exclude already found products
      const supplementQuery = {
        ...mongoQuery,
        _id: { $nin: existingIds }
      };

      let productQuery = Product.find(supplementQuery)
        .sort(sort)
        .limit(remainingLimit);

      if (populate) {
        productQuery = productQuery.populate('setProductId', 'setProductName');
      }

      const mongoProducts = await productQuery.lean().exec();

      mongoProducts.forEach(product => {
        orderedResults.push({
          ...product,
          id: product._id.toString(),
          setProductName: product.setProductId?.setProductName || '',
          displayName: this._buildProductDisplayName(product),
          searchRelevance: 'mongo'
        });
      });
    }

    // Apply offset and limit
    return orderedResults.slice(offset, offset + limit);
  }

  /**
   * Search products with filters only (no text query)
   * @private
   */
  async _searchProductsWithFiltersOnly(filters, options) {
    const { limit = 50, offset = 0, sort = { _id: -1 }, populate = true } = options;

    let query = Product.find(filters)
      .sort(sort)
      .skip(offset)
      .limit(limit);

    if (populate) {
      query = query.populate('setProductId', 'setProductName');
    }

    const products = await query.lean().exec();

    return products.map(product => ({
      ...product,
      id: product._id.toString(),
      setProductName: product.setProductId?.setProductName || '',
      displayName: this._buildProductDisplayName(product),
      searchRelevance: 'filter'
    }));
  }

  /**
   * Get all products (no search query)
   * @private
   */
  async _getAllProducts(limit, offset, sort, populate) {
    let query = Product.find({})
      .sort(sort)
      .skip(offset)
      .limit(limit);

    if (populate) {
      query = query.populate('setProductId', 'setProductName');
    }

    const products = await query.lean().exec();

    return products.map(product => ({
      ...product,
      id: product._id.toString(),
      setProductName: product.setProductId?.setProductName || '',
      displayName: this._buildProductDisplayName(product),
      searchRelevance: 'all'
    }));
  }

  /**
   * Build display name for product
   * @private
   */
  _buildProductDisplayName(product) {
    const parts = [product.productName];

    if (product.category) {
      parts.push(`(${product.category})`);
    }

    if (product.setProductId?.setProductName) {
      parts.push(`- ${product.setProductId.setProductName}`);
    }

    return parts.join(' ');
  }

  /**
   * Get popular product categories
   * Returns most common categories for filtering/suggestions
   *
   * @param {Object} options - Options (limit)
   * @returns {Array} Popular categories with counts
   */
  async getPopularCategories(options = {}) {
    const { limit = 10 } = options;

    try {
      const categories = await Product.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { category: '$_id', count: 1, _id: 0 } }
      ]);

      return categories;

    } catch (error) {
      Logger.operationError('GET_POPULAR_CATEGORIES', 'Failed to get popular categories', error);
      return [];
    }
  }

  /**
   * Get product statistics
   * Returns overview statistics for products
   *
   * @returns {Object} Product statistics
   */
  async getProductStats() {
    try {
      const [totalProducts, categoryStats] = await Promise.all([
        Product.countDocuments({}),
        Product.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ])
      ]);

      return {
        totalProducts,
        categoryStats,
        topCategory: categoryStats[0] || null
      };

    } catch (error) {
      Logger.operationError('GET_PRODUCT_STATS', 'Failed to get product statistics', error);
      return {
        totalProducts: 0,
        categoryStats: [],
        topCategory: null
      };
    }
  }
}

export default new ProductSearchService();
