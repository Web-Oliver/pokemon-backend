/**
 * Unified Matching Service
 *
 * Single point of entry for all PSA/OCR matching operations
 * Replaces all 8 individual matching services with unified factory-based approach
 * Maintains backward compatibility with existing API contracts
 */

import MatchingServiceFactory from './MatchingServiceFactory.js';
class UnifiedMatchingService {
  constructor() {
    this.factory = new MatchingServiceFactory();
    this.initialized = false;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await this.factory.initialize();
      this.initialized = true;
      console.log('✅ UnifiedMatchingService initialized successfully');
    } catch (error) {
      console.error('❌ UnifiedMatchingService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Main PSA label matching method
   * Replaces: PsaMatchingService.matchPsaLabel(), SmartPsaMatchingService.matchPsaLabel(), OptimalPsaMatchingService.matchPsaLabel()
   *
   * @param {string} psaText - Raw PSA label text
   * @param {string} strategy - Matching strategy ('psa-optimal', 'psa-smart', 'psa-comprehensive')
   * @param {Object} options - Additional matching options
   * @returns {Object} Matching results with confidence scores
   */
  async matchPsaLabel(psaText, strategy = 'psa-optimal', options = {}) {
    await this.initialize();

    console.log(`🎯 UnifiedMatchingService: PSA label matching with ${strategy} strategy`);
    console.log(`📄 Input text: ${psaText?.substring(0, 100)}...`);

    try {
      const matchingService = this.factory.createMatchingService(strategy, {
        maxResults: options.limit || 10,
        confidenceThreshold: options.threshold || 0.1,
        useFuzzyMatching: options.fuzzy !== false,
        useOptimalScoring: strategy === 'psa-optimal'
      });

      const results = await matchingService.match(psaText);

      // Convert to legacy format for backward compatibility
      return this._convertToLegacyPsaFormat(results, strategy);

    } catch (error) {
      console.error('❌ PSA label matching error:', error);
      return {
        extracted: this._getEmptyExtracted(),
        matches: [],
        confidence: 0,
        matchingStrategy: strategy,
        error: error.message
      };
    }
  }

  /**
   * OCR card matching method
   * Replaces: OcrCardMatchingService.matchOcrText(), ComprehensiveOcrFuzzyMatchingService.performComprehensive3StepMatching()
   *
   * @param {string} ocrText - Raw OCR text
   * @param {Object} options - Matching options
   * @returns {Object} Card matching results
   */
  async matchOcrText(ocrText, options = {}) {
    await this.initialize();

    console.log('🔍 UnifiedMatchingService: OCR text matching');
    console.log(`📄 Input text: ${ocrText?.substring(0, 100)}...`);

    try {
      const strategy = options.strategy || 'ocr-comprehensive';
      const matchingService = this.factory.createMatchingService(strategy, {
        maxResults: options.limit || 10,
        confidenceThreshold: options.threshold || 0.2,
        useFuzzyMatching: true,
        use3StepMatching: true
      });

      const results = await matchingService.match(ocrText);

      // Convert to legacy OCR format for backward compatibility
      return this._convertToLegacyOcrFormat(results, ocrText, options);

    } catch (error) {
      console.error('❌ OCR text matching error:', error);
      return {
        success: false,
        error: error.message,
        matches: [],
        extractedData: this._extractBasicData(ocrText),
        confidence: 0
      };
    }
  }

  /**
   * Enhanced fuzzy matching method
   * Replaces: EnhancedFuzzySortMatchingService.performEnhanced3StepMatching()
   *
   * @param {string} ocrText - Raw OCR text
   * @returns {Array} Enhanced fuzzy matching results
   */
  async performEnhanced3StepMatching(ocrText) {
    await this.initialize();

    console.log('🧠 UnifiedMatchingService: Enhanced 3-step fuzzy matching');

    try {
      const matchingService = this.factory.createMatchingService('enhanced-fuzzy', {
        maxResults: 12,
        confidenceThreshold: 0.15,
        useFuzzySort: true,
        useOcrCorrections: true,
        aggressiveThreshold: true
      });

      const results = await matchingService.match(ocrText);

      // Convert to enhanced fuzzy format
      return this._convertToEnhancedFuzzyFormat(results);

    } catch (error) {
      console.error('❌ Enhanced fuzzy matching error:', error);
      return [];
    }
  }

  /**
   * Comprehensive set matching method
   * Replaces: ComprehensiveOcrFuzzyMatchingService.performComprehensiveSetMatching()
   *
   * @param {string} ocrText - Raw OCR text
   * @returns {Array} Set matching results
   */
  async performComprehensiveSetMatching(ocrText) {
    await this.initialize();

    console.log('📚 UnifiedMatchingService: Comprehensive set matching');

    try {
      const matchingService = this.factory.createMatchingService('set-focused', {
        maxResults: 10,
        confidenceThreshold: 0.3,
        prioritizeSetMatching: true,
        useYearFiltering: true
      });

      const results = await matchingService.match(ocrText);

      // Convert to set matching format
      return this._convertToSetMatchingFormat(results);

    } catch (error) {
      console.error('❌ Comprehensive set matching error:', error);
      return [];
    }
  }

  /**
   * Smart PSA extraction for OCR integration
   * Replaces: SmartPsaOcrIntegration.extractSmartPsaSetName()
   *
   * @param {string} fullText - Full OCR text
   * @returns {string|null} Extracted set name or null
   */
  async extractSmartPsaSetName(fullText) {
    await this.initialize();

    console.log('🧠 UnifiedMatchingService: Smart PSA set name extraction');

    try {
      const matchingService = this.factory.createMatchingService('psa-smart', {
        maxResults: 1,
        confidenceThreshold: 0.5,
        prioritizeSetMatching: true
      });

      const results = await matchingService.match(fullText);

      if (results.length > 0) {
        const topResult = results[0];

        if (topResult.setInfo && topResult.setInfo.setName) {
          console.log(`✅ Smart PSA extraction: ${topResult.setInfo.setName}`);
          return topResult.setInfo.setName;
        }
      }

      console.log('❌ Smart PSA extraction: No set name found');
      return null;

    } catch (error) {
      console.error('❌ Smart PSA extraction error:', error);
      return null;
    }
  }

  /**
   * Card detection from OCR
   * Replaces: ocrCardDetectionService functionality
   *
   * @param {Object} ocrData - OCR detection data
   * @returns {Object} Card detection results
   */
  async detectCardFromOcr(ocrData) {
    await this.initialize();

    console.log('🔍 UnifiedMatchingService: Card detection from OCR');

    try {
      const strategy = ocrData.cardType === 'psa-label' ? 'psa-optimal' : 'ocr-comprehensive';
      const matchingService = this.factory.createMatchingService(strategy, {
        maxResults: 5,
        confidenceThreshold: ocrData.confidence || 0.3,
        cardType: ocrData.cardType
      });

      const results = await matchingService.match(ocrData.text);

      // Convert to card detection format
      return this._convertToCardDetectionFormat(results, ocrData);

    } catch (error) {
      console.error('❌ Card detection error:', error);
      return {
        success: false,
        error: error.message,
        matches: []
      };
    }
  }

  // ==================== FORMAT CONVERSION METHODS ====================

  /**
   * Convert unified results to legacy PSA format
   */
  _convertToLegacyPsaFormat(results, strategy) {
    const topResult = results.length > 0 ? results[0] : null;

    return {
      extracted: topResult ? {
        originalText: topResult.originalText || '',
        year: topResult.year,
        pokemonName: topResult.pokemonName,
        cardNumber: topResult.cardNumber,
        setName: topResult.setName,
        grade: topResult.grade
      } : this._getEmptyExtracted(),
      matches: results.map(result => ({
        type: result.matchType || 'card',
        data: {
          _id: result.cardId || result.setId,
          cardName: result.cardName,
          cardNumber: result.cardNumber,
          setName: result.setInfo?.setName || result.setName,
          year: result.setInfo?.year || result.year,
          confidence: result.confidence
        },
        score: result.confidence,
        finalScore: result.confidence * 100,
        priority: result.matchType?.toUpperCase() || 'CARD',
        reason: `${strategy} match: ${result.cardName} in ${result.setName}`
      })),
      confidence: topResult ? topResult.confidence * 100 : 0,
      matchingStrategy: strategy.toUpperCase().replace('-', ' + ')
    };
  }

  /**
   * Convert unified results to legacy OCR format
   */
  _convertToLegacyOcrFormat(results, ocrText, options) {
    const extracted = this._extractBasicData(ocrText);

    return {
      success: true,
      matches: results.map((result, index) => ({
        card: {
          _id: result.cardId,
          cardName: result.cardName,
          cardNumber: result.cardNumber,
          setName: result.setInfo?.setName || result.setName || 'Unknown Set',
          setId: result.setId,
          year: result.setInfo?.year || result.year,
          rarity: result.rarity,
          variety: result.variety
        },
        matchScore: result.confidence,
        confidence: result.confidence,
        searchStrategy: result.matchType || 'unified',
        reasons: result.reasons || [`${result.matchType} match`]
      })),
      setRecommendations: results
        .filter(r => r.setInfo)
        .map(r => ({
          setName: r.setInfo.setName,
          year: r.setInfo.year,
          confidence: r.confidence,
          strategy: 'unified_matching'
        }))
        .slice(0, 5),
      extractedData: extracted,
      confidence: results.length > 0 ? results[0].confidence : 0,
      ocrText,
      totalCandidates: results.length
    };
  }

  /**
   * Convert unified results to enhanced fuzzy format
   */
  _convertToEnhancedFuzzyFormat(results) {
    return results.map(result => ({
      strategy: 'enhanced_3_step_priority_match',
      confidence: result.confidence * 100,
      setName: result.setInfo?.setName || result.setName || 'Unknown Set',
      year: result.setInfo?.year || result.year,
      cardName: result.cardName,
      cardNumber: result.cardNumber,
      setId: result.setId,
      cardId: result.cardId,
      matchReason: `Enhanced unified: ${result.matchType} match`,
      verificationData: {
        pokemonMatch: Boolean(result.pokemonName),
        cardNumberMatch: Boolean(result.cardNumber),
        yearMatch: Boolean(result.year),
        setNameMatch: Boolean(result.setInfo?.setName),
        unifiedService: true
      }
    }));
  }

  /**
   * Convert unified results to set matching format
   */
  _convertToSetMatchingFormat(results) {
    const setMatches = new Map();

    results.forEach(result => {
      const setName = result.setInfo?.setName || result.setName;

      if (setName && !setMatches.has(setName)) {
        setMatches.set(setName, {
          strategy: 'unified_set_match',
          confidence: result.confidence * 100,
          setName,
          year: result.setInfo?.year || result.year,
          matchReason: `Unified set matching: ${result.matchType}`
        });
      }
    });

    return Array.from(setMatches.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10);
  }

  /**
   * Convert unified results to card detection format
   */
  _convertToCardDetectionFormat(results, ocrData) {
    return {
      success: true,
      cardType: ocrData.cardType,
      confidence: results.length > 0 ? results[0].confidence : 0,
      matches: results.map(result => ({
        cardName: result.cardName,
        cardNumber: result.cardNumber,
        setName: result.setInfo?.setName || result.setName,
        year: result.setInfo?.year || result.year,
        confidence: result.confidence,
        matchType: result.matchType
      })),
      extractedData: this._extractBasicData(ocrData.text)
    };
  }

  /**
   * Extract basic data from OCR text for compatibility
   */
  _extractBasicData(ocrText) {
    if (!ocrText) return { pokemonName: null, cardNumber: null, year: null };

    // Use the unified parser for consistency
    const parser = this.factory.getParser();
    const parsed = parser.parse(ocrText);

    return {
      pokemonName: parsed.pokemonName,
      cardNumber: parsed.cardNumber,
      year: parsed.year,
      grade: parsed.grade
    };
  }

  /**
   * Get empty extracted data structure
   */
  _getEmptyExtracted() {
    return {
      originalText: '',
      year: null,
      pokemonName: null,
      cardNumber: null,
      setName: null,
      grade: null,
      cleanText: ''
    };
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get available matching strategies
   */
  getAvailableStrategies() {
    return this.factory.getAvailableStrategies();
  }

  /**
   * Get service statistics
   */
  async getServiceStats() {
    await this.initialize();
    return {
      initialized: this.initialized,
      availableStrategies: this.getAvailableStrategies(),
      factoryStats: await this.factory.getStats()
    };
  }

  /**
   * Test the unified service with sample data
   */
  async testService(testData = {}) {
    await this.initialize();

    const testResults = {};

    // Test PSA matching
    if (testData.psaText) {
      testResults.psaMatching = await this.matchPsaLabel(testData.psaText, 'psa-optimal');
    }

    // Test OCR matching
    if (testData.ocrText) {
      testResults.ocrMatching = await this.matchOcrText(testData.ocrText);
    }

    return {
      testResults,
      serviceStats: await this.getServiceStats()
    };
  }
}

export default UnifiedMatchingService;
