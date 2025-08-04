const mongoose = require('mongoose');
const { Schema } = mongoose;
const { queryOptimizationPlugin } = require('../plugins/queryOptimization');

const cardSchema = new mongoose.Schema(
  {
    // MongoDB ObjectId relationships
    setId: { type: Schema.Types.ObjectId, ref: 'Set', required: true },
    
    // Card data
    cardName: { type: String, required: true },
    variety: { type: String, default: '' },
    cardNumber: { type: String, required: true },
    
    // Unique identifiers for database rebuilding
    uniquePokemonId: { type: Number, required: true, unique: true },
    uniqueSetId: { type: Number, required: true },
    
    // PSA grade population data
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
cardSchema.index({ setId: 1, cardName: 1, cardNumber: 1, variety: 1 }, { unique: true });

// Text search index for efficient search across card name and card number
cardSchema.index(
  {
    cardName: 'text',
    cardNumber: 'text',
    variety: 'text',
  },
  {
    weights: {
      cardName: 10,
      cardNumber: 5,
      variety: 3,
    },
    name: 'card_text_search',
  },
);

// Optimized indexes for common search patterns
cardSchema.index({ cardName: 1 });
cardSchema.index({ setId: 1, cardName: 1 });
cardSchema.index({ setId: 1, cardNumber: 1 });
cardSchema.index({ cardNumber: 1 }); // Card number lookup

// Note: uniquePokemonId and uniqueSetId indexes are automatically created by unique: true in schema

// PSA grade indexes
cardSchema.index({ 'grades.grade_total': 1 }); // Grade total filtering
cardSchema.index({ 'grades.grade_10': -1 }); // PSA 10 filtering
cardSchema.index({ setId: 1, 'grades.grade_total': -1 }); // Set with grade population
cardSchema.index({ uniqueSetId: 1, 'grades.grade_total': -1 }); // Unique set with grade population
cardSchema.index({ variety: 1 }); // Variety filtering

// Add validation for new structure
cardSchema.pre('save', function(next) {
  const { validateUniquePokemonId, validateUniqueSetId, validateGrades } = require('../utils/validationUtils');
  const { ValidationError } = require('../middleware/errorHandler');
  
  try {
    // Validate uniquePokemonId
    if (this.uniquePokemonId !== undefined) {
      validateUniquePokemonId(this.uniquePokemonId);
    }
    
    // Validate uniqueSetId
    if (this.uniqueSetId !== undefined) {
      validateUniqueSetId(this.uniqueSetId);
    }
    
    // Validate grades structure
    if (this.grades) {
      validateGrades(this.grades);
    }
    
    // Validate cardNumber is not empty
    if (this.cardNumber !== undefined && this.cardNumber.trim() === '') {
      throw new ValidationError('cardNumber cannot be empty');
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
