/**
 * Google Cloud Vision API Service
 *
 * Real implementation of Google Vision OCR for Pokemon card text detection
 * Supports both service account and API key authentication
 */

import vision from '@google-cloud/vision';
import ApiCallTracker from '@/Application/Services/Core/ApiCallTracker.js';
class GoogleVisionService {
  constructor() {
    this.client = null;
    this.asyncClient = null;
    this.initialized = false;
    this.batchRequestsPool = [];
    this.processingBatch = false;
    this.batchConfig = {
      maxBatchSize: 16, // Google Vision API allows up to 16 images per batch
      batchTimeoutMs: 100, // Wait 100ms to collect batch requests
      maxRetries: 3
    };
    this.apiCallCount = 0;
    this.apiQuotaLimit = 1000; // Daily quota limit
    this.rateLimitPerMinute = 60; // 60 calls per minute
    this.callTimestamps = [];
    this.initializeClient();
  }

  /**
   * Initialize Google Vision client with credentials
   */
  initializeClient() {
    console.log('[DEBUG Vision] Initializing Google Vision client...');
    console.log('[DEBUG Vision] Environment check:', {
      hasServiceAccount: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      hasApiKey: Boolean(process.env.GOOGLE_VISION_API_KEY),
      timestamp: new Date().toISOString()
    });

    try {
      // Option 1: Service Account (Recommended) with optimization settings
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('[DEBUG Vision] Attempting optimized service account initialization...');

        // Fixed client configuration - remove gRPC specific options causing issues
        const clientConfig = {
          // Use fallback to avoid gRPC compatibility issues
          fallback: true,
          // Configure retry settings for reliability
          retry: {
            retryCodes: [14, 4], // UNAVAILABLE, DEADLINE_EXCEEDED
            backoffSettings: {
              initialRetryDelayMillis: 100,
              retryDelayMultiplier: 1.3,
              maxRetryDelayMillis: 60000,
              initialRpcTimeoutMillis: 20000,
              rpcTimeoutMultiplier: 1.0,
              maxRpcTimeoutMillis: 120000,
              totalTimeoutMillis: 600000,
            },
          }
        };

        this.client = new vision.ImageAnnotatorClient(clientConfig);

        // Also create async client for concurrent operations
        this.asyncClient = new vision.ImageAnnotatorClient(clientConfig);

        this.initialized = true;
        console.log('✅ [DEBUG Vision] Optimized Google Vision API initialized with service account');
        console.log('[DEBUG Vision] gRPC client and async client created successfully');
        return;
      }

      // Option 2: API Key with REST fallback
      if (process.env.GOOGLE_VISION_API_KEY) {
        console.log('[DEBUG Vision] Attempting API key initialization...');
        this.client = new vision.ImageAnnotatorClient({
          keyFilename: undefined,
          credentials: {
            private_key: undefined,
            client_email: undefined
          },
          // Use REST API with API key
          fallback: true,
          apiKey: process.env.GOOGLE_VISION_API_KEY
        });
        this.asyncClient = this.client; // Use same client for API key mode
        this.initialized = true;
        console.log('✅ [DEBUG Vision] Google Vision API initialized with API key (REST mode)');
        return;
      }

      console.error('🚨 [CRITICAL ERROR] Google Vision API credentials not found - SERVICE WILL NOT WORK');
      console.error('🚨 [BILLING PROTECTION] Mock responses disabled - all API calls will throw errors');
      this.initialized = false;
    } catch (error) {
      console.error('❌ [DEBUG Vision] Failed to initialize Google Vision API:', {
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
        timestamp: new Date().toISOString()
      });
      this.initialized = false;
    }
  }

  /**
   * Extract text from image using Google Vision API
   * @param {string} base64Image - Base64 encoded image
   * @param {Object} options - OCR options
   * @returns {Promise<Object>} OCR result
   */
  async extractText(base64Image, options = {}) {
    const startTime = Date.now();

    // 🚨 CRITICAL: CHECK QUOTA SAFETY BEFORE API CALL
    await ApiCallTracker.checkQuotaSafety('google-vision');

    // 🚨 CRITICAL: START API CALL TRACKING
    const tracking = await ApiCallTracker.startApiCall('google-vision', 'extractText', {
      imageSize: base64Image?.length || 0,
      imageCount: 1,
      cost: 0.0015, // $1.50 per 1000 units from Google Cloud pricing
      sessionId: options.sessionId || 'unknown'
    });

    console.log('🚨 [CRITICAL TRACKING] API call authorized and logged:', {
      requestId: tracking.requestId,
      dailyCallNumber: tracking.apiCall.dailyCallNumber,
      monthlyCallNumber: tracking.apiCall.monthlyCallNumber
    });

    // EXTENSIVE API CALL DEBUGGING
    this.apiCallCount++;
    this.callTimestamps.push(Date.now());

    // Clean old timestamps (older than 1 minute)
    const oneMinuteAgo = Date.now() - 60000;

    this.callTimestamps = this.callTimestamps.filter(ts => ts > oneMinuteAgo);

    console.log('🔥 [EXTENSIVE DEBUG] API CALL TRACKING:', {
      totalApiCalls: this.apiCallCount,
      callsInLastMinute: this.callTimestamps.length,
      rateLimitPerMinute: this.rateLimitPerMinute,
      quotaRemaining: this.apiQuotaLimit - this.apiCallCount,
      timestamp: new Date().toISOString()
    });

    // RATE LIMIT CHECK
    if (this.callTimestamps.length > this.rateLimitPerMinute) {
      console.error('💥 [RATE LIMIT EXCEEDED] Too many calls in last minute:', this.callTimestamps.length);
      throw new Error(`Rate limit exceeded: ${this.callTimestamps.length} calls in last minute (limit: ${this.rateLimitPerMinute})`);
    }

    if (this.apiCallCount > this.apiQuotaLimit) {
      console.error('💥 [QUOTA EXCEEDED] Daily quota limit reached:', this.apiCallCount);
      throw new Error(`Daily quota exceeded: ${this.apiCallCount} calls (limit: ${this.apiQuotaLimit})`);
    }

    console.log('🔥 [EXTENSIVE DEBUG] extractText called with:', {
      base64ImageLength: base64Image?.length,
      base64Preview: `${base64Image?.substring(0, 50)}...`,
      imageSizeKB: base64Image ? Math.round(base64Image.length * 0.75 / 1024) : 0,
      options,
      initialized: this.initialized,
      apiCallNumber: this.apiCallCount,
      timestamp: new Date().toISOString()
    });

    if (!this.initialized) {
      console.error('🚨 [CRITICAL ERROR] Google Vision API not initialized - BLOCKING API CALL');
      console.error('🚨 [NO MOCK ALLOWED] Mock responses disabled for billing protection');

      // 🚨 CRITICAL: LOG FAILED INITIALIZATION ATTEMPT
      if (tracking) {
        await ApiCallTracker.completeApiCall(tracking.requestId, tracking.startTime, null,
          new Error('Google Vision API not initialized - credentials missing'));
      }

      throw new Error('Google Vision API not initialized. Check GOOGLE_APPLICATION_CREDENTIALS.');
    }

    try {
      const request = {
        image: {
          content: base64Image
        },
        features: [
          {
            type: 'DOCUMENT_TEXT_DETECTION', // 🔥 USE DOCUMENT_TEXT_DETECTION for dense structured text (PSA labels)
            model: 'builtin/latest' // 🔥 2024 LATEST MODEL for better OCR accuracy
          }
        ],
        imageContext: {
          languageHints: options.languageHints || ['en', 'ja']
        }
      };

      console.log('[DEBUG Vision] Sending request to Google Vision API:', {
        features: request.features,
        imageContext: request.imageContext,
        imageContentLength: request.image.content?.length
      });

      console.log('🔥 [EXTENSIVE DEBUG] Sending to Google Vision API:', {
        requestSize: JSON.stringify(request).length,
        imageContentSize: request.image.content.length,
        features: request.features,
        imageContext: request.imageContext,
        callNumber: this.apiCallCount,
        timestamp: new Date().toISOString()
      });

      console.log('⏳ [WAITING] Google Vision API processing - timeout in 120 seconds...');
      const apiCallStart = Date.now();

      const [result] = await Promise.race([
        this.client.annotateImage(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('OCR request timeout after 120 seconds')), 120000)
        )
      ]);

      const apiCallTime = Date.now() - apiCallStart;

      console.log('✅ [SUCCESS] Google Vision API response received:', {
        responseTime: `${apiCallTime}ms`,
        callNumber: this.apiCallCount,
        hasResult: Boolean(result),
        timestamp: new Date().toISOString()
      });

      console.log('[DEBUG Vision] Raw API response:', {
        hasResult: Boolean(result),
        hasTextAnnotations: Boolean(result?.textAnnotations),
        textAnnotationsCount: result?.textAnnotations?.length || 0,
        hasFullTextAnnotation: Boolean(result?.fullTextAnnotation),
        fullTextLength: result?.fullTextAnnotation?.text?.length || 0,
        processingTime: Date.now() - startTime
      });

      const textAnnotations = result.textAnnotations || [];
      const { fullTextAnnotation } = result;

      if (!fullTextAnnotation || !fullTextAnnotation.text) {
        console.log('🚨 [API RESULT] No text detected in image - but API call was made');

        const emptyResult = {
          text: '',
          confidence: 0,
          textAnnotations: []
        };

        // 🚨 CRITICAL: STILL LOG THE API CALL - IT WAS MADE AND BILLED
        await ApiCallTracker.completeApiCall(tracking.requestId, tracking.startTime, emptyResult);

        return emptyResult;
      }

      const confidence = this.calculateConfidence(textAnnotations);
      const trimmedText = fullTextAnnotation.text.trim();

      console.log('🔥 [EXTENSIVE DEBUG] OCR TEXT EXTRACTION SUCCESS:', {
        originalTextLength: fullTextAnnotation.text.length,
        trimmedTextLength: trimmedText.length,
        confidence,
        textAnnotationsCount: textAnnotations.length,
        pagesCount: fullTextAnnotation.pages?.length || 0,
        textPreview: `${trimmedText.substring(0, 300)}...`,
        processingTime: Date.now() - startTime,
        callNumber: this.apiCallCount,
        apiQuotaUsed: `${this.apiCallCount}/${this.apiQuotaLimit}`,
        rateLimitStatus: `${this.callTimestamps.length}/${this.rateLimitPerMinute} calls/min`,
        timestamp: new Date().toISOString()
      });

      // 🚨 COMPREHENSIVE DEBUG: Log detailed textAnnotations analysis
      console.log('🚨 [COMPREHENSIVE DEBUG] textAnnotations ANALYSIS:');
      console.log(`📊 Total textAnnotations: ${textAnnotations.length}`);

      if (textAnnotations.length > 0) {
        console.log('📝 First 10 textAnnotations with coordinates:');
        textAnnotations.slice(0, 10).forEach((annotation, i) => {
          const vertices = annotation.boundingPoly?.vertices || [];
          const avgY = vertices.length > 0 ? vertices.reduce((sum, v) => sum + (v.y || 0), 0) / vertices.length : 'NO_Y';
          const avgX = vertices.length > 0 ? vertices.reduce((sum, v) => sum + (v.x || 0), 0) / vertices.length : 'NO_X';

          console.log(`  ${i + 1}. "${annotation.description}" at (${avgX}, ${avgY}) confidence=${annotation.confidence || 'none'}`);
        });

        if (textAnnotations.length > 10) {
          console.log(`... and ${textAnnotations.length - 10} more textAnnotations`);
        }
      } else {
        console.log('❌ NO textAnnotations found - this is a critical problem!');
      }

      // 🚨 COMPREHENSIVE DEBUG: Log fullTextAnnotation structure
      console.log('🚨 [COMPREHENSIVE DEBUG] fullTextAnnotation STRUCTURE:');
      if (fullTextAnnotation.pages && fullTextAnnotation.pages.length > 0) {
        const page = fullTextAnnotation.pages[0];

        console.log(`📄 Pages: ${fullTextAnnotation.pages.length}`);
        console.log(`📦 Blocks: ${page.blocks?.length || 0}`);
        console.log(`📝 Paragraphs: ${page.blocks?.reduce((sum, block) => sum + (block.paragraphs?.length || 0), 0) || 0}`);
        console.log(`🔤 Words: ${page.blocks?.reduce((sum, block) =>
          sum + (block.paragraphs?.reduce((pSum, para) =>
            pSum + (para.words?.length || 0), 0) || 0), 0) || 0}`);
      } else {
        console.log('❌ NO pages found in fullTextAnnotation!');
      }

      // VALIDATE TEXT EXTRACTION
      if (trimmedText.length === 0) {
        console.error('💥 [OCR FAILURE] No text extracted from image!');
      } else if (trimmedText.length < 100) {
        console.warn('⚠️ [OCR WARNING] Very short text extracted:', trimmedText.length, 'characters');
      } else {
        console.log('✅ [OCR SUCCESS] Good text extraction:', trimmedText.length, 'characters');
      }

      const apiResult = {
        text: trimmedText,
        confidence,
        textAnnotations, // Keep ALL coordinates for spatial segmentation
        pages: fullTextAnnotation.pages || [], // 🔥 CRITICAL: Use hierarchical coordinate data for DOCUMENT_TEXT_DETECTION
        fullTextAnnotation // 🔥 Complete structured response for dense text processing
      };

      // 🚨 CRITICAL: LOG SUCCESSFUL API CALL
      await ApiCallTracker.completeApiCall(tracking.requestId, tracking.startTime, apiResult);

      return apiResult;

    } catch (error) {
      console.error('🚨 [API ERROR] Google Vision API error:', {
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        stack: error.stack,
        processingTime: Date.now() - startTime
      });

      // 🚨 CRITICAL: LOG FAILED API CALL
      if (tracking) {
        await ApiCallTracker.completeApiCall(tracking.requestId, tracking.startTime, null, error);
      }

      // 🚨 NO MOCK RESPONSES - THROW ERROR TO PREVENT UNTRACKED USAGE
      console.error('🚨 [CRITICAL] Google Vision API call failed - NO FALLBACK ALLOWED');
      console.error('🚨 [BILLING PROTECTION] Throwing error to prevent untracked API usage');

      throw error; // Re-throw the original error - NO MOCK FALLBACK
    }
  }

  /**
   * Calculate overall confidence from text annotations
   * @param {Array} textAnnotations
   * @returns {number} Average confidence score
   */
  calculateConfidence(textAnnotations) {
    if (!textAnnotations || textAnnotations.length === 0) return 0;

    const confidences = textAnnotations
      .filter(annotation => annotation.confidence !== undefined)
      .map(annotation => annotation.confidence);

    if (confidences.length === 0) return 0.8; // Default confidence

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  // 🚨 REMOVED: extractTextAdvanced - SAME API CALL as extractText()
  // Just use extractText() with options - no need for duplicate methods
  async extractTextAdvanced(base64Image, options = {}) {
    throw new Error('🚨 DEPRECATED: extractTextAdvanced() is the same API call as extractText(). Use extractText() with options instead.');
  }

  // 🚨 REMOVED: batchExtractText and processBatch - NOT single API calls
  // ONLY extractText() with stitched images = TRUE single API call approach

  /**
   * Async text extraction for concurrent processing
   * @param {string} base64Image - Base64 encoded image
   * @param {Object} options - OCR options
   * @returns {Promise<Object>} OCR result
   */
  async extractTextAsync(base64Image, options = {}) {
    // 🚨 ALL ASYNC CALLS GO THROUGH TRACKED extractText METHOD
    console.log('🚨 [REDIRECT] extractTextAsync redirecting to fully tracked extractText method');
    return await this.extractText(base64Image, options);
  }

  // 🚨 MOCK RESPONSES DELETED FOR BILLING PROTECTION
  // NO FALLBACK METHODS ALLOWED - ALL API CALLS MUST BE TRACKED

  /**
   * Process image file buffer
   * @param {Buffer} imageBuffer - Image file buffer
   * @param {Object} options - OCR options
   * @returns {Promise<Object>} OCR result
   */
  async processImageBuffer(imageBuffer, options = {}) {
    const base64Image = imageBuffer.toString('base64');

    return await this.extractText(base64Image, options);
  }

  /**
   * Check if Google Vision API is available
   * @returns {boolean} True if API is configured and available
   */
  isAvailable() {
    return this.initialized;
  }

  /**
   * Get API status information
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasServiceAccount: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      hasApiKey: Boolean(process.env.GOOGLE_VISION_API_KEY),
      client: this.client ? 'configured' : 'not configured'
    };
  }
}

// Export singleton instance
export default new GoogleVisionService();
