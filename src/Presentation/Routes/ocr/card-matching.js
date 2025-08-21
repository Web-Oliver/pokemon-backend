/**
 * OCR Card Matching Routes
 *
 * Single Responsibility: Card database matching and collection management
 * Handles OCR text matching, approval workflow, and PSA label operations
 */

import express from 'express';
const router = express.Router();

// Import OCR matching controller - delegates to UnifiedOcrMatchingService
import ocrMatchingController from '@/Presentation/Controllers/ocrMatchingController.js';
/**
 * POST /api/ocr/match
 * Match OCR text against card database with confidence scores
 */
router.post('/match', ocrMatchingController.matchOcrText);

/**
 * POST /api/ocr/batch-match
 * Match multiple OCR texts in a single request
 */
router.post('/batch-match', ocrMatchingController.batchMatchOcrText);

/**
 * POST /api/ocr/process-all-psa-labels
 * Process ALL PSA labels from database through OCR matching
 */
router.get('/process-all-psa-labels', ocrMatchingController.processAllPsaLabels);

/**
 * GET /api/ocr/search/sets
 * Hierarchical set search for manual correction workflow
 */
router.get('/search/sets', ocrMatchingController.searchSets);

/**
 * GET /api/ocr/search/cards
 * Hierarchical card search with set filtering
 */
router.get('/search/cards', ocrMatchingController.searchCards);

/**
 * POST /api/ocr/approve
 * Approve an OCR match and add PSA card to collection
 */
router.post('/approve', ocrMatchingController.approveMatch);

/**
 * POST /api/ocr/edit-extract
 * Manual correction of extracted data
 */
router.post('/edit-extract', ocrMatchingController.editExtractedData);

/**
 * POST /api/ocr/find-psa-image
 * Find PSA label image by OCR text similarity
 */
router.post('/find-psa-image', ocrMatchingController.findPsaImageByOcr);

/**
 * DELETE /api/ocr/delete-psa-label/:id
 * Delete unwanted PSA label
 */
router.delete('/delete-psa-label/:id', ocrMatchingController.deletePsaLabel);

/**
 * GET /api/ocr/matching-stats
 * OCR matching statistics and performance metrics
 */
router.get('/matching-stats', ocrMatchingController.getMatchingStats);

/**
 * GET /api/ocr/psa-label/:id/image
 * Serve full card image for PSA label
 */
router.get('/psa-label/:id/image', ocrMatchingController.getPsaLabelImage);

/**
 * GET /api/ocr/psa-labels
 * Get all PSA labels for management interface
 */
router.get('/psa-labels', ocrMatchingController.getAllPsaLabels);

/**
 * POST /api/ocr/create-collection-item
 * Create collection item from approved PSA label
 */
router.post('/create-collection-item', ocrMatchingController.createCollectionItem);

export default router;
