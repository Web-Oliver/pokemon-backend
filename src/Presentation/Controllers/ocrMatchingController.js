/**
 * OCR Matching Controller - Refactored for SOLID Compliance
 *
 * This file now delegates to focused controller modules following Single Responsibility Principle
 * Previously 1092 lines - now delegates to 3 focused modules for better maintainability
 *
 * Architecture:
 * - TextMatchingController.js: OCR text matching and search operations (325 lines)
 * - CollectionManagementController.js: Collection approval and PSA card management (280 lines)
 * - LabelProcessingController.js: Batch processing and image handling (410 lines)
 * - index.js: Controller orchestration and unified interface (35 lines)
 *
 * Total: 1050 lines across 4 focused modules (vs 1092 lines in single file)
 * Benefits: Better maintainability, testability, and separation of concerns
 *
 * Updated to use UnifiedOcrMatchingService (consolidates 8+ OCR/PSA services)
 */

// Delegate to the modular OCR controller system
export { default } from './ocr/index.js';
