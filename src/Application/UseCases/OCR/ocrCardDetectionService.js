/**
 * Legacy OCR Card Detection Service Wrapper
 *
 * Maintains backward compatibility by delegating to UnifiedOcrMatchingService
 * This replaces the original ocrCardDetectionService.js
 */

import UnifiedOcrMatchingService from './UnifiedOcrMatchingService.js';
class OcrCardDetectionService extends UnifiedOcrMatchingService {
  constructor() {
    super();
  }

  // Legacy method compatibility - card detection from OCR
  async detectCardFromOcr(ocrData) {
    return await this.unifiedService.detectCardFromOcr(ocrData);
  }

  // Legacy batch detection
  async detectCardsFromOcrBatch(ocrDataArray) {
    const results = [];

    for (const ocrData of ocrDataArray) {
      try {
        const result = await this.detectCardFromOcr(ocrData);

        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          matches: []
        });
      }
    }

    return {
      success: true,
      results,
      totalProcessed: ocrDataArray.length,
      successful: results.filter(r => r.success).length
    };
  }

  // Legacy method compatibility
  async matchText(text, options = {}) {
    return await this.unifiedService.matchOcrText(text, options);
  }

  // Legacy method compatibility
  extractCardInfo(ocrText) {
    return this.unifiedService._extractBasicData(ocrText);
  }

  // Legacy method compatibility
  validateCardData(cardData) {
    return {
      valid: Boolean(cardData.pokemonName || cardData.cardNumber),
      issues: [],
      confidence: cardData.pokemonName && cardData.cardNumber ? 0.8 : 0.4
    };
  }

  // Legacy method compatibility
  async getDetectionStats() {
    const stats = await this.unifiedService.getServiceStats();

    return {
      initialized: stats.initialized,
      strategiesAvailable: stats.availableStrategies.length,
      serviceType: 'unified_ocr_detection',
      version: '2.0.0'
    };
  }
}

export default OcrCardDetectionService;
