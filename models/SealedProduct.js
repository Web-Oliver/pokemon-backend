const mongoose = require('mongoose');
const { Schema } = mongoose;
const activityTrackingPlugin = require('../plugins/activityTracking');
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

// Apply shared transform function for JSON responses
sealedProductSchema.set('toJSON', {
  transform: sealedProductTransform,
});

const SealedProduct = mongoose.model('SealedProduct', sealedProductSchema);

module.exports = SealedProduct;
