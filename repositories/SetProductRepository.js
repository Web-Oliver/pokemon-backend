const BaseRepository = require('./base/BaseRepository');
const SetProduct = require('../models/SetProduct');

/**
 * SetProduct Repository
 *
 * Specialized repository for SetProduct model operations.
 * Handles product expansion/set data (like "Prismatic Evolutions").
 */
class SetProductRepository extends BaseRepository {
  /**
   * Creates a new SetProduct repository instance
   */
  constructor() {
    super(SetProduct, {
      entityName: 'SetProduct',
      defaultSort: { setProductName: 1 },
    });
  }

  /**
   * Finds set by product name
   * @param {string} setProductName - Set product name to search
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} - Set product or null
   */
  async findBySetProductName(setProductName, options = {}) {
    try {
      return await this.findOne(
        {
          setProductName: new RegExp(`^${setProductName}$`, 'i'),
        },
        options,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Finds set by unique set product ID
   * @param {number} uniqueSetProductId - Unique set product ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} - Set product or null
   */
  async findByUniqueSetProductId(uniqueSetProductId, options = {}) {
    try {
      return await this.findOne(
        {
          uniqueSetProductId,
        },
        options,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches set products
   * @param {string} query - Search query
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Search results
   */
  async search(query, options = {}) {
    try {
      return await this.findAll(
        {
          setProductName: { $regex: query, $options: 'i' },
        },
        options,
      );
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets set product suggestions for autocomplete
   * @param {string} query - Search query
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Set suggestions
   */
  async getSuggestions(query, options = {}) {
    try {
      const results = await this.search(query, {
        limit: options.limit || 10,
        sort: { setProductName: 1 },
      });

      return results.map((setProduct) => ({
        id: setProduct._id,
        text: setProduct.setProductName,
        metadata: {
          uniqueSetProductId: setProduct.uniqueSetProductId,
          setProductName: setProduct.setProductName,
        },
      }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = SetProductRepository;