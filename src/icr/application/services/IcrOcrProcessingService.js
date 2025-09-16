/**
 * ICR OCR Processing Service
 *
 * Single Responsibility: Handle Google Vision OCR processing
 * Extracted from IcrBatchService to follow SRP
 */

import { GoogleVisionOcrProvider } from '@/icr/infrastructure/external/GoogleVisionOcrProvider.js';
import ImageHashService from '@/icr/shared/ImageHashService.js';
import OcrTextDistributor from '@/icr/shared/OcrTextDistributor.js';
import StitchedLabelRepository from '@/icr/infrastructure/repositories/StitchedLabelRepository.js';
import Logger from '@/system/logging/Logger.js';
import { promises as fs } from 'fs';
import path from 'path';

import OperationManager from '@/system/utilities/OperationManager.js';

export class IcrOcrProcessingService {
  constructor() {
    this.googleVisionProvider = new GoogleVisionOcrProvider();
    this.stitchedLabelRepository = new StitchedLabelRepository();
  }

  /**
   * STEP 3: Process OCR on stitched image
   * EXACT EXTRACTION from IcrBatchService.js lines 334-391
   */
  async processOcr(stitchedImagePath) {
    const context = OperationManager.createContext('IcrOcr', 'processOcr', {
      stitchedImagePath
    });

    return OperationManager.executeFileOperation(
      context,
      { fileName: path.basename(stitchedImagePath) },
      async () => {
        const stitchedBuffer = await fs.readFile(stitchedImagePath);
        const ocrResult = await this.googleVisionProvider.extractText(stitchedBuffer);

        // Find the StitchedLabel record to update
        const stitchedImageHash = ImageHashService.generateHash(stitchedBuffer);
        const stitchedLabel = await this.stitchedLabelRepository.findByHash(stitchedImageHash);

        if (!stitchedLabel) {
          throw new Error(`No StitchedLabel found for image hash: ${stitchedImageHash}`);
        }

        // Calculate overall confidence from text annotations
        const overallConfidence = ocrResult.textAnnotations && ocrResult.textAnnotations.length > 0
          ? ocrResult.textAnnotations[0].confidence || 0.85
          : 0.85;

        // Update StitchedLabel database record with OCR results
        await this.stitchedLabelRepository.update(stitchedLabel._id, {
          ocrText: ocrResult.fullText,
          ocrConfidence: overallConfidence,
          ocrAnnotations: ocrResult.textAnnotations,
          processingStatus: 'ocr_completed'
        });

        // Also save OCR results to JSON file for testing/backup
        const resultsPath = stitchedImagePath.replace('.jpg', '_ocr_results.json');
        await fs.writeFile(resultsPath, JSON.stringify({
          fullText: ocrResult.fullText,
          textAnnotations: ocrResult.textAnnotations,
          processingTime: ocrResult.processingTime,
          provider: ocrResult.provider,
          stitchedLabelId: stitchedLabel._id,
          confidence: overallConfidence
        }, null, 2));

        return {
          ...ocrResult,
          resultsPath,
          stitchedLabelId: stitchedLabel._id,
          confidence: overallConfidence,
          databaseUpdated: true
        };
      }
    );
  }

  /**
   * STEP 3B: Process OCR by batch ID (auto-detect stitched image)
   * EXACT EXTRACTION from IcrBatchService.js lines 396-423
   */
  async processOcrByBatch(batchId) {
    try {
      Logger.operationStart('ICR_OCR_BY_BATCH', 'Auto-detecting stitched image for OCR', { batchId });

      // Find most recent stitched label for this batch that hasn't been OCR processed yet
      const stitchedLabels = await this.stitchedLabelRepository.findMany({
        batchId,
        processingStatus: 'stitched'
      }, { sort: { createdAt: -1 }, limit: 1 });
      const stitchedLabel = stitchedLabels[0];

      if (!stitchedLabel) {
        throw new Error(`No stitched image found for batch ${batchId}. Create stitched image first.`);
      }

      Logger.info('ICR_OCR_BY_BATCH', 'Found stitched image for OCR processing', {
        stitchedLabelId: stitchedLabel._id,
        stitchedImagePath: stitchedLabel.stitchedImagePath
      });

      // Process OCR using the detected stitched image
      return await this.processOcr(stitchedLabel.stitchedImagePath);

    } catch (error) {
      Logger.operationError('ICR_OCR_BY_BATCH', 'Auto-detection OCR failed', error, { batchId });
      throw error;
    }
  }

  /**
   * Process OCR by imageHashes - works independently
   * EXACT EXTRACTION from IcrBatchService.js lines 747-831
   */
  async processOcrByHashes(imageHashes) {
    try {
      Logger.operationStart('ICR_OCR_BY_HASHES', 'Processing OCR by hashes', { imageHashes });

      // Find ONE stitched label that contains ANY of these hashes (check both stitched and ocr_completed)
      Logger.info('ICR_OCR_BY_HASHES', 'Searching for stitched labels', {
        imageHashesCount: imageHashes.length,
        firstFewHashes: imageHashes.slice(0, 3),
        searchCriteria: { labelHashes: { $in: imageHashes }, processingStatus: { $in: ['stitched', 'ocr_completed', 'distributed'] } }
      });

      const stitchedLabels = await this.stitchedLabelRepository.findMany({
        labelHashes: { $in: imageHashes }
        // NO STATUS CHECK - Process ANY stitched label
      }, { sort: { createdAt: -1 }, limit: 1 });

      const stitchedLabel = stitchedLabels[0];

      if (!stitchedLabel) {
        // DEBUG: Check what stitched labels actually exist
        const allStitchedLabels = await this.stitchedLabelRepository.findMany({}, { limit: 5 });
        const stitchedWithHashes = await this.stitchedLabelRepository.findMany({
          labelHashes: { $in: imageHashes }
        }, { limit: 5 });

        Logger.error('ICR_OCR_BY_HASHES', 'No stitched label found for OCR', {
          providedHashCount: imageHashes.length,
          allStitchedLabelsCount: allStitchedLabels.length,
          allStitchedLabels: allStitchedLabels.map(sl => ({
            id: sl._id,
            status: sl.processingStatus,
            labelHashCount: sl.labelHashes?.length,
            firstFewLabelHashes: sl.labelHashes?.slice(0, 3)
          })),
          stitchedWithHashesCount: stitchedWithHashes.length,
          stitchedWithHashes: stitchedWithHashes.map(sl => ({
            id: sl._id,
            status: sl.processingStatus,
            labelHashCount: sl.labelHashes?.length
          }))
        });

        throw new Error('No stitched image found for provided hashes. Run stitching first.');
      }

      // ALWAYS PROCESS OCR - NO STATUS CHECKS - OVERWRITE ANY EXISTING DATA
      let ocrResult;

      // Always process OCR regardless of status - we need to fix the data
      {
        console.log('🔍 DEBUG: STITCHED LABEL FOUND:', {
          id: stitchedLabel._id,
          path: stitchedLabel.stitchedImagePath,
          status: stitchedLabel.processingStatus,
          labelCount: stitchedLabel.labelHashes?.length,
          hasOcrText: !!stitchedLabel.ocrText,
          ocrTextLength: stitchedLabel.ocrText?.length || 0
        });

        Logger.info('ICR_OCR_BY_HASHES', 'Processing OCR for stitched image', {
          stitchedImagePath: stitchedLabel.stitchedImagePath
        });

        // Process OCR on stitched image
        ocrResult = await this.processOcr(stitchedLabel.stitchedImagePath);
      }

      return {
        stitchedLabelId: stitchedLabel._id,
        labelHashes: stitchedLabel.labelHashes,
        ...ocrResult
      };

    } catch (error) {
      Logger.operationError('ICR_OCR_BY_HASHES', 'OCR by hashes failed', error);
      throw error;
    }
  }
}

export default IcrOcrProcessingService;