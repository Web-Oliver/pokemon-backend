const mongoose = require('mongoose');
const { Schema } = mongoose;
const activityTrackingPlugin = require('../plugins/activityTracking');
const { queryOptimizationPlugin } = require('../plugins/queryOptimization');
const { saleDetailsSchema, priceHistorySchema, sealedProductTransform } = require('./schemas/shared');

const sealedProductSchema = new mongoose.Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'CardMarketReferenceProduct',
    required: true,
  },
  category: {
    type: String,
    required: true,
    enum: [
      'Blisters',
      'Booster-Boxes',
      'Boosters',
      'Box-Sets',
      'Elite-Trainer-Boxes',
      'Theme-Decks',
      'Tins',
      'Trainer-Kits',
    ],
  },
  setName: { type: String, required: true },
  name: { type: String, required: true },
  availability: { type: Number, required: true },
  cardMarketPrice: { type: mongoose.Types.Decimal128, required: true },
  myPrice: { type: mongoose.Types.Decimal128, required: true },
  priceHistory: priceHistorySchema,
  images: [{ type: String }],
  dateAdded: { type: Date, default: Date.now },
  sold: { type: Boolean, default: false },
  saleDetails: saleDetailsSchema,
});

// Add product-specific indexes for optimal query performance
sealedProductSchema.index({ category: 1, sold: 1 }); // Category filtering with sale status
sealedProductSchema.index({ setName: 1, sold: 1 }); // Set filtering with sale status
sealedProductSchema.index({ setName: 1, category: 1 }); // Combined set and category filtering
sealedProductSchema.index({ cardMarketPrice: 1 }); // Price range queries
sealedProductSchema.index({ myPrice: 1 }); // User price range queries
sealedProductSchema.index({ availability: 1 }); // Availability filtering
sealedProductSchema.index({ productId: 1, sold: 1 }); // Reference product queries
sealedProductSchema.index({ dateAdded: -1, sold: 1 }); // Recent items with sale status

// Apply activity tracking plugin
sealedProductSchema.plugin(activityTrackingPlugin, {
  itemType: 'sealed',
  config: {
    trackCreation: true,
    trackSales: true,
    trackPriceUpdates: true,
    trackImageUpdates: true,
  },
});

// Apply query optimization plugin with product-specific configuration
sealedProductSchema.plugin(queryOptimizationPlugin, {
  entityType: 'SealedProduct',
  enableLeanQueries: true,
  enableQueryLogging: false,
  enablePerformanceTracking: true,
  enableAutomaticIndexing: true,
  enableQueryHints: true,
  defaultLimit: 50,
  maxLimit: 500,
  enableCachedCounts: true,
  optimizationLevel: 'standard',
  // Product-specific optimizations
  productSpecificOptions: {
    enableCategoryIndexing: true,
    enableSetNameIndexing: true,
    enablePriceRangeOptimization: true,
    enableAvailabilityFiltering: true,
  },
});

// Apply shared transform function for JSON responses
sealedProductSchema.set('toJSON', {
  transform: sealedProductTransform,
});

const SealedProduct = mongoose.model('SealedProduct', sealedProductSchema);

module.exports = SealedProduct;
