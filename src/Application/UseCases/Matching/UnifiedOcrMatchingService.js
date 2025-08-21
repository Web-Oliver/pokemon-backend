/**
 * Unified OCR Matching Service
 *
 * Drop-in replacement for all OCR matching services
 * Maintains exact API compatibility while using the new unified architecture
 */

import UnifiedMatchingService from './matching/UnifiedMatchingService.js';
class UnifiedOcrMatchingService {
  constructor() {
    this.unifiedService = new UnifiedMatchingService();
    this.initialized = false;
  }

  /**
   * Initialize service - maintains compatibility
   */
  async initialize() {
    if (this.initialized) return;
    await this.unifiedService.initialize();
    this.initialized = true;
  }

  /**
   * Main OCR matching method - maintains API compatibility with OcrCardMatchingService
   */
  async matchOcrText(ocrText, options = {}) {
    return await this.unifiedService.matchOcrText(ocrText, options);
  }

  /**
   * Enhanced 3-step matching - maintains API compatibility with ComprehensiveOcrFuzzyMatchingService
   */
  async performComprehensive3StepMatching(ocrText) {
    return await this.unifiedService.performEnhanced3StepMatching(ocrText);
  }

  /**
   * Enhanced 3-step matching - maintains API compatibility with EnhancedFuzzySortMatchingService
   */
  async performEnhanced3StepMatching(ocrText) {
    return await this.unifiedService.performEnhanced3StepMatching(ocrText);
  }

  /**
   * Comprehensive set matching - maintains API compatibility
   */
  async performComprehensiveSetMatching(ocrText) {
    return await this.unifiedService.performComprehensiveSetMatching(ocrText);
  }

  /**
   * Card detection from OCR - maintains API compatibility with ocrCardDetectionService
   */
  async detectCardFromOcr(ocrData) {
    return await this.unifiedService.detectCardFromOcr(ocrData);
  }

  /**
   * Extract from OCR - maintains compatibility
   */
  extractFromOCR(ocrText) {
    return this.unifiedService._extractBasicData(ocrText);
  }

  /**
   * Load mappings - no-op for compatibility
   */
  async loadMappings() {
    // No-op - unified service handles initialization internally
    console.log('✅ OCR Mappings loaded via unified service');
  }

  /**
   * Parse OCR for fuzzy matching - delegates to unified service
   */
  parseOcrForFuzzyMatching(ocrText) {
    return this.unifiedService._extractBasicData(ocrText);
  }

  /**
   * Test with real OCR data - delegates to unified service
   */
  async testWithRealOcrData() {
    const testData = {
      ocrText: '2003 POKEMON JAPANESE # 025 AMPHAROS EX - HOLO NM - MT RULERS / HEAVENS 1ST ED . 8 70496958'
    };

    return await this.unifiedService.testService(testData);
  }

  /**
   * Test PSA labels batch - delegates to unified service
   */
  async testPsaLabelsBatch() {
    const testData = {
      psaText: '2005 P.M. JAPANESE HOLON JOLTEON EX - HOLO # 004 NM - MT RESRCH TWR LGHTNG- 1ST ED 8 70496954'
    };

    return await this.unifiedService.testService(testData);
  }
}

export default UnifiedOcrMatchingService;
