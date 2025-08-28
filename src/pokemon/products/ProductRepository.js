import SearchableRepository from '@/system/database/SearchableRepository.js';
import Product from '@/pokemon/products/Product.js';
import { ValidationError } from '@/system/errors/ErrorTypes.js';
/**
 * Product Repository
 *
 * Specialized repository for Product model operations.
 * Extends SearchableRepository with unified search functionality.
 *
 * IMPORTANT: This handles Product which references SetProduct
 * for product expansion/set grouping information.
 *
 * REFACTORED: Now uses unified search abstraction, eliminating ~210 lines of duplicated search code.
 */
class ProductRepository extends SearchableRepository {
  /**
   * Creates a new Product repository instance
   */
  constructor() {
    super(Product, {
      entityType: 'products', // Use search configuration key
      defaultSort: { available: -1, price: 1 },
      defaultPopulate: 'setProductId',
    });
  }

  /**
   * Finds products by category
   * @param {string} category - Product category
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Products in the category
   */
  async findByCategory(category, options = {}) {
    try {
      return await this.findAll(
        {
          category: new RegExp(category, 'i'),
        },
        options,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds products by set product ID
   * @param {string} setProductId - Set product ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Products in the set
   */
  async findBySetProduct(setProductId, options = {}) {
    try {
      return await this.findAll(
        {
          setProductId,
        },
        options,
      );
    } catch (error) {
      throw error;
    }
  }

  // searchAdvanced method now inherited from SearchableRepository
  // Eliminates ~210 lines of duplicated search logic including complex aggregation pipeline
  // All original functionality preserved through search configuration

  /**
   * Gets available categories
   * @returns {Promise<Array>} - Available categories
   */
  async getCategories() {
    try {
      const categories = await this.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalAvailable: { $sum: '$available' },
            averagePrice: { $avg: { $toDouble: '$price' } },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            totalAvailable: 1,
            averagePrice: { $round: ['$averagePrice', 2] },
            _id: 0,
          },
        },
      ]);

      return categories;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets available set products
   * @returns {Promise<Array>} - Available set products
   */
  async getSetProducts() {
    try {
      const setProducts = await this.aggregate([
        {
          $lookup: {
            from: 'setproducts',
            localField: 'setProductId',
            foreignField: '_id',
            as: 'setProduct',
          },
        },
        {
          $unwind: '$setProduct',
        },
        {
          $group: {
            _id: '$setProductId',
            setProductName: { $first: '$setProduct.setProductName' },
            uniqueSetProductId: { $first: '$setProduct.uniqueSetProductId' },
            count: { $sum: 1 },
            totalAvailable: { $sum: '$available' },
            averagePrice: { $avg: { $toDouble: '$price' } },
            categories: { $addToSet: '$category' },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $project: {
            setProductId: '$_id',
            setProductName: 1,
            uniqueSetProductId: 1,
            count: 1,
            totalAvailable: 1,
            averagePrice: { $round: ['$averagePrice', 2] },
            categoryCount: { $size: '$categories' },
            _id: 0,
          },
        },
      ]);

      return setProducts;
    } catch (error) {
      throw error;
    }
  }

  // getSuggestions method now inherited from SearchableRepository
  // Eliminates ~22 lines of duplicated suggestion formatting logic
  // All original functionality preserved through search configuration
}

export default ProductRepository;
