/**
 * Shared Schema Components
 *
 * Central export for all shared schema components to simplify imports
 * and maintain consistency across the application.
 */

const saleDetailsSchema = require('./saleDetails');
const priceHistorySchema = require('./priceHistory');
const constants = require('./constants');
const transforms = require('./transforms');

module.exports = {
  // Schema components
  saleDetailsSchema,
  priceHistorySchema,

  // Constants
  ...constants,

  // Transform functions
  ...transforms,

  // Convenience exports
  schemas: {
    saleDetails: saleDetailsSchema,
    priceHistory: priceHistorySchema,
  },

  constants: {
    PAYMENT_METHODS: constants.PAYMENT_METHODS,
    DELIVERY_METHODS: constants.DELIVERY_METHODS,
    SALES_SOURCES: constants.SALES_SOURCES,
    AUCTION_STATUSES: constants.AUCTION_STATUSES,
    COMMON_PATTERNS: constants.COMMON_PATTERNS,
  },

  transforms: {
    createDecimal128Transform: transforms.createDecimal128Transform,
    convertDecimal128ToNumber: transforms.convertDecimal128ToNumber,
    convertDateToString: transforms.convertDateToString,
    collectionItemTransform: transforms.collectionItemTransform,
    sealedProductTransform: transforms.sealedProductTransform,
    auctionTransform: transforms.auctionTransform,
    cardMarketTransform: transforms.cardMarketTransform,
  },
};
