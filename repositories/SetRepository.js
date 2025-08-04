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

      // Grade population filter
      if (filters.minGradedPopulation) {
        matchConditions.push({
          'total_grades.total_graded': { $gte: filters.minGradedPopulation }
        });
      }

      // Grade population range filter
      if (filters.gradedPopulationRange) {
        matchConditions.push({
          'total_grades.total_graded': {
            $gte: filters.gradedPopulationRange.min,
            $lte: filters.gradedPopulationRange.max,
          }
        });
      }

      // Grade-specific filters for new structure
      if (filters.minGrade10Count) {
        matchConditions.push({
          'total_grades.grade_10': { $gte: filters.minGrade10Count }
        });
      }

      // Unique set ID filter
      if (filters.uniqueSetId) {
        matchConditions.push({
          unique_set_id: filters.uniqueSetId
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
                    if: { $gt: ['$total_grades.total_graded', 0] },
                    then: { $divide: ['$total_grades.total_graded', 10000] },
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
        ? { $sort: { score: -1, 'total_grades.total_graded': -1, year: -1 } }
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
          totalGraded: set.total_grades?.total_graded,
          uniqueSetId: set.unique_set_id,
          setUrl: set.setUrl,
          era: set.year || 'Unknown',
          // Include grade breakdown if available
          ...(set.total_grades && {
            grades: {
              grade_10: set.total_grades.grade_10,
              grade_9: set.total_grades.grade_9,
              grade_8: set.total_grades.grade_8,
              total_graded: set.total_grades.total_graded
            }
          })
        },
      }));
    } catch (error) {
      throw error;
    }
  }


}

module.exports = SetRepository;
