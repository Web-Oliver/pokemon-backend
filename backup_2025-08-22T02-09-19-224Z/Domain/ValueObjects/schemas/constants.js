import mongoose from 'mongoose';

/**
 * Shared Schema Constants
 *
 * Centralized constants for schema field values to ensure consistency
 * across all models and eliminate duplication.
 */

// Payment method options
const PAYMENT_METHODS = ['CASH', 'Mobilepay', 'BankTransfer'];

// Delivery method options
const DELIVERY_METHODS = ['Sent', 'Local Meetup'];

// Sales source options
const SALES_SOURCES = ['Facebook', 'DBA'];

// Auction status options
const AUCTION_STATUSES = ['draft', 'active', 'sold', 'expired'];

// Common field patterns
const COMMON_PATTERNS = {
  // Standard date field with default to now
  dateWithDefault: {
    type: Date,
    default: Date.now,
  },

  // Required string field
  requiredString: {
    type: String,
    required: true,
  },

  // Optional string field
  optionalString: {
    type: String,
  },

  // Boolean field with default false
  booleanDefault: {
    type: Boolean,
    default: false,
  },

  // Required ObjectId reference
  requiredObjectId: (ref) => ({
    type: mongoose.Schema.Types.ObjectId,
    ref,
    required: true,
  }),

  // Optional ObjectId reference
  optionalObjectId: (ref) => ({
    type: mongoose.Schema.Types.ObjectId,
    ref,
  }),

  // Required Decimal128 for prices
  requiredPrice: {
    type: mongoose.Types.Decimal128,
    required: true,
  },

  // Optional Decimal128 for prices
  optionalPrice: {
    type: mongoose.Types.Decimal128,
  },

  // Array of strings for images
  imagesArray: [
    {
      type: String,
    },
  ],
};

export {
  PAYMENT_METHODS,
  DELIVERY_METHODS,
  SALES_SOURCES,
  AUCTION_STATUSES,
  COMMON_PATTERNS
};
export default PAYMENT_METHODS;;
