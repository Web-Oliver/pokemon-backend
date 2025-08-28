/**
 * Shared schemas and transforms index
 * Re-exports all shared schema components for easy importing
 */

// Import schemas
import saleDetailsSchema from '@/collection/sales/saleDetails.js';
import priceHistorySchema from '@/collection/shared/priceHistory.js';
import PAYMENT_METHODS from './constants.js';

// Import transforms
import {
  createDecimal128Transform,
  convertDecimal128ToNumber,
  convertDateToString,
  convertObjectIdsToStrings,
  collectionItemTransform,
  sealedProductTransform,
  auctionTransform,
  productTransform
} from './transforms.js';

// Re-export all schemas
export {
  saleDetailsSchema,
  priceHistorySchema,
  PAYMENT_METHODS
};

// Re-export all transforms
export {
  createDecimal128Transform,
  convertDecimal128ToNumber,
  convertDateToString,
  convertObjectIdsToStrings,
  collectionItemTransform,
  sealedProductTransform,
  auctionTransform,
  productTransform
};
