/**
 * Intelligent Image Naming Service
 *
 * Generates standardized filenames at upload time using date and hash
 * while maintaining hash-based deduplication and matching capabilities.
 */

import sharp from 'sharp';
import crypto from 'crypto';
import Logger from '@/system/logging/Logger.js';

export class IntelligentImageNamingService {
  constructor() {
    this.MAX_FILENAME_LENGTH = 200;
  }

  /**
   * Generate standardized filename at upload time
   */
  async generateUploadFilename(imageBuffer, originalFilename = '', imageHash = '') {
    try {
      Logger.info('IntelligentImageNamingService', 'Generating upload filename', {
        imageHashPreview: imageHash.substring(0, 8)
      });

      const metadata = await this.extractImageMetadata(imageBuffer);
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      const hashPreview = imageHash ? imageHash.substring(0, 8) : this.generateTempHash().substring(0, 8);

      const descriptiveFilename = `PSA-scan-${timestamp}-${hashPreview}.${metadata.format}`;
      const hashBasedFilename = this.constructHashBasedFilename(imageHash, metadata.format);

      const result = {
        descriptive: descriptiveFilename,
        storage: hashBasedFilename,
        fallback: descriptiveFilename,
        metadata: {
          format: metadata.format,
          dimensions: `${metadata.width}x${metadata.height}`,
          size: metadata.size,
          timestamp: Date.now()
        }
      };

      Logger.info('IntelligentImageNamingService', 'Generated upload filename', {
        descriptive: result.descriptive,
        storage: result.storage
      });

      return result;

    } catch (error) {
      Logger.error('IntelligentImageNamingService', 'Filename generation failed', error);
      return this.generateFallbackFilename(imageHash);
    }
  }

  /**
   * Extract image metadata using Sharp
   */
  async extractImageMetadata(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      return {
        format: metadata.format || 'jpg',
        width: metadata.width || 0,
        height: metadata.height || 0,
        size: metadata.size || 0
      };
    } catch (error) {
      Logger.warn('IntelligentImageNamingService', 'Metadata extraction failed, using defaults', error);
      return {
        format: 'jpg',
        width: 0,
        height: 0,
        size: 0
      };
    }
  }

  /**
   * Construct hash-based filename for storage (deduplication)
   */
  constructHashBasedFilename(imageHash, format) {
    if (!imageHash) {
      imageHash = this.generateTempHash();
    }

    const shortHash = imageHash.substring(0, 16);
    const timestamp = Date.now().toString(36);

    return `${shortHash}-${timestamp}.${format || 'jpg'}`;
  }

  /**
   * Generate fallback filename in case of errors
   */
  generateFallbackFilename(imageHash) {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const hashPreview = imageHash ? imageHash.substring(0, 8) : 'unknown';

    const fallbackName = `PSA-scan-${timestamp}-${hashPreview}.jpg`;

    return {
      descriptive: fallbackName,
      storage: fallbackName,
      fallback: fallbackName,
      metadata: {
        format: 'jpg',
        dimensions: 'unknown',
        size: 0,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Generate temporary hash for cases where hash is missing
   */
  generateTempHash() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Get recommended filename for different use cases
   */
  getRecommendedFilename(filenameInfo, useCase = 'descriptive') {
    switch (useCase) {
      case 'descriptive':
      case 'display':
        return filenameInfo.descriptive;

      case 'storage':
      case 'internal':
        return filenameInfo.storage;

      default:
        return filenameInfo.descriptive;
    }
  }
}

export default IntelligentImageNamingService;