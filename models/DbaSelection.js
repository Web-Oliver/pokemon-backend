const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * DBA Selection Model
 * 
 * Tracks which items are selected for DBA listing with 60-day countdown
 * Separate from main collection models to keep DBA functionality isolated
 */
const dbaSelectionSchema = new mongoose.Schema({
  // Reference to the item (can be PSA, Raw, or Sealed)
  itemId: { type: Schema.Types.ObjectId, required: true },
  itemType: { 
    type: String, 
    required: true, 
    enum: ['psa', 'raw', 'sealed'] 
  },
  
  // DBA tracking information
  selectedDate: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  
  // Optional metadata
  notes: { type: String, default: '' },
  
  // Automatically calculated fields (for convenience)
  expiryDate: { 
    type: Date, 
    default() {
      return new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days from now
    }
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for efficient querying
dbaSelectionSchema.index({ itemId: 1, itemType: 1 }, { unique: true });
dbaSelectionSchema.index({ isActive: 1 });
dbaSelectionSchema.index({ expiryDate: 1 });

// Virtual for days remaining
dbaSelectionSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const diffTime = this.expiryDate.getTime() - now.getTime();

  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
});

// Virtual for days selected
dbaSelectionSchema.virtual('daysSelected').get(function() {
  const now = new Date();
  const diffTime = now.getTime() - this.selectedDate.getTime();

  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
});

// Ensure virtuals are included in JSON output
dbaSelectionSchema.set('toJSON', { virtuals: true });

// Static method to get active selections
dbaSelectionSchema.statics.getActiveSelections = function() {
  return this.find({ 
    isActive: true,
    expiryDate: { $gt: new Date() }
  });
};

// Static method to get expired selections
dbaSelectionSchema.statics.getExpiredSelections = function() {
  return this.find({ 
    isActive: true,
    expiryDate: { $lte: new Date() }
  });
};

// Static method to get selections expiring soon (within days)
dbaSelectionSchema.statics.getExpiringSoon = function(days = 10) {
  const cutoffDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  return this.find({ 
    isActive: true,
    expiryDate: { $gt: new Date(), $lte: cutoffDate }
  });
};

const DbaSelection = mongoose.model('DbaSelection', dbaSelectionSchema);

module.exports = DbaSelection;