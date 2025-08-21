import mongoose from 'mongoose';
const { Schema } = mongoose;
import { queryOptimizationPlugin   } from '@/Infrastructure/Plugins/queryOptimization.js';
const ocrResultSchema = new mongoose.Schema({
  // Image identification
  imageHash: { type: String, required: true },
  originalFileName: { type: String },
  imageUrl: { type: String },

  // OCR processing details
  ocrProvider: { type: String, required: true, enum: ['google-vision', 'tesseract', 'aws-textract'] },
  processingTime: { type: Number }, // milliseconds

  // Raw OCR text results
  fullText: { type: String, required: true, index: 'text' },
  confidence: { type: Number, min: 0, max: 1 },

  // Structured OCR data
  textAnnotations: [{
    description: String,
    boundingPoly: {
      vertices: [{
        x: Number,
        y: Number
      }]
    },
    confidence: { type: Number, min: 0, max: 1 }
  }],

  // Google Vision specific data
  pages: [{
    confidence: Number,
    width: Number,
    height: Number,
    blocks: [{
      boundingBox: {
        vertices: [{
          x: Number,
          y: Number
        }]
      },
      confidence: Number,
      blockType: String
    }]
  }],

  // Processing metadata
  languageHints: [String],
  features: {
    textDetection: Boolean,
    documentTextDetection: Boolean,
    styleInformation: Boolean
  },

  // Card detection results (if any)
  detectedCards: [{
    cardId: { type: Schema.Types.ObjectId, ref: 'Card' },
    matchConfidence: Number,
    matchType: { type: String, enum: ['psa', 'english', 'japanese', 'generic'] }
  }],

  // Error information
  processingErrors: [String],

  // Timestamps and tracking
  processedAt: { type: Date, default: Date.now, index: true },
  sessionId: String, // Track batch processing sessions
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // If user system exists

  // Analysis metadata
  textQuality: {
    score: { type: Number, min: 0, max: 1 },
    issues: [String],
    recommendations: [String]
  },

  // Card type classification
  cardType: { type: String, enum: ['psa', 'english', 'japanese', 'generic', 'unknown'] },

  // Batch processing info
  batchId: String,
  batchIndex: Number
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for efficient querying
ocrResultSchema.index({ imageHash: 1 }, { unique: true });
ocrResultSchema.index({ processedAt: -1 });
ocrResultSchema.index({ ocrProvider: 1, processedAt: -1 });
ocrResultSchema.index({ cardType: 1, processedAt: -1 });
ocrResultSchema.index({ batchId: 1, batchIndex: 1 });
ocrResultSchema.index({ sessionId: 1 });
ocrResultSchema.index({ 'textQuality.score': -1 });

// Text search index for full-text search
ocrResultSchema.index(
  {
    fullText: 'text',
    originalFileName: 'text'
  },
  {
    weights: {
      fullText: 10,
      originalFileName: 5
    },
    name: 'ocr_text_search'
  }
);

// Compound indexes for common query patterns
ocrResultSchema.index({ cardType: 1, 'textQuality.score': -1, processedAt: -1 });
ocrResultSchema.index({ ocrProvider: 1, confidence: -1, processedAt: -1 });

// Pre-save middleware for data validation
ocrResultSchema.pre('save', function (next) {
  try {
    // Validate confidence score
    if (this.confidence && (this.confidence < 0 || this.confidence > 1)) {
      throw new Error('Confidence must be between 0 and 1');
    }

    // Ensure fullText is not empty
    if (!this.fullText || this.fullText.trim().length === 0) {
      throw new Error('fullText cannot be empty');
    }

    // Set default card type if not provided
    if (!this.cardType) {
      this.cardType = 'unknown';
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
ocrResultSchema.methods.getTextSummary = function (maxLength = 100) {
  if (!this.fullText) return '';
  return this.fullText.length > maxLength
    ? `${this.fullText.substring(0, maxLength)}...`
    : this.fullText;
};

ocrResultSchema.methods.getHighConfidenceAnnotations = function (threshold = 0.8) {
  return this.textAnnotations.filter(annotation =>
    annotation.confidence && annotation.confidence >= threshold
  );
};

// Static methods
ocrResultSchema.statics.findByImageHash = function (hash) {
  return this.findOne({ imageHash: hash });
};

ocrResultSchema.statics.findByCardType = function (cardType, limit = 50) {
  return this.find({ cardType })
    .sort({ processedAt: -1 })
    .limit(limit);
};

ocrResultSchema.statics.searchText = function (searchTerm, limit = 20) {
  return this.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: 'textScore' } }
  )
  .sort({ score: { $meta: 'textScore' }, processedAt: -1 })
  .limit(limit);
};

ocrResultSchema.statics.getBatchResults = function (batchId) {
  return this.find({ batchId })
    .sort({ batchIndex: 1 });
};

ocrResultSchema.statics.getProcessingStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: '$ocrProvider',
        count: { $sum: 1 },
        avgConfidence: { $avg: '$confidence' },
        avgProcessingTime: { $avg: '$processingTime' },
        avgTextLength: { $avg: { $strLenCP: '$fullText' } }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Apply query optimization plugin
ocrResultSchema.plugin(queryOptimizationPlugin, {
  entityType: 'OcrResult',
  enableLeanQueries: true,
  enableQueryLogging: process.env.NODE_ENV === 'development',
  enablePerformanceTracking: true,
  enableAutomaticIndexing: false, // We manage indexes manually
  defaultLimit: 50,
  maxLimit: 1000,
  enableCachedCounts: true
});

const OcrResult = mongoose.model('OcrResult', ocrResultSchema);

export default OcrResult;
