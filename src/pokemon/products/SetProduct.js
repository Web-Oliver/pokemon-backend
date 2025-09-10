import mongoose from 'mongoose';
const setProductSchema = new mongoose.Schema(
  {
    // Set product data
    setProductName: { type: String, required: true, unique: true },

    // Unique identifier for database rebuilding
    uniqueSetProductId: { type: Number, required: true, unique: true }
  },
  { versionKey: false }
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

const SetProduct = mongoose.model('SetProduct', setProductSchema);

export default SetProduct;
