const mongoose = require('mongoose');
const { queryOptimizationPlugin } = require('../plugins/queryOptimization');

const setSchema = new mongoose.Schema(
  {
    // Set metadata
    setName: { type: String, required: true, unique: true },
    year: { type: Number, required: true },
    setUrl: { type: String, required: true },
    totalCardsInSet: { type: Number, required: true },
    
    // Unique identifier for database rebuilding
    uniqueSetId: { type: Number, required: true, unique: true },
    
    // PSA grade totals for the entire set
    total_grades: {
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
      total_graded: { type: Number, default: 0 }
    }
  },
  { versionKey: false },
);

// Add set-specific indexes for optimal query performance
setSchema.index({ year: 1 }); // Year filtering and sorting
setSchema.index({ year: 1, setName: 1 }); // Year with set name queries
setSchema.index({ totalCardsInSet: 1 }); // Set size filtering
setSchema.index({ setName: 'text' }, { name: 'set_text_search' }); // Text search on set names

// Unique identifier indexes for database rebuilding
setSchema.index({ uniqueSetId: 1 }); // Unique set ID lookups

// PSA grade indexes
setSchema.index({ 'total_grades.total_graded': 1 }); // Total graded filtering
setSchema.index({ 'total_grades.grade_10': -1 }); // PSA 10 filtering
setSchema.index({ year: 1, 'total_grades.total_graded': -1 }); // Year with grade population
setSchema.index({ year: -1, 'total_grades.total_graded': -1 }); // Recent sets with high grade population

// Add validation for new structure
setSchema.pre('save', function(next) {
  const { validateUniqueSetId, validateTotalGrades } = require('../utils/validationUtils');
  
  try {
    // Validate uniqueSetId
    if (this.uniqueSetId !== undefined) {
      validateUniqueSetId(this.uniqueSetId);
    }
    
    // Validate total_grades structure
    if (this.total_grades) {
      validateTotalGrades(this.total_grades);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Apply query optimization plugin with set-specific configuration
setSchema.plugin(queryOptimizationPlugin, {
  entityType: 'Set',
  enableLeanQueries: true,
  enableQueryLogging: false,
  enablePerformanceTracking: true,
  enableAutomaticIndexing: false, // We manage indexes manually for optimal set queries
  enableQueryHints: true,
  defaultLimit: 50,
  maxLimit: 500,
  enableCachedCounts: true,
  optimizationLevel: 'standard',
  // Set-specific optimizations
  setSpecificOptions: {
    enableYearFiltering: true,
    enablePsaPopulationOptimization: true,
    enableCardCountOptimization: true,
    enableSetNameOptimization: true,
    cacheFrequentSetQueries: true,
    enableTemporalQueries: true, // For year-based queries
  },
});

const Set = mongoose.model('Set', setSchema);

module.exports = Set;
