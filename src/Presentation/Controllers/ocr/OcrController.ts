/**
 * OCR Controller - NEW ARCHITECTURE
 * 
 * SINGLE RESPONSIBILITY: Handle OCR HTTP requests and responses
 * NO OTHER RESPONSIBILITIES: business logic (delegated to services)
 * 
 * ELIMINATES DUPLICATION: Uses dependency injection instead of direct service instantiation
 */

import { Request, Response } from 'express';
import { asyncHandler } from '@/Infrastructure/Utilities/errorHandler.js';
import { container, ServiceKeys } from '@/Infrastructure/DependencyInjection/ServiceContainer.js';
import { IOcrOrchestrator } from '@/Domain/Interfaces/IOcrServices.js';

/**
 * Modern OCR Controller with Proper Separation
 * 
 * Uses dependency injection - NO MORE service instantiation chaos
 * Single responsibility - ONLY handles HTTP layer
 */
export class OcrController {
  
  /**
   * POST /api/ocr/match
   * Match OCR text against card database
   */
  matchOcrText = asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { ocrText, options = {} } = req.body;

    // Validation
    if (!ocrText || typeof ocrText !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'OCR text is required and must be a string'
      });
    }

    try {
      console.log(`🔍 [OCR-CONTROLLER] Processing OCR text: "${ocrText.substring(0, 50)}..."`);

      // Resolve OCR orchestrator from container (NO direct instantiation)
      const orchestrator = container.resolve<IOcrOrchestrator>(ServiceKeys.OCR_ORCHESTRATOR);
      
      // Delegate to orchestrator (NO business logic in controller)
      const result = await orchestrator.processOcrText(ocrText, options);

      console.log(`✅ [OCR-CONTROLLER] Processing completed in ${Date.now() - startTime}ms`);

      res.json({
        success: result.success,
        data: {
          matches: result.matches,
          extractedData: result.extractedData,
          confidence: result.confidence,
          strategies: result.strategies,
          totalCandidates: result.totalCandidates
        },
        error: result.error,
        meta: {
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error(`❌ [OCR-CONTROLLER] Processing failed after ${Date.now() - startTime}ms:`, error);
      throw error; // Let error handler deal with it
    }
  });

  /**
   * POST /api/ocr/batch-match
   * Match multiple OCR texts in a single request
   */
  batchMatchOcrText = asyncHandler(async (req: Request, res: Response) => {
    const { ocrTexts, options = {} } = req.body;

    if (!Array.isArray(ocrTexts)) {
      return res.status(400).json({
        success: false,
        error: 'ocrTexts must be an array of strings'
      });
    }

    console.log(`📦 [OCR-CONTROLLER] Processing batch: ${ocrTexts.length} texts`);

    try {
      // Resolve orchestrator from container
      const orchestrator = container.resolve<IOcrOrchestrator>(ServiceKeys.OCR_ORCHESTRATOR);
      
      // Delegate batch processing
      const results = await orchestrator.processOcrBatch(ocrTexts, options);

      console.log(`✅ [OCR-CONTROLLER] Batch processing completed`);

      res.json({
        success: true,
        data: {
          results: results.map((result, index) => ({
            index,
            ocrText: ocrTexts[index],
            ...result
          })),
          totalProcessed: results.length,
          successfulMatches: results.filter(r => r.success && r.matches.length > 0).length
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ [OCR-CONTROLLER] Batch processing failed:', error);
      throw error;
    }
  });

  /**
   * POST /api/ocr/process-image
   * Process OCR image (extract text then match)
   */
  processOcrImage = asyncHandler(async (req: Request, res: Response) => {
    const { options = {} } = req.body;

    // Check for image in request
    if (!req.file && !req.body.imageBuffer) {
      return res.status(400).json({
        success: false,
        error: 'Image is required (file upload or imageBuffer)'
      });
    }

    try {
      console.log('🖼️ [OCR-CONTROLLER] Processing OCR image');

      // Get image buffer from file or body
      const imageBuffer = req.file?.buffer || Buffer.from(req.body.imageBuffer, 'base64');

      // Resolve orchestrator from container
      const orchestrator = container.resolve<IOcrOrchestrator>(ServiceKeys.OCR_ORCHESTRATOR);
      
      // Delegate image processing
      const result = await orchestrator.processOcrImage(imageBuffer, options);

      console.log('✅ [OCR-CONTROLLER] Image processing completed');

      res.json({
        success: result.success,
        data: {
          matches: result.matches,
          extractedData: result.extractedData,
          confidence: result.confidence,
          strategies: result.strategies,
          totalCandidates: result.totalCandidates
        },
        error: result.error,
        meta: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ [OCR-CONTROLLER] Image processing failed:', error);
      throw error;
    }
  });

  /**
   * GET /api/ocr/service-info
   * Get service registration info for debugging
   */
  getServiceInfo = asyncHandler(async (req: Request, res: Response) => {
    try {
      const stats = container.getStats();
      
      res.json({
        success: true,
        data: {
          containerStats: stats,
          serviceKeys: Object.values(ServiceKeys),
          registeredServices: Object.values(ServiceKeys).map(key => ({
            key,
            registered: container.has(key)
          }))
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ [OCR-CONTROLLER] Service info failed:', error);
      throw error;
    }
  });
}

// Export singleton instance
export default new OcrController();