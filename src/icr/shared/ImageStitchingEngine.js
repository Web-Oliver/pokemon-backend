/**
 * Image Stitching Engine - Centralized Stitching Logic
 *
 * ELIMINATES CODE DUPLICATION by providing a single implementation
 * for all stitching operations across the ICR system.
 *
 * BEFORE: 150+ lines duplicated between IcrStitchingService & IcrStitchingOrchestrator
 * AFTER: Single source of truth for all stitching logic
 */

import sharp from 'sharp';
import Logger from '@/system/logging/Logger.js';

export class ImageStitchingEngine {
  /**
   * Create vertical stitched image from label buffers
   * SINGLE IMPLEMENTATION - no more duplication
   */
  static async createVerticalStitchedImage(labelBuffers, options = {}) {
    const { quality = 90 } = options;

    try {
      const startTime = Date.now();
      Logger.info('ImageStitchingEngine', `📐 Creating vertical stitched image from ${labelBuffers.length} labels`);

      const dimensionResult = await this.createDynamicDimensionComposite(labelBuffers);
      const finalWidth = dimensionResult.width;
      const finalHeight = dimensionResult.height;
      const compositeOperations = dimensionResult.operations;

      // Create final stitched image
      const stitchedBuffer = await sharp({
        create: {
          width: finalWidth,
          height: finalHeight,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      })
      .composite(compositeOperations)
      .jpeg({ quality })
      .toBuffer();

      const processingTime = Date.now() - startTime;

      Logger.info('ImageStitchingEngine', `✅ Stitched image created: ${finalWidth}x${finalHeight} (${processingTime}ms)`);

      return {
        buffer: stitchedBuffer,
        width: finalWidth,
        height: finalHeight,
        labelCount: labelBuffers.length,
        labelPositions: dimensionResult.labelPositions,
        processingTime
      };

    } catch (error) {
      Logger.error('ImageStitchingEngine', 'Failed to create stitched image:', error);
      throw error;
    }
  }


  /**
   * Dynamic dimension composite (preserves original label dimensions)
   * @private
   */
  static async createDynamicDimensionComposite(labelBuffers) {
    const labelMetas = await Promise.all(labelBuffers.map(buffer => sharp(buffer).metadata()));
    const maxWidth = Math.max(...labelMetas.map(meta => meta.width));

    const compositeOperations = [];
    const labelPositions = [];
    let currentTop = 0;

    Logger.info('ImageStitchingEngine', `Processing ${labelBuffers.length} labels with max width: ${maxWidth}px`);

    for (let i = 0; i < labelBuffers.length; i++) {
      const originalWidth = labelMetas[i].width;
      const originalHeight = labelMetas[i].height;

      Logger.info('ImageStitchingEngine', `Label ${i}: ${originalWidth}x${originalHeight}px`);

      // FIXED: Preserve aspect ratio and text quality
      const processedBuffer = await sharp(labelBuffers[i])
        // Only resize if image is larger than max width, preserve aspect ratio
        .resize(originalWidth > maxWidth ? maxWidth : null, null, {
          fit: 'inside',           // Preserve aspect ratio
          withoutEnlargement: true, // Don't enlarge small images
          kernel: sharp.kernel.lanczos3 // High-quality resampling
        })
        // Enhance text quality
        .sharpen(1.0, 1.0, 2.0)    // Sharpen text edges
        .normalize()               // Improve contrast
        .png({ quality: 100 })     // Use lossless format for text
        .toBuffer();

      // Get actual dimensions after processing
      const processedMeta = await sharp(processedBuffer).metadata();
      const actualWidth = processedMeta.width;
      const actualHeight = processedMeta.height;

      Logger.info('ImageStitchingEngine', `Label ${i} processed: ${actualWidth}x${actualHeight}px`);

      // Center horizontally if image is narrower than max width
      const leftOffset = Math.max(0, Math.floor((maxWidth - actualWidth) / 2));

      compositeOperations.push({
        input: processedBuffer,
        left: leftOffset,
        top: currentTop
      });

      // Record actual positioned coordinates for accurate text distribution
      labelPositions.push({
        index: i,
        y: currentTop,
        height: actualHeight,
        actualWidth: actualWidth,
        leftOffset: leftOffset,
        originalWidth: originalWidth,
        originalHeight: originalHeight,
        aspectRatioPreserved: true
      });

      // Add padding between labels to prevent text bleeding
      currentTop += actualHeight + 5; // 5px padding
    }

    Logger.info('ImageStitchingEngine', `Final stitched dimensions: ${maxWidth}x${currentTop}px`);

    return {
      operations: compositeOperations,
      width: maxWidth,
      height: currentTop,
      labelPositions
    };
  }

  /**
   * Calculate final stitched dimensions without processing
   */
  static async calculateStitchedDimensions(labelBuffers) {
    const labelMetas = await Promise.all(labelBuffers.map(buffer => sharp(buffer).metadata()));
    const maxWidth = Math.max(...labelMetas.map(meta => meta.width));
    const totalHeight = labelMetas.reduce((sum, meta) => sum + meta.height, 0);

    return {
      width: maxWidth,
      height: totalHeight,
      labelCount: labelBuffers.length
    };
  }
}