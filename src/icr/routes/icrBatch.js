/**
 * ICR Batch Processing Routes
 *
 * REST-compliant routes for Image Character Recognition batch processing.
 * Handles PSA card image upload, stitching, OCR, text distribution, and card matching.
 *
 * Each test script functionality is converted to its own route endpoint.
 */

import express from 'express';
import IcrBatchController from '@/icr/presentation/controllers/IcrBatchController.js';
import {validationMiddlewares} from '@/system/middleware/validationMiddleware.js';

const router = express.Router();

// NO CACHING FOR ICR - Removed all caching middleware to prevent workflow issues

// Initialize controller with debug logging
try {
    const icrBatchController = new IcrBatchController();
} catch (error) {
    console.error('❌ [DEBUG] Failed to create IcrBatchController:', error.message);
    console.error('❌ [DEBUG] Stack:', error.stack);
    throw error;
}
const icrBatchController = new IcrBatchController();

// ================================
// BATCH UPLOAD & PROCESSING ROUTES
// ================================

/**
 * @route   POST /api/icr/upload
 * @desc    Upload PSA card images with duplicate detection
 * @access  Public
 * @body    {files} images - Array of image files (max 50 files, 500MB limit)
 */
router.post('/upload',
    icrBatchController.getUploadMiddleware(),
    icrBatchController.uploadBatch
);

/**
 * @route   POST /api/icr/extract-labels
 * @desc    Extract PSA labels from uploaded scans
 * @access  Public
 * @body    {array} ids - Array of scan IDs to process
 */
router.post('/extract-labels',
    icrBatchController.extractLabels
);

/**
 * @route   POST /api/icr/stitch
 * @desc    Create vertical stitched image from extracted labels
 * @access  Public
 * @body    {array} imageHashes - Array of image hashes to stitch
 */
router.post('/stitch',
    validationMiddlewares.validateStitchingRequest,
    icrBatchController.stitchBatch
);

/**
 * @route   POST /api/icr/ocr
 * @desc    Process OCR on stitched image
 * @access  Public
 * @body    {array} imageHashes - Array of image hashes
 * @body    {string} stitchedImagePath - Path to stitched image (optional)
 */
router.post('/ocr',
    validationMiddlewares.validateImageHashes,
    icrBatchController.processOcr
);

/**
 * @route   POST /api/icr/distribute
 * @desc    Distribute OCR text to individual images
 * @access  Public
 * @body    {array} imageHashes - Array of image hashes
 * @body    {object} ocrResult - OCR result data (optional)
 */
router.post('/distribute',
    validationMiddlewares.validateImageHashes,
    icrBatchController.distributeText
);

/**
 * @route   POST /api/icr/match
 * @desc    Perform hierarchical card matching
 * @access  Public
 * @body    {array} imageHashes - Array of image hashes to match
 */
router.post('/match',
    validationMiddlewares.validateImageHashes,
    icrBatchController.matchCards
);

// ================================
// BATCH RESULTS & STATUS ROUTES
// ================================

/**
 * @route   GET /api/icr/scans/:id
 * @desc    Get individual scan with complete details
 * @access  Public
 * @param   {string} id - Scan ID
 */
router.get('/scans/:id',
    validationMiddlewares.validateObjectIdParam,
    icrBatchController.getScanDetails
);

/**
 * @route   GET /api/icr/scans
 * @desc    Get scans by processing status
 * @access  Public
 * @query   {string} status - Filter by processing status (default: uploaded)
 * @query   {number} page - Page number (optional, default 1)
 * @query   {number} limit - Results per page (optional, default 20)
 */
router.get('/scans',
    validationMiddlewares.validatePaginationQuery,
    icrBatchController.getScans
);

/**
 * @route   GET /api/icr/stitched
 * @desc    Get all stitched images
 * @access  Public
 * @query   {number} page - Page number (optional, default 1)
 * @query   {number} limit - Results per page (optional, default 20)
 */
router.get('/stitched',
    validationMiddlewares.validatePaginationQuery,
    icrBatchController.getStitchedImages
);

/**
 * @route   POST /api/icr/sync-statuses
 * @desc    Sync scan statuses with existing stitched labels
 * @access  Public
 */
router.post('/sync-statuses',
    icrBatchController.syncStatuses
);

/**
 * @route   GET /api/icr/status
 * @desc    Get overall processing status
 * @access  Public
 */
router.get('/status',
    icrBatchController.getOverallStatus
);

/**
 * @route   POST /api/icr/status/check
 * @desc    Get processing status for specific images
 * @access  Public
 * @body    {array} imageHashes - Array of image hashes to check
 */
router.post('/status/check',
    validationMiddlewares.validateImageHashes,
    icrBatchController.getImageStatuses
);

// ================================
// IMAGE SERVING ROUTES
// ================================

/**
 * @route   GET /api/icr/images/full/:filename
 * @desc    Serve full PSA card images
 * @access  Public
 * @param   {string} filename - Image filename
 */
router.get('/images/full/:filename',
    validationMiddlewares.validateFilename,
    icrBatchController.serveFullImage
);

/**
 * @route   GET /api/icr/images/labels/:filename
 * @desc    Serve extracted PSA label images
 * @access  Public
 * @param   {string} filename - Image filename
 */
router.get('/images/labels/:filename',
    validationMiddlewares.validateFilename,
    icrBatchController.serveLabelImage
);

/**
 * @route   GET /api/icr/images/stitched/:filename
 * @desc    Serve stitched images
 * @access  Public
 * @param   {string} filename - Image filename
 */
router.get('/images/stitched/:filename',
    validationMiddlewares.validateFilename,
    icrBatchController.serveStitchedImage
);

// ================================
// BATCH MANAGEMENT ROUTES
// ================================

/**
 * @route   DELETE /api/icr/scans
 * @desc    Delete multiple scans
 * @access  Public
 * @body    {array} ids - Array of scan IDs to delete
 */
router.delete('/scans',
    icrBatchController.deleteScans
);

/**
 * @route   DELETE /api/icr/stitched/:id
 * @desc    Delete stitched image and reset scans to extracted status
 * @access  Public
 * @param   {string} id - Stitched image ID
 */
router.delete('/stitched/:id',
    validationMiddlewares.validateObjectIdParam,
    icrBatchController.deleteStitchedImage
);

// ================================
// CARD MATCHING MANAGEMENT ROUTES
// ================================

/**
 * @route   GET /api/icr/scans/matched
 * @desc    Get scans ready for PSA creation (matched status)
 * @access  Public
 * @query   {number} page - Page number (optional, default 1)
 * @query   {number} limit - Results per page (optional, default 20)
 */
router.get('/scans/matched',
    validationMiddlewares.validatePaginationQuery,
    icrBatchController.getMatchedScans
);

/**
 * @route   PUT /api/icr/batch/:id/select-match
 * @desc    Manual card match selection override
 * @access  Public
 * @param   {string} id - Scan ID
 * @body    {string} cardId - Selected card ObjectId
 */
router.put('/batch/:id/select-match',
    validationMiddlewares.validateObjectIdParam,
    icrBatchController.selectMatch
);

/**
 * @route   POST /api/icr/batch/:id/create-psa
 * @desc    Create PSA card from matched image
 * @access  Public
 * @param   {string} id - Scan ID
 * @body    {number} myPrice - User price
 * @body    {string} grade - PSA grade override (optional)
 * @body    {date} dateAdded - Date added (optional)
 */
router.post('/batch/:id/create-psa',
    validationMiddlewares.validateObjectIdParam,
    icrBatchController.createPsaCard
);

/**
 * @route   POST /api/icr/scans/:id/complete
 * @desc    Complete scan after PSA card creation and cleanup files
 * @access  Public
 * @body    {string} psaCardId - Created PSA card ID
 * @body    {boolean} cleanupFiles - Whether to delete scan images
 * @body    {boolean} keepImageHash - Whether to keep imageHash for duplicate prevention
 */
router.post('/scans/:id/complete',
    icrBatchController.completeScan
);

export default router;
