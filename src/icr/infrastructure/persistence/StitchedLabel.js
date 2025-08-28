/**
 * Stitched Label Model - For Combined Label Processing
 *
 * Stores stitched images created from multiple extracted labels
 * with duplicate detection and OCR processing tracking
 */

import mongoose from 'mongoose';
const { Schema } = mongoose;

const stitchedLabelSchema = new mongoose.Schema({
  // Image information
  stitchedImagePath: { type: String, required: true },
  stitchedImageHash: { type: String, required: true, unique: true },
  stitchedImageDimensions: {
    width: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  labelPositions: [{
    index: { type: Number, required: true },
    y: { type: Number, required: true },
    height: { type: Number, required: true }
  }],

  labelHashes: [{ type: String, required: true }],
  labelCount: { type: Number, required: true },

  // Processing status
  processingStatus: {
    type: String,
    enum: ['stitched', 'ocr_pending', 'ocr_completed', 'distributed', 'matched'],
    default: 'stitched'
  },

  // OCR results (when processed)
  ocrText: String,
  ocrConfidence: { type: Number, min: 0, max: 1 },
  ocrAnnotations: Schema.Types.Mixed,

  // Relationships
  gradedCardScanIds: [{ type: Schema.Types.ObjectId, ref: 'GradedCardScan' }]
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
stitchedLabelSchema.index({ stitchedImageHash: 1 }, { unique: true });
stitchedLabelSchema.index({ processingStatus: 1 });
stitchedLabelSchema.index({ labelHashes: 1 });

// Static methods

stitchedLabelSchema.statics.findByHash = function (stitchedImageHash) {
  return this.findOne({ stitchedImageHash });
};

stitchedLabelSchema.statics.findByLabelHashes = function (labelHashes) {
  return this.findOne({
    labelHashes: { $all: labelHashes },
    $expr: { $eq: [{ $size: '$labelHashes' }, labelHashes.length] }
  });
};

// Instance methods
stitchedLabelSchema.methods.updateOcrResults = function (ocrText, ocrConfidence, ocrAnnotations) {
  this.ocrText = ocrText;
  this.ocrConfidence = ocrConfidence;
  this.ocrAnnotations = ocrAnnotations;
  this.processingStatus = 'ocr_completed';
  return this.save();
};

stitchedLabelSchema.methods.markDistributed = function () {
  this.processingStatus = 'distributed';
  return this.save();
};

stitchedLabelSchema.methods.markMatched = function () {
  this.processingStatus = 'matched';
  return this.save();
};

const StitchedLabel = mongoose.model('StitchedLabel', stitchedLabelSchema);

export default StitchedLabel;
