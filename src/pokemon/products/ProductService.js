/**
 * ProductService - Service Layer for Product Operations
 *
 * Provides business logic abstraction for Product operations.
 * Replaces direct model access in ProductsController to improve
 * architecture consistency and maintainability.
 *
 * Follows SOLID principles:
 * - Single Responsibility: Handles only product business logic
 * - Dependency Inversion: Controllers depend on this service abstraction
 * - Open/Closed: Extensible for new product operations
 */

import Product from '@/pokemon/products/Product.js';
import SetProduct from '@/pokemon/products/SetProduct.js';
import SearchService from '@/search/services/SearchService.js';
import ValidatorFactory from '@/system/validation/ValidatorFactory.js';
import Logger from '@/system/logging/Logger.js';
import { NotFoundError, ValidationError } from '@/system/middleware/errorHandler.js';

class ProductService {
  constructor() {
    this.searchService = new SearchService();
  }

  /**
   * Get all products with filtering and pagination
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (pagination, sorting, etc.)
   * @returns {Promise<Object>} - Products with pagination metadata
   */
  async getAllProducts(filters = {}, options = {}) {
    Logger.debug('ProductService', 'Getting all products', { filters, options });

    const {
      page = 1,
      limit = 20,
      maxLimit = 100,
      searchQuery = null,
      sortBy = 'available',
      sortOrder = -1
    } = options;

    // Handle search-based queries
    if (searchQuery) {
      return this.searchProducts(searchQuery, filters, { page, limit });
    }

    // Build MongoDB query
    const query = this.buildProductQuery(filters);

    // Validate pagination
    const { pageNum, limitNum } = ValidatorFactory.validatePagination(page, limit, maxLimit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query with pagination
    const [products, totalProducts] = await Promise.all([
      Product.find(query)
        .populate('setProductId', 'setProductName')
        .skip(skip)
        .limit(limitNum)
        .sort({ [sortBy]: sortOrder, price: 1, _id: 1 })
        .lean(),
      Product.countDocuments(query)
    ]);

    const totalPages = Math.ceil(totalProducts / limitNum);

    Logger.debug('ProductService', 'Products retrieved', {
      found: products.length,
      total: totalProducts,
      page: pageNum,
      totalPages
    });

    return {
      products,
      pagination: {
        total: totalProducts,
        currentPage: pageNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        count: products.length,
        limit: limitNum
      },
      filters: query,
      success: true
    };
  }

  /**
   * Get product by ID
   * @param {string} productId - Product ID
   * @param {Object} options - Query options (populate, select, etc.)
   * @returns {Promise<Object>} - Product document
   */
  async getProductById(productId, options = {}) {
    Logger.debug('ProductService', 'Getting product by ID', { productId, options });

    // Validate product ID
    ValidatorFactory.validateObjectId(productId, 'Product ID');

    let query = Product.findById(productId);

    // Apply populate options
    if (options.populate !== false) {
      query = query.populate('setProductId', 'setProductName');
    }

    if (options.select) {
      query = query.select(options.select);
    }

    if (options.lean !== false) {
      query = query.lean();
    }

    const product = await query;

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    Logger.debug('ProductService', 'Product found', { productId: product._id });

    return product;
  }

  /**
   * Search products using SearchService
   * @param {string} searchQuery - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @returns {Promise<Object>} - Search results with metadata
   */
  async searchProducts(searchQuery, filters = {}, options = {}) {
    Logger.debug('ProductService', 'Searching products', { searchQuery, filters, options });

    const { page = 1, limit = 50 } = options;
    const { pageNum, limitNum } = ValidatorFactory.validatePagination(page, limit, 100);

    const searchOptions = {
      limit: limitNum,
      page: pageNum
    };

    const { results, total, page: resultPage, totalPages } = await this.searchService.searchProducts(
      searchQuery,
      filters,
      searchOptions
    );

    Logger.debug('ProductService', 'Search completed', {
      query: searchQuery,
      resultsFound: results.length,
      total,
      page: resultPage || pageNum
    });

    return {
      products: results,
      pagination: {
        total,
        currentPage: resultPage || pageNum,
        totalPages,
        hasNextPage: (resultPage || pageNum) < totalPages,
        hasPrevPage: (resultPage || pageNum) > 1,
        count: results.length,
        limit: limitNum
      },
      query: searchQuery,
      filters,
      success: true
    };
  }

  /**
   * Get product set names with search and metadata
   * @param {string} searchQuery - Optional search query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Set names with metadata
   */
  async getProductSetNames(searchQuery = null, options = {}) {
    Logger.debug('ProductService', 'Getting product set names', { searchQuery, options });

    if (searchQuery) {
      // Search-based set names extraction
      const searchResults = await this.searchService.searchProducts(searchQuery, {}, { limit: 100 });
      const products = Array.isArray(searchResults) ? searchResults : searchResults.results || [];

      // Group products by setName and calculate metadata
      const setNameStats = {};

      products.forEach(product => {
        if (!setNameStats[product.setName]) {
          setNameStats[product.setName] = {
            setName: product.setName,
            count: 0,
            totalAvailable: 0,
            categories: new Set(),
            priceRange: { min: Infinity, max: 0 }
          };
        }

        const stats = setNameStats[product.setName];
        stats.count++;
        stats.totalAvailable += product.available || 0;
        if (product.category) stats.categories.add(product.category);
        if (product.price) {
          stats.priceRange.min = Math.min(stats.priceRange.min, product.price);
          stats.priceRange.max = Math.max(stats.priceRange.max, product.price);
        }
      });

      // Convert sets to arrays and clean up
      const setNames = Object.values(setNameStats).map(stats => ({
        ...stats,
        categories: Array.from(stats.categories),
        priceRange: stats.priceRange.min === Infinity
          ? null
          : stats.priceRange
      }));

      Logger.debug('ProductService', 'Search-based set names extracted', {
        found: setNames.length
      });

      return setNames.sort((a, b) => b.count - a.count);
    }

    // Direct aggregation for all set names
    const setNames = await Product.aggregate([
      {
        $group: {
          _id: '$setName',
          count: { $sum: 1 },
          totalAvailable: { $sum: '$available' },
          categories: { $addToSet: '$category' },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      },
      {
        $project: {
          setName: '$_id',
          count: 1,
          totalAvailable: 1,
          categories: 1,
          priceRange: {
            min: '$minPrice',
            max: '$maxPrice',
            avg: '$avgPrice'
          },
          _id: 0
        }
      },
      { $sort: { count: -1 } }
    ]);

    Logger.debug('ProductService', 'Aggregation-based set names retrieved', {
      found: setNames.length
    });

    return setNames;
  }

  /**
   * Get product categories with counts
   * @returns {Promise<Array>} - Categories with counts
   */
  async getProductCategories() {
    Logger.debug('ProductService', 'Getting product categories');

    const categories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAvailable: { $sum: '$available' },
          avgPrice: { $avg: '$price' }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          totalAvailable: 1,
          avgPrice: { $round: ['$avgPrice', 2] },
          _id: 0
        }
      },
      { $match: { category: { $ne: null } } },
      { $sort: { count: -1 } }
    ]);

    Logger.debug('ProductService', 'Categories retrieved', {
      found: categories.length
    });

    return categories;
  }

  /**
   * Get category details with products
   * @param {string} categoryName - Category name
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Category details with products
   */
  async getCategoryDetails(categoryName, options = {}) {
    Logger.debug('ProductService', 'Getting category details', { categoryName, options });

    const { limit = 20, page = 1 } = options;
    const { pageNum, limitNum } = ValidatorFactory.validatePagination(page, limit, 100);
    const skip = (pageNum - 1) * limitNum;

    const query = { category: categoryName };

    const [products, totalProducts, categoryStats] = await Promise.all([
      Product.find(query)
        .populate('setProductId', 'setProductName')
        .skip(skip)
        .limit(limitNum)
        .sort({ available: -1, price: 1 })
        .lean(),
      Product.countDocuments(query),
      Product.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalAvailable: { $sum: '$available' },
            avgPrice: { $avg: '$price' },
            minPrice: { $min: '$price' },
            maxPrice: { $max: '$price' },
            setNames: { $addToSet: '$setName' }
          }
        }
      ])
    ]);

    const totalPages = Math.ceil(totalProducts / limitNum);
    const stats = categoryStats[0] || {};

    Logger.debug('ProductService', 'Category details retrieved', {
      category: categoryName,
      productsFound: products.length,
      totalProducts
    });

    return {
      category: categoryName,
      products,
      pagination: {
        total: totalProducts,
        currentPage: pageNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
        count: products.length,
        limit: limitNum
      },
      statistics: {
        totalProducts: stats.totalProducts || 0,
        totalAvailable: stats.totalAvailable || 0,
        avgPrice: Math.round((stats.avgPrice || 0) * 100) / 100,
        priceRange: {
          min: stats.minPrice || 0,
          max: stats.maxPrice || 0
        },
        setNames: stats.setNames || []
      }
    };
  }

  /**
   * Build MongoDB query from filters
   * @private
   */
  buildProductQuery(filters) {
    const query = {};

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.setName) {
      query.setName = new RegExp(filters.setName, 'i');
    }

    if (filters.available === true || filters.available === 'true') {
      query.available = { $gt: 0 };
    }

    if (filters.minPrice || filters.maxPrice) {
      query.price = {};
      if (filters.minPrice) query.price.$gte = Number(filters.minPrice);
      if (filters.maxPrice) query.price.$lte = Number(filters.maxPrice);
    }

    return query;
  }

  /**
   * Create a new product
   * @param {Object} productData - Product data
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} - Created product
   */
  async createProduct(productData, options = {}) {
    Logger.debug('ProductService', 'Creating product', { productData });

    const product = new Product(productData);
    await product.save();

    Logger.info('ProductService', 'Product created', { productId: product._id });

    return options.populate !== false
      ? await product.populate('setProductId', 'setProductName')
      : product;
  }

  /**
   * Update product by ID
   * @param {string} productId - Product ID
   * @param {Object} updateData - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} - Updated product
   */
  async updateProduct(productId, updateData, options = {}) {
    Logger.debug('ProductService', 'Updating product', { productId, updateData });

    ValidatorFactory.validateObjectId(productId, 'Product ID');

    const product = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    Logger.info('ProductService', 'Product updated', { productId: product._id });

    return options.populate !== false
      ? await product.populate('setProductId', 'setProductName')
      : product;
  }

  /**
   * Delete product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} - Deleted product
   */
  async deleteProduct(productId) {
    Logger.debug('ProductService', 'Deleting product', { productId });

    ValidatorFactory.validateObjectId(productId, 'Product ID');

    const product = await Product.findByIdAndDelete(productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    Logger.info('ProductService', 'Product deleted', { productId });

    return product;
  }
}

export default ProductService;
