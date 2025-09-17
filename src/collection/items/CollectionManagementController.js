/**
 * OCR Collection Management Controller
 *
 * Single Responsibility: Collection approval, creation, and PSA card management
 * Handles approval workflow, collection item creation, and PSA card operations
 */

import {asyncHandler} from '@/system/middleware/CentralizedErrorHandler.js';
import Logger from '@/system/logging/Logger.js';
import OcrCollectionService from '@/collection/services/CollectionService.js';
import StandardResponseBuilder from '@/system/utilities/StandardResponseBuilder.js';

const collectionService = new OcrCollectionService();

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

    Logger.debug('OCR-COLLECTION', 'APPROVE_START', 'Starting match approval', {
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


        Logger.debug('OCR-COLLECTION', 'APPROVE_SUCCESS', 'Match approved and PSA card created', {
            psaLabelId,
            cardId,
            psaCardId: result.psaCard._id,
            certificationNumber: result.psaCard.certificationNumber
        });

        const response = StandardResponseBuilder.success(result, {
            message: `Successfully created PSA card for ${result.psaCard.cardName} (Cert: ${result.psaCard.certificationNumber})`,
            operation: 'approveMatch',
            certificationNumber: result.psaCard.certificationNumber
        });
        res.json(response);

    } catch (error) {
        Logger.debug('OCR-COLLECTION', 'APPROVE_ERROR', 'Match approval failed', {
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
    const {psaGradedCardId, collectionData = {}} = req.body;

    if (!psaGradedCardId) {
        return res.status(400).json({
            success: false,
            error: 'PSA graded card ID is required'
        });
    }

    Logger.debug('OCR-COLLECTION', 'CREATE_COLLECTION_START', 'Creating collection item', {
        psaGradedCardId,
        collectionData
    });

    try {
        const result = await collectionService.createCollectionItem(psaGradedCardId, collectionData);

        Logger.debug('OCR-COLLECTION', 'CREATE_COLLECTION_SUCCESS', 'Collection item created', {
            psaGradedCardId,
            cardName: result.psaCard.cardName
        });

        const response = StandardResponseBuilder.success(result, {
            message: `Collection item created for ${result.psaCard.cardName} (PSA ${result.psaCard.grade})`,
            operation: 'createCollectionItem',
            cardName: result.psaCard.cardName,
            grade: result.psaCard.grade
        });
        res.json(response);

    } catch (error) {
        Logger.debug('OCR-COLLECTION', 'CREATE_COLLECTION_ERROR', 'Collection item creation failed', {
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
    const {id} = req.params;
    const {reason = 'user_request'} = req.body;

    Logger.debug('OCR-COLLECTION', 'DELETE_LABEL_START', 'Deleting PSA label', {id, reason});

    try {
        const result = await collectionService.deletePsaLabel(id, reason);

        Logger.debug('OCR-COLLECTION', 'DELETE_LABEL_SUCCESS', 'PSA label deleted', {id, reason});

        const response = StandardResponseBuilder.success(result, {
            message: 'PSA label successfully deleted',
            operation: 'deletePsaLabel',
            labelId: id
        });
        res.json(response);

    } catch (error) {
        Logger.debug('OCR-COLLECTION', 'DELETE_LABEL_ERROR', 'PSA label deletion failed', {
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
export default approveMatch;

