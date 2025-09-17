/**
 * ICR Stitching Service - CLEAN IMPLEMENTATION
 *
 * REUSES existing GoogleVisionOcrProvider - NO DUPLICATION
 * Returns complete textAnnotations with bounding box coordinates for precise text mapping
 */

import {GoogleVisionOcrProvider} from '@/icr/infrastructure/external/GoogleVisionOcrProvider.js';
import {ImageStitchingEngine} from '@/icr/shared/ImageStitchingEngine.js';
import path from 'path';
import {promises as fs} from 'fs';
import Logger from '@/system/logging/Logger.js';

class IcrStitchingService {
    constructor() {
        // REUSE existing GoogleVisionOcrProvider - NO DUPLICATION
        this.googleVisionProvider = new GoogleVisionOcrProvider();

        // ICR-specific directories
        this.icrUploadsDir = path.join(process.cwd(), 'uploads', 'icr');
        this.stitchedImagesDir = path.join(this.icrUploadsDir, 'stitched-images');

        this.ensureDirectories();
    }

    async ensureDirectories() {
        const dirs = [this.icrUploadsDir, this.stitchedImagesDir];
        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, {recursive: true});
            } catch (error) {
                Logger.error('IcrStitchingService', `Failed to create directory ${dir}:`, error);
            }
        }
    }

    /**
     * Create vertical stitched image from extracted label buffers
     * REFACTORED: Uses centralized ImageStitchingEngine - NO MORE DUPLICATION
     */
    async createVerticalStitchedImage(imageBuffers, batchId) {
        try {
            Logger.info('IcrStitchingService', `📐 Creating VERTICAL stitched image from ${imageBuffers.length} labels`);

            // Use centralized stitching engine
            const stitchResult = await ImageStitchingEngine.createVerticalStitchedImage(imageBuffers, {
                quality: 90
            });

            // Save stitched image
            const filename = `${batchId}_stitched.jpg`;
            const stitchedImagePath = path.join(this.stitchedImagesDir, filename);
            await fs.writeFile(stitchedImagePath, stitchResult.buffer);

            Logger.info('IcrStitchingService', `✅ VERTICAL stitched image created: ${filename} (${stitchResult.processingTime}ms)`);

            return {
                stitchedImagePath,
                width: stitchResult.width,
                height: stitchResult.height,
                labelCount: stitchResult.labelCount,
                labelPositions: stitchResult.labelPositions,
                processingTime: stitchResult.processingTime
            };

        } catch (error) {
            Logger.error('IcrStitchingService', 'Failed to create stitched image:', error);
            throw error;
        }
    }

    /**
     * Run Google Vision OCR on stitched image
     * REUSES existing GoogleVisionOcrProvider - returns complete textAnnotations with coordinates
     */
    async runGoogleVisionOCR(stitchedImagePath) {
        try {
            const startTime = Date.now();

            Logger.info('IcrStitchingService', `🤖 Running OCR on stitched image: ${path.basename(stitchedImagePath)}`);

            // REUSE existing GoogleVisionOcrProvider
            await this.googleVisionProvider.initialize();

            const stitchedBuffer = await fs.readFile(stitchedImagePath);
            const ocrResult = await this.googleVisionProvider.extractText(stitchedBuffer);

            const processingTime = Date.now() - startTime;

            Logger.info('IcrStitchingService', `🤖 OCR completed: ${ocrResult.fullText?.length || 0} characters (${processingTime}ms)`);
            Logger.info('IcrStitchingService', `📍 Text annotations: ${ocrResult.textAnnotations?.length || 0} blocks with coordinates`);

            // Return complete OCR result with textAnnotations containing coordinates
            return {
                fullText: ocrResult.fullText,
                textAnnotations: ocrResult.textAnnotations, // Contains bounding boxes with vertices
                processingTime: ocrResult.processingTime + processingTime,
                provider: ocrResult.provider
            };

        } catch (error) {
            Logger.error('IcrStitchingService', 'OCR processing failed:', error);
            throw error;
        }
    }


    /**
     * Generate unique batch ID
     */
    generateBatchId() {
        return `icr_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get processing statistics
     */
    async getProcessingStats() {
        try {
            const files = await fs.readdir(this.stitchedImagesDir);
            const stitchedImages = files.filter(file => file.endsWith('.jpg'));

            return {
                totalStitchedImages: stitchedImages.length,
                stitchedImagesDirectory: this.stitchedImagesDir,
                reusesExistingOcrProvider: true,
                returnsCoordinateData: true
            };
        } catch (error) {
            return {error: 'Failed to get stats'};
        }
    }
}

export default new IcrStitchingService();
