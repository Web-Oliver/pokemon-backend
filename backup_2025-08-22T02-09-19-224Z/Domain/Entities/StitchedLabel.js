import mongoose from 'mongoose';
const { Schema } = mongoose;
import { queryOptimizationPlugin   } from '@/Infrastructure/Plugins/queryOptimization.js';
const stitchedLabelSchema = new mongoose.Schema({
  // Stitched image information
  stitchedImage: { type: String, required: true }, // Path to the stitched image
  stitchedImageHash: { type: String, required: true }, // Hash of stitched image
  imageHashes: [{ type: String, required: true }], // Array of individual image hashes for duplicate prevention

  // Individual label information
  individualLabels: [{
    labelImage: { type: String, required: true }, // Path to individual label image
    imageHash: { type: String, required: true }, // Hash of individual image
    originalFileName: String,
    position: {
      x: Number, // X coordinate in stitched image
      y: Number, // Y coordinate in stitched image
      width: Number, // Width in stitched image
      height: Number // Height in stitched image
    },
    gridPosition: {
      row: Number, // Grid row (0-based)
      col: Number // Grid column (0-based)
    }
  }],

  // Stitching configuration
  stitchingConfig: {
    gridColumns: { type: Number, required: true }, // Number of columns in grid
    gridRows: { type: Number, required: true }, // Number of rows in grid
    labelWidth: Number, // Individual label width
    labelHeight: Number, // Individual label height
    spacing: { type: Number, default: 10 }, // Spacing between labels
    backgroundColor: { type: String, default: '#FFFFFF' }, // Background color
    totalWidth: Number, // Final stitched image width
    totalHeight: Number // Final stitched image height
  },

  // OCR processing results for stitched image
  batchOcrResult: {
    fullText: String, // Complete OCR text from stitched image
    confidence: { type: Number, min: 0, max: 1 }, // Overall confidence
    processingTime: Number, // Time to process stitched image (ms)
    textAnnotations: [{
      description: String,
      boundingPoly: {
        vertices: [{
          x: Number,
          y: Number
        }]
      },
      confidence: { type: Number, min: 0, max: 1 }
    }]
  },

  // Individual PSA label references
  psaLabels: [{
    type: Schema.Types.ObjectId,
    ref: 'PsaLabel'
  }],

  // Batch processing information
  batchId: { type: String, required: true },
  batchSize: { type: Number, required: true },

  // Processing metadata
  processingTime: Number, // Total processing time (ms)
  processedAt: { type: Date, default: Date.now },

  // Cost optimization metrics
  costSavings: {
    individualApiCalls: Number, // Cost if processed individually
    stitchedApiCall: Number, // Cost for stitched processing
    savingsAmount: Number, // Absolute savings
    savingsPercentage: Number // Percentage savings
  },

  // Quality assessment
  stitchingQuality: {
    score: { type: Number, min: 0, max: 1 },
    issues: [String], // e.g., ['overlapping_labels', 'misaligned_grid']
    recommendations: [String]
  },

  // Status tracking
  status: {
    type: String,
    enum: ['created', 'stitched', 'ocr_processed', 'labels_extracted', 'completed', 'failed'],
    default: 'created'
  },

  // Error handling
  processingErrors: [String],

  // User interaction
  userVerified: { type: Boolean, default: false },
  userNotes: String
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for efficient querying
stitchedLabelSchema.index({ stitchedImageHash: 1 }, { unique: true });
stitchedLabelSchema.index({ imageHashes: 1 }); // For duplicate prevention queries
stitchedLabelSchema.index({ batchId: 1 });
stitchedLabelSchema.index({ status: 1, processedAt: -1 });
stitchedLabelSchema.index({ processedAt: -1 });
stitchedLabelSchema.index({ batchSize: 1 });

// Compound indexes for common queries
stitchedLabelSchema.index({ status: 1, batchId: 1 });
stitchedLabelSchema.index({ userVerified: 1, processedAt: -1 });

// Pre-save validation
stitchedLabelSchema.pre('save', function (next) {
  try {
    // Validate batch size matches individual labels
    if (this.individualLabels.length !== this.batchSize) {
      throw new Error(`Batch size ${this.batchSize} doesn't match individual labels count ${this.individualLabels.length}`);
    }

    // Validate grid configuration - grid should accommodate at least the batch size
    const expectedLabels = this.stitchingConfig.gridColumns * this.stitchingConfig.gridRows;

    if (expectedLabels < this.batchSize) {
      throw new Error(`Grid configuration (${this.stitchingConfig.gridColumns}x${this.stitchingConfig.gridRows}) is too small for batch size ${this.batchSize}`);
    }

    // Calculate cost savings if not set
    if (!this.costSavings.savingsAmount && this.costSavings.individualApiCalls && this.costSavings.stitchedApiCall) {
      this.costSavings.savingsAmount = this.costSavings.individualApiCalls - this.costSavings.stitchedApiCall;
      this.costSavings.savingsPercentage = Math.round(
        (this.costSavings.savingsAmount / this.costSavings.individualApiCalls) * 100
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
stitchedLabelSchema.methods.getLabelAtPosition = function (row, col) {
  return this.individualLabels.find(label =>
    label.gridPosition.row === row && label.gridPosition.col === col
  );
};

stitchedLabelSchema.methods.isProcessingComplete = function () {
  return this.status === 'completed' && this.psaLabels.length === this.batchSize;
};

stitchedLabelSchema.methods.getProcessingSummary = function () {
  return {
    batchId: this.batchId,
    status: this.status,
    labelCount: this.batchSize,
    psaLabelsCreated: this.psaLabels.length,
    processingTime: this.processingTime,
    costSavings: this.costSavings.savingsPercentage,
    hasErrors: this.errors.length > 0
  };
};

stitchedLabelSchema.methods.calculateGridDimensions = function (labelCount) {
  // Calculate optimal grid dimensions
  const sqrt = Math.sqrt(labelCount);
  const cols = Math.ceil(sqrt);
  const rows = Math.ceil(labelCount / cols);

  return { cols, rows };
};

// Static methods
stitchedLabelSchema.statics.findByBatchId = function (batchId) {
  return this.findOne({ batchId }).populate('psaLabels');
};

stitchedLabelSchema.statics.findByStatus = function (status, limit = 50) {
  return this.find({ status })
    .sort({ processedAt: -1 })
    .limit(limit)
    .populate('psaLabels');
};

stitchedLabelSchema.statics.getProcessingStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgProcessingTime: { $avg: '$processingTime' },
        avgBatchSize: { $avg: '$batchSize' },
        totalCostSavings: { $sum: '$costSavings.savingsAmount' }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

stitchedLabelSchema.statics.getCostSavingsReport = function () {
  return this.aggregate([
    {
      $match: {
        'costSavings.savingsAmount': { $exists: true, $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        totalBatches: { $sum: 1 },
        totalLabels: { $sum: '$batchSize' },
        totalSavings: { $sum: '$costSavings.savingsAmount' },
        avgSavingsPercentage: { $avg: '$costSavings.savingsPercentage' },
        maxSavingsPercentage: { $max: '$costSavings.savingsPercentage' }
      }
    }
  ]);
};

stitchedLabelSchema.statics.findUnverified = function (limit = 50) {
  return this.find({
    userVerified: false,
    status: 'completed'
  })
  .sort({ processedAt: -1 })
  .limit(limit)
  .populate('psaLabels');
};

// Apply query optimization plugin
stitchedLabelSchema.plugin(queryOptimizationPlugin, {
  entityType: 'StitchedLabel',
  enableLeanQueries: true,
  enableQueryLogging: process.env.NODE_ENV === 'development',
  enablePerformanceTracking: true,
  defaultLimit: 20,
  maxLimit: 100
});

const StitchedLabel = mongoose.model('StitchedLabel', stitchedLabelSchema);

export default StitchedLabel;
