/**
 * OCR Controllers Main Index
 *
 * Single Responsibility: Controller orchestration and module composition
 * Combines focused controller modules following SOLID principles
 */

// Import focused controller modules
import * as TextMatchingController from './TextMatchingController.js';
import * as CollectionManagementController from './CollectionManagementController.js';
import * as LabelProcessingController from './LabelProcessingController.js';
/**
 * Combined controller exports for backward compatibility
 * Each controller maintains single responsibility while providing unified interface
 */
const ocrController = {
  // Text Matching Operations (TextMatchingController)
  matchOcrText: TextMatchingController.matchOcrText,
  batchMatchOcrText: TextMatchingController.batchMatchOcrText,
  searchSets: TextMatchingController.searchSets,
  searchCards: TextMatchingController.searchCards,
  editExtractedData: TextMatchingController.editExtractedData,
  getMatchingStats: TextMatchingController.getMatchingStats,

  // Collection Management Operations (CollectionManagementController)
  approveMatch: CollectionManagementController.approveMatch,
  createCollectionItem: CollectionManagementController.createCollectionItem,
  deletePsaLabel: CollectionManagementController.deletePsaLabel,

  // Label Processing Operations (LabelProcessingController)
  processAllPsaLabels: LabelProcessingController.processAllPsaLabels,
  findPsaImageByOcr: LabelProcessingController.findPsaImageByOcr,
  getPsaLabelImage: LabelProcessingController.getPsaLabelImage,
  getAllPsaLabels: LabelProcessingController.getAllPsaLabels
};

export default ocrController;
