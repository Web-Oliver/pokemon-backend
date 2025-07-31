const mongoose = require('mongoose');

/**
 * Price History Schema
 *
 * Shared schema component for tracking price changes over time.
 * Used across PsaGradedCard, RawCard, and SealedProduct models.
 *
 * Consolidates duplicate schema definitions to ensure consistency
 * and simplify maintenance.
 */
const priceHistorySchema = [
  {
    price: {
      type: mongoose.Types.Decimal128,
      required: true,
    },
    dateUpdated: {
      type: Date,
      default: Date.now,
      get(value) {
        // Ensure dates are properly converted to ISO strings
        if (value instanceof Date && !isNaN(value.getTime())) {
          return value.toISOString();
        }
        return value;
      }
    },
  },
];

module.exports = priceHistorySchema;
