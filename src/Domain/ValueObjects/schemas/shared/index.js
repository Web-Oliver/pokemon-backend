/**
 * Shared Schema Components
 *
 * Central export for all shared schema components to simplify imports
 * and maintain consistency across the application.
 */

import saleDetailsSchema from './saleDetails.js';
import priceHistorySchema from './priceHistory.js';
import constants from './constants.js';
import transforms from './transforms.js';
export {
  saleDetailsSchema,
  priceHistorySchema,
  constants,
  transforms
};

// Export specific transform functions for direct import
export const { 
  collectionItemTransform, 
  sealedProductTransform, 
  auctionTransform, 
  productTransform 
} = transforms;

export default {
  saleDetailsSchema,
  priceHistorySchema,
  constants,
  transforms
};
