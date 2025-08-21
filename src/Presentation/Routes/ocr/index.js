/**
 * OCR Routes Main Router
 *
 * Single Responsibility: Route orchestration and common middleware
 * Combines focused route modules while maintaining backward compatibility
 */

import express from 'express';
const router = express.Router();

// Import focused route modules
import coreDetectionRoutes from './core-detection.js';
import visionProcessingRoutes from './vision-processing.js';
import cardMatchingRoutes from './card-matching.js';
/**
 * Global OCR middleware for logging and performance tracking
 */
router.use((req, res, next) => {
  const startTime = Date.now();

  // Add processing time to response locals
  res.locals.processingTime = 0;

  // Override res.json to add processing time
  const originalJson = res.json;

  res.json = function (data) {
    res.locals.processingTime = Date.now() - startTime;

    // Add processing time to meta if it exists
    if (data && typeof data === 'object' && data.meta) {
      data.meta.processingTime = res.locals.processingTime;
    }

    return originalJson.call(this, data);
  };

  console.log(`[OCR Routes] ${req.method} ${req.path} - Request started`);

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    console.log(`[OCR Routes] ${req.method} ${req.path} - Completed in ${duration}ms`);
  });

  next();
});

/**
 * Route module delegation
 * Each module handles its specific responsibility
 */

// Core detection routes: /api/ocr/detect-*, /api/ocr/validate-*, /api/ocr/detection-stats
router.use('/', coreDetectionRoutes);

// Vision processing routes: /api/ocr/vision, /api/ocr/advanced, /api/ocr/async, /api/ocr/batch-*
router.use('/', visionProcessingRoutes);

// Card matching routes: /api/ocr/match, /api/ocr/search/*, /api/ocr/approve, /api/ocr/psa-*
router.use('/', cardMatchingRoutes);

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'OCR Routes',
    modules: {
      coreDetection: 'loaded',
      visionProcessing: 'loaded',
      cardMatching: 'loaded'
    },
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

/**
 * API documentation endpoint
 */
router.get('/docs', (req, res) => {
  res.json({
    success: true,
    documentation: {
      overview: 'OCR API endpoints split into focused modules for SOLID compliance',
      modules: {
        coreDetection: {
          description: 'Basic OCR detection and validation',
          endpoints: [
            'POST /detect-card',
            'POST /batch-detect',
            'GET /card-suggestions/:cardId',
            'POST /validate-text',
            'GET /detection-stats'
          ]
        },
        visionProcessing: {
          description: 'Google Vision API integration and image processing',
          endpoints: [
            'GET /status',
            'POST /vision',
            'POST /advanced',
            'POST /async',
            'POST /batch-stitched',
            'POST /batch (deprecated)'
          ]
        },
        cardMatching: {
          description: 'Card database matching and collection management',
          endpoints: [
            'POST /match',
            'POST /batch-match',
            'GET /process-all-psa-labels',
            'GET /search/sets',
            'GET /search/cards',
            'POST /approve',
            'POST /edit-extract',
            'POST /find-psa-image',
            'DELETE /delete-psa-label/:id',
            'GET /matching-stats',
            'GET /psa-label/:id/image',
            'GET /psa-labels',
            'POST /create-collection-item'
          ]
        }
      },
      architecture: {
        principles: 'SOLID - Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion',
        benefits: 'Improved maintainability, testability, and scalability through focused modules',
        backwardCompatibility: 'All existing endpoints maintained with identical behavior'
      }
    },
    meta: {
      totalEndpoints: 23,
      modules: 3,
      timestamp: new Date().toISOString()
    }
  });
});

export default router;
