import mongoose from 'mongoose';
const { Schema } = mongoose;
import activityTrackingPlugin from '@/collection/activities/activityTracking.js';
import { queryOptimizationPlugin } from '@/system/plugins/queryOptimization.js';
import { saleDetailsSchema, priceHistorySchema, collectionItemTransform } from '@/system/schemas/index.js';
const rawCardSchema = new mongoose.Schema({
  cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
  condition: { type: String, required: true },
  images: [{ type: String }],
  myPrice: { type: mongoose.Types.Decimal128, required: true },
  priceHistory: priceHistorySchema,
  dateAdded: { type: Date, default: Date.now },
  sold: { type: Boolean, default: false },
  saleDetails: saleDetailsSchema
});

// Apply activity tracking plugin
rawCardSchema.plugin(activityTrackingPlugin, {
  itemType: 'raw',
  config: {
    trackCreation: true,
    trackSales: true,
    trackPriceUpdates: true,
    trackImageUpdates: true
  }
});

// Apply query optimization plugin
rawCardSchema.plugin(queryOptimizationPlugin, {
  entityType: 'RawCard',
  enableLeanQueries: true,
  enablePerformanceTracking: true,
  enableAutomaticIndexing: true,
  defaultLimit: 50,
  maxLimit: 500
});

// Apply shared transform function for JSON responses
rawCardSchema.set('toJSON', {
  transform: collectionItemTransform
});

const RawCard = mongoose.model('RawCard', rawCardSchema);

export default RawCard;
