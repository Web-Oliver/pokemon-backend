const mongoose = require('mongoose');
const { Schema } = mongoose;
const activityTrackingPlugin = require('../plugins/activityTracking');
const { queryOptimizationPlugin } = require('../plugins/queryOptimization');
const { saleDetailsSchema, priceHistorySchema, collectionItemTransform } = require('./schemas/shared');

const psaGradedCardSchema = new mongoose.Schema({
  cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
  grade: { type: String, required: true },
  images: [{ type: String }],
  myPrice: { type: mongoose.Types.Decimal128, required: true },
  priceHistory: priceHistorySchema,
  dateAdded: { type: Date, default: Date.now },
  sold: { type: Boolean, default: false },
  saleDetails: saleDetailsSchema,
});

// Apply activity tracking plugin
psaGradedCardSchema.plugin(activityTrackingPlugin, {
  itemType: 'psa',
  config: {
    trackCreation: true,
    trackSales: true,
    trackPriceUpdates: true,
    trackImageUpdates: true,
  },
});

// Apply query optimization plugin
psaGradedCardSchema.plugin(queryOptimizationPlugin, {
  entityType: 'PsaGradedCard',
  enableLeanQueries: true,
  enablePerformanceTracking: true,
  enableAutomaticIndexing: true,
  defaultLimit: 50,
  maxLimit: 500,
});

// Apply shared transform function for JSON responses
psaGradedCardSchema.set('toJSON', {
  transform: collectionItemTransform,
  getters: true, // Enable getters for JSON serialization
});

const PsaGradedCard = mongoose.model('PsaGradedCard', psaGradedCardSchema);

module.exports = PsaGradedCard;
