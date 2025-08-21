import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import Logger from '@/Infrastructure/Utilities/Logger.js';
/**
 * PSA Red Label Detection Service
 * Ported from Context7OcrPreprocessor.ts for server-side use with Sharp
 *
 * This service detects and extracts PSA red labels from Pokemon card images
 * using HSV color space analysis and smart cropping strategies
 */
class PsaLabelDetectionService {
  constructor() {
    // PSA red label HSV color range (ported from frontend)
    this.PSA_RED_HSV_RANGE = {
      hueMin: 0,
      hueMax: 15,
      saturationMin: 50,
      valueMin: 50
    };
  }

  /**
   * Extract PSA label from card image using color-based detection
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {Object} options - Detection options
   * @returns {Buffer} - Extracted PSA label image buffer
   */
  async extractPsaLabel(imageBuffer, options = {}) {
    try {
      const startTime = Date.now();

      Logger.info('PsaLabelDetectionService', 'Starting PSA label extraction');

      // Get image metadata
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const { width, height } = metadata;

      Logger.info('PsaLabelDetectionService', `Image dimensions: ${width}x${height}`);

      // Convert to RGB format for color analysis
      const { data } = await image
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Detect red label region using HSV analysis
      const cropRegion = options.cropStrategy === 'color-based' || !options.cropStrategy
        ? await this.detectRedLabelRegion(data, width, height)
        : this.getFixedCropRegion(width, height);

      Logger.info('PsaLabelDetectionService', `Detected crop region: ${JSON.stringify(cropRegion)}`);

      // Extract the detected region
      const extractedBuffer = await sharp(imageBuffer)
        .extract({
          left: Math.max(0, cropRegion.x),
          top: Math.max(0, cropRegion.y),
          width: Math.min(cropRegion.width, width - cropRegion.x),
          height: Math.min(cropRegion.height, height - cropRegion.y)
        })
        .jpeg({ quality: 95 })
        .toBuffer();

      // Apply enhancements if specified
      const enhancedBuffer = options.enhanceContrast !== false
        ? await this.enhanceForOcr(extractedBuffer, options)
        : extractedBuffer;

      const processingTime = Date.now() - startTime;

      Logger.info('PsaLabelDetectionService', `PSA label extraction completed in ${processingTime}ms`);

      return {
        labelBuffer: enhancedBuffer,
        cropRegion,
        processingTime,
        originalDimensions: { width, height },
        extractedDimensions: await this.getImageDimensions(enhancedBuffer)
      };

    } catch (error) {
      Logger.error('PsaLabelDetectionService', 'Error extracting PSA label:', error);
      throw error;
    }
  }

  /**
   * Detect red label region using HSV color space analysis - MINIMAL AREA ONLY
   * Updated to extract ONLY the red PSA label rectangle, not entire top section
   */
  async detectRedLabelRegion(rgbData, width, height) {
    try {
      let redPixelCount = 0;
      let totalPixels = 0;
      let minY = height;
      let maxY = 0;
      let minX = width;
      let maxX = 0;

      // Scan top 25% of image for red pixels - reduced from 30%
      const scanHeight = Math.floor(height * 0.25);

      for (let y = 0; y < scanHeight; y++) {
        for (let x = 0; x < width; x++) {
          const pixelIndex = (y * width + x) * 3; // RGB format
          const r = rgbData[pixelIndex];
          const g = rgbData[pixelIndex + 1];
          const b = rgbData[pixelIndex + 2];

          const hsv = this.rgbToHsv(r, g, b);

          if (this.isRedLabelColor(hsv)) {
            redPixelCount++;
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
          totalPixels++;
        }
      }

      const redRatio = redPixelCount / totalPixels;

      Logger.info('PsaLabelDetectionService', `Red pixel analysis: ${redPixelCount}/${totalPixels} (${(redRatio * 100).toFixed(2)}%)`);

      // If significant red content found, use TIGHT bounding box around red pixels
      if (redRatio > 0.05) { // Lower threshold for better detection
        // MINIMAL padding - just 5px instead of 20px
        const minimalPadding = 5;

        const detectedRegion = {
          x: Math.max(0, minX - minimalPadding),
          y: Math.max(0, minY - minimalPadding),
          width: Math.min(width, maxX - minX + minimalPadding * 2),
          height: Math.min(height, maxY - minY + minimalPadding * 2)
        };

        // Additional validation - PSA labels should have reasonable aspect ratio
        const aspectRatio = detectedRegion.width / detectedRegion.height;

        // PSA labels are typically wide rectangles (aspect ratio > 2.0)
        if (aspectRatio > 2.0 && detectedRegion.width > 200 && detectedRegion.height > 30) {
          Logger.info('PsaLabelDetectionService', `MINIMAL red label detected: ${JSON.stringify(detectedRegion)} (AR: ${aspectRatio.toFixed(2)})`);
          return detectedRegion;
        }
          Logger.info('PsaLabelDetectionService', `Red pixels found but invalid dimensions (AR: ${aspectRatio.toFixed(2)}) - using minimal fixed region`);

      }

      // Fallback to MUCH smaller fixed region - just the typical PSA label area
      Logger.info('PsaLabelDetectionService', 'Using minimal fixed PSA label region');
      return this.getMinimalPsaLabelRegion(width, height);

    } catch (error) {
      Logger.error('PsaLabelDetectionService', 'Error in red label detection:', error);
      // Fallback to minimal region on error
      return this.getMinimalPsaLabelRegion(width, height);
    }
  }

  /**
   * Get minimal PSA label region - MUCH smaller than original 15%
   * Updated to extract only the essential PSA red label rectangle
   */
  getMinimalPsaLabelRegion(width, height) {
    // PSA labels are typically around 8-10% of card height and positioned near top
    const labelHeight = Math.floor(height * 0.08); // Reduced from 15% to 8%
    const labelY = Math.floor(height * 0.02); // Start slightly below top edge

    return {
      x: Math.floor(width * 0.05), // Small margin from left edge
      y: labelY,
      width: Math.floor(width * 0.9), // 90% of width to avoid edges
      height: labelHeight
    };
  }

  /**
   * Get fixed crop region (Context7 optimized 15% from top)
   * Ported from Context7OcrPreprocessor.ts getFixedCropRegion method
   */
  getFixedCropRegion(width, height) {
    return {
      x: 0,
      y: 0,
      width,
      height: Math.floor(height * 0.15) // Context7 research: 15% optimal for PSA labels
    };
  }

  /**
   * RGB to HSV conversion
   * Ported from Context7OcrPreprocessor.ts rgbToHsv method
   */
  rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;

    if (delta !== 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;

    const s = max === 0 ? 0 : delta / max;
    const v = max;

    return { h, s: s * 100, v: v * 100 };
  }

  /**
   * Check if color matches PSA red label
   * Ported from Context7OcrPreprocessor.ts isRedLabelColor method
   */
  isRedLabelColor(hsv) {
    return (
      (hsv.h <= this.PSA_RED_HSV_RANGE.hueMax || hsv.h >= 345) &&
      hsv.s >= this.PSA_RED_HSV_RANGE.saturationMin &&
      hsv.v >= this.PSA_RED_HSV_RANGE.valueMin
    );
  }

  /**
   * Enhance extracted label for better OCR results
   * Ported concept from Context7OcrPreprocessor.ts enhancement methods
   */
  async enhanceForOcr(imageBuffer, options = {}) {
    try {
      let image = sharp(imageBuffer);

      // Apply contrast enhancement (similar to applyAdvancedContrast)
      if (options.enhanceContrast !== false) {
        image = image.modulate({
          brightness: 1.05, // Slight brightness boost
          saturation: 0.7, // Reduce saturation for better text clarity
        });
      }

      // Apply sharpening (similar to applyEdgeEnhancement)
      if (options.edgeEnhancement !== false) {
        image = image.sharpen({
          sigma: 1.0,
          flat: 0.5,
          jagged: 2.0
        });
      }

      // Apply gamma correction for better contrast (similar to applyContrastCurve)
      if (options.gammaCorrection !== false) {
        image = image.gamma(1.2); // Enhance darker areas (Sharp requires 1.0-3.0)
      }

      // Convert to high-quality JPEG
      const enhancedBuffer = await image
        .jpeg({ quality: 95, mozjpeg: true })
        .toBuffer();

      Logger.info('PsaLabelDetectionService', 'Applied OCR enhancements');
      return enhancedBuffer;

    } catch (error) {
      Logger.error('PsaLabelDetectionService', 'Error enhancing image for OCR:', error);
      return imageBuffer; // Return original on error
    }
  }

  /**
   * Process multiple card images and extract PSA labels from each
   * @param {Array} imageBuffers - Array of image buffers
   * @param {Object} options - Processing options
   * @returns {Array} - Array of extracted PSA label buffers
   */
  async extractMultiplePsaLabels(imageBuffers, options = {}) {
    try {
      Logger.info('PsaLabelDetectionService', `Extracting PSA labels from ${imageBuffers.length} images`);

      const results = [];

      for (let i = 0; i < imageBuffers.length; i++) {
        try {
          const result = await this.extractPsaLabel(imageBuffers[i], options);

          results.push({
            index: i,
            success: true,
            ...result
          });
          Logger.info('PsaLabelDetectionService', `Successfully extracted label ${i + 1}/${imageBuffers.length}`);
        } catch (error) {
          Logger.error('PsaLabelDetectionService', `Failed to extract label ${i + 1}:`, error);
          results.push({
            index: i,
            success: false,
            error: error.message,
            labelBuffer: imageBuffers[i] // Use original image as fallback
          });
        }
      }

      const successCount = results.filter(r => r.success).length;

      Logger.info('PsaLabelDetectionService', `Label extraction completed: ${successCount}/${imageBuffers.length} successful`);

      return results;

    } catch (error) {
      Logger.error('PsaLabelDetectionService', 'Error processing multiple PSA labels:', error);
      throw error;
    }
  }

  /**
   * Validate if image contains PSA label characteristics
   * @param {Buffer} imageBuffer - Image buffer to validate
   * @returns {Object} - Validation result with confidence score
   */
  async validatePsaLabel(imageBuffer) {
    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();
      const { width, height } = metadata;

      // Quick validation checks
      let confidence = 0;
      const validations = [];

      // Check aspect ratio (PSA labels are typically taller than wide)
      const aspectRatio = width / height;

      if (aspectRatio < 0.8) {
        confidence += 0.3;
        validations.push('Good aspect ratio for PSA label');
      }

      // Check for red content in top portion
      const { data } = await image
        .extract({ left: 0, top: 0, width, height: Math.min(height, Math.floor(height * 0.3)) })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      let redPixels = 0;
      const totalPixels = data.length / 3;

      for (let i = 0; i < data.length; i += 3) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const hsv = this.rgbToHsv(r, g, b);

        if (this.isRedLabelColor(hsv)) {
          redPixels++;
        }
      }

      const redRatio = redPixels / totalPixels;

      if (redRatio > 0.05) {
        confidence += Math.min(0.4, redRatio * 4);
        validations.push(`Red content detected: ${(redRatio * 100).toFixed(2)}%`);
      }

      // Check image size (PSA labels should be reasonably sized)
      if (width > 200 && height > 300) {
        confidence += 0.2;
        validations.push('Good image dimensions');
      }

      // Confidence threshold
      const isPsaLabel = confidence > 0.5;

      return {
        isPsaLabel,
        confidence: Math.min(1.0, confidence),
        validations,
        aspectRatio,
        redContentRatio: redRatio
      };

    } catch (error) {
      Logger.error('PsaLabelDetectionService', 'Error validating PSA label:', error);
      return {
        isPsaLabel: false,
        confidence: 0,
        validations: [],
        error: error.message
      };
    }
  }

  /**
   * Get image dimensions from buffer
   */
  async getImageDimensions(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      return {
        width: metadata.width,
        height: metadata.height
      };
    } catch (error) {
      Logger.error('PsaLabelDetectionService', 'Error getting image dimensions:', error);
      return { width: 0, height: 0 };
    }
  }

  /**
   * Save extracted PSA label to file (for testing/debugging)
   */
  async saveExtractedLabel(labelBuffer, filename) {
    try {
      const outputDir = path.join(process.cwd(), 'uploads', 'extracted-labels');

      await fs.mkdir(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, filename);

      await fs.writeFile(outputPath, labelBuffer);

      Logger.info('PsaLabelDetectionService', `Extracted label saved: ${outputPath}`);
      return outputPath;
    } catch (error) {
      Logger.error('PsaLabelDetectionService', 'Error saving extracted label:', error);
      throw error;
    }
  }
}

export default new PsaLabelDetectionService();
