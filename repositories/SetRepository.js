const BaseRepository = require('./base/BaseRepository');
const Set = require('../models/Set');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Set Repository
 * 
 * Specialized repository for Set model operations.
 * Extends BaseRepository with set-specific search and query methods.
 * 
 * IMPORTANT: This handles the Set model (official Pokemon card sets)
 * which is different from CardMarketReferenceProduct.setName field.
 */
class SetRepository extends BaseRepository {
  /**
   * Creates a new set repository instance
   */
  constructor() {
    super(Set, {
      entityName: 'Set',
      defaultSort: { year: -1, setName: 1 }
    });
  }

  /**
   * Finds sets by year
   * @param {number} year - Year to search
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Sets from the year
   */
  async findByYear(year, options = {}) {
    try {
      if (typeof year !== 'number' || year < 1996) {
        throw new ValidationError('Year must be a valid number starting from 1996');
      }

      return await this.findAll({ year }, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds sets by year range
   * @param {number} startYear - Start year
   * @param {number} endYear - End year
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Sets in the year range
   */
  async findByYearRange(startYear, endYear, options = {}) {
    try {
      if (typeof startYear !== 'number' || typeof endYear !== 'number') {
        throw new ValidationError('Start year and end year must be numbers');
      }

      if (startYear > endYear) {
        throw new ValidationError('Start year cannot be greater than end year');
      }

      return await this.findAll({
        year: { $gte: startYear, $lte: endYear }
      }, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds sets by set name (case-insensitive)
   * @param {string} setName - Set name to search
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Sets matching the name
   */
  async findBySetName(setName, options = {}) {
    try {
      return await this.findAll({
        setName: new RegExp(setName, 'i')
      }, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds sets by minimum PSA population
   * @param {number} minPopulation - Minimum PSA population
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Sets with minimum population
   */
  async findByMinPsaPopulation(minPopulation, options = {}) {
    try {
      if (typeof minPopulation !== 'number' || minPopulation < 0) {
        throw new ValidationError('Minimum PSA population must be a non-negative number');
      }

      return await this.findAll({
        totalPsaPopulation: { $gte: minPopulation }
      }, {
        ...options,
        sort: { totalPsaPopulation: -1, ...this.options.defaultSort }
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds sets by card count range
   * @param {number} minCards - Minimum card count
   * @param {number} maxCards - Maximum card count
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Sets in the card count range
   */
  async findByCardCountRange(minCards, maxCards, options = {}) {
    try {
      if (typeof minCards !== 'number' || typeof maxCards !== 'number') {
        throw new ValidationError('Min and max cards must be numbers');
      }

      if (minCards > maxCards) {
        throw new ValidationError('Minimum cards cannot be greater than maximum cards');
      }

      return await this.findAll({
        totalCardsInSet: { $gte: minCards, $lte: maxCards }
      }, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches sets with advanced filtering
   * @param {string} query - Search query
   * @param {Object} filters - Advanced filters
   * @returns {Promise<Array>} - Search results
   */
  async searchAdvanced(query, filters = {}) {
    try {
      const pipeline = [];
      const matchConditions = [];

      // Text search
      if (query) {
        matchConditions.push({
          setName: { $regex: query, $options: 'i' }
        });
      }

      // Year filter
      if (filters.year) {
        matchConditions.push({ year: filters.year });
      }

      // Year range filter
      if (filters.yearRange) {
        matchConditions.push({
          year: {
            $gte: filters.yearRange.start,
            $lte: filters.yearRange.end
          }
        });
      }

      // PSA population filter
      if (filters.minPsaPopulation) {
        matchConditions.push({
          totalPsaPopulation: { $gte: filters.minPsaPopulation }
        });
      }

      // PSA population range filter
      if (filters.psaPopulationRange) {
        matchConditions.push({
          totalPsaPopulation: {
            $gte: filters.psaPopulationRange.min,
            $lte: filters.psaPopulationRange.max
          }
        });
      }

      // Card count filter
      if (filters.minCardCount) {
        matchConditions.push({
          totalCardsInSet: { $gte: filters.minCardCount }
        });
      }

      // Card count range filter
      if (filters.cardCountRange) {
        matchConditions.push({
          totalCardsInSet: {
            $gte: filters.cardCountRange.min,
            $lte: filters.cardCountRange.max
          }
        });
      }

      // Add match stage
      if (matchConditions.length > 0) {
        pipeline.push({
          $match: matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]
        });
      }

      // Add scoring if query provided
      if (query) {
        pipeline.push({
          $addFields: {
            score: {
              $add: [
                // Exact match
                { $cond: { if: { $eq: [{ $toLower: '$setName' }, query.toLowerCase()] }, then: 100, else: 0 } },
                // Starts with
                { $cond: { if: { $regexMatch: { input: { $toLower: '$setName' }, regex: `^${query.toLowerCase()}` } }, then: 80, else: 0 } },
                // Contains
                { $cond: { if: { $regexMatch: { input: { $toLower: '$setName' }, regex: query.toLowerCase() } }, then: 60, else: 0 } },
                // Word boundary
                { $cond: { if: { $regexMatch: { input: { $toLower: '$setName' }, regex: `\\b${query.toLowerCase()}\\b` } }, then: 40, else: 0 } },
                // Popularity score
                { $cond: { if: { $gt: ['$totalPsaPopulation', 0] }, then: { $divide: ['$totalPsaPopulation', 10000] }, else: 0 } },
                // Length penalty
                { $cond: { if: { $regexMatch: { input: { $toLower: '$setName' }, regex: query.toLowerCase() } }, then: { $divide: [50, { $strLenCP: '$setName' }] }, else: 0 } }
              ]
            }
          }
        });
      }

      // Sort
      const sortStage = query ? 
        { $sort: { score: -1, totalPsaPopulation: -1, year: -1 } } :
        { $sort: filters.sort || this.options.defaultSort };
      
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
   * Gets sets with card statistics
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Sets with card statistics
   */
  async getSetsWithCardStats(options = {}) {
    try {
      const pipeline = [
        {
          $lookup: {
            from: 'cards',
            localField: '_id',
            foreignField: 'setId',
            as: 'cards'
          }
        },
        {
          $addFields: {
            actualCardCount: { $size: '$cards' },
            cardCountDifference: { $subtract: ['$totalCardsInSet', { $size: '$cards' }] },
            completionPercentage: {
              $cond: {
                if: { $gt: ['$totalCardsInSet', 0] },
                then: { $multiply: [{ $divide: [{ $size: '$cards' }, '$totalCardsInSet'] }, 100] },
                else: 0
              }
            }
          }
        },
        {
          $sort: options.sort || this.options.defaultSort
        }
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
   * Gets set statistics summary
   * @returns {Promise<Object>} - Set statistics
   */
  async getSetStatistics() {
    try {
      const stats = await this.aggregate([
        {
          $group: {
            _id: null,
            totalSets: { $sum: 1 },
            totalCards: { $sum: '$totalCardsInSet' },
            totalPsaPopulation: { $sum: '$totalPsaPopulation' },
            averageCardsPerSet: { $avg: '$totalCardsInSet' },
            averagePsaPopulation: { $avg: '$totalPsaPopulation' },
            minYear: { $min: '$year' },
            maxYear: { $max: '$year' },
            yearRange: { $push: '$year' }
          }
        },
        {
          $addFields: {
            uniqueYears: { $setUnion: ['$yearRange', []] },
            yearSpan: { $subtract: ['$maxYear', '$minYear'] }
          }
        },
        {
          $project: {
            _id: 0,
            totalSets: 1,
            totalCards: 1,
            totalPsaPopulation: 1,
            averageCardsPerSet: { $round: ['$averageCardsPerSet', 2] },
            averagePsaPopulation: { $round: ['$averagePsaPopulation', 2] },
            minYear: 1,
            maxYear: 1,
            yearSpan: 1,
            uniqueYearCount: { $size: '$uniqueYears' }
          }
        }
      ]);

      return stats[0] || {};
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets available years for filtering
   * @returns {Promise<Array>} - Available years
   */
  async getAvailableYears() {
    try {
      const years = await this.aggregate([
        {
          $group: {
            _id: '$year',
            setCount: { $sum: 1 },
            totalCards: { $sum: '$totalCardsInSet' },
            totalPsaPopulation: { $sum: '$totalPsaPopulation' }
          }
        },
        {
          $sort: { _id: -1 }
        },
        {
          $project: {
            year: '$_id',
            setCount: 1,
            totalCards: 1,
            totalPsaPopulation: 1,
            _id: 0
          }
        }
      ]);

      return years;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets sets by era classification
   * @param {string} era - Era classification
   * @returns {Promise<Array>} - Sets in the era
   */
  async getSetsByEra(era) {
    try {
      let yearRange;
      
      switch (era.toLowerCase()) {
        case 'wizards':
        case 'wizards era':
          yearRange = { start: 1996, end: 2000 };
          break;
        case 'e-card':
        case 'e-card era':
          yearRange = { start: 2001, end: 2003 };
          break;
        case 'ex':
        case 'ex era':
          yearRange = { start: 2004, end: 2006 };
          break;
        case 'diamond & pearl':
        case 'diamond & pearl era':
          yearRange = { start: 2007, end: 2010 };
          break;
        case 'black & white':
        case 'black & white era':
          yearRange = { start: 2011, end: 2013 };
          break;
        case 'xy':
        case 'xy era':
          yearRange = { start: 2014, end: 2016 };
          break;
        case 'sun & moon':
        case 'sun & moon era':
          yearRange = { start: 2017, end: 2019 };
          break;
        case 'sword & shield':
        case 'sword & shield era':
          yearRange = { start: 2020, end: 2022 };
          break;
        case 'scarlet & violet':
        case 'scarlet & violet era':
          yearRange = { start: 2023, end: new Date().getFullYear() };
          break;
        default:
          throw new ValidationError(`Unknown era: ${era}`);
      }

      return await this.findByYearRange(yearRange.start, yearRange.end);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets most popular sets by PSA population
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Most popular sets
   */
  async getMostPopularSets(options = {}) {
    try {
      const limit = options.limit || 20;
      const minPopulation = options.minPopulation || 1000;

      return await this.findAll(
        { totalPsaPopulation: { $gte: minPopulation } },
        {
          ...options,
          sort: { totalPsaPopulation: -1 },
          limit
        }
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets sets with highest card counts
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Sets with highest card counts
   */
  async getLargestSets(options = {}) {
    try {
      const limit = options.limit || 20;
      const minCards = options.minCards || 50;

      return await this.findAll(
        { totalCardsInSet: { $gte: minCards } },
        {
          ...options,
          sort: { totalCardsInSet: -1 },
          limit
        }
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets set suggestions for autocomplete
   * @param {string} query - Search query
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Set suggestions
   */
  async getSuggestions(query, options = {}) {
    try {
      const results = await this.searchAdvanced(query, {
        limit: options.limit || 10
      });

      return results.map(set => ({
        id: set._id,
        text: set.setName,
        secondaryText: set.year ? `${set.year}` : null,
        metadata: {
          year: set.year,
          totalCards: set.totalCardsInSet,
          totalPsaPopulation: set.totalPsaPopulation,
          setUrl: set.setUrl,
          era: this.classifyEra(set.year)
        }
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Classifies set era based on year
   * @param {number} year - Set year
   * @returns {string} - Era classification
   */
  classifyEra(year) {
    if (!year) return 'Unknown';
    
    if (year >= 1996 && year <= 2000) return 'Wizards Era';
    if (year >= 2001 && year <= 2003) return 'e-Card Era';
    if (year >= 2004 && year <= 2006) return 'Ex Era';
    if (year >= 2007 && year <= 2010) return 'Diamond & Pearl Era';
    if (year >= 2011 && year <= 2013) return 'Black & White Era';
    if (year >= 2014 && year <= 2016) return 'XY Era';
    if (year >= 2017 && year <= 2019) return 'Sun & Moon Era';
    if (year >= 2020 && year <= 2022) return 'Sword & Shield Era';
    if (year >= 2023) return 'Scarlet & Violet Era';
    
    return 'Unknown Era';
  }

  /**
   * Gets era statistics
   * @returns {Promise<Array>} - Era statistics
   */
  async getEraStatistics() {
    try {
      const stats = await this.aggregate([
        {
          $addFields: {
            era: {
              $switch: {
                branches: [
                  { case: { $and: [{ $gte: ['$year', 1996] }, { $lte: ['$year', 2000] }] }, then: 'Wizards Era' },
                  { case: { $and: [{ $gte: ['$year', 2001] }, { $lte: ['$year', 2003] }] }, then: 'e-Card Era' },
                  { case: { $and: [{ $gte: ['$year', 2004] }, { $lte: ['$year', 2006] }] }, then: 'Ex Era' },
                  { case: { $and: [{ $gte: ['$year', 2007] }, { $lte: ['$year', 2010] }] }, then: 'Diamond & Pearl Era' },
                  { case: { $and: [{ $gte: ['$year', 2011] }, { $lte: ['$year', 2013] }] }, then: 'Black & White Era' },
                  { case: { $and: [{ $gte: ['$year', 2014] }, { $lte: ['$year', 2016] }] }, then: 'XY Era' },
                  { case: { $and: [{ $gte: ['$year', 2017] }, { $lte: ['$year', 2019] }] }, then: 'Sun & Moon Era' },
                  { case: { $and: [{ $gte: ['$year', 2020] }, { $lte: ['$year', 2022] }] }, then: 'Sword & Shield Era' },
                  { case: { $gte: ['$year', 2023] }, then: 'Scarlet & Violet Era' }
                ],
                default: 'Unknown Era'
              }
            }
          }
        },
        {
          $group: {
            _id: '$era',
            setCount: { $sum: 1 },
            totalCards: { $sum: '$totalCardsInSet' },
            totalPsaPopulation: { $sum: '$totalPsaPopulation' },
            averageCardsPerSet: { $avg: '$totalCardsInSet' },
            averagePsaPopulation: { $avg: '$totalPsaPopulation' },
            minYear: { $min: '$year' },
            maxYear: { $max: '$year' }
          }
        },
        {
          $sort: { minYear: 1 }
        },
        {
          $project: {
            era: '$_id',
            setCount: 1,
            totalCards: 1,
            totalPsaPopulation: 1,
            averageCardsPerSet: { $round: ['$averageCardsPerSet', 2] },
            averagePsaPopulation: { $round: ['$averagePsaPopulation', 2] },
            yearRange: { $concat: [{ $toString: '$minYear' }, ' - ', { $toString: '$maxYear' }] },
            _id: 0
          }
        }
      ]);

      return stats;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = SetRepository;