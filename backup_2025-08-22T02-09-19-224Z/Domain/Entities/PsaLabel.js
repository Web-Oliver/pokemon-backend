import mongoose from 'mongoose';
const { Schema } = mongoose;
import { queryOptimizationPlugin   } from '@/Infrastructure/Plugins/queryOptimization.js';
const psaLabelSchema = new mongoose.Schema({
  // Image information
  labelImage: { type: String, required: true }, // Path to the PSA label image
  imageHash: { type: String, required: true }, // Unique hash of the image
  originalFileName: String,

  // Extracted OCR text from Google Vision API (populated after stitching)
  ocrText: { type: String, required: false }, // Raw text from Google Vision (assigned after OCR)
  ocrConfidence: { type: Number, min: 0, max: 1 }, // Google Vision confidence score

  // Structured OCR data from Google Vision API
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

  // Processing metadata
  processingTime: Number, // milliseconds
  processedAt: { type: Date, default: Date.now },
  ocrProvider: { type: String, default: 'google-vision' },

  // Parsed PSA label information (extracted from OCR text)
  psaData: {
    certificationNumber: String,
    year: String,
    totalTextFields: Number,
    // Dynamic text fields (text1, text2, text3, etc) stored as flexible object
    dynamicFields: Schema.Types.Mixed
  },

  // Matching results
  matchedCard: { type: Schema.Types.ObjectId, ref: 'Card' },
  matchConfidence: { type: Number, min: 0, max: 1 },
  matchingAlgorithm: { type: String, enum: ['smart-psa', 'levenshtein', 'phonetic', 'manual'] },

  // Quality assessment
  ocrQuality: {
    score: { type: Number, min: 0, max: 1 },
    issues: [String], // e.g., ['low_contrast', 'blurry', 'partial_text']
    recommendations: [String]
  },

  // User interaction
  userVerified: { type: Boolean, default: false },
  userCorrections: String, // Manual corrections by user

  // Batch processing info
  batchId: String,
  batchIndex: Number
}, {
  timestamps: true,
  versionKey: false,
  toJSON: { virtuals: true }
});

// Indexes for efficient querying
psaLabelSchema.index({ imageHash: 1 }, { unique: true });
psaLabelSchema.index({ processedAt: -1 });
psaLabelSchema.index({ 'psaData.certificationNumber': 1 });
psaLabelSchema.index({ 'psaData.grade': 1 });
psaLabelSchema.index({ matchedCard: 1 });
psaLabelSchema.index({ batchId: 1, batchIndex: 1 });

// Text search index for OCR text
psaLabelSchema.index(
  {
    ocrText: 'text',
    'psaData.cardName': 'text',
    'psaData.setName': 'text'
  },
  {
    weights: {
      ocrText: 10,
      'psaData.cardName': 8,
      'psaData.setName': 6
    },
    name: 'psa_label_text_search'
  }
);

// Compound indexes for common queries
psaLabelSchema.index({ 'psaData.grade': 1, matchConfidence: -1, processedAt: -1 });
psaLabelSchema.index({ matchedCard: 1, userVerified: 1 });

// Pre-save validation
psaLabelSchema.pre('save', function (next) {
  try {
    // OCR text is optional during initial creation (populated after stitching OCR)
    if (this.ocrText && this.ocrText.trim().length === 0) {
      this.ocrText = undefined; // Remove empty string
    }

    if (!this.labelImage) {
      throw new Error('labelImage path is required');
    }

    // Validate confidence scores
    if (this.ocrConfidence && (this.ocrConfidence < 0 || this.ocrConfidence > 1)) {
      throw new Error('ocrConfidence must be between 0 and 1');
    }

    if (this.matchConfidence && (this.matchConfidence < 0 || this.matchConfidence > 1)) {
      throw new Error('matchConfidence must be between 0 and 1');
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
psaLabelSchema.methods.getOcrSummary = function (maxLength = 100) {
  if (!this.ocrText) return '';
  return this.ocrText.length > maxLength
    ? `${this.ocrText.substring(0, maxLength)}...`
    : this.ocrText;
};

psaLabelSchema.methods.isPsaDataComplete = function () {
  const required = ['certificationNumber', 'grade', 'cardName'];

  return required.every(field => this.psaData && this.psaData[field]);
};

psaLabelSchema.methods.getHighConfidenceAnnotations = function (threshold = 0.8) {
  return this.textAnnotations.filter(annotation =>
    annotation.confidence && annotation.confidence >= threshold
  );
};

// Virtual fields
psaLabelSchema.virtual('fullCardImageUrl').get(function () {
  return `/api/ocr/psa-label/${this._id}/image`;
});

// Static methods
psaLabelSchema.statics.findByImageHash = function (hash) {
  return this.findOne({ imageHash: hash });
};

psaLabelSchema.statics.findByCertNumber = function (certNumber) {
  return this.findOne({ 'psaData.certificationNumber': certNumber });
};

psaLabelSchema.statics.searchOcrText = function (searchTerm, limit = 20) {
  return this.find(
    { $text: { $search: searchTerm } },
    { score: { $meta: 'textScore' } }
  )
  .sort({ score: { $meta: 'textScore' }, processedAt: -1 })
  .limit(limit);
};

psaLabelSchema.statics.findUnmatched = function (limit = 50) {
  return this.find({ matchedCard: { $exists: false } })
    .sort({ processedAt: -1 })
    .limit(limit);
};

psaLabelSchema.statics.findByGrade = function (grade, limit = 50) {
  return this.find({ 'psaData.grade': grade })
    .sort({ processedAt: -1 })
    .limit(limit);
};

psaLabelSchema.statics.getBatchLabels = function (batchId) {
  return this.find({ batchId })
    .sort({ batchIndex: 1 });
};

// Apply query optimization plugin
psaLabelSchema.plugin(queryOptimizationPlugin, {
  entityType: 'PsaLabel',
  enableLeanQueries: true,
  enableQueryLogging: process.env.NODE_ENV === 'development',
  enablePerformanceTracking: true,
  defaultLimit: 50,
  maxLimit: 500
});

const PsaLabel = mongoose.model('PsaLabel', psaLabelSchema);

export default PsaLabel;
