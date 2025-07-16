const mongoose = require('mongoose');
const { ValidationError, NotFoundError } = require('../../utils/errorHandler');

/**
 * Sale Service
 *
 * Centralizes sale processing logic to eliminate duplication across controllers.
 * Handles marking items as sold with consistent validation and data structure.
 */
class SaleService {
  /**
   * Marks an item as sold with sale details
   *
   * @param {Object} model - Mongoose model (PsaGradedCard, RawCard, SealedProduct)
   * @param {string} itemId - Item ID to mark as sold
   * @param {Object} saleDetails - Sale details object
   * @param {Object} populateOptions - Population options for the response
   * @returns {Promise<Object>} - Updated item with populated data
   */
  static async markAsSold(model, itemId, saleDetails, populateOptions = null) {
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      throw new ValidationError('Invalid ObjectId format');
    }

    // Extract sale details
    const {
      paymentMethod,
      actualSoldPrice,
      deliveryMethod,
      source,
      buyerFullName,
      buyerAddress,
      buyerPhoneNumber,
      buyerEmail,
      trackingNumber,
    } = saleDetails;

    // Find the item
    const item = await model.findById(itemId);

    if (!item) {
      throw new NotFoundError(`${model.modelName} not found`);
    }

    // Update sale status and details
    item.sold = true;
    item.saleDetails = {
      paymentMethod,
      actualSoldPrice,
      deliveryMethod,
      source,
      dateSold: new Date(),
      buyerFullName,
      buyerAddress,
      buyerPhoneNumber,
      buyerEmail,
      trackingNumber,
    };

    // Save the item
    await item.save();

    // Populate if options provided
    if (populateOptions) {
      await item.populate(populateOptions);
    }

    return item;
  }

  /**
   * Marks a card as sold with card-specific population
   *
   * @param {Object} model - Card model (PsaGradedCard, RawCard)
   * @param {string} itemId - Card ID to mark as sold
   * @param {Object} saleDetails - Sale details object
   * @returns {Promise<Object>} - Updated card with populated cardId and setId
   */
  static async markCardAsSold(model, itemId, saleDetails) {
    const populateOptions = {
      path: 'cardId',
      populate: {
        path: 'setId',
        model: 'Set',
      },
    };

    return await this.markAsSold(model, itemId, saleDetails, populateOptions);
  }

  /**
   * Marks a sealed product as sold with product-specific population
   *
   * @param {Object} model - SealedProduct model
   * @param {string} itemId - Product ID to mark as sold
   * @param {Object} saleDetails - Sale details object
   * @returns {Promise<Object>} - Updated product with populated productId
   */
  static async markSealedProductAsSold(model, itemId, saleDetails) {
    const populateOptions = {
      path: 'productId',
    };

    return await this.markAsSold(model, itemId, saleDetails, populateOptions);
  }

  /**
   * Validates sale details structure
   *
   * @param {Object} saleDetails - Sale details to validate
   * @returns {boolean} - True if valid, throws error if invalid
   */
  static validateSaleDetails(saleDetails) {
    const required = ['paymentMethod', 'actualSoldPrice', 'deliveryMethod', 'source'];

    for (const field of required) {
      if (!saleDetails[field]) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }

    if (typeof saleDetails.actualSoldPrice !== 'number' || saleDetails.actualSoldPrice <= 0) {
      throw new ValidationError('actualSoldPrice must be a positive number');
    }

    return true;
  }

  /**
   * Gets sale statistics for an item type
   *
   * @param {Object} model - Mongoose model
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} - Sale statistics
   */
  static async getSaleStatistics(model, filters = {}) {
    const baseQuery = { sold: true, ...filters };

    const [totalSold, totalRevenue] = await Promise.all([
      model.countDocuments(baseQuery),
      model.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$saleDetails.actualSoldPrice' },
          },
        },
      ]),
    ]);

    return {
      totalSold,
      totalRevenue: totalRevenue[0]?.total || 0,
    };
  }

  /**
   * Finds items sold within a date range
   *
   * @param {Object} model - Mongoose model
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} - Array of sold items
   */
  static async getSoldItemsByDateRange(model, startDate, endDate) {
    return await model.find({
      sold: true,
      'saleDetails.dateSold': {
        $gte: startDate,
        $lte: endDate,
      },
    });
  }
}

module.exports = SaleService;
