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
      defaultSort: { year: -1, setName: 1 },
    });
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
          setName: { $regex: query, $options: 'i' },
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
            $lte: filters.yearRange.end,
          },
        });
      }

      // PSA population filter
      if (filters.minPsaPopulation) {
        matchConditions.push({
          totalPsaPopulation: { $gte: filters.minPsaPopulation },
        });
      }

      // PSA population range filter
      if (filters.psaPopulationRange) {
        matchConditions.push({
          totalPsaPopulation: {
            $gte: filters.psaPopulationRange.min,
            $lte: filters.psaPopulationRange.max,
          },
        });
      }

      // Card count filter
      if (filters.minCardCount) {
        matchConditions.push({
          totalCardsInSet: { $gte: filters.minCardCount },
        });
      }

      // Card count range filter
      if (filters.cardCountRange) {
        matchConditions.push({
          totalCardsInSet: {
            $gte: filters.cardCountRange.min,
            $lte: filters.cardCountRange.max,
          },
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
                // Exact match
                {
                  $cond: {
                    if: {
                      $eq: [{ $toLower: '$setName' }, query.toLowerCase()],
                    },
                    then: 100,
                    else: 0,
                  },
                },
                // Starts with
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$setName' },
                        regex: `^${query.toLowerCase()}`,
                      },
                    },
                    then: 80,
                    else: 0,
                  },
                },
                // Contains
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$setName' },
                        regex: query.toLowerCase(),
                      },
                    },
                    then: 60,
                    else: 0,
                  },
                },
                // Word boundary
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$setName' },
                        regex: `\\b${query.toLowerCase()}\\b`,
                      },
                    },
                    then: 40,
                    else: 0,
                  },
                },
                // Popularity score
                {
                  $cond: {
                    if: { $gt: ['$totalPsaPopulation', 0] },
                    then: { $divide: ['$totalPsaPopulation', 10000] },
                    else: 0,
                  },
                },
                // Length penalty
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$setName' },
                        regex: query.toLowerCase(),
                      },
                    },
                    then: { $divide: [50, { $strLenCP: '$setName' }] },
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
        ? { $sort: { score: -1, totalPsaPopulation: -1, year: -1 } }
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
   * Gets set suggestions for autocomplete
   * @param {string} query - Search query
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Set suggestions
   */
  async getSuggestions(query, options = {}) {
    try {
      const results = await this.searchAdvanced(query, {
        limit: options.limit || 10,
      });

      return results.map((set) => ({
        id: set._id,
        text: set.setName,
        secondaryText: set.year ? `${set.year}` : null,
        metadata: {
          year: set.year,
          totalCards: set.totalCardsInSet,
          totalPsaPopulation: set.totalPsaPopulation,
          setUrl: set.setUrl,
          era: set.year || 'Unknown',
        },
      }));
    } catch (error) {
      throw error;
    }
  }


}

module.exports = SetRepository;
