const mongoose = require('mongoose');
const { cardMarketTransform } = require('./schemas/shared/transforms');

const cardMarketReferenceProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    setName: { type: String, required: true },
    available: { type: Number, required: true },
    price: { type: String, required: true },
    category: { type: String, required: true },
    url: { type: String, required: true },
    lastUpdated: { type: Date },
  },
  { versionKey: false },
);

// Compound index for uniqueness
cardMarketReferenceProductSchema.index({ name: 1, setName: 1, category: 1 }, { unique: true });

// Text index for efficient search across name and setName fields
cardMarketReferenceProductSchema.index(
  {
    name: 'text',
    setName: 'text',
  },
  {
    weights: { name: 10, setName: 5 },
    name: 'search_index',
  },
);

// Additional indexes for filtering and sorting
cardMarketReferenceProductSchema.index({ category: 1 });
cardMarketReferenceProductSchema.index({ name: 1 });
cardMarketReferenceProductSchema.index({ setName: 1 });

// Apply shared transform function for JSON responses
cardMarketReferenceProductSchema.set('toJSON', {
  transform: cardMarketTransform,
  getters: true, // Enable getters for JSON serialization
});

const CardMarketReferenceProduct = mongoose.model('CardMarketReferenceProduct', cardMarketReferenceProductSchema);

module.exports = CardMarketReferenceProduct;
