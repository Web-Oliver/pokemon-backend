/**
 * OCR to Collection Approval Workflow Controller
 *
 * REFACTORED TO FOLLOW SOLID PRINCIPLES:
 * - Single Responsibility: Only handles HTTP request/response
 * - Dependency Inversion: Depends on service abstraction
 * - NO direct database access, NO business logic in controller
 */

import {asyncHandler, ValidationError} from '@/system/middleware/CentralizedErrorHandler.js';
import {OcrApprovalWorkflowService} from '@/icr/application/services/OcrApprovalWorkflowService.js';
import Logger from '@/system/logging/Logger.js';

// Initialize service (should be injected in real implementation)
const ocrApprovalService = new OcrApprovalWorkflowService();

/**
 * POST /api/workflow/approve-ocr
 * Approve OCR result and create collection item
 * REFACTORED: Controller only handles HTTP concerns, delegates to service
 */
const approveOcrForCollection = asyncHandler(async (req, res) => {
    const {
        psaLabelId,
        cardId,
        userApprovalData = {}
    } = req.body;

    // Input validation (controller responsibility)
    if (!psaLabelId) {
        throw new ValidationError('PSA label ID is required for approval workflow');
    }

    Logger.info('OcrApprovalController', 'OCR approval request received', {
        psaLabelId,
        cardId: Boolean(cardId)
    });

    // Delegate to service (business logic)
    const result = await ocrApprovalService.approveOcrForCollection(
        psaLabelId,
        cardId,
        userApprovalData
    );

    // Format response (controller responsibility)
    res.json({
        success: true,
        data: result,
        message: 'ICR result approved and added to collection',
        meta: {
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * POST /api/workflow/reject-icr
 * Reject ICR result (keeps in ICR system, never enters collection)
 * REFACTORED: Controller only handles HTTP concerns, delegates to service
 */
const rejectIcrResult = asyncHandler(async (req, res) => {
    const {id, reason = 'user_rejection'} = req.body;

    // Input validation (controller responsibility)
    if (!id) {
        throw new ValidationError('Scan ID is required for rejection');
    }

    Logger.info('OcrApprovalController', 'OCR rejection request received', {
        id,
        reason
    });

    // Delegate to service (business logic)
    const result = await ocrApprovalService.rejectIcrResult(id, reason);

    // Format response (controller responsibility)
    res.json({
        success: true,
        data: result,
        message: 'ICR result rejected and marked in system'
    });
});

export {
    approveOcrForCollection,
    rejectIcrResult
};
