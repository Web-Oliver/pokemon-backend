import mongoose from 'mongoose';
import { queryOptimizationPlugin } from '@/system/plugins/queryOptimization.js';
const setProductSchema = new mongoose.Schema(
  {
    // Set product data
    setProductName: { type: String, required: true, unique: true },

    // Unique identifier for database rebuilding
    uniqueSetProductId: { type: Number, required: true, unique: true },
  },
  { versionKey: false },
);

// Add set product specific indexes for optimal query performance
setProductSchema.index(
  { setProductName: 'text' },
  {
    name: 'set_product_text_search',
    weights: { setProductName: 10 },
    background: true
  }
); // Text search with weights
// Note: setProductName and uniqueSetProductId indexes are automatically created by unique: true in schema

// Additional performance indexes (removed duplicates - unique fields auto-create indexes)

// Add validation for new structure
setProductSchema.pre('save', function (next) {
  try {
    // Validate uniqueSetProductId is positive
    if (this.uniqueSetProductId !== undefined && this.uniqueSetProductId <= 0) {
      throw new Error('uniqueSetProductId must be a positive number');
    }

    // Validate setProductName is not empty
    if (this.setProductName !== undefined && this.setProductName.trim() === '') {
      throw new Error('setProductName cannot be empty');
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Apply query optimization plugin with set product configuration
setProductSchema.plugin(queryOptimizationPlugin, {
  entityType: 'SetProduct',
  enableLeanQueries: true,
  enableQueryLogging: false,
  enablePerformanceTracking: true,
  enableAutomaticIndexing: false, // We manage indexes manually
  enableQueryHints: true,
  defaultLimit: 50,
  maxLimit: 500,
  enableCachedCounts: true,
  optimizationLevel: 'standard',
  // Set product specific optimizations
  setProductOptions: {
    enableNameOptimization: true,
    cacheFrequentSetQueries: true,
  },
});

const SetProduct = mongoose.model('SetProduct', setProductSchema);

export default SetProduct;
