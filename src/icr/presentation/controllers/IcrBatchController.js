/**
 * ICR Batch Controller
 *
 * HTTP controller for ICR batch processing endpoints.
 * Handles image upload, stitching, OCR, text distribution, and card matching.
 */

import { asyncHandler, ValidationError } from '@/system/middleware/CentralizedErrorHandler.js';
import BaseController from '@/system/middleware/BaseController.js';
import { ServiceKeys } from '@/system/dependency-injection/ServiceContainer.js';
import IcrControllerService from '@/icr/application/services/IcrControllerService.js';
import IcrFileService from '@/icr/infrastructure/services/IcrFileService.js';
import Logger from '@/system/logging/Logger.js';
import multer from 'multer';
import path from 'path';

// Initialize file service for directory management
const icrFileService = new IcrFileService();
icrFileService.ensureDirectories();

// Configure multer for image upload using file service
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await icrFileService.ensureDirectories();
        const uploadsPath = icrFileService.getUploadPath('fullImages');
        cb(null, uploadsPath);
      } catch (error) {
        cb(error);
      }
    },
    filename: (req, file, cb) => {
      const safeFilename = icrFileService.generateSafeFilename(file.originalname);
      cb(null, safeFilename);
    }
  }),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 50 // Max 50 files
  },
  fileFilter: (req, file, cb) => {
    // Use file service for validation
    if (!icrFileService.isValidImageFile(file.originalname, file.mimetype)) {
      return cb(new ValidationError('Invalid image file type or format'));
    }
    cb(null, true);
  }
});

class IcrBatchController extends BaseController {
  constructor() {

    try {
      super(ServiceKeys.ICR_BATCH_SERVICE, {
        entityName: 'IcrBatch',
        pluralName: 'batches',
        enableCaching: false,
        enablePlugins: false,
        enableMetrics: true
      });


      // Initialize proper services following SOLID principles
      this.icrBatchService = this.service;
      this.icrControllerService = new IcrControllerService();
      this.icrFileService = new IcrFileService();

    } catch (error) {
      console.error('❌ [DEBUG] IcrBatchController constructor failed:', error.message);
      console.error('❌ [DEBUG] Stack:', error.stack);
      throw error;
    }
  }

  /**
   * POST /api/icr/upload
   * Upload PSA card images and create GradedCardScan records
   */
  uploadBatch = asyncHandler(async (req, res) => {
    Logger.info('IcrBatchController', '📤 Image upload request received', {
      fileCount: req.files?.length || 0
    });

    if (!req.files || req.files.length === 0) {
      throw new ValidationError('No images provided for upload');
    }

    const result = await this.icrBatchService.uploadImages(req.files);

    res.status(201).json({
      success: true,
      message: `Image upload completed: ${result.successful}/${req.files.length} images uploaded, ${result.duplicateCount} duplicates skipped`,
      data: {
        scanIds: result.scanIds,
        successful: result.successful,
        failed: result.failed,
        duplicateCount: result.duplicateCount,
        errors: result.errors,
        duplicates: result.duplicates
      }
    });
  });

  /**
   * POST /api/icr/extract-labels
   * Extract PSA labels from uploaded scans
   */
  extractLabels = asyncHandler(async (req, res) => {
    const { scanIds } = req.body;

    if (!scanIds || !Array.isArray(scanIds) || scanIds.length === 0) {
      throw new ValidationError('scanIds array is required');
    }

    Logger.info('IcrBatchController', '⚙️ Label extraction request received', { scanCount: scanIds.length });

    const result = await this.icrBatchService.extractLabels(scanIds);

    res.json({
      success: true,
      message: `Label extraction completed: ${result.successful}/${scanIds.length} scans processed, ${result.skippedCount} skipped`,
      data: result
    });
  });

  /**
   * POST /api/icr/stitch
   * Create vertical stitched image from extracted labels
   */
  stitchBatch = asyncHandler(async (req, res) => {
    const { imageHashes } = req.body;

    Logger.info('IcrBatchController', '🧩 Stitching request received', { imageHashes });

    const result = await this.icrBatchService.createStitchedImageFromHashes(imageHashes);

    const message = result.isDuplicate
      ? 'Duplicate detected: Using existing stitched image'
      : 'Stitched image created successfully';

    res.json({
      success: true,
      message: message,
      data: result
    });
  });

  /**
   * POST /api/icr/ocr
   * Process OCR on stitched image
   */
  processOcr = asyncHandler(async (req, res) => {
    const { imageHashes, stitchedImagePath } = req.body;

    Logger.info('IcrBatchController', '👁️ OCR processing request received', { imageHashes });

    let result;
    if (stitchedImagePath) {
      // Use provided stitched image path
      result = await this.icrBatchService.processOcr(stitchedImagePath);
    } else {
      // Auto-detect most recent stitched image for these hashes
      result = await this.icrBatchService.processOcrByHashes(imageHashes);
    }

    res.json({
      success: true,
      message: 'OCR processing completed and database updated',
      data: result
    });
  });

  /**
   * POST /api/icr/distribute
   * Distribute OCR text to individual scans
   */
  distributeText = asyncHandler(async (req, res) => {
    const { imageHashes, ocrResult } = req.body;

    Logger.info('IcrBatchController', '📋 Text distribution request received', {
      imageHashes,
      hasOcrResult: Boolean(ocrResult)
    });

    const result = await this.icrBatchService.distributeOcrTextByHashes(imageHashes, ocrResult);

    res.json({
      success: true,
      message: 'Text distribution completed',
      data: result
    });
  });

  /**
   * POST /api/icr/match
   * Perform hierarchical card matching
   */
  matchCards = asyncHandler(async (req, res) => {
    const { imageHashes } = req.body;

    Logger.info('IcrBatchController', '🎯 Card matching request received', { imageHashes });

    const result = await this.icrBatchService.performCardMatchingByHashes(imageHashes);

    res.json({
      success: true,
      message: `Card matching completed: ${result.successfulMatches}/${result.totalProcessed} matches found with OCR data extraction`,
      data: {
        ...result
      }
    });
  });

  /**
   * GET /api/icr/batch/:batchId/results
   * Get batch results for frontend display
   */
  getBatchResults = asyncHandler(async (req, res) => {
    const { batchId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    Logger.info('IcrBatchController', '📊 Batch results request received', {
      batchId,
      page,
      limit
    });

    const result = await this.icrBatchService.getBatchResults(
      batchId,
      parseInt(page, 10),
      parseInt(limit, 10)
    );

    res.json({
      success: true,
      message: `Found ${result.scans.length} results for batch ${batchId}`,
      data: result
    });
  });

  /**
   * GET /api/icr/scans
   * Get scans by processing status
   */
  getScans = asyncHandler(async (req, res) => {
    // Force no-cache headers for real-time ICR data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { status = 'uploaded', page = 1, limit = 150 } = req.query;
    const skip = (page - 1) * limit;

    // FIXED: Use service instead of direct database access
    const scans = await this.icrControllerService.getScans(
      { status },
      { skip, limit }
    );

    const totalCount = await this.icrControllerService.gradedCardScanRepository.countByStatus(status);

    res.json({
      success: true,
      data: {
        scans: scans.map(scan => ({
          id: scan._id,
          originalFileName: scan.originalFileName,
          fullImageUrl: `/api/icr/images/full/${path.basename(scan.fullImage)}`,
          labelImageUrl: scan.labelImage ? `/api/icr/images/labels/${path.basename(scan.labelImage)}` : null,
          processingStatus: scan.processingStatus,
          imageHash: scan.imageHash,
          extractedData: scan.extractedData || {},
          createdAt: scan.createdAt
        })),
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  });

  /**
   * GET /api/icr/stitched
   * Get all stitched images
   */
  getStitchedImages = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // FIXED: Use service instead of direct database access
    const stitchedImages = await this.icrControllerService.getStitchedImages({ skip, limit });
    const totalCount = await this.icrControllerService.stitchedLabelRepository.count();

    const formattedImages = stitchedImages.map(stitched => ({
      id: stitched._id,
      stitchedImagePath: stitched.stitchedImagePath,
      stitchedImageUrl: `/api/icr/images/stitched/${path.basename(stitched.stitchedImagePath)}`,
      imageWidth: stitched.stitchedImageDimensions.width,
      imageHeight: stitched.stitchedImageDimensions.height,
      labelCount: stitched.labelCount,
      batchId: stitched.batchId,
      processingStatus: stitched.processingStatus,
      createdAt: stitched.createdAt,
      labelHashes: stitched.labelHashes
    }));

    res.json({
      success: true,
      data: {
        stitchedImages: formattedImages,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      }
    });
  });

  /**
   * DELETE /api/icr/stitched/:id
   * Delete a stitched image and reset scans to extracted status
   */
  deleteStitchedImage = asyncHandler(async (req, res) => {
    const { id } = req.params;

    Logger.info('IcrBatchController', '🗑️ Delete stitched image request', { stitchedId: id });

    // FIXED: Use service instead of direct database access
    const result = await this.icrControllerService.deleteStitchedImages([id]);

    res.json({
      success: true,
      message: 'Stitched image deleted successfully',
      data: result
    });
  });

  /**
   * POST /api/icr/sync-statuses
   * Sync scan statuses with existing stitched labels (fix inconsistent state)
   */
  syncStatuses = asyncHandler(async (req, res) => {
    const { imageHashes } = req.body;

    Logger.info('IcrBatchController', '🔄 Syncing scan statuses...');

    // FIXED: Use service instead of direct database access
    const statusMap = await this.icrControllerService.syncStatuses(imageHashes);

    res.json({
      success: true,
      message: 'Status sync completed',
      data: statusMap
    });
  });

  /**
   * GET /api/icr/status
   * Get overall processing status
   */
  getOverallStatus = asyncHandler(async (req, res) => {
    // Force no-cache headers for real-time ICR status
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // FIXED: Use service instead of direct database access
    const status = await this.icrControllerService.getOverallStatus();

    res.json({
      success: true,
      data: status
    });
  });

  /**
   * POST /api/icr/status/check
   * Get processing status for specific images
   */
  getImageStatuses = asyncHandler(async (req, res) => {
    const { imageHashes } = req.body;

    if (!imageHashes || !Array.isArray(imageHashes) || imageHashes.length === 0) {
      throw new ValidationError('imageHashes array is required');
    }

    // FIXED: Use service instead of direct database access
    const statusMap = await this.icrControllerService.syncStatuses(imageHashes);

    res.json({
      success: true,
      data: statusMap
    });
  });

  /**
   * GET /api/icr/images/full/:filename
   * Serve full PSA card images
   */
  serveFullImage = asyncHandler(async (req, res) => {
    const { filename } = req.params;

    // FIXED: Use file service instead of direct file system access
    const imagePath = this.icrFileService.getUploadPath('fullImages');
    const fullPath = path.join(imagePath, filename);

    const imageData = await this.icrControllerService.serveImage(fullPath, 'full');

    res.set({
      'Content-Type': imageData.contentType,
      'Content-Length': imageData.size,
      'Last-Modified': imageData.lastModified.toUTCString()
    });

    res.end(imageData.buffer);
  });

  /**
   * GET /api/icr/images/labels/:filename
   * Serve extracted PSA label images
   */
  serveLabelImage = asyncHandler(async (req, res) => {
    const { filename } = req.params;

    // FIXED: Use file service instead of direct file system access
    const imagePath = this.icrFileService.getUploadPath('extractedLabels');
    const fullPath = path.join(imagePath, filename);

    const imageData = await this.icrControllerService.serveImage(fullPath, 'label');

    res.set({
      'Content-Type': imageData.contentType,
      'Content-Length': imageData.size,
      'Last-Modified': imageData.lastModified.toUTCString()
    });

    res.end(imageData.buffer);
  });

  /**
   * GET /api/icr/images/stitched/:filename
   * Serve stitched images
   */
  serveStitchedImage = asyncHandler(async (req, res) => {
    const { filename } = req.params;

    // FIXED: Use file service instead of direct file system access
    const imagePath = this.icrFileService.getUploadPath('stitchedImages');
    const fullPath = path.join(imagePath, filename);

    const imageData = await this.icrControllerService.serveImage(fullPath, 'stitched');

    res.set({
      'Content-Type': imageData.contentType,
      'Content-Length': imageData.size,
      'Last-Modified': imageData.lastModified.toUTCString()
    });

    res.end(imageData.buffer);
  });

  /**
   * DELETE /api/icr/scans
   * Delete multiple scans
   */
  deleteScans = asyncHandler(async (req, res) => {
    const { scanIds } = req.body;

    if (!scanIds || !Array.isArray(scanIds) || scanIds.length === 0) {
      throw new ValidationError('scanIds array is required');
    }

    Logger.info('IcrBatchController', '🗑️ Scan deletion request received', { scanCount: scanIds.length });

    // FIXED: Use service instead of direct database access
    const result = await this.icrControllerService.deleteScans(scanIds);

    res.json({
      success: true,
      message: `${result.deletedCount} scans deleted`,
      data: result
    });
  });

  /**
   * PUT /api/icr/batch/:scanId/select-match
   * Manual card match selection
   */
  selectMatch = asyncHandler(async (req, res) => {
    const { scanId } = req.params;
    const { cardId } = req.body;

    Logger.info('IcrBatchController', '🎯 Manual match selection', { scanId, cardId });

    // FIXED: Delegate to batch service instead of direct model access
    await this.icrBatchService.selectCardMatch(scanId, cardId);

    res.json({
      success: true,
      message: 'Match selected successfully',
      data: {
        scanId,
        selectedCardId: cardId,
        matchingStatus: 'manual_override'
      }
    });
  });

  /**
   * GET /api/icr/scans/:id
   * Get individual scan with complete OCR details, card matches, and extracted data
   */
  getScanDetails = asyncHandler(async (req, res) => {
    // Force no-cache headers for real-time data
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    const { id } = req.params;

    Logger.info('IcrBatchController', '🔍 Getting scan details', { scanId: id });

    // Get complete scan details with all OCR data and card matches
    const scan = await this.icrControllerService.getScanById(id);

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan not found',
        data: null
      });
    }

    res.json({
      success: true,
      message: 'Scan details retrieved successfully',
      data: {
        scan: {
          id: scan._id,
          originalFileName: scan.originalFileName,
          imageHash: scan.imageHash,
          processingStatus: scan.processingStatus,
          matchingStatus: scan.matchingStatus,
          fullImageUrl: `/api/icr/images/full/${scan.fullImage ? scan.fullImage.split('/').pop() : ''}`,
          labelImageUrl: scan.labelImage ? `/api/icr/images/labels/${scan.labelImage.split('/').pop()}` : null,
          ocrText: scan.ocrText,
          ocrConfidence: scan.ocrConfidence,
          extractedData: scan.extractedData || {},
          cardMatches: scan.cardMatches,
          selectedCardMatch: scan.selectedCardMatch,
          createdAt: scan.createdAt,
          updatedAt: scan.updatedAt
        }
      }
    });
  });

  /**
   * POST /api/icr/batch/:scanId/create-psa
   * Create PSA card from matched scan
   */
  createPsaCard = asyncHandler(async (req, res) => {
    const { scanId } = req.params;
    const { myPrice, dateAdded, grade } = req.body;

    Logger.info('IcrBatchController', '💳 PSA card creation request', { scanId });

    const result = await this.icrBatchService.createPsaCardFromScan(scanId, {
      myPrice,
      dateAdded: dateAdded || new Date(),
      grade
    });

    res.status(201).json({
      success: true,
      message: 'PSA card created successfully with pre-populated OCR data',
      data: {
        ...result
      }
    });
  });

  // Multer middleware getter for routes
  getUploadMiddleware() {
    return upload.array('images', 50);
  }
}

export default IcrBatchController;
