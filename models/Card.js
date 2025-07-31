const mongoose = require('mongoose');
const { Schema } = mongoose;
const { queryOptimizationPlugin } = require('../plugins/queryOptimization');

const cardSchema = new mongoose.Schema(
  {
    setId: { type: Schema.Types.ObjectId, ref: 'Set', required: true },
    pokemonNumber: { type: String, required: false, default: '' },
    cardName: { type: String, required: true },
    baseName: { type: String, required: true },
    variety: { type: String, default: '' },
    psaGrades: {
      psa_1: { type: Number, default: 0 },
      psa_2: { type: Number, default: 0 },
      psa_3: { type: Number, default: 0 },
      psa_4: { type: Number, default: 0 },
      psa_5: { type: Number, default: 0 },
      psa_6: { type: Number, default: 0 },
      psa_7: { type: Number, default: 0 },
      psa_8: { type: Number, default: 0 },
      psa_9: { type: Number, default: 0 },
      psa_10: { type: Number, default: 0 },
    },
    psaTotalGradedForCard: { type: Number, required: true },
  },
  { versionKey: false },
);

// Compound index to ensure uniqueness for cards within a set
cardSchema.index({ setId: 1, cardName: 1, pokemonNumber: 1, variety: 1 }, { unique: true });

// Text search index for efficient search across card name and pokemon number
cardSchema.index(
  {
    cardName: 'text',
    baseName: 'text',
    pokemonNumber: 'text',
    variety: 'text',
  },
  {
    weights: {
      cardName: 10,
      baseName: 8,
      pokemonNumber: 5,
      variety: 3,
    },
    name: 'card_text_search',
  },
);

// Optimized indexes for common search patterns
cardSchema.index({ cardName: 1 });
cardSchema.index({ baseName: 1 });
cardSchema.index({ setId: 1, cardName: 1 });
cardSchema.index({ setId: 1, pokemonNumber: 1 });

// Additional reference data specific indexes for query optimization
cardSchema.index({ psaTotalGradedForCard: 1 }); // PSA population filtering
cardSchema.index({ setId: 1, psaTotalGradedForCard: 1 }); // Set with PSA population
cardSchema.index({ variety: 1 }); // Variety filtering
cardSchema.index({ pokemonNumber: 1 }); // Pokemon number lookup

// Apply query optimization plugin with reference data configuration
cardSchema.plugin(queryOptimizationPlugin, {
  entityType: 'Card',
  enableLeanQueries: true,
  enableQueryLogging: false,
  enablePerformanceTracking: true,
  enableAutomaticIndexing: false, // We manage indexes manually due to text search complexity
  enableQueryHints: true,
  defaultLimit: 100,
  maxLimit: 1000,
  enableCachedCounts: true,
  optimizationLevel: 'standard',
  // Reference data specific optimizations
  referenceDataOptions: {
    enableTextSearchOptimization: true,
    enableSetRelationOptimization: true,
    enablePsaPopulationOptimization: true,
    enableCardNameOptimization: true,
    cacheFrequentQueries: true,
  },
});

const Card = mongoose.model('Card', cardSchema);

module.exports = Card;
