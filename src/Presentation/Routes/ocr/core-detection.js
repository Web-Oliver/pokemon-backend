/**
 * OCR Core Detection Routes
 *
 * Single Responsibility: Basic OCR detection, validation, and card matching
 * Handles fundamental OCR operations without advanced features
 */

import express from 'express';
const router = express.Router();
import OcrCardDetectionService from '@/Application/UseCases/Matching/UnifiedOcrMatchingService.js';
import { asyncHandler, ValidationError, NotFoundError   } from '@/Infrastructure/Utilities/errorHandler.js';
import { validationResult, body, param   } from 'express-validator';
import Card from '@/Domain/Entities/Card.js';
// Initialize service instance
const ocrService = new OcrCardDetectionService();

/**
 * Validation middleware for OCR detection requests
 */
const validateOcrDetection = [
  body('ocrResult')
    .isObject()
    .withMessage('ocrResult must be an object'),
  body('ocrResult.text')
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage('OCR text must be a string between 1 and 10000 characters'),
  body('ocrResult.confidence')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Confidence must be a number between 0 and 1'),
  body('cardType')
    .optional()
    .isIn(['psa-label', 'english-pokemon', 'japanese-pokemon', 'generic'])
    .withMessage('Invalid card type')
];

/**
 * Validation middleware for batch detection requests
 */
const validateBatchDetection = [
  body('ocrResults')
    .isArray({ min: 1, max: 50 })
    .withMessage('ocrResults must be an array with 1-50 items'),
  body('ocrResults.*.text')
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage('Each OCR text must be a string between 1 and 10000 characters'),
  body('ocrResults.*.confidence')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('Confidence must be a number between 0 and 1'),
  body('ocrResults.*.cardType')
    .optional()
    .isIn(['psa-label', 'english-pokemon', 'japanese-pokemon', 'generic'])
    .withMessage('Invalid card type')
];

/**
 * Helper function to handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.error('[OCR Core Detection] Request failed validation:', {
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
 * POST /api/ocr/detect-card
 * Detect card from OCR data
 */
router.post('/detect-card',
  validateOcrDetection,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { ocrResult, cardType = 'generic' } = req.body;

    try {
      const detection = await ocrService.detectCardFromOcr({
        text: ocrResult.text,
        cardType,
        confidence: ocrResult.confidence || 0.8
      });

      res.json({
        success: true,
        data: {
          detection,
          suggestions: detection.suggestions,
          extracted: detection.extracted,
          confidence: detection.confidence,
          processingType: detection.type,
          timestamp: new Date().toISOString()
        },
        meta: {
          suggestionsCount: detection.suggestions.length,
          processingTime: res.locals.processingTime || 0
        }
      });

    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }

      throw error;
    }
  })
);

/**
 * POST /api/ocr/batch-detect
 * Batch card detection from multiple OCR results
 */
router.post('/batch-detect',
  validateBatchDetection,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { ocrResults } = req.body;

    try {
      const detections = await ocrService.detectCardsFromOcrBatch(ocrResults);

      const avgConfidence = detections.results.length > 0
        ? detections.results.reduce((sum, d) => sum + (d.confidence || 0), 0) / detections.results.length
        : 0;

      const totalSuggestions = detections.results.reduce((sum, d) => sum + (d.suggestions?.length || 0), 0);

      res.json({
        success: true,
        data: {
          detections: detections.results,
          total: detections.results.length,
          avgConfidence: Math.round(avgConfidence * 100) / 100,
          timestamp: new Date().toISOString()
        },
        meta: {
          requested: ocrResults.length,
          processed: detections.results.length,
          successful: detections.successful,
          totalSuggestions,
          processingTime: res.locals.processingTime || 0
        }
      });

    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }

      throw error;
    }
  })
);

/**
 * GET /api/ocr/card-suggestions/:cardId
 * Get additional suggestions for a specific card
 */
router.get('/card-suggestions/:cardId',
  [
    param('cardId')
      .isMongoId()
      .withMessage('Invalid card ID format')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const { limit = 10 } = req.query;

    // Get the card with populated set information
    const card = await Card.findById(cardId)
      .populate('setId', 'setName year totalCardsInSet')
      .lean();

    if (!card) {
      throw new NotFoundError('Card not found');
    }

    // Create a mock extraction object from the card data
    const mockExtracted = {
      cardName: card.cardName,
      setName: card.setId?.setName,
      year: card.setId?.year,
      cardNumber: card.cardNumber,
      variety: card.variety
    };

    // Use unified OCR service to find similar cards
    const matchResults = await ocrService.matchOcrText(
      `${card.cardName} ${card.cardNumber} ${card.setId?.setName || ''}`,
      { limit: parseInt(limit) + 1 }
    );

    // Filter out the original card and limit results
    const suggestions = matchResults.matches
      .filter(match => match.card._id.toString() !== cardId)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        card,
        suggestions: suggestions.map(s => s.card),
        total: suggestions.length
      },
      meta: {
        originalCard: {
          id: card._id,
          name: card.cardName,
          set: card.setId?.setName,
          year: card.setId?.year
        },
        searchCriteria: mockExtracted
      }
    });
  })
);

/**
 * POST /api/ocr/validate-text
 * Validate OCR text quality and provide suggestions
 */
router.post('/validate-text',
  [
    body('text')
      .isString()
      .isLength({ min: 1, max: 10000 })
      .withMessage('Text must be a string between 1 and 10000 characters')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { text } = req.body;

    // Basic text quality analysis
    const analysis = {
      length: text.length,
      wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
      hasNumbers: (/\d/).test(text),
      hasUppercase: (/[A-Z]/).test(text),
      hasSpecialChars: (/[^a-zA-Z0-9\s]/).test(text),
      potentialCardNames: [],
      potentialYears: [],
      potentialGrades: [],
      quality: 'unknown'
    };

    // Extract potential card names (words starting with uppercase)
    analysis.potentialCardNames = text.match(/\b[A-Z][a-z]+\b/g) || [];

    // Extract potential years (4-digit numbers between 1996-2025)
    const years = text.match(/\b(19|20)\d{2}\b/g) || [];

    analysis.potentialYears = years.filter(year => {
      const y = parseInt(year);

      return y >= 1996 && y <= 2025;
    });

    // Extract potential grades (numbers 1-10)
    analysis.potentialGrades = text.match(/\b([1-9]|10)\b/g) || [];

    // Calculate quality score
    let qualityScore = 0;

    if (analysis.length > 10) qualityScore += 20;
    if (analysis.wordCount > 3) qualityScore += 20;
    if (analysis.hasNumbers) qualityScore += 15;
    if (analysis.hasUppercase) qualityScore += 15;
    if (analysis.potentialCardNames.length > 0) qualityScore += 30;

    if (qualityScore >= 80) analysis.quality = 'excellent';
    else if (qualityScore >= 60) analysis.quality = 'good';
    else if (qualityScore >= 40) analysis.quality = 'fair';
    else analysis.quality = 'poor';

    res.json({
      success: true,
      data: {
        analysis,
        recommendations: generateTextRecommendations(analysis)
      }
    });
  })
);

/**
 * Helper function to generate text improvement recommendations
 */
function generateTextRecommendations(analysis) {
  const recommendations = [];

  if (analysis.length < 10) {
    recommendations.push({
      type: 'warning',
      message: 'Text is very short. Ensure the entire card or label is captured.',
      action: 'retake_photo'
    });
  }

  if (analysis.potentialCardNames.length === 0) {
    recommendations.push({
      type: 'warning',
      message: 'No potential card names detected. Check image clarity and lighting.',
      action: 'improve_quality'
    });
  }

  if (!analysis.hasNumbers) {
    recommendations.push({
      type: 'info',
      message: 'No numbers detected. Card number or year might not be visible.',
      action: 'check_coverage'
    });
  }

  if (analysis.quality === 'poor') {
    recommendations.push({
      type: 'error',
      message: 'Text quality is poor. Consider retaking the photo with better lighting.',
      action: 'retake_photo'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'success',
      message: 'Text quality looks good for card detection.',
      action: 'proceed'
    });
  }

  return recommendations;
}

/**
 * GET /api/ocr/detection-stats
 * Get OCR detection statistics
 */
router.get('/detection-stats', asyncHandler(async (req, res) => {
  const stats = await ocrService.getDetectionStats();

  res.json({
    success: true,
    data: {
      totalDetections: 0, // Would be tracked in production
      avgConfidence: 0.85,
      cardTypeBreakdown: {
        'psa-label': 0,
        'english-pokemon': 0,
        'japanese-pokemon': 0,
        'generic': 0
      },
      topMatchedCards: [],
      recentActivity: [],
      serviceStats: stats
    },
    meta: {
      period: '30days',
      lastUpdated: new Date().toISOString()
    }
  });
}));

export default router;
