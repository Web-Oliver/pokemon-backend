/**
 * Graded Card Scan Model - CLEAN ICR IMPLEMENTATION
 *
 * Only essential functionality for graded card scanning and OCR processing.
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

const gradedCardScanSchema = new mongoose.Schema({
  // Image information
  fullImage: { type: String, required: true }, // Path to full graded card image
  labelImage: { type: String }, // Path to extracted label image (populated after extraction)
  imageHash: { type: String, required: true, unique: true },
  originalFileName: String,

  // Batch processing
  batchId: { type: String, required: false }, // For tracking batch operations

  // OCR results
  ocrText: String,
  ocrConfidence: { type: Number, min: 0, max: 1 },

  // NEW: Preserve annotation segments with bounding boxes
  ocrAnnotations: [{
    text: String,
    confidence: { type: Number, min: 0, max: 1 },
    boundingBox: {
      vertices: [{ x: Number, y: Number }]
    },
    centerY: Number
  }],

  // Extracted PSA data from OCR parsing
  extractedData: {
    certificationNumber: String,
    grade: Number,
    year: Number,
    cardName: String,
    setName: String,
    language: String,
    possibleCardNumbers: [String],
    possiblePokemonNames: [String],
    modifiers: [String]
  },

  // Card matching results - ALL candidates with scores
  cardMatches: [{
    cardId: { type: Schema.Types.ObjectId, ref: 'Card' },
    cardName: String,
    cardNumber: String,
    setId: { type: Schema.Types.ObjectId, ref: 'Set' },
    setName: String,
    year: Number,
    confidence: { type: Number, min: 0, max: 1 },
    scores: {
      yearMatch: Number,
      pokemonMatch: Number,
      cardNumberMatch: Number,
      modifierMatch: Number,
      setVerification: Number
    }
  }],

  userSelectedMatch: { type: Schema.Types.ObjectId, ref: 'Card' },

  // Matching status tracking
  matchingStatus: {
    type: String,
    enum: ['pending', 'auto_matched', 'manual_override', 'no_match', 'confirmed', 'psa_created'],
    default: 'pending'
  },

  // Processing status (ICR pipeline steps) - NO ENUM VALIDATION
  processingStatus: {
    type: String,
    default: 'pending'
  },

  // Stitched image position
  stitchedPosition: {
    y: Number,
    height: Number,
    index: Number
  },


  // User verification
  userVerified: { type: Boolean, default: false },
  userDenied: { type: Boolean, default: false },

  processedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  versionKey: false
});;

// Essential indexes only
gradedCardScanSchema.index({ imageHash: 1 }, { unique: true });
gradedCardScanSchema.index({ processingStatus: 1 });
gradedCardScanSchema.index({ batchId: 1 });
gradedCardScanSchema.index({ batchId: 1, processingStatus: 1 });

// Essential static methods only

gradedCardScanSchema.statics.findByHash = function (imageHash) {
  return this.findOne({ imageHash });
};

// Essential instance methods only
gradedCardScanSchema.methods.approve = function () {
  this.userVerified = true;
  this.userDenied = false;
  this.processingStatus = 'approved';
  return this.save();
};

gradedCardScanSchema.methods.deny = function () {
  this.userVerified = false;
  this.userDenied = true;
  this.processingStatus = 'denied';
  return this.save();
};

// Card matching methods
gradedCardScanSchema.methods.selectMatch = function (cardId) {
  this.userSelectedMatch = cardId;
  this.matchingStatus = 'manual_override';
  return this.save();
};

gradedCardScanSchema.methods.confirmMatch = function () {
  this.matchingStatus = 'confirmed';
  return this.save();
};

gradedCardScanSchema.methods.markPsaCreated = function () {
  this.matchingStatus = 'psa_created';
  return this.save();
};

gradedCardScanSchema.methods.getBestMatch = function () {
  return this.userSelectedMatch;
};

const GradedCardScan = mongoose.model('GradedCardScan', gradedCardScanSchema);

export default GradedCardScan;
