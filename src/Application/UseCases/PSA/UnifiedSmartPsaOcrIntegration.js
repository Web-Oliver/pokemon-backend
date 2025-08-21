/**
 * Unified Smart PSA OCR Integration
 *
 * Drop-in replacement for SmartPsaOcrIntegration
 * Maintains exact API compatibility while using the new unified architecture
 */

import UnifiedMatchingService from './matching/UnifiedMatchingService.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
class UnifiedSmartPsaOcrIntegration {
  constructor() {
    this.unifiedService = new UnifiedMatchingService();
  }

  /**
   * Smart PSA set name extraction - maintains API compatibility with SmartPsaOcrIntegration
   */
  async extractSmartPsaSetName(fullText) {
    console.log('🧠 UNIFIED SMART PSA OCR INTEGRATION - SETNAME + POKEMONNUMBER + YEAR');
    Logger.info('UnifiedSmartPSAOCR', `Smart PSA OCR integration: "${fullText.substring(0, 100)}"`);

    try {
      const setName = await this.unifiedService.extractSmartPsaSetName(fullText);

      if (setName) {
        Logger.info('UnifiedSmartPSAOCR', `Smart match - Set: ${setName}`);
        console.log('✅ Unified Smart PSA Match Found:', setName);
        return setName;
      }

      Logger.info('UnifiedSmartPSAOCR', 'Unified smart matching found no results');
      console.log('❌ No Unified Smart PSA Match Found');
      return null;

    } catch (error) {
      console.error('❌ Unified Smart PSA OCR integration error:', error);
      Logger.error('UnifiedSmartPSAOCR', 'Unified Smart PSA OCR integration failed', error);
      return null;
    }
  }

  /**
   * Extract PSA card details - maintains API compatibility
   */
  async extractPsaCardDetails(fullText) {
    try {
      Logger.info('UnifiedSmartPSAOCR', `Extracting PSA card details: "${fullText.substring(0, 50)}"`);

      // Use unified service to get comprehensive matching data
      const results = await this.unifiedService.matchPsaLabel(fullText, 'psa-comprehensive');

      if (results.matches && results.matches.length > 0) {
        const topMatch = results.matches[0];
        const cardDetails = {
          pokemonName: results.extracted.pokemonName,
          cardNumber: results.extracted.cardNumber,
          setName: topMatch.data.setName,
          year: topMatch.data.year,
          grade: results.extracted.grade,
          confidence: topMatch.score / 100
        };

        Logger.info('UnifiedSmartPSAOCR', 'PSA card details extracted successfully', cardDetails);
        return cardDetails;
      }

      Logger.info('UnifiedSmartPSAOCR', 'No PSA card details could be extracted');
      return null;

    } catch (error) {
      console.error('❌ PSA card details extraction error:', error);
      Logger.error('UnifiedSmartPSAOCR', 'PSA card details extraction failed', error);
      return null;
    }
  }

  /**
   * Get enhanced matching results for analysis
   */
  async getEnhancedMatchingResults(fullText) {
    try {
      const results = await this.unifiedService.performEnhanced3StepMatching(fullText);

      Logger.info('UnifiedSmartPSAOCR', `Enhanced matching returned ${results.length} results`);
      return results;

    } catch (error) {
      console.error('❌ Enhanced matching results error:', error);
      Logger.error('UnifiedSmartPSAOCR', 'Enhanced matching results failed', error);
      return [];
    }
  }

  /**
   * Validate unified service integration
   */
  async validateIntegration() {
    try {
      const stats = await this.unifiedService.getServiceStats();

      Logger.info('UnifiedSmartPSAOCR', 'Integration validation successful', {
        initialized: stats.initialized,
        strategiesAvailable: stats.availableStrategies.length
      });

      return {
        valid: true,
        stats
      };

    } catch (error) {
      Logger.error('UnifiedSmartPSAOCR', 'Integration validation failed', error);
      return {
        valid: false,
        error: error.message
      };
    }
  }
}

export default UnifiedSmartPsaOcrIntegration;
