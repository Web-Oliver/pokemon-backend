/**
 * NEW Unified OCR Matching Service
 * 
 * PROPER REPLACEMENT for the broken UnifiedOcrMatchingService
 * Uses dependency injection and proper separation of concerns
 */

import { container, ServiceKeys } from '@/Infrastructure/DependencyInjection/ServiceContainer.js';

class NewUnifiedOcrMatchingService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize service - maintains compatibility
   */
  async initialize() {
    if (this.initialized) return;
    
    console.log('🚀 [NEW-OCR-SERVICE] Initializing...');
    
    // Services are resolved from container, no direct instantiation
    this.initialized = true;
    
    console.log('✅ [NEW-OCR-SERVICE] Initialized successfully');
  }

  /**
   * Main OCR matching method - PROPERLY IMPLEMENTED
   */
  async matchOcrText(ocrText, options = {}) {
    console.log('🔍 [NEW-OCR-SERVICE] matchOcrText called with:', ocrText.substring(0, 50) + '...');
    
    try {
      // Resolve OCR orchestrator from container
      const orchestrator = container.resolve(ServiceKeys.OCR_ORCHESTRATOR);
      
      // Delegate to orchestrator
      const result = await orchestrator.processOcrText(ocrText, options);
      
      console.log('✅ [NEW-OCR-SERVICE] matchOcrText completed successfully');
      
      return result;
      
    } catch (error) {
      console.error('❌ [NEW-OCR-SERVICE] matchOcrText failed:', error);
      
      // Return error result in expected format
      return {
        matches: [],
        extractedData: { originalText: ocrText, confidence: 0 },
        confidence: 0,
        strategies: [],
        totalCandidates: 0,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Batch processing - maintains compatibility
   */
  async batchMatchOcrText(ocrTexts, options = {}) {
    console.log('📦 [NEW-OCR-SERVICE] batchMatchOcrText called');
    
    try {
      const orchestrator = container.resolve(ServiceKeys.OCR_ORCHESTRATOR);
      return await orchestrator.processOcrBatch(ocrTexts, options);
    } catch (error) {
      console.error('❌ [NEW-OCR-SERVICE] batchMatchOcrText failed:', error);
      return [];
    }
  }

  /**
   * Extract from OCR - basic compatibility
   */
  extractFromOCR(ocrText) {
    console.log('📝 [NEW-OCR-SERVICE] extractFromOCR called');
    
    try {
      const parser = container.resolve(ServiceKeys.OCR_TEXT_PARSER);
      return parser.parseCardInfo(ocrText);
    } catch (error) {
      console.error('❌ [NEW-OCR-SERVICE] extractFromOCR failed:', error);
      return { originalText: ocrText, confidence: 0 };
    }
  }
}

export default NewUnifiedOcrMatchingService;