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

    for (let i = 0; i < labelBuffers.length; i++) {
      const originalHeight = labelMetas[i].height;

      const resizedBuffer = await sharp(labelBuffers[i])
        .resize(maxWidth, originalHeight, { fit: 'fill' })
        .toBuffer();

      compositeOperations.push({
        input: resizedBuffer,
        left: 0,
        top: currentTop
      });

      labelPositions.push({
        index: i,
        y: currentTop,
        height: originalHeight
      });

      currentTop += originalHeight;
    }

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