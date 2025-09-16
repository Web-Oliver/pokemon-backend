/**
 * Google Vision OCR Provider
 *
 * Infrastructure implementation for Google Cloud Vision API.
 * Single Responsibility: Google Vision API integration only.
 */

import vision from '@google-cloud/vision';
import Logger from '@/system/logging/Logger.js';

export class GoogleVisionOcrProvider {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.rateLimiter = new Map(); // Rate limiting storage
    this.failureCount = 0;
    this.lastFailure = null;
    this.maxRetries = 3;
    this.backoffMultiplier = 1000; // Start with 1 second
  }

  /**
   * Initialize Google Vision client
   */
  async initialize() {
    if (this.initialized) return;

    try {
      Logger.info('GoogleVisionOcrProvider', 'Initializing Google Vision client...');

      // Configure client based on available credentials
      const clientConfig = {
        fallback: true // Use REST fallback to avoid gRPC issues
      };

      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Use service account authentication
        this.client = new vision.ImageAnnotatorClient(clientConfig);
        Logger.info('GoogleVisionOcrProvider', '✅ Initialized with service account credentials');
      } else if (process.env.GOOGLE_VISION_API_KEY) {
        // Use API key authentication
        clientConfig.apiKey = process.env.GOOGLE_VISION_API_KEY;
        this.client = new vision.ImageAnnotatorClient(clientConfig);
        Logger.info('GoogleVisionOcrProvider', '✅ Initialized with API key');
      } else {
        throw new Error('No Google Vision credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_VISION_API_KEY');
      }

      // Test the connection
      await this.testConnection();

      this.initialized = true;
      Logger.info('GoogleVisionOcrProvider', '✅ Google Vision provider ready');

    } catch (error) {
      Logger.error('GoogleVisionOcrProvider', '❌ Failed to initialize:', error);
      throw new Error(`Google Vision initialization failed: ${error.message}`);
    }
  }

  /**
   * Extract text from image buffer
   * @param {Buffer} imageBuffer - Image data as buffer
   * @returns {Promise<Object>} OCR response with text and annotations
   */
  async extractText(imageBuffer) {
    await this.initialize();

    if (!Buffer.isBuffer(imageBuffer)) {
      throw new Error('Image data must be a Buffer');
    }

    try {
      Logger.info('GoogleVisionOcrProvider', 'Extracting text from image');

      // Check rate limiting
      await this.enforceRateLimit();

      // Prepare request
      const request = {
        image: { content: imageBuffer },
        features: [
          {
            type: 'TEXT_DETECTION', // ✅ FIXED: Use TEXT_DETECTION for PSA labels (better for simple text)
            maxResults: 50 // Optimized for PSA labels
          }
        ],
        imageContext: {
          languageHints: ['en', 'ja'],
          textDetectionParams: {
            enableTextDetectionConfidenceScore: true // Enable confidence scores
          }
        }
      };

      // Call Google Vision API
      const startTime = Date.now();
      const [result] = await this.client.annotateImage(request);
      const processingTime = Date.now() - startTime;

      Logger.info('GoogleVisionOcrProvider', `Text extraction completed in ${processingTime}ms`);

      // ✅ DEBUG: Log the actual API response structure
      Logger.info('GoogleVisionOcrProvider', 'API Response Structure', {
        hasTextAnnotations: !!result.textAnnotations,
        textAnnotationsLength: result.textAnnotations?.length || 0,
        hasFullTextAnnotation: !!result.fullTextAnnotation,
        hasError: !!result.error,
        firstAnnotationHasBoundingPoly: result.textAnnotations?.[0]?.boundingPoly ? true : false,
        firstAnnotationSample: result.textAnnotations?.[0] ? {
          description: result.textAnnotations[0].description?.substring(0, 50),
          hasBoundingPoly: !!result.textAnnotations[0].boundingPoly,
          hasVertices: !!result.textAnnotations[0].boundingPoly?.vertices
        } : null
      });

      // Check for errors
      if (result.error) {
        throw new Error(`Google Vision API error: ${result.error.message}`);
      }

      // Extract text annotations - try both response formats
      let textAnnotations = result.textAnnotations || [];

      // ✅ FALLBACK: If no textAnnotations, try fullTextAnnotation
      if (textAnnotations.length === 0 && result.fullTextAnnotation) {
        Logger.info('GoogleVisionOcrProvider', 'Using fullTextAnnotation as fallback');

        // Extract from structured response
        if (result.fullTextAnnotation.pages) {
          textAnnotations = [];
          result.fullTextAnnotation.pages.forEach(page => {
            page.blocks?.forEach(block => {
              block.paragraphs?.forEach(paragraph => {
                paragraph.words?.forEach(word => {
                  const wordText = word.symbols?.map(s => s.text).join('') || '';
                  if (wordText && word.boundingBox) {
                    textAnnotations.push({
                      description: wordText,
                      boundingPoly: word.boundingBox,
                      confidence: word.confidence
                    });
                  }
                });
              });
            });
          });
        }

        // Add full text as first annotation
        if (result.fullTextAnnotation.text) {
          textAnnotations.unshift({
            description: result.fullTextAnnotation.text,
            boundingPoly: result.fullTextAnnotation.pages?.[0]?.blocks?.[0]?.boundingBox
          });
        }
      }

      const fullText = textAnnotations.length > 0 ? textAnnotations[0].description : '';

      // ✅ FINAL DEBUG: Log what we're returning
      Logger.info('GoogleVisionOcrProvider', 'Final extraction result', {
        textAnnotationsLength: textAnnotations.length,
        fullTextLength: fullText.length,
        annotationsWithBoundingBoxes: textAnnotations.filter(a => a.boundingPoly?.vertices).length,
        sampleAnnotations: textAnnotations.slice(1, 4).map(a => ({
          text: a.description?.substring(0, 20),
          hasBoundingPoly: !!a.boundingPoly,
          verticesCount: a.boundingPoly?.vertices?.length || 0
        }))
      });

      return {
        textAnnotations,
        fullText,
        processingTime,
        provider: 'google-vision'
      };

    } catch (error) {
      Logger.error('GoogleVisionOcrProvider', 'Text extraction failed:', error);
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  // REMOVED: extractTextBatch - Google Vision batch processing (alternative to stitching)

  /**
   * Get provider status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      initialized: this.initialized,
      provider: 'google-vision',
      hasCredentials: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_VISION_API_KEY),
      rateLimitStatus: this.getRateLimitStatus()
    };
  }

  /**
   * Test the connection to Google Vision API
   * @private
   */
  async testConnection() {
    try {
      // Create a minimal test image (1x1 pixel white image)
      const testImage = Buffer.from([
        137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
        0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222,
        0, 0, 0, 12, 73, 68, 65, 84, 8, 215, 99, 248, 15, 0, 0, 1,
        0, 1, 90, 250, 46, 237, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
      ]);

      const [result] = await this.client.textDetection({ image: { content: testImage } });
      Logger.info('GoogleVisionOcrProvider', '✅ Connection test successful');

      return true;
    } catch (error) {
      Logger.error('GoogleVisionOcrProvider', '❌ Connection test failed:', error);
      throw error;
    }
  }

  /**
   * Enforce rate limiting
   * @private
   */
  async enforceRateLimit() {
    const now = Date.now();
    const windowMs = 60000; // 1 minute window
    const maxRequests = 60; // Max requests per minute

    // Clean old entries
    for (const [timestamp, count] of this.rateLimiter.entries()) {
      if (now - timestamp > windowMs) {
        this.rateLimiter.delete(timestamp);
      }
    }

    // Count recent requests
    const recentRequests = Array.from(this.rateLimiter.values()).reduce((sum, count) => sum + count, 0);

    if (recentRequests >= maxRequests) {
      const waitTime = windowMs - (now % windowMs);
      Logger.warn('GoogleVisionOcrProvider', `Rate limit reached. Waiting ${waitTime}ms`);

      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Record this request
    const currentMinute = Math.floor(now / windowMs) * windowMs;
    const currentCount = this.rateLimiter.get(currentMinute) || 0;
    this.rateLimiter.set(currentMinute, currentCount + 1);
  }

  /**
   * Get current rate limit status
   * @private
   */
  getRateLimitStatus() {
    const now = Date.now();
    const windowMs = 60000;
    const maxRequests = 60;

    // Count recent requests
    let recentRequests = 0;
    for (const [timestamp, count] of this.rateLimiter.entries()) {
      if (now - timestamp <= windowMs) {
        recentRequests += count;
      }
    }

    return {
      recentRequests,
      maxRequests,
      remainingRequests: Math.max(0, maxRequests - recentRequests),
      windowMs
    };
  }
}
