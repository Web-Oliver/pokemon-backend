const mongoose = require('mongoose');
const { Schema } = mongoose;
const { queryOptimizationPlugin } = require('../plugins/queryOptimization');

const productSchema = new mongoose.Schema(
  {
    // MongoDB ObjectId relationships
    setProductId: { 
      type: Schema.Types.ObjectId, 
      ref: 'SetProduct', 
      required: true 
    },
    
    // Product data
    productName: { type: String, required: true },
    available: { type: Number, required: true },
    price: { type: String, required: true },
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
    url: { type: String, required: true },
    
    // Unique identifier for database rebuilding
    uniqueProductId: { type: Number, required: true, unique: true },
  },
  { versionKey: false },
);

// Compound index for uniqueness within a product set
productSchema.index({ 
  setProductId: 1, 
  productName: 1, 
  category: 1 
}, { unique: true });

// Text index for efficient search across name
productSchema.index(
  {
    productName: 'text',
  },
  {
    weights: { productName: 10 },
    name: 'product_text_search',
  },
);

// Additional indexes for filtering and sorting
productSchema.index({ category: 1 });
productSchema.index({ productName: 1 });
productSchema.index({ setProductId: 1 });
productSchema.index({ available: 1 });

// Unique identifier indexes for database rebuilding
productSchema.index({ uniqueProductId: 1 });

// Optimization indexes
productSchema.index({ setProductId: 1, category: 1 }); // Set with category filtering
productSchema.index({ setProductId: 1, available: -1 }); // Set with availability sorting
productSchema.index({ category: 1, available: -1 }); // Category with availability sorting

// Apply query optimization plugin with product configuration
productSchema.plugin(queryOptimizationPlugin, {
  entityType: 'Product',
  enableLeanQueries: true,
  enableQueryLogging: false,
  enablePerformanceTracking: true,
  enableAutomaticIndexing: false, // We manage indexes manually
  enableQueryHints: true,
  defaultLimit: 100,
  maxLimit: 1000,
  enableCachedCounts: true,
  optimizationLevel: 'standard',
  // Product specific optimizations
  productOptions: {
    enableTextSearchOptimization: true,
    enableSetProductOptimization: true,
    enableCategoryFiltering: true,
    enableAvailabilityOptimization: true,
    cacheFrequentQueries: true,
  },
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;