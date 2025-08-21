/**
 * Unified PSA Matching Service
 *
 * Drop-in replacement for all PSA matching services
 * Maintains exact API compatibility while using the new unified architecture
 */

import UnifiedMatchingService from './matching/UnifiedMatchingService.js';
class UnifiedPsaMatchingService {
  constructor() {
    this.unifiedService = new UnifiedMatchingService();
  }

  /**
   * Main PSA matching method - maintains API compatibility with all old services
   * Compatible with: PsaMatchingService, SmartPsaMatchingService, OptimalPsaMatchingService
   */
  async matchPsaLabel(psaText) {
    return await this.unifiedService.matchPsaLabel(psaText, 'psa-optimal');
  }

  /**
   * Load matching data - no-op for compatibility
   */
  loadMatchingData() {
    // No-op - unified service handles initialization internally
    console.log('✅ PSA Matching Data loaded via unified service');
  }

  /**
   * Extract PSA fields - delegates to unified parser
   */
  extractPsaFields(psaText) {
    return this.unifiedService._extractBasicData(psaText);
  }

  /**
   * Connect to database - handled internally by unified service
   */
  connectToDatabase() {
    // No-op - unified service handles database connections
  }

  /**
   * Parse OCR text - delegates to unified service
   */
  parseOcrText(ocrText) {
    return this.unifiedService._extractBasicData(ocrText);
  }
}

export default UnifiedPsaMatchingService;
