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
import ProductRepository from '@/pokemon/products/ProductRepository.js';
import BaseRepository from '@/system/database/BaseRepository.js';
import BaseService from '@/system/services/BaseService.js';
import SearchService from '@/search/services/SearchService.js';
import ValidatorFactory from '@/system/validation/ValidatorFactory.js';
import Logger from '@/system/logging/Logger.js';
import { NotFoundError, ValidationError } from '@/system/errors/ErrorTypes.js';

class ProductService extends BaseService {
  constructor() {
    // Create repository for Product model
    const productRepository = new BaseRepository(Product, {
      entityName: 'Product',
      defaultPopulate: { path: 'setProductId', select: 'setProductName' },
      defaultSort: { available: -1, price: 1, _id: 1 }
    });

    // Initialize BaseService
    super(productRepository, {
      entityName: 'Product',
      enableLogging: true,
      enableValidation: true
    });

    this.searchService = new SearchService();
  }
  /**
   * Product-specific validation for create operations
   * @protected
   */
  async validateEntitySpecificCreateData(data) {
    // Validate required product fields
    ValidatorFactory.string(data.productName, 'Product name', { required: true, maxLength: 255 });
    ValidatorFactory.string(data.category, 'Category', { required: true });
    ValidatorFactory.string(data.setName, 'Set name', { required: true });
    ValidatorFactory.number(data.price, 'Price', { required: true, min: 0 });
    ValidatorFactory.number(data.available, 'Available quantity', { min: 0, integer: true });

    if (data.setProductId) {
      ValidatorFactory.objectId(data.setProductId, 'Set product reference');
    }
  }

  /**
   * Product-specific validation for update operations
   * @protected
   */
  async validateEntitySpecificUpdateData(data, id) {
    // Validate product fields for updates
    if (data.productName !== undefined) {
      ValidatorFactory.string(data.productName, 'Product name', { required: true, maxLength: 255 });
    }

    if (data.category !== undefined) {
      ValidatorFactory.string(data.category, 'Category', { required: true });
    }

    if (data.price !== undefined) {
      ValidatorFactory.number(data.price, 'Price', { required: true, min: 0 });
    }

    if (data.available !== undefined) {
      ValidatorFactory.number(data.available, 'Available quantity', { min: 0, integer: true });
    }

    if (data.setProductId !== undefined) {
      ValidatorFactory.objectId(data.setProductId, 'Set product reference');
    }
  }

  /**
   * Get all products with filtering and pagination
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options (pagination, sorting, etc.)
   * @returns {Promise<Object>} - Products with pagination metadata
   */
  async getAllProducts(filters = {}, options = {}) {
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

    // Build query filters
    const query = this.buildProductQuery(filters);

    // Use BaseService findPaginated with enhanced options
    const { pageNum, limitNum } = ValidatorFactory.validatePagination(page, limit, maxLimit);

    const paginatedResults = await this.findPaginated(query, {
      page: pageNum,
      limit: limitNum,
      sort: { [sortBy]: sortOrder, price: 1, _id: 1 },
      populate: this.repository.options.defaultPopulate,
      lean: true
    });

    // Transform to match expected response format
    return {
      products: paginatedResults.data,
      pagination: {
        total: paginatedResults.pagination.totalCount,
        currentPage: paginatedResults.pagination.page,
        totalPages: paginatedResults.pagination.totalPages,
        hasNextPage: paginatedResults.pagination.hasNextPage,
        hasPrevPage: paginatedResults.pagination.hasPrevPage,
        count: paginatedResults.data.length,
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
    // Use BaseService getById method with enhanced validation
    return await this.getById(productId, {
      populate: options.populate !== false ? this.repository.options.defaultPopulate : false,
      select: options.select,
      lean: options.lean !== false
    });
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
    // Use BaseService create method with enhanced validation and logging
    const product = await this.create(productData, {
      populate: options.populate !== false ? this.repository.options.defaultPopulate : false
    });

    return product;
  }

  /**
   * Update product by ID
   * @param {string} productId - Product ID
   * @param {Object} updateData - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} - Updated product
   */
  async updateProduct(productId, updateData, options = {}) {
    // Use BaseService update method with enhanced validation and logging
    const product = await this.update(productId, updateData, {
      populate: options.populate !== false ? this.repository.options.defaultPopulate : false
    });

    return product;
  }

  /**
   * Delete product by ID
   * @param {string} productId - Product ID
   * @returns {Promise<Object>} - Deleted product
   */
  async deleteProduct(productId) {
    // Use BaseService delete method with enhanced validation and logging
    return await this.delete(productId);
  }
}

export default ProductService;
