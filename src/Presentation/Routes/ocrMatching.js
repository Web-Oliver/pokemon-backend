/**
 * OCR Matching Routes - API endpoints for OCR card matching
 */

import express from 'express';
const router = express.Router();
import ocrController from '@/Presentation/Controllers/ocrMatchingController.js';
/**
 * @route POST /api/ocr/match
 * @desc Match OCR text against card database
 * @body { ocrText: string, options?: object }
 * @returns { success: boolean, data: { matches, extractedData, confidence, ... } }
 */
router.post('/match', ocrController.matchOcrText);

/**
 * @route POST /api/ocr/batch-match
 * @desc Match multiple OCR texts in batch
 * @body { ocrTexts: string[], options?: object }
 * @returns { success: boolean, data: { results: MatchResult[] } }
 */
router.post('/batch-match', ocrController.batchMatchOcrText);

/**
 * @route GET /api/ocr/search/sets
 * @desc Search sets for manual selection
 * @query { query?: string, limit?: number }
 * @returns { success: boolean, data: { sets: Set[] } }
 */
router.get('/search/sets', ocrController.searchSets);

/**
 * @route GET /api/ocr/search/cards
 * @desc Search cards with optional set filtering
 * @query { query?: string, setId?: string, setName?: string, limit?: number }
 * @returns { success: boolean, data: { cards: Card[] } }
 */
router.get('/search/cards', ocrController.searchCards);

/**
 * @route POST /api/ocr/approve
 * @desc Approve a match and add to collection
 * @body { ocrText: string, selectedCard: Card, extractedData: object, confidence: number, userCorrections?: object }
 * @returns { success: boolean, data: { approvedMatch, message } }
 */
router.post('/approve', ocrController.approveMatch);

/**
 * @route POST /api/ocr/edit-extract
 * @desc Manually correct extracted data and re-match
 * @body { ocrText: string, corrections: { pokemonName?: string, cardNumber?: string } }
 * @returns { success: boolean, data: { correctedData, newMatches, confidence } }
 */
router.post('/edit-extract', ocrController.editExtractedData);

/**
 * @route GET /api/ocr/stats
 * @desc Get OCR matching statistics and performance metrics
 * @returns { success: boolean, data: { overallAccuracy, totalMatches, ... } }
 */
router.get('/stats', ocrController.getMatchingStats);

export default router;
