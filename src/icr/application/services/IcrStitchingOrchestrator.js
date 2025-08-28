/**
 * ICR Stitching Orchestrator - Single Responsibility: Stitching Workflow Coordination
 *
 * SOLID Principles:
 * - Single Responsibility: Only orchestrates stitching workflow
 * - Open/Closed: Extensible for new stitching strategies
 * - Dependency Inversion: Depends on service abstractions
 */

import { container, ServiceKeys } from '@/system/dependency-injection/ServiceContainer.js';
import ImageHashService from '@/icr/shared/ImageHashService.js';
import { ImageStitchingEngine } from '@/icr/shared/ImageStitchingEngine.js';
import StitchedLabel from '@/icr/infrastructure/persistence/StitchedLabel.js';
import sharp from 'sharp';
import Logger from '@/system/logging/Logger.js';
import { promises as fs } from 'fs';
import path from 'path';

import IcrPathManager from '@/icr/shared/IcrPathManager.js';

class IcrStitchingOrchestrator {
  constructor(
    statusService = null,
    gradedCardScanRepository = null,
    stitchedLabelRepository = null
  ) {
    this.statusService = statusService || container.resolve(ServiceKeys.ICR_STATUS_SERVICE);
    this.gradedCardScanRepository = gradedCardScanRepository || container.resolve(ServiceKeys.GRADED_CARD_SCAN_REPOSITORY);
    this.stitchedLabelRepository = stitchedLabelRepository || container.resolve(ServiceKeys.STITCHED_LABEL_REPOSITORY);
  }

  async stitchImagesByHashes(imageHashes) {
    try {
      Logger.operationStart('ICR_STITCH_ORCHESTRATOR', 'Orchestrating stitching workflow', { imageHashes });

      // 1. Find and validate scans
      const validationResult = await this.validateScansForStitching(imageHashes);
      if (validationResult.isDuplicate) {
        return validationResult;
      }

      const { availableScans, labelBuffers } = validationResult;

      // 2. Create stitched image
      const stitchResult = await this.createVerticalStitchedImage(labelBuffers);

      // 3. Save stitched label record
      const stitchedLabel = await this.createStitchedLabelRecord(stitchResult, availableScans);

      // 4. Update scan statuses to 'stitched' and store positions
      for (let i = 0; i < availableScans.length; i++) {
        const scan = availableScans[i];
        const position = stitchResult.labelPositions[i];

        await this.gradedCardScanRepository.update(scan._id, {
          processingStatus: 'stitched',
          stitchedPosition: {
            y: position.y,
            height: position.height,
            index: position.index
          }
        });
      }

      const scansUpdated = availableScans.length;

      Logger.operationSuccess('ICR_STITCH_ORCHESTRATOR', 'Stitching orchestration completed', {
        totalRequested: imageHashes.length,
        newHashes: availableScans.length,
        alreadyStitched: imageHashes.length - availableScans.length,
        stitchedLabelId: stitchedLabel._id,
        scansUpdated
      });

      return {
        ...stitchResult,
        stitchedLabelId: stitchedLabel._id,
        stitchedImageUrl: `/api/icr/images/stitched/${stitchResult.stitchedImagePath.split('/').pop()}`,
        isDuplicate: false,
        totalRequested: imageHashes.length,
        newHashes: availableScans.length,
        alreadyStitched: imageHashes.length - availableScans.length,
        scansUpdated
      };

    } catch (error) {
      Logger.operationError('ICR_STITCH_ORCHESTRATOR', 'Stitching orchestration failed', error);
      throw error;
    }
  }

  async validateScansForStitching(imageHashes) {
    // Find scans by imageHashes that have extracted labels
    const scans = await this.gradedCardScanRepository.findMany({
      imageHash: { $in: imageHashes },
      processingStatus: { $in: ['extracted', 'stitched'] }, // Allow re-stitching, exclude ocr_completed/matched
      labelImage: { $exists: true, $ne: null }
    }, { sort: { createdAt: 1 } }); // Pass sort options as second parameter

    if (scans.length === 0) {
      throw new Error('No scans with extracted labels found for provided image hashes');
    }

    // Check for duplicates
    const alreadyStitchedHashes = await this.getAlreadyStitchedHashes();
    const newScans = scans.filter(scan => !alreadyStitchedHashes.has(scan.imageHash));

    if (newScans.length === 0) {
      Logger.info('ICR_STITCH_ORCHESTRATOR', 'All provided hashes already stitched', {
        totalRequested: imageHashes.length,
        alreadyStitched: imageHashes.length
      });
      return {
        isDuplicate: true,
        message: 'All provided image hashes have already been stitched',
        totalRequested: imageHashes.length,
        newHashes: 0,
        alreadyStitched: imageHashes.length
      };
    }

    // Load label files
    const availableScans = [];
    const labelBuffers = [];

    for (const scan of newScans) {
      try {
        await fs.access(scan.labelImage);
        const labelBuffer = await fs.readFile(scan.labelImage);
        labelBuffers.push(labelBuffer);
        availableScans.push(scan);
      } catch (error) {
        Logger.warn('ICR_STITCH_ORCHESTRATOR', 'Label file not found - skipping', {
          scanId: scan._id,
          labelPath: scan.labelImage,
          imageHash: scan.imageHash
        });
      }
    }

    if (availableScans.length === 0) {
      throw new Error('No label files available for new image hashes');
    }

    return { availableScans, labelBuffers, isDuplicate: false };
  }

  async getAlreadyStitchedHashes() {
    const existingStitchedLabels = await this.stitchedLabelRepository.findMany({});
    const alreadyStitchedHashes = new Set();
    existingStitchedLabels.forEach(stitched => {
      stitched.labelHashes.forEach(hash => alreadyStitchedHashes.add(hash));
    });
    return alreadyStitchedHashes;
  }

  async createStitchedLabelRecord(stitchResult, availableScans) {
    const stitchedBuffer = await fs.readFile(stitchResult.stitchedImagePath);
    const stitchedImageHash = ImageHashService.generateHash(stitchedBuffer);

    const stitchedLabel = await this.stitchedLabelRepository.create({
      stitchedImagePath: stitchResult.stitchedImagePath,
      stitchedImageHash,
      stitchedImageDimensions: {
        width: stitchResult.width,
        height: stitchResult.height
      },
      labelPositions: stitchResult.labelPositions,
      labelHashes: availableScans.map(s => s.imageHash).sort(),
      labelCount: availableScans.length,
      gradedCardScanIds: availableScans.map(s => s._id),
      processingStatus: 'stitched'
    });

    return stitchedLabel;
  }

  async deleteStitchedImage(stitchedId) {
    try {
      Logger.operationStart('ICR_STITCH_DELETE', 'Deleting stitched image', { stitchedId });

      const stitched = await this.stitchedLabelRepository.findById(stitchedId);
      if (!stitched) {
        throw new Error('Stitched image not found');
      }

      // Delete physical file
      try {
        if (stitched.stitchedImagePath) {
          await fs.unlink(stitched.stitchedImagePath);
          Logger.info('ICR_STITCH_DELETE', 'Deleted stitched image file', { path: stitched.stitchedImagePath });
        }
      } catch (error) {
        Logger.warn('ICR_STITCH_DELETE', 'Failed to delete stitched image file', { error: error.message });
      }

      // Delete database record
      await this.stitchedLabelRepository.delete(stitchedId);

      // Reset scan statuses back to 'extracted' and clear positions
      for (const hash of stitched.labelHashes) {
        await this.gradedCardScanRepository.updateByHash(hash, {
          processingStatus: 'extracted',
          $unset: { stitchedPosition: 1 }
        });
      }

      const scansReset = stitched.labelHashes.length;

      Logger.operationSuccess('ICR_STITCH_DELETE', 'Stitched image deleted and scans reset', {
        stitchedId,
        scansReset,
        labelHashes: stitched.labelHashes
      });

      return {
        deletedStitchedId: stitchedId,
        scansReset,
        resetHashes: stitched.labelHashes
      };

    } catch (error) {
      Logger.operationError('ICR_STITCH_DELETE', 'Failed to delete stitched image', error);
      throw error;
    }
  }

  async createVerticalStitchedImage(labelBuffers) {
    try {
      // Use centralized stitching engine
      const stitchResult = await ImageStitchingEngine.createVerticalStitchedImage(labelBuffers, {
        quality: 90
      });

      // Generate filename using IcrPathManager
      const filenameInfo = IcrPathManager.generateFileName('stitched_image.jpg', {
        labelCount: labelBuffers.length
      });

      // Save stitched image using IcrPathManager
      const stitchedImagePath = IcrPathManager.getFilePath('STITCHED_IMAGES', filenameInfo.descriptive);
      await fs.writeFile(stitchedImagePath, stitchResult.buffer);

      return {
        stitchedImagePath,
        width: stitchResult.width,
        height: stitchResult.height,
        labelCount: stitchResult.labelCount,
        labelPositions: stitchResult.labelPositions
      };
    } catch (error) {
      Logger.error('IcrStitchingOrchestrator', 'Failed to create stitched image:', error);
      throw error;
    }
  }

}

export default IcrStitchingOrchestrator;
