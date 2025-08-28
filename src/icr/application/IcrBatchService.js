/**
 * ICR Batch Processing Service
 *
 * Application layer service that orchestrates the complete ICR workflow:
 * 1. Batch image upload and PSA label extraction
 * 2. Vertical image stitching
 * 3. Google Vision OCR processing
 * 4. Text distribution by coordinates
 * 5. Hierarchical PSA card matching
 */

import IcrImageUploadService from '@/icr/application/services/IcrImageUploadService.js';
import IcrLabelExtractionService from '@/icr/application/services/IcrLabelExtractionService.js';
import IcrOcrProcessingService from '@/icr/application/services/IcrOcrProcessingService.js';
import IcrTextDistributionService from '@/icr/application/services/IcrTextDistributionService.js';
import IcrCardMatchingService from '@/icr/application/services/IcrCardMatchingService.js';
import IcrStitchingOrchestrator from '@/icr/application/services/IcrStitchingOrchestrator.js';
import ImageHashService from '@/icr/shared/ImageHashService.js';
import OcrTextDistributor from '@/icr/shared/OcrTextDistributor.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import StitchedLabelRepository from '@/icr/infrastructure/repositories/StitchedLabelRepository.js';
import Logger from '@/system/logging/Logger.js';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

class IcrBatchService {
  constructor() {
    this.imageUploadService = new IcrImageUploadService();
    this.labelExtractionService = new IcrLabelExtractionService();
    this.ocrProcessingService = new IcrOcrProcessingService();
    this.textDistributionService = new IcrTextDistributionService();
    this.cardMatchingService = new IcrCardMatchingService();
    this.stitchingOrchestrator = new IcrStitchingOrchestrator();

    // FIXED: Use repositories instead of direct model access
    this.gradedCardScanRepository = new GradedCardScanRepository();
    this.stitchedLabelRepository = new StitchedLabelRepository();
  }

  /**
   * STEP 1: Upload images and create GradedCardScan records
   * Delegates to dedicated upload service
   */
  async uploadImages(imageFiles) {
    return await this.imageUploadService.uploadImages(imageFiles);
  }

  /**
   * STEP 2: Extract PSA labels from uploaded scans
   * Delegates to dedicated label extraction service
   */
  async extractLabels(scanIds) {
    return await this.labelExtractionService.extractLabels(scanIds);
  }

  /**
   * STEP 2: Create vertical stitched image with duplicate detection
   */
  async createStitchedImage(batchId) {
    try {
      Logger.operationStart('ICR_STITCHING', 'Creating vertical stitched image', { batchId });

      const scans = await this.gradedCardScanRepository.findMany({ batchId }, { sort: { createdAt: 1 } });
      if (scans.length === 0) {
        throw new Error(`No scans found for batch ${batchId}`);
      }

      // Get all existing stitched labels to check which hashes have been processed
      const existingStitchedLabels = await this.stitchedLabelRepository.findMany({});
      const alreadyStitchedHashes = new Set();
      existingStitchedLabels.forEach(stitched => {
        stitched.labelHashes.forEach(hash => alreadyStitchedHashes.add(hash));
      });

      // Filter out scans that have already been stitched
      const newScans = scans.filter(scan => !alreadyStitchedHashes.has(scan.imageHash));

      if (newScans.length === 0) {
        Logger.info('ICR_STITCHING', 'All labels already stitched - no new labels to process', {
          totalScans: scans.length,
          alreadyStitched: scans.length - newScans.length,
          batchId
        });

        return {
          message: 'All labels already stitched',
          isDuplicate: true,
          totalLabels: scans.length,
          newLabels: 0,
          alreadyStitched: scans.length
        };
      }

      Logger.info('ICR_STITCHING', 'Found new labels to stitch', {
        totalScans: scans.length,
        newScans: newScans.length,
        alreadyStitched: scans.length - newScans.length,
        batchId
      });

      // Load only NEW label images that haven't been stitched AND exist on disk
      const labelBuffers = [];
      const availableScans = [];

      for (const scan of newScans) {
        try {
          await fs.access(scan.labelImage); // Check if file exists
          const labelBuffer = await fs.readFile(scan.labelImage);
          labelBuffers.push(labelBuffer);
          availableScans.push(scan);
        } catch (error) {
          Logger.warn('ICR_STITCHING', 'Label file not found - skipping scan', {
            scanId: scan._id,
            labelPath: scan.labelImage,
            error: error.message
          });
        }
      }

      if (availableScans.length === 0) {
        Logger.info('ICR_STITCHING', 'No available label files found for new scans', {
          totalScans: scans.length,
          newScans: newScans.length,
          batchId
        });

        return {
          message: 'No available label files found for stitching',
          isDuplicate: true,
          totalLabels: scans.length,
          newLabels: 0,
          alreadyStitched: scans.length
        };
      }

      // Create vertical stitched image using orchestrator
      const stitchedResult = await this.stitchingOrchestrator.createVerticalStitchedImage(labelBuffers);

      // Generate hash of stitched image
      const stitchedBuffer = await fs.readFile(stitchedResult.stitchedImagePath);
      const stitchedImageHash = ImageHashService.generateHash(stitchedBuffer);

      // Create StitchedLabel record for AVAILABLE scans only
      const newLabelHashes = availableScans.map(scan => scan.imageHash).sort();
      const stitchedLabel = await this.stitchedLabelRepository.create({
        stitchedImagePath: stitchedResult.stitchedImagePath,
        stitchedImageHash,
        stitchedImageDimensions: {
          width: stitchedResult.width,
          height: stitchedResult.height
        },
        batchId,
        labelHashes: newLabelHashes,
        labelCount: availableScans.length,
        gradedCardScanIds: availableScans.map(scan => scan._id),
        processingStatus: 'stitched'
      });


      // Update the scans' processing status to 'stitched'
      const statusUpdateResult = await this.gradedCardScanRepository.updateStatusByHashes(newLabelHashes, 'stitched'
      );

      Logger.operationSuccess('ICR_STITCHING', 'Stitching completed', {
        labelCount: labelBuffers.length,
        dimensions: `${stitchedResult.width}x${stitchedResult.height}`,
        scansUpdated: statusUpdateResult.modifiedCount,
        requestedHashes: newLabelHashes,
        stitchedLabelId: stitchedLabel._id
      });

      return {
        ...stitchedResult,
        stitchedLabelId: stitchedLabel._id,
        isDuplicate: false,
        totalLabels: scans.length,
        newLabels: availableScans.length,
        alreadyStitched: scans.length - availableScans.length,
        message: `Stitched ${availableScans.length} new labels (${scans.length - availableScans.length} already processed)`
      };

    } catch (error) {
      Logger.operationError('ICR_STITCHING', 'Stitching failed', error, { batchId });
      throw error;
    }
  }


  /**
   * STEP 3: Process OCR on stitched image
   * Delegates to dedicated OCR processing service
   */
  async processOcr(stitchedImagePath) {
    return await this.ocrProcessingService.processOcr(stitchedImagePath);
  }

  /**
   * STEP 3B: Process OCR by batch ID (auto-detect stitched image)
   * Delegates to dedicated OCR processing service
   */
  async processOcrByBatch(batchId) {
    return await this.ocrProcessingService.processOcrByBatch(batchId);
  }

  /**
   * STEP 4: Distribute OCR text to individual scans
   * Delegates to dedicated text distribution service
   */
  async distributeOcrText(batchId, ocrResult = null) {
    return await this.textDistributionService.distributeOcrText(batchId, ocrResult);
  }

  /**
   * STEP 5: Perform hierarchical card matching
   * Delegates to dedicated card matching service
   */
  async performCardMatching(batchId) {
    return await this.cardMatchingService.performCardMatching(batchId);
  }

  /**
   * Get scans by processing status
   */
  async getUploadedScans(status = 'uploaded', page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const scans = await this.gradedCardScanRepository.findByStatus(status, { skip, limit, sort: { createdAt: -1 } });

      const totalCount = await this.gradedCardScanRepository.countByStatus(status);

      return {
        scans: scans.map(scan => ({
          id: scan._id,
          originalFileName: scan.originalFileName,
          fullImageUrl: `/api/icr/images/full/${path.basename(scan.fullImage)}`,
          labelImageUrl: scan.labelImage ? `/api/icr/images/labels/${path.basename(scan.labelImage)}` : null,
          ocrText: scan.ocrText,
          ocrConfidence: scan.ocrConfidence,
          matchedCard: scan.matchedCard,
          matchConfidence: scan.matchConfidence,
          processingStatus: scan.processingStatus,
          imageHash: scan.imageHash,
          createdAt: scan.createdAt
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      };

    } catch (error) {
      Logger.operationError('ICR_GET_SCANS', 'Failed to get scans', error);
      throw error;
    }
  }

  /**
   * Create PSA card from matched GradedCardScan with pre-populated certification details
   */
  async createPsaCardFromScan(scanId, userInputs) {
    try {
      Logger.operationStart('ICR_CREATE_PSA', 'Creating PSA card from scan', { scanId });

      const scan = await this.gradedCardScanRepository.findById(scanId);
      if (!scan) {
        throw new Error('Scan not found');
      }

      const selectedCard = scan.getBestMatch();
      if (!selectedCard) {
        throw new Error('No card match selected');
      }

      // Import PsaGradedCard
      const PsaGradedCard = (await import('@/collection/items/PsaGradedCard.js')).default;

      const psaData = {
        cardId: selectedCard,
        grade: userInputs.grade || 10,
        certificationNumber: userInputs.certificationNumber,
        myPrice: userInputs.myPrice,
        dateAdded: userInputs.dateAdded || new Date(),
        images: [scan.fullImage, scan.labelImage]
      };

      Logger.info('ICR_CREATE_PSA', 'Creating PSA card:', {
        scanId,
        grade: psaData.grade,
        certificationNumber: psaData.certificationNumber
      });

      const psaCard = await PsaGradedCard.create(psaData);

      // Mark scan as PSA created
      await this.gradedCardScanRepository.update(scanId, {
        processingStatus: 'psa_created',
        psaCardId: psaCard._id
      });

      Logger.operationSuccess('ICR_CREATE_PSA', 'PSA card created successfully', {
        scanId,
        psaCardId: psaCard._id
      });

      return {
        psaCard,
        sourceGradedCardScan: scanId
      };

    } catch (error) {
      Logger.operationError('ICR_CREATE_PSA', 'PSA card creation failed', error);
      throw error;
    }
  }

  /**
   * HASH-BASED METHODS: Work directly with imageHashes (no batchId needed)
   */

  /**
   * Create stitched image from imageHashes array
   * Delegates to IcrStitchingOrchestrator - SOLID & DRY
   */
  async createStitchedImageFromHashes(imageHashes) {
    return this.stitchingOrchestrator.stitchImagesByHashes(imageHashes);
  }

  /**
   * Process OCR by imageHashes - delegates to OCR processing service
   */
  async processOcrByHashes(imageHashes) {
    return await this.ocrProcessingService.processOcrByHashes(imageHashes);
  }

  /**
   * Distribute OCR text by imageHashes - delegates to text distribution service
   */
  async distributeOcrTextByHashes(imageHashes, ocrResult = null) {
    return await this.textDistributionService.distributeOcrTextByHashes(imageHashes, ocrResult);
  }


  /**
   * Perform card matching by imageHashes - delegates to card matching service
   */
  async performCardMatchingByHashes(imageHashes) {
    return await this.cardMatchingService.performCardMatchingByHashes(imageHashes);
  }

  // ==========================================================================
  // PRIVATE HELPER METHODS
  // ==========================================================================

  async ensureDirectories() {
    const dirs = ['full-images', 'labels', 'stitched-images'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.baseDir, dir), { recursive: true });
    }
  }


  async clearExistingBatch(batchId) {
    await this.gradedCardScanRepository.deleteMany({ batchId });
  }


  async saveFullImage(file, batchId, index) {
    const filename = `${file.originalname}`;
    const filePath = path.join(process.cwd(), 'uploads', 'icr', 'full-images', filename);
    await fs.writeFile(filePath, file.buffer);
    return filePath;
  }


}

export default IcrBatchService;
