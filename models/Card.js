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
    
    // New fields for migration
    unique_pokemon_id: { type: Number, required: true, unique: true },
    card_number: { type: String, required: true },
    grades: {
      grade_1: { type: Number, default: 0 },
      grade_2: { type: Number, default: 0 },
      grade_3: { type: Number, default: 0 },
      grade_4: { type: Number, default: 0 },
      grade_5: { type: Number, default: 0 },
      grade_6: { type: Number, default: 0 },
      grade_7: { type: Number, default: 0 },
      grade_8: { type: Number, default: 0 },
      grade_9: { type: Number, default: 0 },
      grade_10: { type: Number, default: 0 },
      grade_total: { type: Number, default: 0 }
    }
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

// New indexes for migration fields
cardSchema.index({ unique_pokemon_id: 1 }); // Unique pokemon ID lookups
cardSchema.index({ card_number: 1 }); // Card number filtering
cardSchema.index({ 'grades.grade_total': 1 }); // Grade total filtering
cardSchema.index({ 'grades.grade_10': -1 }); // PSA 10 filtering
cardSchema.index({ setId: 1, 'grades.grade_total': -1 }); // Set with grade population
cardSchema.index({ variety: 1 }); // Variety filtering
cardSchema.index({ pokemonNumber: 1 }); // Pokemon number lookup

// Add validation for new structure
cardSchema.pre('save', function(next) {
  const { validateUniquePokemonId, validateGrades } = require('../utils/validationUtils');
  const { ValidationError } = require('../middleware/errorHandler');
  
  try {
    // Validate unique_pokemon_id
    if (this.unique_pokemon_id !== undefined) {
      validateUniquePokemonId(this.unique_pokemon_id);
    }
    
    // Validate grades structure
    if (this.grades) {
      validateGrades(this.grades);
    }
    
    // Validate card_number is not empty
    if (this.card_number !== undefined && this.card_number.trim() === '') {
      throw new ValidationError('card_number cannot be empty');
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

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
