/**
 * OCR Orchestrator Service
 * 
 * SINGLE RESPONSIBILITY: Coordinate OCR workflow between specialized services
 * NO OTHER RESPONSIBILITIES: extraction, parsing, matching, scoring (delegates all)
 */

/**
 * OCR Workflow Orchestrator
 */
export class OcrOrchestrator {
  constructor(textExtractor, textParser, cardMatcher, psaMatcher, confidenceScorer) {
    this.textExtractor = textExtractor;
    this.textParser = textParser;
    this.cardMatcher = cardMatcher;
    this.psaMatcher = psaMatcher;
    this.confidenceScorer = confidenceScorer;
  }

  /**
   * Process OCR text (text already extracted)
   */
  async processOcrText(ocrText, options = {}) {
    const startTime = Date.now();

    try {
      console.log(`🔍 Processing OCR text: "${ocrText.substring(0, 50)}..."`);

      // Step 1: Parse the OCR text into structured data
      const parsedData = this.textParser.parseCardInfo(ocrText);
      console.log('📝 Text parsed:', { 
        pokemonName: parsedData.pokemonName, 
        cardNumber: parsedData.cardNumber,
        confidence: parsedData.confidence 
      });

      // Step 2: Validate parsed data quality
      if (!this.textParser.validateParsedData(parsedData)) {
        return this.createErrorResult('Invalid parsed data - insufficient information', ocrText);
      }

      // Step 3: Determine matching strategy (card vs PSA)
      const isPsaData = this.isPsaData(parsedData);
      console.log(`🎯 Matching strategy: ${isPsaData ? 'PSA' : 'Card'}`);

      // Step 4: Find matches using appropriate matcher
      let matches = [];
      if (isPsaData && this.psaMatcher) {
        matches = await this.psaMatcher.findPsaMatches(parsedData, options);
      } else {
        matches = await this.cardMatcher.findCardMatches(parsedData, options);
      }

      console.log(`🔍 Found ${matches.length} initial matches`);

      // Step 5: Score and sort matches by confidence
      const scoredMatches = this.confidenceScorer.scoreMatches(matches);
      console.log(`📊 Scored matches: ${scoredMatches.length} results`);

      // Step 6: Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(parsedData, scoredMatches);

      // Step 7: Build result
      const result = {
        matches: scoredMatches,
        extractedData: parsedData,
        confidence: overallConfidence,
        strategies: [isPsaData ? 'psa-matching' : 'card-matching'],
        totalCandidates: matches.length,
        success: true,
        error: undefined
      };

      const processingTime = Date.now() - startTime;
      console.log(`✅ OCR processing completed in ${processingTime}ms`);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ OCR processing failed after ${processingTime}ms:`, error);
      
      return this.createErrorResult(
        `OCR processing failed: ${error.message}`,
        ocrText
      );
    }
  }

  /**
   * Process OCR image (extract text first, then process)
   */
  async processOcrImage(imageBuffer, options = {}) {
    try {
      console.log('🖼️ Extracting text from image...');
      
      // Step 1: Extract text from image
      const extractedText = await this.textExtractor.extractText(imageBuffer);
      
      if (!extractedText || extractedText.trim().length === 0) {
        return this.createErrorResult('No text could be extracted from image', '');
      }

      console.log(`📝 Extracted text: "${extractedText.substring(0, 100)}..."`);

      // Step 2: Process the extracted text
      return this.processOcrText(extractedText, options);

    } catch (error) {
      console.error('❌ Image OCR processing failed:', error);
      return this.createErrorResult(
        `Image processing failed: ${error.message}`,
        ''
      );
    }
  }

  /**
   * Process batch of OCR texts
   */
  async processOcrBatch(texts, options = {}) {
    console.log(`📦 Processing OCR batch: ${texts.length} texts`);

    const results = [];
    const batchStartTime = Date.now();

    // Process each text individually
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      console.log(`📝 Processing batch item ${i + 1}/${texts.length}`);
      
      try {
        const result = await this.processOcrText(text, options);
        results.push(result);
      } catch (error) {
        console.error(`❌ Batch item ${i + 1} failed:`, error);
        results.push(this.createErrorResult(
          `Batch item ${i + 1} failed: ${error.message}`,
          text
        ));
      }
    }

    const batchTime = Date.now() - batchStartTime;
    const successCount = results.filter(r => r.success).length;
    
    console.log(`✅ Batch processing completed: ${successCount}/${texts.length} succeeded in ${batchTime}ms`);

    return results;
  }

  /**
   * Determine if parsed data represents PSA information
   */
  isPsaData(parsedData) {
    return !!(parsedData.grade || parsedData.certificationNumber);
  }

  /**
   * Calculate overall confidence score
   */
  calculateOverallConfidence(parsedData, matches) {
    if (matches.length === 0) return 0;

    // Base confidence from parsing
    let confidence = parsedData.confidence || 0;

    // Add confidence from best match
    const bestMatch = matches[0];
    if (bestMatch) {
      confidence = (confidence + bestMatch.confidence) / 2;
    }

    // Boost confidence if we have multiple good matches
    const goodMatches = matches.filter(m => m.confidence > 0.7);
    if (goodMatches.length > 1) {
      confidence = Math.min(confidence * 1.1, 1.0);
    }

    return Math.round(confidence * 100) / 100; // Round to 2 decimals
  }

  /**
   * Create error result
   */
  createErrorResult(errorMessage, ocrText) {
    return {
      matches: [],
      extractedData: {
        originalText: ocrText,
        confidence: 0
      },
      confidence: 0,
      strategies: [],
      totalCandidates: 0,
      success: false,
      error: errorMessage
    };
  }
}

/**
 * OCR Orchestrator Factory
 */
export class OcrOrchestratorFactory {
  static create(textExtractor, textParser, cardMatcher, psaMatcher, confidenceScorer) {
    console.log('🎼 Creating OCR Orchestrator with all dependencies');
    
    return new OcrOrchestrator(
      textExtractor,
      textParser,
      cardMatcher,
      psaMatcher,
      confidenceScorer
    );
  }
}