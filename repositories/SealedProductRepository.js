const BaseRepository = require('./base/BaseRepository');
const SealedProduct = require('../models/SealedProduct');

/**
 * Sealed Product Repository
 *
 * Handles data access operations specific to sealed products.
 * Extends BaseRepository to provide common CRUD operations
 * plus sealed product-specific query methods.
 */
class SealedProductRepository extends BaseRepository {
  constructor() {
    super(SealedProduct, {
      entityName: 'SealedProduct',
      defaultPopulate: {
        path: 'productId',
      },
      defaultSort: { dateAdded: -1 },
    });
  }

  /**
   * Finds sealed products by category
   * @param {string} category - Product category (e.g., 'Booster-Boxes', 'Elite-Trainer-Boxes')
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products
   */
  async findByCategory(category, options = {}) {
    return await this.findAll({ category }, options);
  }

  /**
   * Finds sealed products by multiple categories
   * @param {Array} categories - Array of categories
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products
   */
  async findByCategories(categories, options = {}) {
    return await this.findAll({
      category: { $in: categories },
    }, options);
  }

  /**
   * Finds sealed products by set name
   * @param {string} setName - Set name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products
   */
  async findBySetName(setName, options = {}) {
    return await this.findAll({ setName }, options);
  }

  /**
   * Finds sealed products by product reference
   * @param {string} productId - Product reference ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products
   */
  async findByProductId(productId, options = {}) {
    return await this.findAll({ productId }, options);
  }

  /**
   * Finds sold sealed products
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sold sealed products
   */
  async findSold(options = {}) {
    return await this.findAll({ sold: true }, options);
  }

  /**
   * Finds unsold sealed products
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of unsold sealed products
   */
  async findUnsold(options = {}) {
    return await this.findAll({ sold: false }, options);
  }

  /**
   * Finds sealed products by price range
   * @param {number} minPrice - Minimum price
   * @param {number} maxPrice - Maximum price
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products
   */
  async findByPriceRange(minPrice, maxPrice, options = {}) {
    return await this.findAll({
      myPrice: { $gte: minPrice, $lte: maxPrice },
    }, options);
  }

  /**
   * Finds sealed products by availability
   * @param {number} minAvailability - Minimum availability
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products
   */
  async findByAvailability(minAvailability, options = {}) {
    return await this.findAll({
      availability: { $gte: minAvailability },
    }, options);
  }

  /**
   * Gets sealed product statistics
   * @returns {Promise<Object>} - Statistics object
   */
  async getStatistics() {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          totalValue: { $sum: { $toDouble: '$myPrice' } },
          soldProducts: { $sum: { $cond: [{ $eq: ['$sold', true] }, 1, 0] } },
          soldValue: { $sum: { $cond: [{ $eq: ['$sold', true] }, { $toDouble: '$myPrice' }, 0] } },
          avgPrice: { $avg: { $toDouble: '$myPrice' } },
          categoryDistribution: {
            $push: '$category',
          },
          setDistribution: {
            $push: '$setName',
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalProducts: 1,
          totalValue: { $round: ['$totalValue', 2] },
          soldProducts: 1,
          soldValue: { $round: ['$soldValue', 2] },
          avgPrice: { $round: ['$avgPrice', 2] },
          unsoldProducts: { $subtract: ['$totalProducts', '$soldProducts'] },
          categoryDistribution: 1,
          setDistribution: 1,
        },
      },
    ];

    const result = await this.aggregate(pipeline);

    return result[0] || {
      totalProducts: 0,
      totalValue: 0,
      soldProducts: 0,
      soldValue: 0,
      avgPrice: 0,
      unsoldProducts: 0,
      categoryDistribution: [],
      setDistribution: [],
    };
  }

  /**
   * Finds sealed products by category distribution
   * @returns {Promise<Array>} - Category distribution data
   */
  async getCategoryDistribution() {
    const pipeline = [
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalValue: { $sum: { $toDouble: '$myPrice' } },
          avgPrice: { $avg: { $toDouble: '$myPrice' } },
          soldCount: { $sum: { $cond: [{ $eq: ['$sold', true] }, 1, 0] } },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          totalValue: { $round: ['$totalValue', 2] },
          avgPrice: { $round: ['$avgPrice', 2] },
          soldCount: 1,
          unsoldCount: { $subtract: ['$count', '$soldCount'] },
          _id: 0,
        },
      },
    ];

    return await this.aggregate(pipeline);
  }

  /**
   * Finds sealed products by set distribution
   * @returns {Promise<Array>} - Set distribution data
   */
  async getSetDistribution() {
    const pipeline = [
      {
        $group: {
          _id: '$setName',
          count: { $sum: 1 },
          totalValue: { $sum: { $toDouble: '$myPrice' } },
          avgPrice: { $avg: { $toDouble: '$myPrice' } },
          soldCount: { $sum: { $cond: [{ $eq: ['$sold', true] }, 1, 0] } },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $project: {
          setName: '$_id',
          count: 1,
          totalValue: { $round: ['$totalValue', 2] },
          avgPrice: { $round: ['$avgPrice', 2] },
          soldCount: 1,
          unsoldCount: { $subtract: ['$count', '$soldCount'] },
          _id: 0,
        },
      },
    ];

    return await this.aggregate(pipeline);
  }

  /**
   * Finds sealed products with recent price changes
   * @param {number} days - Number of days to look back
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products with recent price changes
   */
  async findWithRecentPriceChanges(days = 30, options = {}) {
    const cutoffDate = new Date();

    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.findAll({
      'priceHistory.dateUpdated': { $gte: cutoffDate },
    }, options);
  }

  /**
   * Searches sealed products by name or set name
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of matching sealed products
   */
  async search(searchTerm, options = {}) {
    return await this.findAll({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { setName: { $regex: searchTerm, $options: 'i' } },
        { category: { $regex: searchTerm, $options: 'i' } },
      ],
    }, options);
  }

  /**
   * Finds sealed products with low availability
   * @param {number} threshold - Availability threshold (default: 10)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products with low availability
   */
  async findLowAvailability(threshold = 10, options = {}) {
    return await this.findAll({
      availability: { $lte: threshold },
      sold: false,
    }, options);
  }

  /**
   * Finds sealed products with high profit potential
   * @param {number} profitMargin - Minimum profit margin percentage (default: 20)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sealed products with high profit potential
   */
  async findHighProfitPotential(profitMargin = 20, options = {}) {
    const pipeline = [
      {
        $match: {
          sold: false,
          cardMarketPrice: { $exists: true, $ne: null },
          myPrice: { $exists: true, $ne: null },
        },
      },
      {
        $addFields: {
          profitPercentage: {
            $multiply: [
              {
                $divide: [
                  { $subtract: [{ $toDouble: '$myPrice' }, { $toDouble: '$cardMarketPrice' }] },
                  { $toDouble: '$cardMarketPrice' },
                ],
              },
              100,
            ],
          },
        },
      },
      {
        $match: {
          profitPercentage: { $gte: profitMargin },
        },
      },
      {
        $sort: { profitPercentage: -1 },
      },
    ];

    return await this.aggregate(pipeline);
  }

  /**
   * Gets profit analysis for sealed products
   * @returns {Promise<Array>} - Profit analysis data
   */
  async getProfitAnalysis() {
    const pipeline = [
      {
        $match: {
          cardMarketPrice: { $exists: true, $ne: null },
          myPrice: { $exists: true, $ne: null },
        },
      },
      {
        $addFields: {
          profitAmount: {
            $subtract: [{ $toDouble: '$myPrice' }, { $toDouble: '$cardMarketPrice' }],
          },
          profitPercentage: {
            $multiply: [
              {
                $divide: [
                  { $subtract: [{ $toDouble: '$myPrice' }, { $toDouble: '$cardMarketPrice' }] },
                  { $toDouble: '$cardMarketPrice' },
                ],
              },
              100,
            ],
          },
        },
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgProfitAmount: { $avg: '$profitAmount' },
          avgProfitPercentage: { $avg: '$profitPercentage' },
          totalProfitAmount: { $sum: '$profitAmount' },
          maxProfitAmount: { $max: '$profitAmount' },
          minProfitAmount: { $min: '$profitAmount' },
        },
      },
      {
        $sort: { avgProfitPercentage: -1 },
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          avgProfitAmount: { $round: ['$avgProfitAmount', 2] },
          avgProfitPercentage: { $round: ['$avgProfitPercentage', 2] },
          totalProfitAmount: { $round: ['$totalProfitAmount', 2] },
          maxProfitAmount: { $round: ['$maxProfitAmount', 2] },
          minProfitAmount: { $round: ['$minProfitAmount', 2] },
          _id: 0,
        },
      },
    ];

    return await this.aggregate(pipeline);
  }
}

module.exports = SealedProductRepository;
