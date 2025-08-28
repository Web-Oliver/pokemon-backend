/**
 * ICR Label Extraction Service
 * 
 * Single Responsibility: Extract PSA labels from uploaded scans
 * Extracted from IcrBatchService to follow SRP
 */

import PsaLabelExtractionService from '@/icr/infrastructure/services/PsaLabelExtractionService.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import Logger from '@/system/logging/Logger.js';
import { promises as fs } from 'fs';
import path from 'path';

export class IcrLabelExtractionService {
  constructor() {
    this.psaLabelExtractionService = new PsaLabelExtractionService();
    this.gradedCardScanRepository = new GradedCardScanRepository();
  }

  /**
   * STEP 2: Extract PSA labels from uploaded scans
   * EXACT EXTRACTION from IcrBatchService.js lines 123-196
   */
  async extractLabels(scanIds) {
    try {
      Logger.operationStart('ICR_EXTRACT_LABELS', 'Extracting PSA labels', { scanCount: scanIds.length });

      const results = [];
      const errors = [];
      const skipped = [];

      for (const scanId of scanIds) {
        try {
          const scan = await this.gradedCardScanRepository.findById(scanId);
          if (!scan) {
            errors.push({ scanId, error: 'Scan not found' });
            continue;
          }

          if (scan.processingStatus !== 'uploaded') {
            skipped.push({ scanId, reason: `Already processed (${scan.processingStatus})` });
            continue;
          }

          // Read uploaded image file
          const imageBuffer = await fs.readFile(scan.fullImage);

          // Extract PSA label
          const extractionResult = await this.psaLabelExtractionService.extractPsaLabel(imageBuffer);

          // Save extracted label
          const labelPath = await this.saveExtractedLabel(
            extractionResult.labelBuffer,
            scan.originalFileName,
            scanId
          );

          // Update GradedCardScan with label info
          await this.gradedCardScanRepository.update(scanId, {
            labelImage: labelPath,
            extractedDimensions: extractionResult.extractedDimensions,
            processingStatus: 'extracted'
          });

          results.push({
            scanId,
            originalFileName: scan.originalFileName,
            labelPath,
            extractedDimensions: extractionResult.extractedDimensions
          });

        } catch (error) {
          Logger.operationError('ICR_LABEL_EXTRACTION', 'Label extraction failed', error, { scanId });
          errors.push({ scanId, error: error.message });
        }
      }

      Logger.operationSuccess('ICR_EXTRACT_LABELS', 'Label extraction completed', {
        successful: results.length,
        failed: errors.length,
        skipped: skipped.length
      });

      return {
        successful: results.length,
        failed: errors.length,
        skippedCount: skipped.length,
        results,
        errors,
        skipped
      };

    } catch (error) {
      Logger.operationError('ICR_EXTRACT_LABELS', 'Label extraction failed', error);
      throw error;
    }
  }

  /**
   * Helper method extracted from IcrBatchService lines 1050-1055
   */
  async saveExtractedLabel(labelBuffer, originalName, index) {
    const filename = `${originalName}_extracted_label.jpg`;
    const filePath = path.join(process.cwd(), 'uploads', 'icr', 'extracted-labels', filename);
    await fs.writeFile(filePath, labelBuffer);
    return filePath;
  }
}

export default IcrLabelExtractionService;