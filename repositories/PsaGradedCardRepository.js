const BaseRepository = require('./base/BaseRepository');
const PsaGradedCard = require('../models/PsaGradedCard');

/**
 * PSA Graded Card Repository
 * 
 * Handles data access operations specific to PSA graded cards.
 * Extends BaseRepository to provide common CRUD operations
 * plus PSA-specific query methods.
 */
class PsaGradedCardRepository extends BaseRepository {
  constructor() {
    super(PsaGradedCard, {
      entityName: 'PsaGradedCard',
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
   * Finds PSA graded cards by grade
   * @param {string} grade - PSA grade (1-10)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of PSA graded cards
   */
  async findByGrade(grade, options = {}) {
    return await this.findAll({ grade }, options);
  }

  /**
   * Finds PSA graded cards by grade range
   * @param {string} minGrade - Minimum PSA grade
   * @param {string} maxGrade - Maximum PSA grade
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of PSA graded cards
   */
  async findByGradeRange(minGrade, maxGrade, options = {}) {
    return await this.findAll({
      grade: { $gte: minGrade, $lte: maxGrade }
    }, options);
  }

  /**
   * Finds PSA graded cards by card reference
   * @param {string} cardId - Card reference ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of PSA graded cards
   */
  async findByCardId(cardId, options = {}) {
    return await this.findAll({ cardId }, options);
  }

  /**
   * Finds sold PSA graded cards
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sold PSA graded cards
   */
  async findSold(options = {}) {
    return await this.findAll({ sold: true }, options);
  }

  /**
   * Finds unsold PSA graded cards
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of unsold PSA graded cards
   */
  async findUnsold(options = {}) {
    return await this.findAll({ sold: false }, options);
  }

  /**
   * Finds PSA graded cards by price range
   * @param {number} minPrice - Minimum price
   * @param {number} maxPrice - Maximum price
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of PSA graded cards
   */
  async findByPriceRange(minPrice, maxPrice, options = {}) {
    return await this.findAll({
      myPrice: { $gte: minPrice, $lte: maxPrice }
    }, options);
  }

  /**
   * Gets PSA graded card statistics
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
          gradeDistribution: {
            $push: '$grade'
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
          gradeDistribution: 1
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
      gradeDistribution: []
    };
  }

  /**
   * Finds PSA graded cards by grade distribution
   * @returns {Promise<Array>} - Grade distribution data
   */
  async getGradeDistribution() {
    const pipeline = [
      {
        $group: {
          _id: '$grade',
          count: { $sum: 1 },
          totalValue: { $sum: { $toDouble: '$myPrice' } },
          avgPrice: { $avg: { $toDouble: '$myPrice' } }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          grade: '$_id',
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
   * Finds PSA graded cards with recent price changes
   * @param {number} days - Number of days to look back
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of PSA graded cards with recent price changes
   */
  async findWithRecentPriceChanges(days = 30, options = {}) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.findAll({
      'priceHistory.dateUpdated': { $gte: cutoffDate }
    }, options);
  }

  /**
   * Searches PSA graded cards by card name or Pokemon name
   * @param {string} searchTerm - Search term
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of matching PSA graded cards
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
            { 'set.setName': { $regex: searchTerm, $options: 'i' } }
          ]
        }
      },
      {
        $sort: { dateAdded: -1 }
      }
    ];

    return await this.aggregate(pipeline);
  }
}

module.exports = PsaGradedCardRepository;