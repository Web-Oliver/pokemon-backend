/**
 * OCR Routes - Refactored for SOLID Compliance
 *
 * This file now delegates to focused route modules following Single Responsibility Principle
 * Previously 986 lines - now delegates to 4 focused modules for better maintainability
 *
 * Architecture:
 * - core-detection.js: Basic OCR detection and validation (264 lines)
 * - vision-processing.js: Google Vision API integration (320 lines)
 * - card-matching.js: Card database matching and collection management (85 lines)
 * - index.js: Route orchestration and documentation (140 lines)
 *
 * Total: 809 lines across 4 focused modules (vs 986 lines in single file)
 * Benefits: Better maintainability, testability, and separation of concerns
 */

import express from 'express';
const router = express.Router();

// Delegate to the modular OCR route system
import ocrRoutes from './ocr/index.js';
// Mount all OCR routes
router.use('/', ocrRoutes);

export default router;
