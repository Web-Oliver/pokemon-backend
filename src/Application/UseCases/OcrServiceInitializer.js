/**
 * OCR Service Initializer
 * 
 * Single Responsibility: Common OCR service initialization pattern
 * Extracted from multiple OCR controllers to eliminate duplication
 */

import NewUnifiedOcrMatchingService from '@/Application/UseCases/Matching/NewUnifiedOcrMatchingService.js';

class OcrServiceInitializer {
  constructor() {
    this.serviceInstances = new Map();
  }

  /**
   * Get or create OCR service instance with lazy initialization
   * @param {string} controllerName - Name of the controller for logging
   * @returns {Promise<NewUnifiedOcrMatchingService>} Initialized OCR service
   */
  async getOcrService(controllerName = 'Unknown') {
    if (!this.serviceInstances.has('ocrMatchingService')) {
      const ocrService = new NewUnifiedOcrMatchingService();
      this.serviceInstances.set('ocrMatchingService', ocrService);
    }

    const ocrService = this.serviceInstances.get('ocrMatchingService');

    // Lazy initialization
    if (!ocrService.initialized) {
      await ocrService.initialize();
      console.log(`✅ OCR matching service initialized in ${controllerName}`);
    }

    return ocrService;
  }

  /**
   * Reset service instances (useful for testing)
   */
  reset() {
    this.serviceInstances.clear();
  }

  /**
   * Check if service is initialized
   * @returns {boolean} True if service is initialized
   */
  isInitialized() {
    const service = this.serviceInstances.get('ocrMatchingService');
    return service && service.initialized;
  }
}

// Export singleton instance
export default new OcrServiceInitializer();