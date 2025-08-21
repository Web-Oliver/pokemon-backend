/**
 * Unified PSA Matching Service
 *
 * Drop-in replacement for all PSA matching services
 * Maintains exact API compatibility while using the new unified architecture
 */

import { container, ServiceKeys } from '@/Infrastructure/DependencyInjection/ServiceContainer.js';
class UnifiedPsaMatchingService {
  constructor() {
    // Use dependency injection instead of direct instantiation
  }

  /**
   * Main PSA matching method - maintains API compatibility with all old services
   * Compatible with: PsaMatchingService, SmartPsaMatchingService, OptimalPsaMatchingService
   */
  async matchPsaLabel(psaText) {
    try {
      const orchestrator = container.resolve(ServiceKeys.OCR_ORCHESTRATOR);
      const result = await orchestrator.processOcrText(psaText, { strategy: 'psa-optimal' });
      
      // Convert to expected PSA format
      return {
        matches: result.matches?.map(match => ({
          card: {
            _id: match.cardId,
            cardName: match.cardName,
            cardNumber: match.cardNumber,
            setName: match.setName,
            setId: match.setId,
            year: match.year
          },
          confidence: match.confidence,
          strategy: match.matchStrategy
        })) || [],
        confidence: result.confidence,
        extractedData: result.extractedData
      };
    } catch (error) {
      console.error('❌ PSA matching failed:', error);
      return { matches: [], confidence: 0, extractedData: {} };
    }
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
    try {
      const parser = container.resolve(ServiceKeys.OCR_TEXT_PARSER);
      return parser.parseCardInfo(psaText);
    } catch (error) {
      console.error('❌ PSA field extraction failed:', error);
      return { originalText: psaText, confidence: 0 };
    }
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
    try {
      const parser = container.resolve(ServiceKeys.OCR_TEXT_PARSER);
      return parser.parseCardInfo(ocrText);
    } catch (error) {
      console.error('❌ OCR text parsing failed:', error);
      return { originalText: ocrText, confidence: 0 };
    }
  }
}

export default UnifiedPsaMatchingService;
