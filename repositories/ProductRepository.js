const BaseRepository = require('./base/BaseRepository');
const Product = require('../models/Product');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Product Repository
 *
 * Specialized repository for Product model operations.
 * Extends BaseRepository with product-specific search and query methods.
 *
 * IMPORTANT: This handles Product which references SetProduct
 * for product expansion/set grouping information.
 */
class ProductRepository extends BaseRepository {
  /**
   * Creates a new Product repository instance
   */
  constructor() {
    super(Product, {
      entityName: 'Product',
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

  /**
   * Searches products with advanced filtering
   * @param {string} query - Search query
   * @param {Object} filters - Advanced filters
   * @returns {Promise<Array>} - Search results
   */
  async searchAdvanced(query, filters = {}) {
    try {
      const pipeline = [];
      const matchConditions = [];

      // Add price conversion for filtering
      pipeline.push({
        $addFields: {
          priceNumeric: { $toDouble: '$price' },
        },
      });

      // Populate set product for search
      pipeline.push({
        $lookup: {
          from: 'setproducts',
          localField: 'setProductId',
          foreignField: '_id',
          as: 'setProduct',
        },
      });

      pipeline.push({
        $unwind: '$setProduct',
      });

      // Text search
      if (query) {
        matchConditions.push({
          $or: [
            { productName: { $regex: query, $options: 'i' } },
            { 'setProduct.setProductName': { $regex: query, $options: 'i' } },
            { category: { $regex: query, $options: 'i' } },
          ],
        });
      }

      // Category filter
      if (filters.category) {
        matchConditions.push({
          category: new RegExp(filters.category, 'i'),
        });
      }

      // Set product filter
      if (filters.setProductId) {
        matchConditions.push({
          setProductId: filters.setProductId,
        });
      }

      // Price range filter
      if (filters.priceRange) {
        matchConditions.push({
          priceNumeric: {
            $gte: filters.priceRange.min,
            $lte: filters.priceRange.max,
          },
        });
      }

      // Availability filter
      if (filters.availableOnly) {
        matchConditions.push({
          available: { $gt: 0 },
        });
      }

      // Minimum availability filter
      if (filters.minAvailable) {
        matchConditions.push({
          available: { $gte: filters.minAvailable },
        });
      }

      // Add match stage
      if (matchConditions.length > 0) {
        pipeline.push({
          $match: matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0],
        });
      }

      // Add scoring if query provided
      if (query) {
        pipeline.push({
          $addFields: {
            score: {
              $add: [
                // Exact product name match
                {
                  $cond: {
                    if: { $eq: [{ $toLower: '$productName' }, query.toLowerCase()] },
                    then: 100,
                    else: 0,
                  },
                },
                // Exact set name match
                {
                  $cond: {
                    if: {
                      $eq: [{ $toLower: '$setProduct.setProductName' }, query.toLowerCase()],
                    },
                    then: 80,
                    else: 0,
                  },
                },
                // Product name starts with
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$productName' },
                        regex: `^${query.toLowerCase()}`,
                      },
                    },
                    then: 70,
                    else: 0,
                  },
                },
                // Set name starts with
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$setProduct.setProductName' },
                        regex: `^${query.toLowerCase()}`,
                      },
                    },
                    then: 60,
                    else: 0,
                  },
                },
                // Product name contains
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$productName' },
                        regex: query.toLowerCase(),
                      },
                    },
                    then: 50,
                    else: 0,
                  },
                },
                // Set name contains
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$setProduct.setProductName' },
                        regex: query.toLowerCase(),
                      },
                    },
                    then: 40,
                    else: 0,
                  },
                },
                // Category contains
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$category' },
                        regex: query.toLowerCase(),
                      },
                    },
                    then: 30,
                    else: 0,
                  },
                },
                // Price score (lower prices get higher scores)
                {
                  $cond: {
                    if: { $gt: ['$priceNumeric', 0] },
                    then: { $divide: [1000, '$priceNumeric'] },
                    else: 0,
                  },
                },
                // Availability score
                {
                  $cond: {
                    if: { $gt: ['$available', 0] },
                    then: { $divide: ['$available', 100] },
                    else: 0,
                  },
                },
              ],
            },
          },
        });
      }

      // Sort
      const sortStage = query
        ? { $sort: { score: -1, available: -1, priceNumeric: 1 } }
        : { $sort: filters.sort || this.options.defaultSort };

      pipeline.push(sortStage);

      // Limit
      if (filters.limit) {
        pipeline.push({ $limit: filters.limit });
      }

      return await this.aggregate(pipeline);
    } catch (error) {
      throw error;
    }
  }

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

  /**
   * Gets product suggestions for autocomplete
   * @param {string} query - Search query
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Product suggestions
   */
  async getSuggestions(query, options = {}) {
    try {
      const results = await this.searchAdvanced(query, {
        limit: options.limit || 10,
      });

      return results.map((product) => ({
        id: product._id,
        text: product.productName,
        secondaryText: product.setProduct?.setProductName || 'Unknown Set',
        metadata: {
          category: product.category,
          price: product.price,
          priceNumeric: product.priceNumeric,
          available: product.available,
          setProductId: product.setProductId,
          setProductName: product.setProduct?.setProductName,
          isAvailable: product.available > 0,
        },
      }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ProductRepository;