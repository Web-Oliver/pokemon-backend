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

    // Batch processing
    batchId: { type: String, required: false }, // For tracking batch operations

    // Processing status
    processingStatus: {
        type: String,
        enum: ['stitched', 'ocr_complete', 'matched'],
        default: 'stitched'
    },

    // OCR results (when processed)
    ocrText: String,
    ocrConfidence: { type: Number, min: 0, max: 1 },

    // Enhanced structured OCR annotations
    ocrAnnotations: [{
        description: { type: String }, // Google Vision returns 'description' not 'text'
        text: { type: String }, // Keep for backwards compatibility
        confidence: { type: Number, min: 0, max: 1 },
        boundingPoly: {
            vertices: [{ x: Number, y: Number }]
        },
        centerY: Number,
        assignmentConfidence: Number, // Confidence for text-to-label mapping
        labelIndex: Number // Which label this annotation belongs to
    }],

    // Processing metadata
    distributionMetrics: {
        totalAnnotations: Number,
        distributedAnnotations: Number,
        distributionRate: Number,
        averageAssignmentConfidence: Number,
        processingTime: Number
    },

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
stitchedLabelSchema.index({ batchId: 1 });
stitchedLabelSchema.index({ batchId: 1, processingStatus: 1 });

// Performance indexes for OCR operations
stitchedLabelSchema.index({ 'ocrAnnotations.text': 'text' }); // Full-text search
stitchedLabelSchema.index({ ocrConfidence: -1 }); // Quality sorting
stitchedLabelSchema.index({ 'processingStatus': 1, 'createdAt': -1 }); // Workflow queries
stitchedLabelSchema.index({ gradedCardScanIds: 1 }); // Batch lookups

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
    this.processingStatus = 'ocr_complete';
    return this.save();
};

// Distribution doesn't change processing status - removed markDistributed method

stitchedLabelSchema.methods.markMatched = function () {
    this.processingStatus = 'matched';
    return this.save();
};

const StitchedLabel = mongoose.model('StitchedLabel', stitchedLabelSchema);

export default StitchedLabel;
