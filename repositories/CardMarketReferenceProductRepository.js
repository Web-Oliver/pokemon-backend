const BaseRepository = require('./base/BaseRepository');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * CardMarketReferenceProduct Repository
 *
 * Specialized repository for CardMarketReferenceProduct model operations.
 * Extends BaseRepository with product-specific search and query methods.
 *
 * IMPORTANT: This handles CardMarketReferenceProduct which has a setName field
 * that is NOT the same as the Set model. This setName is for product grouping.
 */
class CardMarketReferenceProductRepository extends BaseRepository {
  /**
   * Creates a new CardMarketReferenceProduct repository instance
   */
  constructor() {
    super(CardMarketReferenceProduct, {
      entityName: 'CardMarketReferenceProduct',
      defaultSort: { available: -1, price: 1 },
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
   * Finds products by set name (product grouping)
   * @param {string} setName - Set name to search
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Products in the set
   */
  async findBySetName(setName, options = {}) {
    try {
      return await this.findAll(
        {
          setName: new RegExp(setName, 'i'),
        },
        options,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds available products only
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Available products
   */
  async findAvailable(options = {}) {
    try {
      return await this.findAll(
        {
          available: { $gt: 0 },
        },
        {
          ...options,
          sort: { available: -1, price: 1 },
        },
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds products by price range
   * @param {number} minPrice - Minimum price
   * @param {number} maxPrice - Maximum price
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Products in price range
   */
  async findByPriceRange(minPrice, maxPrice, options = {}) {
    try {
      if (minPrice < 0 || maxPrice < 0) {
        throw new ValidationError('Price values must be non-negative');
      }

      if (minPrice > maxPrice) {
        throw new ValidationError('Minimum price cannot be greater than maximum price');
      }

      // Convert price strings to numbers for comparison
      const pipeline = [
        {
          $addFields: {
            priceNumeric: { $toDouble: '$price' },
          },
        },
        {
          $match: {
            priceNumeric: { $gte: minPrice, $lte: maxPrice },
          },
        },
        {
          $sort: options.sort || { priceNumeric: 1 },
        },
      ];

      if (options.limit) {
        pipeline.push({ $limit: options.limit });
      }

      return await this.aggregate(pipeline);
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

      // Text search
      if (query) {
        matchConditions.push({
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { setName: { $regex: query, $options: 'i' } },
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

      // Set name filter
      if (filters.setName) {
        matchConditions.push({
          setName: new RegExp(filters.setName, 'i'),
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

      // Last updated filter
      if (filters.lastUpdatedAfter) {
        matchConditions.push({
          lastUpdated: { $gte: new Date(filters.lastUpdatedAfter) },
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
                // Exact name match
                {
                  $cond: {
                    if: { $eq: [{ $toLower: '$name' }, query.toLowerCase()] },
                    then: 100,
                    else: 0,
                  },
                },
                // Exact set name match
                {
                  $cond: {
                    if: {
                      $eq: [{ $toLower: '$setName' }, query.toLowerCase()],
                    },
                    then: 80,
                    else: 0,
                  },
                },
                // Name starts with
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$name' },
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
                        input: { $toLower: '$setName' },
                        regex: `^${query.toLowerCase()}`,
                      },
                    },
                    then: 60,
                    else: 0,
                  },
                },
                // Name contains
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$name' },
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
                        input: { $toLower: '$setName' },
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
   * Gets available set names (product groupings)
   * @returns {Promise<Array>} - Available set names
   */
  async getSetNames() {
    try {
      const setNames = await this.aggregate([
        {
          $group: {
            _id: '$setName',
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
            setName: '$_id',
            count: 1,
            totalAvailable: 1,
            averagePrice: { $round: ['$averagePrice', 2] },
            categoryCount: { $size: '$categories' },
            _id: 0,
          },
        },
      ]);

      return setNames;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets product statistics
   * @returns {Promise<Object>} - Product statistics
   */
  async getProductStatistics() {
    try {
      const stats = await this.aggregate([
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            totalAvailable: { $sum: '$available' },
            averagePrice: { $avg: { $toDouble: '$price' } },
            minPrice: { $min: { $toDouble: '$price' } },
            maxPrice: { $max: { $toDouble: '$price' } },
            uniqueCategories: { $addToSet: '$category' },
            uniqueSetNames: { $addToSet: '$setName' },
            availableProducts: {
              $sum: { $cond: [{ $gt: ['$available', 0] }, 1, 0] },
            },
            recentlyUpdated: {
              $sum: {
                $cond: [
                  {
                    $gt: [
                      '$lastUpdated',
                      {
                        $dateSubtract: {
                          startDate: '$$NOW',
                          unit: 'day',
                          amount: 7,
                        },
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $addFields: {
            uniqueCategoryCount: { $size: '$uniqueCategories' },
            uniqueSetNameCount: { $size: '$uniqueSetNames' },
            availabilityPercentage: {
              $cond: {
                if: { $gt: ['$totalProducts', 0] },
                then: {
                  $multiply: [{ $divide: ['$availableProducts', '$totalProducts'] }, 100],
                },
                else: 0,
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            totalProducts: 1,
            totalAvailable: 1,
            averagePrice: { $round: ['$averagePrice', 2] },
            minPrice: { $round: ['$minPrice', 2] },
            maxPrice: { $round: ['$maxPrice', 2] },
            uniqueCategoryCount: 1,
            uniqueSetNameCount: 1,
            availableProducts: 1,
            availabilityPercentage: { $round: ['$availabilityPercentage', 2] },
            recentlyUpdated: 1,
          },
        },
      ]);

      return stats[0] || {};
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets profit analysis data
   * @returns {Promise<Array>} - Profit analysis results
   */
  async getProfitAnalysis() {
    try {
      const analysis = await this.aggregate([
        {
          $addFields: {
            priceNumeric: { $toDouble: '$price' },
          },
        },
        {
          $group: {
            _id: '$category',
            productCount: { $sum: 1 },
            totalAvailable: { $sum: '$available' },
            averagePrice: { $avg: '$priceNumeric' },
            minPrice: { $min: '$priceNumeric' },
            maxPrice: { $max: '$priceNumeric' },
            priceRange: {
              $subtract: [{ $max: '$priceNumeric' }, { $min: '$priceNumeric' }],
            },
            availableProducts: {
              $sum: { $cond: [{ $gt: ['$available', 0] }, 1, 0] },
            },
          },
        },
        {
          $addFields: {
            availabilityRate: {
              $cond: {
                if: { $gt: ['$productCount', 0] },
                then: { $divide: ['$availableProducts', '$productCount'] },
                else: 0,
              },
            },
            priceVolatility: {
              $cond: {
                if: { $gt: ['$averagePrice', 0] },
                then: { $divide: ['$priceRange', '$averagePrice'] },
                else: 0,
              },
            },
          },
        },
        {
          $sort: { averagePrice: -1 },
        },
        {
          $project: {
            category: '$_id',
            productCount: 1,
            totalAvailable: 1,
            averagePrice: { $round: ['$averagePrice', 2] },
            minPrice: { $round: ['$minPrice', 2] },
            maxPrice: { $round: ['$maxPrice', 2] },
            priceRange: { $round: ['$priceRange', 2] },
            availabilityRate: { $round: ['$availabilityRate', 4] },
            priceVolatility: { $round: ['$priceVolatility', 4] },
            _id: 0,
          },
        },
      ]);

      return analysis;
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
        text: product.name,
        secondaryText: product.setName,
        metadata: {
          category: product.category,
          price: product.price,
          priceNumeric: product.priceNumeric,
          available: product.available,
          setName: product.setName,
          isAvailable: product.available > 0,
        },
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets recently updated products
   * @param {number} days - Number of days to look back
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Recently updated products
   */
  async getRecentlyUpdated(days = 7, options = {}) {
    try {
      const dateThreshold = new Date();

      dateThreshold.setDate(dateThreshold.getDate() - days);

      return await this.findAll(
        {
          lastUpdated: { $gte: dateThreshold },
        },
        {
          ...options,
          sort: { lastUpdated: -1 },
        },
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets low stock products
   * @param {number} threshold - Low stock threshold
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Low stock products
   */
  async getLowStockProducts(threshold = 5, options = {}) {
    try {
      return await this.findAll(
        {
          available: { $gt: 0, $lte: threshold },
        },
        {
          ...options,
          sort: { available: 1, price: 1 },
        },
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets products by price tier
   * @param {string} tier - Price tier ('low', 'medium', 'high', 'premium')
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Products in price tier
   */
  async getProductsByPriceTier(tier, options = {}) {
    try {
      let priceRange;

      switch (tier.toLowerCase()) {
        case 'low':
          priceRange = { min: 0, max: 50 };
          break;
        case 'medium':
          priceRange = { min: 50, max: 200 };
          break;
        case 'high':
          priceRange = { min: 200, max: 500 };
          break;
        case 'premium':
          priceRange = { min: 500, max: Number.MAX_SAFE_INTEGER };
          break;
        default:
          throw new ValidationError(`Unknown price tier: ${tier}`);
      }

      return await this.findByPriceRange(priceRange.min, priceRange.max, options);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CardMarketReferenceProductRepository;
