/**
 * NEW OCR Routes - Modern Architecture
 * 
 * SINGLE RESPONSIBILITY: Define OCR HTTP routes
 * NO OTHER RESPONSIBILITIES: business logic (delegated to controller)
 * 
 * Uses new OcrController with dependency injection
 */

import express from 'express';
import ocrController from '@/Presentation/Controllers/ocr/OcrController.js';
import multer from 'multer';

const router = express.Router();

// Configure multer for image uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * POST /api/ocr/match
 * Match OCR text against card database with confidence scores
 */
router.post('/match', ocrController.matchOcrText);

/**
 * POST /api/ocr/batch-match  
 * Match multiple OCR texts in a single request
 */
router.post('/batch-match', ocrController.batchMatchOcrText);

/**
 * POST /api/ocr/process-image
 * Extract text from image and match against database
 */
router.post('/process-image', upload.single('image'), ocrController.processOcrImage);

/**
 * GET /api/ocr/service-info
 * Get service registration info for debugging
 */
router.get('/service-info', ocrController.getServiceInfo);

/**
 * Route documentation for OpenAPI/Swagger
 */
export const ocrRouteDocumentation = {
  '/api/ocr/match': {
    post: {
      summary: 'Match OCR text against card database',
      description: 'Processes OCR text and finds matching cards with confidence scores',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['ocrText'],
              properties: {
                ocrText: {
                  type: 'string',
                  description: 'OCR text to process'
                },
                options: {
                  type: 'object',
                  properties: {
                    limit: { type: 'number', default: 10 },
                    threshold: { type: 'number', default: 0.1 },
                    strategy: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'OCR processing successful',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    properties: {
                      matches: { type: 'array' },
                      extractedData: { type: 'object' },
                      confidence: { type: 'number' },
                      strategies: { type: 'array' },
                      totalCandidates: { type: 'number' }
                    }
                  },
                  meta: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  }
};

export default router;