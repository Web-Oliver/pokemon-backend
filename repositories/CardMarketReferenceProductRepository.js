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
}

module.exports = CardMarketReferenceProductRepository;