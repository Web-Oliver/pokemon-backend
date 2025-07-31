const BaseRepository = require('./base/BaseRepository');
const Card = require('../models/Card');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Card Repository
 *
 * Specialized repository for Card model operations.
 * Extends BaseRepository with card-specific search and query methods.
 *
 * IMPORTANT: This handles the Card model (official Pokemon cards) which
 * references the Set model. This is different from CardMarketReferenceProduct.
 */
class CardRepository extends BaseRepository {
  /**
   * Creates a new card repository instance
   */
  constructor() {
    super(Card, {
      entityName: 'Card',
      defaultPopulate: {
        path: 'setId',
        model: 'Set',
      },
      defaultSort: { psaTotalGradedForCard: -1, cardName: 1 },
    });
  }


  /**
   * Finds cards by set ID
   * @param {string} setId - Set ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Cards in the set
   */
  async findBySetId(setId, options = {}) {
    try {
      return await this.findAll({ setId }, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds cards by set name
   * @param {string} setName - Set name
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Cards in the set
   */
  async findBySetName(setName, options = {}) {
    try {
      const pipeline = [
        {
          $lookup: {
            from: 'sets',
            localField: 'setId',
            foreignField: '_id',
            as: 'setInfo',
          },
        },
        {
          $unwind: {
            path: '$setInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $match: {
            'setInfo.setName': new RegExp(setName, 'i'),
          },
        },
        {
          $sort: options.sort || this.options.defaultSort,
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
   * Finds cards by Pokemon number
   * @param {string} pokemonNumber - Pokemon number
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Cards with the Pokemon number
   */
  async findByPokemonNumber(pokemonNumber, options = {}) {
    try {
      return await this.findAll({ pokemonNumber }, options);
    } catch (error) {
      throw error;
    }
  }






  /**
   * Searches cards with advanced filtering
   * @param {string} query - Search query
   * @param {Object} filters - Advanced filters
   * @returns {Promise<Array>} - Search results
   */
  async searchAdvanced(query, filters = {}) {
    try {
      const pipeline = [
        {
          $lookup: {
            from: 'sets',
            localField: 'setId',
            foreignField: '_id',
            as: 'setInfo',
          },
        },
        {
          $unwind: {
            path: '$setInfo',
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      // Build match conditions
      const matchConditions = [];

      // Text search
      if (query) {
        matchConditions.push({
          $or: [
            { cardName: { $regex: query, $options: 'i' } },
            { baseName: { $regex: query, $options: 'i' } },
            { pokemonNumber: { $regex: query, $options: 'i' } },
            { variety: { $regex: query, $options: 'i' } },
          ],
        });
      }

      // Set filter
      if (filters.setId) {
        matchConditions.push({ setId: filters.setId });
      }

      // Set name filter
      if (filters.setName) {
        matchConditions.push({
          'setInfo.setName': new RegExp(filters.setName, 'i'),
        });
      }

      // Year filter
      if (filters.year) {
        matchConditions.push({ 'setInfo.year': filters.year });
      }

      // Pokemon number filter
      if (filters.pokemonNumber) {
        matchConditions.push({ pokemonNumber: filters.pokemonNumber });
      }

      // Variety filter
      if (filters.variety) {
        matchConditions.push({ variety: new RegExp(filters.variety, 'i') });
      }

      // PSA population filter
      if (filters.minPsaPopulation) {
        matchConditions.push({
          psaTotalGradedForCard: { $gte: filters.minPsaPopulation },
        });
      }

      // PSA grade filter
      if (filters.psaGrade) {
        const gradeField = `psaGrades.psa_${filters.psaGrade}`;

        matchConditions.push({
          [gradeField]: { $gte: filters.minGradeCount || 1 },
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
                {
                  $cond: {
                    if: {
                      $eq: [{ $toLower: '$cardName' }, query.toLowerCase()],
                    },
                    then: 100,
                    else: 0,
                  },
                },
                {
                  $cond: {
                    if: {
                      $eq: [{ $toLower: '$baseName' }, query.toLowerCase()],
                    },
                    then: 90,
                    else: 0,
                  },
                },
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$cardName' },
                        regex: `^${query.toLowerCase()}`,
                      },
                    },
                    then: 80,
                    else: 0,
                  },
                },
                {
                  $cond: {
                    if: {
                      $regexMatch: {
                        input: { $toLower: '$baseName' },
                        regex: `^${query.toLowerCase()}`,
                      },
                    },
                    then: 70,
                    else: 0,
                  },
                },
                {
                  $cond: {
                    if: { $gt: ['$psaTotalGradedForCard', 0] },
                    then: { $divide: ['$psaTotalGradedForCard', 1000] },
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
        ? { $sort: { score: -1, psaTotalGradedForCard: -1, cardName: 1 } }
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
   * Gets card suggestions for autocomplete
   * @param {string} query - Search query
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Card suggestions
   */
  async getSuggestions(query, options = {}) {
    try {
      const results = await this.searchAdvanced(query, {
        limit: options.limit || 10,
      });

      return results.map((card) => ({
        id: card._id,
        text: card.cardName,
        secondaryText: card.baseName !== card.cardName ? card.baseName : null,
        metadata: {
          pokemonNumber: card.pokemonNumber,
          variety: card.variety,
          setName: card.setInfo?.setName,
          year: card.setInfo?.year,
          totalGraded: card.psaTotalGradedForCard,
        },
      }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CardRepository;
