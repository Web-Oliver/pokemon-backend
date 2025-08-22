/**
 * OCR Vision Processing Routes
 *
 * Single Responsibility: Google Vision API integration and image processing
 * Handles vision API calls, batch processing, and stitched label optimization
 */

import express from 'express';
import crypto from 'crypto';
const router = express.Router();
import googleVisionService from '@/Infrastructure/ExternalServices/Google/googleVisionService.js';
import psaLabelService from '@/core/services/psaLabelService.js';
import stitchedLabelService from '@/core/services/stitchedLabelService.js';
import { asyncHandler, ValidationError   } from '@/Presentation/Middleware/errorHandler.js';
import { validationResult, body   } from 'express-validator';
import multer from 'multer';
/**
 * Helper function to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.error('[OCR Vision] Request failed validation:', {
      body: req.body,
      errors: errors.array()
    });
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

/**
 * GET /api/ocr/status
 * Get OCR system status and configuration
 */
router.get('/status', asyncHandler(async (req, res) => {
  const visionStatus = googleVisionService.getStatus();

  res.json({
    success: true,
    data: {
      googleVision: visionStatus,
      ocrService: {
        initialized: true,
        cardDetectionEnabled: true,
        batchProcessingEnabled: true
      },
      endpoints: {
        vision: '/api/ocr/vision',
        detectCard: '/api/ocr/detect-card',
        batchDetect: '/api/ocr/batch-detect',
        validateText: '/api/ocr/validate-text'
      }
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }
  });
}));

/**
 * POST /api/ocr/vision
 * Process image with Google Vision API
 */
router.post('/vision',
  [
    body('image')
      .isString()
      .withMessage('Base64 image data is required'),
    body('features')
      .optional()
      .isArray()
      .withMessage('Features must be an array'),
    body('imageContext')
      .optional()
      .isObject()
      .withMessage('Image context must be an object')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { image, features = ['TEXT_DETECTION'], imageContext = {} } = req.body;
    const startTime = Date.now();

    try {
      console.log('[OCR Vision] Processing image with Google Vision API');

      // Use real Google Vision API
      const ocrResult = await googleVisionService.extractText(image, {
        languageHints: imageContext.languageHints || ['en', 'ja']
      });

      // Format response to match expected structure
      const response = {
        responses: [{
          fullTextAnnotation: {
            text: ocrResult.text,
            pages: ocrResult.pages || [{
              confidence: ocrResult.confidence
            }]
          },
          textAnnotations: ocrResult.textAnnotations || []
        }]
      };

      console.log(`[OCR Vision] Processed successfully in ${Date.now() - startTime}ms`);
      console.log(`[OCR Vision] Extracted text length: ${ocrResult.text.length} characters`);

      // Check if this looks like a PSA label and save it
      let psaLabel = null;

      if (ocrResult.text && (
        ocrResult.text.toLowerCase().includes('psa') ||
        ocrResult.text.toLowerCase().includes('professional sports authenticator') ||
        (/\b\d{8,10}\b/).test(ocrResult.text) // Contains 8-10 digit cert number
      )) {
        try {
          console.log('[OCR Vision] Detected PSA label, saving OCR text...');

          // Create PSA label record with OCR data
          const psaLabelData = {
            labelImage: `temp_${Date.now()}.jpg`, // Placeholder - would need actual image
            ocrText: ocrResult.text,
            ocrConfidence: ocrResult.confidence,
            textAnnotations: ocrResult.textAnnotations || [],
            processingTime: Date.now() - startTime,
            imageHash: crypto.createHash('sha256').update(image).digest('hex')
          };

          psaLabel = await psaLabelService.createPsaLabel(psaLabelData);
          console.log(`[OCR Vision] PSA label saved: ${psaLabel._id}`);
        } catch (saveError) {
          console.warn('[OCR Vision] Failed to save PSA label:', saveError.message);
          // Continue processing even if save fails
        }
      }

      res.json({
        success: true,
        data: response,
        psaLabel: psaLabel ? {
          id: psaLabel._id,
          saved: true,
          psaData: psaLabel.psaData
        } : null,
        meta: {
          features,
          imageContext,
          processingTime: Date.now() - startTime,
          visionApiAvailable: googleVisionService.isAvailable(),
          textLength: ocrResult.text.length,
          confidence: ocrResult.confidence,
          isPsaLabel: Boolean(psaLabel)
        }
      });

    } catch (error) {
      console.error('[OCR Vision] Processing failed:', error.message);
      throw error;
    }
  })
);

/**
 * POST /api/ocr/advanced
 * Advanced OCR endpoint with enhanced options
 */
router.post('/advanced',
  [
    body('image')
      .isString()
      .withMessage('Base64 image data is required'),
    body('options')
      .optional()
      .isObject()
      .withMessage('Options must be an object')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { image, options = {} } = req.body;
    const startTime = Date.now();

    try {
      console.log('[OCR Advanced] Processing with advanced options:', options);

      const ocrResult = await googleVisionService.extractText(image, {
        languageHints: options.languageHints || ['en', 'ja'],
        maxResults: options.maxResults || 50,
        computeStyleInfo: options.computeStyleInfo || false
      });

      console.log(`[OCR Advanced] Advanced processing completed in ${Date.now() - startTime}ms`);

      res.json({
        success: true,
        data: {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          textAnnotations: ocrResult.textAnnotations || [],
          advanced: true,
          processingTime: ocrResult.processingTime || (Date.now() - startTime)
        },
        meta: {
          advancedProcessing: true,
          options,
          visionApiAvailable: googleVisionService.isAvailable(),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[OCR Advanced] Advanced processing failed:', error.message);
      res.status(500).json({
        success: false,
        error: 'Advanced OCR processing failed',
        details: error.message,
        meta: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

/**
 * POST /api/ocr/async
 * Async OCR endpoint for concurrent processing
 */
router.post('/async',
  [
    body('image')
      .isString()
      .withMessage('Base64 image data is required'),
    body('options')
      .optional()
      .isObject()
      .withMessage('Options must be an object')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { image, options = {} } = req.body;
    const startTime = Date.now();

    try {
      console.log('[OCR Async] Processing with async client');

      const ocrResult = await googleVisionService.extractTextAsync(image, {
        languageHints: options.languageHints || ['en', 'ja']
      });

      console.log(`[OCR Async] Async processing completed in ${Date.now() - startTime}ms`);

      res.json({
        success: true,
        data: {
          text: ocrResult.text,
          confidence: ocrResult.confidence,
          textAnnotations: ocrResult.textAnnotations || [],
          async: true,
          processingTime: ocrResult.processingTime || (Date.now() - startTime)
        },
        meta: {
          asyncProcessing: true,
          options,
          visionApiAvailable: googleVisionService.isAvailable(),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[OCR Async] Async processing failed:', error.message);
      res.status(500).json({
        success: false,
        error: 'Async OCR processing failed',
        details: error.message,
        meta: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

// Add multer configuration for stitched label integration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 50 // Maximum 50 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * POST /api/ocr/batch-stitched
 * Process multiple PSA labels using stitched label optimization
 * This provides significant cost savings by stitching labels together before OCR
 */
router.post('/batch-stitched',
  upload.array('images', 50),
  [
    body('enableStitching')
      .optional()
      .isBoolean()
      .withMessage('enableStitching must be a boolean'),
    body('batchId')
      .optional()
      .isString()
      .withMessage('batchId must be a string'),
    body('stitchingOptions.labelWidth')
      .optional()
      .isInt({ min: 100, max: 1000 })
      .withMessage('labelWidth must be between 100 and 1000'),
    body('stitchingOptions.labelHeight')
      .optional()
      .isInt({ min: 100, max: 1500 })
      .withMessage('labelHeight must be between 100 and 1500')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const images = req.files || [];
    const {
      enableStitching = true,
      batchId,
      stitchingOptions = {}
    } = req.body;
    const startTime = Date.now();

    if (!images || images.length === 0) {
      throw new ValidationError('At least one image is required');
    }

    if (images.length > 50) {
      throw new ValidationError('Maximum 50 images allowed per batch');
    }

    try {
      console.log(`[OCR Batch Stitched] Processing ${images.length} images with stitching: ${enableStitching}`);

      let results = [];
      let stitchedLabel = null;
      let costSavings = null;

      if (enableStitching && images.length > 1) {
        // Use stitched label processing for cost optimization
        console.log('[OCR Batch Stitched] Creating stitched label for batch processing');

        const options = {
          batchId: batchId || `ocr_batch_${Date.now()}`,
          ...stitchingOptions
        };

        // Create and process stitched label
        stitchedLabel = await stitchedLabelService.createAndProcessStitchedLabel(images, options);

        // Extract results from individual PSA labels
        await stitchedLabel.populate('psaLabels');

        results = stitchedLabel.psaLabels.map((psaLabel, index) => ({
          text: psaLabel.ocrText,
          confidence: psaLabel.ocrConfidence,
          textAnnotations: psaLabel.textAnnotations,
          psaData: psaLabel.psaData,
          psaLabelId: psaLabel._id,
          batchIndex: index
        }));

        costSavings = stitchedLabel.costSavings;

        console.log(`[OCR Batch Stitched] Stitched processing completed: ${results.length} labels processed`);

      } else {
        // Process individually if stitching disabled or single image
        console.log('[OCR Batch Stitched] Processing images individually');

        const individualResults = await Promise.all(
          images.map(async (image, index) => {
            try {
              // Process with PSA label service to save OCR text
              const psaLabel = await psaLabelService.processImageAndCreateLabel(image, {
                batchId: batchId || `ocr_individual_${Date.now()}`,
                batchIndex: index
              });

              return {
                text: psaLabel.ocrText,
                confidence: psaLabel.ocrConfidence,
                textAnnotations: psaLabel.textAnnotations,
                psaData: psaLabel.psaData,
                psaLabelId: psaLabel._id,
                batchIndex: index
              };
            } catch (error) {
              console.error(`[OCR Batch Stitched] Error processing image ${index}:`, error);
              return {
                text: '',
                confidence: 0,
                error: error.message,
                batchIndex: index
              };
            }
          })
        );

        results = individualResults;
      }

      const successfulResults = results.filter(r => r.text && r.text.length > 0);
      const totalProcessingTime = Date.now() - startTime;

      // Prepare response
      const response = {
        success: true,
        data: {
          results,
          stitchedLabel: stitchedLabel ? {
            id: stitchedLabel._id,
            batchId: stitchedLabel.batchId,
            status: stitchedLabel.status,
            stitchedImage: stitchedLabel.stitchedImage
          } : null,
          summary: {
            totalImages: images.length,
            successfulImages: successfulResults.length,
            failedImages: images.length - successfulResults.length,
            averageConfidence: successfulResults.length > 0
              ? successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length
              : 0,
            totalCharactersExtracted: successfulResults.reduce((sum, r) => sum + r.text.length, 0),
            psaLabelsCreated: results.filter(r => r.psaLabelId).length
          },
          costSavings
        },
        meta: {
          batchProcessing: true,
          stitchingEnabled: enableStitching && images.length > 1,
          processingMethod: stitchedLabel ? 'stitched' : 'individual',
          processingTime: totalProcessingTime,
          averageTimePerImage: totalProcessingTime / images.length,
          visionApiAvailable: googleVisionService.isAvailable(),
          timestamp: new Date().toISOString()
        }
      };

      console.log('[OCR Batch Stitched] Batch processing completed successfully');
      res.json(response);

    } catch (error) {
      console.error('[OCR Batch Stitched] Batch stitched processing failed:', error);
      res.status(500).json({
        success: false,
        error: 'Batch stitched OCR processing failed',
        details: error.message,
        meta: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

/**
 * POST /api/ocr/batch
 * Deprecated batch OCR processing endpoint
 * Throws deprecation warning for multiple API call approach
 */
router.post('/batch',
  [
    body('images')
      .isArray()
      .withMessage('Images array is required')
      .custom((images) => {
        if (images.length === 0) {
          throw new Error('At least one image is required');
        }
        if (images.length > 50) {
          throw new Error('Maximum 50 images allowed per batch');
        }
        return true;
      }),
    body('options')
      .optional()
      .isObject()
      .withMessage('Options must be an object')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { images, options = {} } = req.body;
    const startTime = Date.now();

    try {
      console.log(`[OCR Batch] Processing ${images.length} images in batch mode`);

      // 🚨 DEPRECATED: batchExtractText makes multiple API calls
      // For true single API call, use stitched image approach instead
      throw new Error('🚨 DEPRECATED: /api/ocr/batch endpoint makes multiple API calls. Use /api/ocr/batch-stitched for single API call approach.');

    } catch (error) {
      console.error('[OCR Batch] Batch processing failed:', error.message);
      res.status(500).json({
        success: false,
        error: 'Batch OCR processing failed',
        details: error.message,
        meta: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }
  })
);

export default router;
