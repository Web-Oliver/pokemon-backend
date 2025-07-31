const mongoose = require('mongoose');
const { queryOptimizationPlugin } = require('../plugins/queryOptimization');

const setSchema = new mongoose.Schema(
  {
    setName: { type: String, required: true, unique: true },
    year: { type: Number, required: true },
    setUrl: { type: String, required: true },
    totalCardsInSet: { type: Number, required: true },
    totalPsaPopulation: { type: Number, required: true },
  },
  { versionKey: false },
);

// Add set-specific indexes for optimal query performance
setSchema.index({ year: 1 }); // Year filtering and sorting
setSchema.index({ year: 1, setName: 1 }); // Year with set name queries
setSchema.index({ totalCardsInSet: 1 }); // Set size filtering
setSchema.index({ totalPsaPopulation: 1 }); // PSA population filtering
setSchema.index({ year: -1, totalPsaPopulation: -1 }); // Recent sets with high PSA population
setSchema.index({ setName: 'text' }, { name: 'set_text_search' }); // Text search on set names

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
