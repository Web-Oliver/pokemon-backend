const BaseRepository = require('./base/BaseRepository');
const RawCard = require('../models/RawCard');

/**
 * Raw Card Repository
 * 
 * Handles data access operations specific to raw cards.
 * Extends BaseRepository to provide common CRUD operations
 * plus raw card-specific query methods.
 */
class RawCardRepository extends BaseRepository {
  constructor() {
    super(RawCard, {
      entityName: 'RawCard',
      defaultPopulate: {
        path: 'cardId',
        populate: {
          path: 'setId',
          model: 'Set'
        }
      },
      defaultSort: { dateAdded: -1 }
    });
  }

  /**
   * Finds raw cards by condition
   * @param {string} condition - Card condition (e.g., 'Near Mint', 'Lightly Played')
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of raw cards
   */
  async findByCondition(condition, options = {}) {
    return await this.findAll({ condition }, options);
  }

  /**
   * Finds raw cards by multiple conditions
   * @param {Array} conditions - Array of conditions
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of raw cards
   */
  async findByConditions(conditions, options = {}) {
    return await this.findAll({
      condition: { $in: conditions }
    }, options);
  }

  /**
   * Finds raw cards by card reference
   * @param {string} cardId - Card reference ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of raw cards
   */
  async findByCardId(cardId, options = {}) {
    return await this.findAll({ cardId }, options);
  }

  /**
   * Finds sold raw cards
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sold raw cards
   */
  async findSold(options = {}) {
    return await this.findAll({ sold: true }, options);
  }

  /**
   * Finds unsold raw cards
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of unsold raw cards
   */
  async findUnsold(options = {}) {
    return await this.findAll({ sold: false }, options);
  }

  /**
   * Finds raw cards by price range
   * @param {number} minPrice - Minimum price
   * @param {number} maxPrice - Maximum price
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of raw cards
   */
  async findByPriceRange(minPrice, maxPrice, options = {}) {
    return await this.findAll({
      myPrice: { $gte: minPrice, $lte: maxPrice }
    }, options);
  }

  /**
   * Gets raw card statistics
   * @returns {Promise<Object>} - Statistics object
   */
  async getStatistics() {
    const pipeline = [
      {
        $group: {
          _id: null,
          totalCards: { $sum: 1 },
          totalValue: { $sum: { $toDouble: '$myPrice' } },
          soldCards: { $sum: { $cond: [{ $eq: ['$sold', true] }, 1, 0] } },
          soldValue: { $sum: { $cond: [{ $eq: ['$sold', true] }, { $toDouble: '$myPrice' }, 0] } },
          avgPrice: { $avg: { $toDouble: '$myPrice' } },
          conditionDistribution: {
            $push: '$condition'
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalCards: 1,
          totalValue: { $round: ['$totalValue', 2] },
          soldCards: 1,
          soldValue: { $round: ['$soldValue', 2] },
          avgPrice: { $round: ['$avgPrice', 2] },
          unsoldCards: { $subtract: ['$totalCards', '$soldCards'] },
          conditionDistribution: 1
        }
      }
    ];

    const result = await this.aggregate(pipeline);
    return result[0] || {
      totalCards: 0,
      totalValue: 0,
      soldCards: 0,
      soldValue: 0,
      avgPrice: 0,
      unsoldCards: 0,
      conditionDistribution: []
    };
  }

  /**
   * Finds raw cards by condition distribution
   * @returns {Promise<Array>} - Condition distribution data
   */
  async getConditionDistribution() {
    const pipeline = [
      {
        $group: {
          _id: '$condition',
          count: { $sum: 1 },
          totalValue: { $sum: { $toDouble: '$myPrice' } },
          avgPrice: { $avg: { $toDouble: '$myPrice' } }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          condition: '$_id',
          count: 1,
          totalValue: { $round: ['$totalValue', 2] },
          avgPrice: { $round: ['$avgPrice', 2] },
          _id: 0
        }
      }
    ];

    return await this.aggregate(pipeline);
  }

  /**
   * Finds raw cards with recent price changes
   * @param {number} days - Number of days to look back
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of raw cards with recent price changes
   */
  async findWithRecentPriceChanges(days = 30, options = {}) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.findAll({
      'priceHistory.dateUpdated': { $gte: cutoffDate }
    }, options);
  }

  /**
   * Searches raw cards by card name or Pokemon name
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of matching raw cards
   */
  async search(searchTerm, options = {}) {
    const populate = options.populate || this.options.defaultPopulate;
    
    const pipeline = [
      {
        $lookup: {
          from: 'cards',
          localField: 'cardId',
          foreignField: '_id',
          as: 'card'
        }
      },
      {
        $unwind: '$card'
      },
      {
        $lookup: {
          from: 'sets',
          localField: 'card.setId',
          foreignField: '_id',
          as: 'set'
        }
      },
      {
        $unwind: '$set'
      },
      {
        $match: {
          $or: [
            { 'card.cardName': { $regex: searchTerm, $options: 'i' } },
            { 'card.baseName': { $regex: searchTerm, $options: 'i' } },
            { 'set.setName': { $regex: searchTerm, $options: 'i' } },
            { condition: { $regex: searchTerm, $options: 'i' } }
          ]
        }
      },
      {
        $sort: { dateAdded: -1 }
      }
    ];

    return await this.aggregate(pipeline);
  }

  /**
   * Finds raw cards by set
   * @param {string} setId - Set ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of raw cards from the set
   */
  async findBySet(setId, options = {}) {
    const pipeline = [
      {
        $lookup: {
          from: 'cards',
          localField: 'cardId',
          foreignField: '_id',
          as: 'card'
        }
      },
      {
        $unwind: '$card'
      },
      {
        $match: {
          'card.setId': setId
        }
      },
      {
        $sort: { dateAdded: -1 }
      }
    ];

    return await this.aggregate(pipeline);
  }

  /**
   * Gets cards needing condition assessment (no condition specified)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of raw cards needing condition assessment
   */
  async findNeedingConditionAssessment(options = {}) {
    return await this.findAll({
      $or: [
        { condition: { $exists: false } },
        { condition: null },
        { condition: '' }
      ]
    }, options);
  }
}

module.exports = RawCardRepository;