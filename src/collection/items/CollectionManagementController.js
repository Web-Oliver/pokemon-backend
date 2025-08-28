/**
 * OCR Collection Management Controller
 *
 * Single Responsibility: Collection approval, creation, and PSA card management
 * Handles approval workflow, collection item creation, and PSA card operations
 */

import { asyncHandler } from '@/system/middleware/CentralizedErrorHandler.js';
import DebugLogger from '@/system/logging/DebugLogger.js';
import CollectionService from '@/collection/services/CollectionService.js';

// Use extracted debug logger
const debugLog = DebugLogger.createScopedLogger('OCR-COLLECTION');
const collectionService = new CollectionService();

/**
 * POST /api/ocr/approve
 * Approve an OCR match and add PSA card to collection
 */
const approveMatch = asyncHandler(async (req, res) => {
  const {
    psaLabelId,
    cardId,
    extractedData,
    matchConfidence,
    userConfirmed = false
  } = req.body;

  debugLog('APPROVE_START', 'Starting match approval', {
    psaLabelId,
    cardId,
    matchConfidence,
    userConfirmed
  });

  if (!psaLabelId || !cardId) {
    return res.status(400).json({
      success: false,
      error: 'PSA label ID and card ID are required'
    });
  }

  try {
    const result = await collectionService.approveMatch(
      psaLabelId,
      cardId,
      extractedData,
      matchConfidence,
      userConfirmed
    );


    debugLog('APPROVE_SUCCESS', 'Match approved and PSA card created', {
      psaLabelId,
      cardId,
      psaCardId: result.psaCard._id,
      certificationNumber: result.psaCard.certificationNumber
    });

    res.json({
      success: true,
      data: result,
      message: `Successfully created PSA card for ${result.psaCard.cardName} (Cert: ${result.psaCard.certificationNumber})`,
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    debugLog('APPROVE_ERROR', 'Match approval failed', {
      error: error.message,
      psaLabelId,
      cardId
    });

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    throw error;
  }
});

/**
 * POST /api/ocr/create-collection-item
 * Create collection item from approved PSA label
 */
const createCollectionItem = asyncHandler(async (req, res) => {
  const { psaGradedCardId, collectionData = {} } = req.body;

  if (!psaGradedCardId) {
    return res.status(400).json({
      success: false,
      error: 'PSA graded card ID is required'
    });
  }

  debugLog('CREATE_COLLECTION_START', 'Creating collection item', {
    psaGradedCardId,
    collectionData
  });

  try {
    const result = await collectionService.createCollectionItem(psaGradedCardId, collectionData);

    debugLog('CREATE_COLLECTION_SUCCESS', 'Collection item created', {
      psaGradedCardId,
      cardName: result.psaCard.cardName
    });

    res.json({
      success: true,
      data: result,
      message: `Collection item created for ${result.psaCard.cardName} (PSA ${result.psaCard.grade})`,
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    debugLog('CREATE_COLLECTION_ERROR', 'Collection item creation failed', {
      error: error.message,
      psaGradedCardId
    });
    throw error;
  }
});

/**
 * DELETE /api/ocr/delete-psa-label/:id
 * Delete unwanted PSA label
 */
const deletePsaLabel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason = 'user_request' } = req.body;

  debugLog('DELETE_LABEL_START', 'Deleting PSA label', { id, reason });

  try {
    const result = await collectionService.deletePsaLabel(id, reason);

    debugLog('DELETE_LABEL_SUCCESS', 'PSA label deleted', { id, reason });

    res.json({
      success: true,
      data: result,
      message: 'PSA label successfully deleted',
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    debugLog('DELETE_LABEL_ERROR', 'PSA label deletion failed', {
      error: error.message,
      id
    });
    throw error;
  }
});

export {
  approveMatch,
  createCollectionItem,
  deletePsaLabel
};
export default approveMatch; ;
