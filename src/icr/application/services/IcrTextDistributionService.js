/**
 * ICR Text Distribution Service
 * 
 * Single Responsibility: Distribute OCR text to individual scans
 * Extracted from IcrBatchService to follow SRP
 */

import OcrTextDistributor from '@/icr/shared/OcrTextDistributor.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import StitchedLabelRepository from '@/icr/infrastructure/repositories/StitchedLabelRepository.js';
import Logger from '@/system/logging/Logger.js';

export class IcrTextDistributionService {
  constructor() {
    this.gradedCardScanRepository = new GradedCardScanRepository();
    this.stitchedLabelRepository = new StitchedLabelRepository();
  }

  /**
   * STEP 4: Distribute OCR text to individual scans
   * EXACT EXTRACTION from IcrBatchService.js lines 209-310
   */
  async distributeOcrText(batchId, ocrResult = null) {
    try {
      Logger.operationStart('ICR_TEXT_DISTRIBUTION', 'Distributing OCR text', { batchId });

      // Get OCR data from StitchedLabel if not provided
      let actualOcrResult = ocrResult;
      if (!actualOcrResult) {
        // Find the SPECIFIC stitched label for this batchId
        const stitchedLabels = await this.stitchedLabelRepository.findMany({
          batchId: batchId,
          processingStatus: 'ocr_completed',
          ocrText: { $exists: true, $ne: null }
        }, { sort: { createdAt: -1 }, limit: 1 });
        const stitchedLabel = stitchedLabels[0];

        if (!stitchedLabel || !stitchedLabel.ocrText) {
          throw new Error(`No OCR data found in StitchedLabels for batchId: ${batchId}`);
        }

        // Get the actual stitched image height from the StitchedLabel record
        let stitchedImageHeight = null;
        if (stitchedLabel.stitchedImageDimensions && stitchedLabel.stitchedImageDimensions.height) {
          stitchedImageHeight = stitchedLabel.stitchedImageDimensions.height;
        } else if (stitchedLabel.height) {
          stitchedImageHeight = stitchedLabel.height;
        } else if (stitchedLabel.imageHeight) {
          stitchedImageHeight = stitchedLabel.imageHeight;
        } else if (stitchedLabel.dimensions && stitchedLabel.dimensions.height) {
          stitchedImageHeight = stitchedLabel.dimensions.height;
        }

        if (!stitchedImageHeight) {
          throw new Error(`No image height found in StitchedLabel for batchId: ${batchId}`);
        }

        actualOcrResult = {
          fullText: stitchedLabel.ocrText,
          textAnnotations: stitchedLabel.ocrAnnotations || [],
          confidence: stitchedLabel.ocrConfidence || 0.8,
          imageHeight: stitchedImageHeight
        };

        Logger.info('ICR_TEXT_DISTRIBUTION', 'Using OCR data from StitchedLabel', {
          batchId: stitchedLabel.batchId,
          textLength: actualOcrResult.fullText.length,
          annotationCount: actualOcrResult.textAnnotations.length,
          stitchedHeight: actualOcrResult.imageHeight,
          labelCount: stitchedLabel.labelCount
        });
      }

      const scans = await this.gradedCardScanRepository.findMany({ batchId }, { sort: { createdAt: 1 } });

      if (scans.length === 0) {
        throw new Error(`No GradedCardScans found for batch: ${batchId}`);
      }

      const textSegments = OcrTextDistributor.distributeByActualPositions(
        actualOcrResult.textAnnotations,
        stitchedLabel.labelPositions
      );

      const updatedScans = [];
      for (let i = 0; i < scans.length; i++) {
        const scan = scans[i];
        const textSegment = textSegments[i] || '';

        await this.gradedCardScanRepository.update(scan._id, {
          ocrText: textSegment,
          ocrConfidence: actualOcrResult.confidence || 0.8,
          processingStatus: 'ocr_completed'
        });

        updatedScans.push({
          scanId: scan._id,
          originalFileName: scan.originalFileName,
          ocrText: textSegment,
          ocrTextLength: textSegment.length
        });

        Logger.info('ICR_TEXT_DISTRIBUTION', `Updated scan ${i + 1}/${scans.length}`, {
          originalFileName: scan.originalFileName,
          textLength: textSegment.length
        });
      }

      Logger.operationSuccess('ICR_TEXT_DISTRIBUTION', 'Text distribution completed', {
        scanCount: updatedScans.length,
        totalCharacters: actualOcrResult.fullText?.length || 0
      });

      return {
        updatedScans,
        totalOcrCharacters: actualOcrResult.fullText?.length || 0,
        distributionMethod: ocrResult ? 'provided_data' : 'stitched_label_lookup'
      };

    } catch (error) {
      Logger.operationError('ICR_TEXT_DISTRIBUTION', 'Text distribution failed', error);
      throw error;
    }
  }

  /**
   * Distribute OCR text by imageHashes - works independently
   * EXACT EXTRACTION from IcrBatchService.js lines 572-647 (approximately)
   */
  async distributeOcrTextByHashes(imageHashes, ocrResult = null) {
    try {
      Logger.operationStart('ICR_DISTRIBUTE_BY_HASHES', 'Distributing OCR text by hashes', { imageHashes });

      // Find scans by hashes that need OCR text distribution
      const scans = await this.gradedCardScanRepository.findByHashes(imageHashes);

      if (scans.length === 0) {
        throw new Error('No scans found for provided image hashes');
      }

      // Find stitched labels that contain these hashes and have OCR data
      const stitchedLabelsWithOcr = await this.stitchedLabelRepository.findMany({
        labelHashes: { $in: imageHashes },
        processingStatus: 'ocr_completed',
        ocrText: { $exists: true, $ne: null }
      }, { sort: { createdAt: -1 } });

      if (stitchedLabelsWithOcr.length === 0 && !ocrResult) {
        // Check if there are stitched labels but without OCR data
        const stitchedLabelsWithoutOcr = await this.stitchedLabelRepository.findMany({
          labelHashes: { $in: imageHashes },
          processingStatus: { $in: ['stitched', 'processing'] }
        });

        if (stitchedLabelsWithoutOcr.length > 0) {
          throw new Error(`Found ${stitchedLabelsWithoutOcr.length} stitched labels but no OCR data available. Please run the OCR processing step first before distributing text.`);
        }

        throw new Error('No OCR data or stitched labels found for provided image hashes. Please complete the stitching and OCR steps first.');
      }

      const updatedScans = [];

      // Process each stitched label independently
      for (const stitchedLabel of stitchedLabelsWithOcr) {
        // Find scans that belong to this stitched label
        const labelScans = scans.filter(scan =>
          stitchedLabel.labelHashes.includes(scan.imageHash)
        );

        if (labelScans.length === 0) continue;

        const actualOcrResult = ocrResult || {
          fullText: stitchedLabel.ocrText,
          textAnnotations: stitchedLabel.ocrAnnotations || [],
          confidence: stitchedLabel.ocrConfidence || 0.8,
          imageHeight: stitchedLabel.stitchedImageDimensions.height
        };

        const textSegments = OcrTextDistributor.distributeByActualPositions(
          actualOcrResult.textAnnotations,
          stitchedLabel.labelPositions
        );

        for (let i = 0; i < labelScans.length; i++) {
          const scan = labelScans[i];
          const textSegment = textSegments[i] || '';

          await this.gradedCardScanRepository.update(scan._id, {
            ocrText: textSegment,
            ocrConfidence: actualOcrResult.confidence || 0.8,
            processingStatus: 'ocr_completed'
          });

          updatedScans.push({
            scanId: scan._id,
            imageHash: scan.imageHash,
            originalFileName: scan.originalFileName,
            ocrText: textSegment,
            ocrTextLength: textSegment.length
          });
        }
      }

      Logger.operationSuccess('ICR_DISTRIBUTE_BY_HASHES', 'Text distribution completed', { scanCount: updatedScans.length });

      return {
        updatedScans,
        totalOcrCharacters: updatedScans.reduce((sum, scan) => sum + scan.ocrTextLength, 0),
        distributionMethod: ocrResult ? 'provided_data' : 'stitched_label_lookup'
      };

    } catch (error) {
      Logger.operationError('ICR_DISTRIBUTE_BY_HASHES', 'Text distribution by hashes failed', error);
      throw error;
    }
  }
}

export default IcrTextDistributionService;