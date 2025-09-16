/**
 * ICR Text Distribution Service
 *
 * Service layer that orchestrates the distribution of OCR text from stitched images
 * to individual GradedCardScan records using coordinate-based mapping.
 */

import OcrTextDistributor from '@/icr/shared/OcrTextDistributor.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import StitchedLabelRepository from '@/icr/infrastructure/repositories/StitchedLabelRepository.js';
import Logger from '@/system/logging/Logger.js';
import { ValidationError, NotFoundError } from '@/system/errors/ErrorTypes.js';

export default class IcrTextDistributionService {
  constructor() {
    this.gradedCardScanRepository = new GradedCardScanRepository();
    this.stitchedLabelRepository = new StitchedLabelRepository();
  }

  /**
   * Distributes OCR text from a stitched image to individual card scans
   * @param {string} batchId - Batch identifier
   * @param {Object} ocrResult - Optional OCR result override
   * @returns {Promise<Object>} Distribution results
   */
  async distributeOcrText(batchId, ocrResult = null) {
    try {
      Logger.operationStart('TEXT_DISTRIBUTION', 'Starting OCR text distribution', {
        batchId,
        hasOcrOverride: !!ocrResult
      });

      // Get stitched label with OCR data
      const stitchedLabel = await this.stitchedLabelRepository.findByBatchId(batchId);
      if (!stitchedLabel) {
        throw new NotFoundError('StitchedLabel not found for batch', { batchId });
      }

      // Validate stitched label has OCR data
      if (!stitchedLabel.ocrText && !ocrResult) {
        throw new ValidationError('No OCR data available for distribution', {
          batchId,
          stitchedLabelId: stitchedLabel._id
        });
      }

      // Use provided OCR result or existing data
      const textAnnotations = ocrResult?.textAnnotations || stitchedLabel.ocrAnnotations;
      const labelPositions = stitchedLabel.labelPositions;

      if (!textAnnotations || !Array.isArray(textAnnotations)) {
        throw new ValidationError('Invalid text annotations for distribution', {
          batchId,
          annotationsType: typeof textAnnotations
        });
      }

      if (!labelPositions || !Array.isArray(labelPositions)) {
        throw new ValidationError('Invalid label positions for distribution', {
          batchId,
          positionsType: typeof labelPositions
        });
      }

      Logger.info('TEXT_DISTRIBUTION', 'Distributing text using coordinates', {
        batchId,
        annotationCount: textAnnotations.length,
        labelCount: labelPositions.length
      });

      // Distribute text using coordinate-based mapping
      const distributedTexts = OcrTextDistributor.distributeByActualPositions(
        textAnnotations,
        labelPositions
      );

      // Get individual scans for this batch
      const scans = await this.gradedCardScanRepository.findByBatchId(batchId);
      if (!scans || scans.length === 0) {
        throw new NotFoundError('No scans found for batch', { batchId });
      }

      // CRITICAL FIX: Order scans by stitched label hash order, not database order
      console.log('🔍 DEBUG DISTRIBUTION ORDERING:');
      console.log('Label Positions (Y order):', labelPositions.map((pos, i) => `${i}: Y=${pos.y}-${pos.y + pos.height}`));
      console.log('Stitched Label Hashes:', stitchedLabel.labelHashes.map((h, i) => `${i}: ${h.substring(0, 10)}...`));
      console.log('Distributed Texts Preview:', distributedTexts.map((t, i) => `${i}: "${t.substring(0, 30)}..."`));

      const orderedScans = [];
      for (let i = 0; i < stitchedLabel.labelHashes.length; i++) {
        const hash = stitchedLabel.labelHashes[i];
        const matchingScan = scans.find(scan => scan.imageHash === hash);
        if (matchingScan) {
          orderedScans.push(matchingScan);
          console.log(`Position ${i}: Hash ${hash.substring(0, 10)}... -> Scan ID ${matchingScan._id}`);
        }
      }

      // Update each scan with distributed OCR data
      const updateResults = [];
      const distributionMetrics = {
        totalScans: orderedScans.length,
        successfulUpdates: 0,
        failedUpdates: 0,
        textAssignments: 0,
        emptyAssignments: 0
      };

      console.log('🔄 STARTING SCAN UPDATES:');
      for (let i = 0; i < orderedScans.length; i++) {
        const scan = orderedScans[i];
        const distributedText = distributedTexts[i] || '';

        console.log(`\n📝 UPDATE ${i}:`);
        console.log(`  Scan: ${scan._id} (Hash: ${scan.imageHash.substring(0, 10)}...)`);
        console.log(`  Position: ${i} (Y=${labelPositions[i].y}-${labelPositions[i].y + labelPositions[i].height})`);
        console.log(`  Assigning Text: "${distributedText.substring(0, 60)}..."`);
        console.log(`  Text Length: ${distributedText.length} chars`);

        try {
          // Calculate confidence for this distribution
          const textSegments = this.extractTextSegments(textAnnotations, labelPositions, i);
          const confidence = this.calculateDistributionConfidence(textSegments);

          // Update scan with distributed OCR data - NO STATUS UPDATE
          const updateData = {
            ocrText: distributedText,
            ocrConfidence: confidence,
            ocrAnnotations: textSegments
            // NO PROCESSING STATUS UPDATE - WE'RE FIXING CORE ISSUES
          };

          await this.gradedCardScanRepository.updateOcrResults(scan._id, updateData);

          console.log(`  ✅ UPDATE SUCCESS: Scan ${scan._id} updated with ${distributedText.length} chars`);
          console.log(`  Final OCR Text Preview: "${distributedText.substring(0, 50)}..."`);
          console.log(`  Confidence: ${confidence}`);

          updateResults.push({
            id: scan._id,
            labelIndex: i,
            textLength: distributedText.length,
            confidence: confidence,
            success: true
          });

          distributionMetrics.successfulUpdates++;
          if (distributedText.length > 0) {
            distributionMetrics.textAssignments++;
          } else {
            distributionMetrics.emptyAssignments++;
          }

          Logger.debug('TEXT_DISTRIBUTION', 'Updated scan with OCR text', {
            id: scan._id,
            labelIndex: i,
            textLength: distributedText.length,
            textPreview: distributedText.substring(0, 50)
          });

        } catch (updateError) {
          Logger.error('TEXT_DISTRIBUTION', 'Failed to update scan', updateError, {
            id: scan._id,
            labelIndex: i
          });

          updateResults.push({
            id: scan._id,
            labelIndex: i,
            success: false,
            error: updateError.message
          });

          distributionMetrics.failedUpdates++;
        }
      }

      // Update stitched label status
      await this.stitchedLabelRepository.updateProcessingStatus(
        stitchedLabel._id,
        'distributed',
        { distributionMetrics }
      );

      const result = {
        batchId,
        stitchedLabelId: stitchedLabel._id,
        distributionMetrics,
        updateResults,
        success: distributionMetrics.failedUpdates === 0
      };

      Logger.operationSuccess('TEXT_DISTRIBUTION', 'OCR text distribution completed', result);

      return result;

    } catch (error) {
      Logger.operationError('TEXT_DISTRIBUTION', 'OCR text distribution failed', error, {
        batchId
      });
      throw error;
    }
  }

  /**
   * Extracts text segments for a specific label index
   * @param {Array} textAnnotations - All text annotations
   * @param {Array} labelPositions - Label position data
   * @param {number} labelIndex - Target label index
   * @returns {Array} Text segments for this label
   */
  extractTextSegments(textAnnotations, labelPositions, labelIndex) {
    if (!textAnnotations || labelIndex >= labelPositions.length) {
      return [];
    }

    const labelPosition = labelPositions[labelIndex];
    const segments = [];

    // Skip first annotation (full text) and process individual segments
    const individualAnnotations = textAnnotations.slice(1);

    for (const annotation of individualAnnotations) {
      if (!annotation.boundingPoly || !annotation.boundingPoly.vertices) {
        continue;
      }

      // Calculate text center Y
      const vertices = annotation.boundingPoly.vertices;
      const yCoords = vertices.map(v => v.y || 0);
      const textCenterY = (Math.min(...yCoords) + Math.max(...yCoords)) / 2;

      // Check if text belongs to this label
      const labelTop = labelPosition.y;
      const labelBottom = labelPosition.y + labelPosition.height;

      if (textCenterY >= labelTop && textCenterY <= labelBottom) {
        segments.push({
          text: annotation.description,
          confidence: annotation.confidence || 0,
          boundingBox: {
            vertices: annotation.boundingPoly.vertices
          },
          centerY: textCenterY
        });
      }
    }

    // Sort by Y position
    segments.sort((a, b) => a.centerY - b.centerY);

    return segments;
  }

  /**
   * Calculates confidence score for text distribution
   * @param {Array} textSegments - Text segments for this label
   * @returns {number} Confidence score (0-1)
   */
  calculateDistributionConfidence(textSegments) {
    if (!textSegments || textSegments.length === 0) {
      return 0;
    }

    // Calculate average confidence from all segments
    const totalConfidence = textSegments.reduce((sum, segment) => {
      return sum + (segment.confidence || 0);
    }, 0);

    return textSegments.length > 0 ? totalConfidence / textSegments.length : 0;
  }

  /**
   * Re-distributes OCR text for a specific batch (useful for corrections)
   * @param {string} batchId - Batch identifier
   * @returns {Promise<Object>} Re-distribution results
   */
  async redistributeOcrText(batchId) {
    Logger.info('TEXT_DISTRIBUTION', 'Re-distributing OCR text', { batchId });

    // Clear existing OCR data from scans
    await this.gradedCardScanRepository.clearOcrDataByBatch(batchId);

    // Perform fresh distribution
    return await this.distributeOcrText(batchId);
  }

  /**
   * Distributes OCR text for scans identified by image hashes
   * @param {Array<string>} imageHashes - Array of image hashes
   * @param {Object} ocrResult - Optional OCR result override
   * @returns {Promise<Object>} Distribution results
   */
  async distributeOcrTextByHashes(imageHashes, ocrResult = null) {
    try {
      Logger.operationStart('TEXT_DISTRIBUTION_BY_HASHES', 'Distributing OCR text by hashes', {
        hashCount: imageHashes.length,
        hasOcrOverride: !!ocrResult
      });

      // Find stitched label containing these hashes
      const stitchedLabel = await this.stitchedLabelRepository.findByLabelHashes(imageHashes);
      if (!stitchedLabel) {
        throw new NotFoundError('StitchedLabel not found for hashes', { imageHashes });
      }

      // Get scans by hashes
      const scans = await this.gradedCardScanRepository.findByHashes(imageHashes);
      if (!scans || scans.length === 0) {
        throw new NotFoundError('No scans found for hashes', { imageHashes });
      }

      // Use provided OCR result or existing data
      const textAnnotations = ocrResult?.textAnnotations || stitchedLabel.ocrAnnotations;
      const labelPositions = stitchedLabel.labelPositions;

      if (!textAnnotations || !Array.isArray(textAnnotations)) {
        throw new ValidationError('Invalid text annotations for distribution', {
          annotationsType: typeof textAnnotations
        });
      }

      // Distribute text using coordinate-based mapping
      const distributedTexts = OcrTextDistributor.distributeByActualPositions(
        textAnnotations,
        labelPositions
      );

      // Update each scan with distributed OCR data
      const updateResults = [];
      const distributionMetrics = {
        totalScans: scans.length,
        successfulUpdates: 0,
        failedUpdates: 0,
        textAssignments: 0,
        emptyAssignments: 0
      };

      // Match scans to distributed texts by hash order
      for (let i = 0; i < scans.length; i++) {
        const scan = scans[i];
        const hashIndex = imageHashes.indexOf(scan.imageHash);
        const distributedText = hashIndex >= 0 ? (distributedTexts[hashIndex] || '') : '';

        try {
          // Calculate confidence for this distribution
          const textSegments = this.extractTextSegments(textAnnotations, labelPositions, hashIndex);
          const confidence = this.calculateDistributionConfidence(textSegments);

          // Update scan with distributed OCR data - NO STATUS UPDATE
          const updateData = {
            ocrText: distributedText,
            ocrConfidence: confidence,
            ocrAnnotations: textSegments
            // NO PROCESSING STATUS UPDATE - WE'RE FIXING CORE ISSUES
          };

          await this.gradedCardScanRepository.updateOcrResults(scan._id, updateData);

          updateResults.push({
            id: scan._id,
            imageHash: scan.imageHash,
            textLength: distributedText.length,
            confidence: confidence,
            success: true
          });

          distributionMetrics.successfulUpdates++;
          if (distributedText.length > 0) {
            distributionMetrics.textAssignments++;
          } else {
            distributionMetrics.emptyAssignments++;
          }

        } catch (updateError) {
          Logger.error('TEXT_DISTRIBUTION_BY_HASHES', 'Failed to update scan', updateError, {
            id: scan._id,
            imageHash: scan.imageHash
          });

          updateResults.push({
            id: scan._id,
            imageHash: scan.imageHash,
            success: false,
            error: updateError.message
          });

          distributionMetrics.failedUpdates++;
        }
      }

      // Update stitched label status
      await this.stitchedLabelRepository.updateProcessingStatus(
        stitchedLabel._id,
        'distributed',
        { distributionMetrics }
      );

      const result = {
        imageHashes,
        stitchedLabelId: stitchedLabel._id,
        distributionMetrics,
        updateResults,
        success: distributionMetrics.failedUpdates === 0
      };

      Logger.operationSuccess('TEXT_DISTRIBUTION_BY_HASHES', 'OCR text distribution completed', result);

      return result;

    } catch (error) {
      Logger.operationError('TEXT_DISTRIBUTION_BY_HASHES', 'OCR text distribution failed', error, {
        imageHashes
      });
      throw error;
    }
  }

  /**
   * Gets distribution status for a batch
   * @param {string} batchId - Batch identifier
   * @returns {Promise<Object>} Distribution status
   */
  async getDistributionStatus(batchId) {
    const stitchedLabel = await this.stitchedLabelRepository.findByBatchId(batchId);
    const scans = await this.gradedCardScanRepository.findByBatchId(batchId);

    const scansWithText = scans.filter(scan => scan.ocrText && scan.ocrText.length > 0);

    return {
      batchId,
      stitchedLabelExists: !!stitchedLabel,
      stitchedLabelStatus: stitchedLabel?.processingStatus,
      totalScans: scans.length,
      scansWithText: scansWithText.length,
      distributionComplete: scansWithText.length === scans.length,
      lastDistributed: stitchedLabel?.updatedAt
    };
  }
}