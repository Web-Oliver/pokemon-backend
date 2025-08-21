/**
 * Legacy Optimal PSA Matching Service Wrapper
 *
 * Maintains backward compatibility by delegating to UnifiedPsaMatchingService
 * This replaces the original OptimalPsaMatchingService.js with 520 lines of code
 */

import UnifiedPsaMatchingService from './UnifiedPsaMatchingService.js';
class OptimalPsaMatchingService extends UnifiedPsaMatchingService {
  constructor() {
    super();
    this.connectToDatabase(); // Legacy method compatibility
  }

  // Override to use optimal strategy by default
  async matchPsaLabel(psaText) {
    return await this.unifiedService.matchPsaLabel(psaText, 'psa-optimal');
  }

  // Legacy method compatibility
  connectToDatabase() {
    // No-op - unified service handles database connections internally
    console.log('✅ OptimalPsaMatchingService: Database connection handled by unified service');
  }

  // Legacy method compatibility
  parseOcrText(ocrText) {
    return this.unifiedService._extractBasicData(ocrText);
  }

  // Legacy method compatibility
  async performHardDatabaseMatch(parsed) {
    // Delegate to unified service
    const results = await this.unifiedService.matchPsaLabel(parsed.originalText || '', 'psa-optimal');

    return results.matches || [];
  }

  // Legacy method compatibility
  performFzfMatching(hardMatches, parsed) {
    // Return matches in expected format
    return hardMatches.map(match => ({
      item: match.data,
      score: match.score / 100,
      positions: []
    }));
  }

  // Legacy method compatibility
  calculateContextScores(fuzzyResults, parsed) {
    return fuzzyResults.map(entry => ({
      cardName: entry.item.cardName,
      cardNumber: entry.item.cardNumber,
      cardId: entry.item._id,
      setName: entry.item.setName,
      setId: entry.item.setId,
      year: entry.item.year,
      confidence: entry.score * 100,
      strategy: 'optimal_unified',
      fuzzyScore: entry.score,
      matchedPositions: entry.positions || [],
      verificationData: {
        yearMatch: parsed.year === entry.item.year,
        cardNumberMatch: parsed.cardNumber === entry.item.cardNumber,
        processingMethod: 'unified_optimal'
      }
    }));
  }
}

export default OptimalPsaMatchingService;
