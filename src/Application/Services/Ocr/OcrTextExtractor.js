/**
 * OCR Text Extractor Service
 * 
 * SINGLE RESPONSIBILITY: Extract text from images using OCR
 * NO OTHER RESPONSIBILITIES: parsing, matching, scoring
 */

import fs from 'fs';
import path from 'path';

/**
 * Google Vision OCR Text Extractor
 */
export class GoogleVisionOcrExtractor {
  constructor() {
    this.vision = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const vision = await import('@google-cloud/vision');
      this.vision = new vision.ImageAnnotatorClient();
      this.initialized = true;
      console.log('✅ Google Vision OCR initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Google Vision OCR:', error);
      throw new Error('Google Vision OCR initialization failed');
    }
  }

  /**
   * Extract text from image buffer
   */
  async extractText(imageBuffer) {
    await this.initialize();

    try {
      const [result] = await this.vision.textDetection({
        image: { content: imageBuffer }
      });

      const detections = result.textAnnotations;
      if (!detections || detections.length === 0) {
        return '';
      }

      return detections[0].description || '';
    } catch (error) {
      console.error('❌ OCR text extraction failed:', error);
      throw new Error(`OCR extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract text from image file path
   */
  async extractTextFromPath(imagePath) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const imageBuffer = fs.readFileSync(imagePath);
    return this.extractText(imageBuffer);
  }
}

/**
 * Mock OCR Text Extractor for Testing
 */
export class MockOcrTextExtractor {
  constructor() {
    this.mockResponses = new Map();
  }

  setMockResponse(imageIdentifier, text) {
    this.mockResponses.set(imageIdentifier, text);
  }

  async extractText(imageBuffer) {
    const identifier = this.hashBuffer(imageBuffer);
    
    if (this.mockResponses.has(identifier)) {
      return this.mockResponses.get(identifier);
    }

    return '2003 POKEMON JAPANESE # 025 AMPHAROS EX - HOLO NM - MT RULERS / HEAVENS 1ST ED . 8 70496958';
  }

  async extractTextFromPath(imagePath) {
    const fileName = path.basename(imagePath);
    
    if (this.mockResponses.has(fileName)) {
      return this.mockResponses.get(fileName);
    }

    return '2005 P.M. JAPANESE HOLON JOLTEON EX - HOLO # 004 NM - MT RESRCH TWR LGHTNG- 1ST ED 8 70496954';
  }

  hashBuffer(buffer) {
    return buffer.toString('base64').substring(0, 16);
  }
}

/**
 * OCR Text Extractor Factory
 */
export class OcrTextExtractorFactory {
  static create() {
    const isTestEnv = process.env.NODE_ENV === 'test';
    const isMockMode = process.env.OCR_MOCK_MODE === 'true';

    if (isTestEnv || isMockMode) {
      console.log('🧪 Using Mock OCR Text Extractor');
      return new MockOcrTextExtractor();
    }

    console.log('🔍 Using Google Vision OCR Text Extractor');
    return new GoogleVisionOcrExtractor();
  }
}