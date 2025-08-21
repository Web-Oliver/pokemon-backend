/**
 * OCR Collection Management Controller
 *
 * Single Responsibility: Collection approval, creation, and PSA card management
 * Handles approval workflow, collection item creation, and PSA card operations
 */

import { asyncHandler   } from '@/Infrastructure/Utilities/errorHandler.js';
import ocrMatchingService from '@/Application/UseCases/Matching/UnifiedOcrMatchingService.js';
import PsaGradedCard from '@/Domain/Entities/PsaGradedCard.js';
import PsaLabel from '@/Domain/Entities/PsaLabel.js';
// Comprehensive debugging utility
const debugLog = (context, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [OCR-COLLECTION-${context}] ${message}`;

  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

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
    // Get the PSA label
    const psaLabel = await PsaLabel.findById(psaLabelId);

    if (!psaLabel) {
      return res.status(404).json({
        success: false,
        error: 'PSA label not found'
      });
    }

    // Get the matched card with set information
    const Card = (await import('@/Domain/Entities/Card.js')).default;
    const matchedCard = await Card.findById(cardId)
      .populate('setId', 'setName year series abbreviation')
      .lean();

    if (!matchedCard) {
      return res.status(404).json({
        success: false,
        error: 'Matched card not found'
      });
    }

    // Check if PSA card already exists for this cert number
    const existingPsaCard = await PsaGradedCard.findOne({
      certificationNumber: psaLabel.certificationNumber || extractedData?.certificationNumber
    });

    if (existingPsaCard) {
      debugLog('APPROVE_WARNING', 'PSA card already exists', {
        certificationNumber: existingPsaCard.certificationNumber,
        existingCardId: existingPsaCard._id
      });

      return res.status(409).json({
        success: false,
        error: 'PSA card with this certification number already exists',
        data: {
          existingPsaCard,
          conflictType: 'duplicate_certification'
        }
      });
    }

    // Create PSA graded card from approved match
    const psaCardData = {
      // Basic card information
      cardId: matchedCard._id,
      cardName: matchedCard.cardName,
      cardNumber: matchedCard.cardNumber,
      setName: matchedCard.setId?.setName || extractedData?.setName,
      setId: matchedCard.setId,
      variety: matchedCard.variety,
      rarity: matchedCard.rarity,

      // PSA specific information
      certificationNumber: psaLabel.certificationNumber || extractedData?.certificationNumber,
      grade: extractedData?.grade || psaLabel.psaData?.extractedData?.grade,
      gradingService: 'PSA',
      labelImage: psaLabel.labelImage,

      // OCR and approval tracking
      ocrConfidence: matchConfidence,
      approvalSource: 'ocr_matching',
      approvedAt: new Date(),

      // Extracted data backup
      originalOcrText: psaLabel.ocrText,
      extractedData,

      // Set information
      setYear: matchedCard.setId?.year,
      setSeries: matchedCard.setId?.series,

      // Market information from matched card
      currentPrice: matchedCard.price,
      imageUrl: matchedCard.imageUrl || psaLabel.labelImage
    };

    const psaCard = new PsaGradedCard(psaCardData);

    await psaCard.save();

    // Update PSA label to mark as approved and processed
    await PsaLabel.findByIdAndUpdate(psaLabelId, {
      $set: {
        'psaData.approved': true,
        'psaData.approvedAt': new Date(),
        'psaData.approvedCardId': cardId,
        'psaData.psaGradedCardId': psaCard._id,
        'psaData.matchConfidence': matchConfidence,
        'psaData.userConfirmed': userConfirmed,
        status: 'approved'
      }
    });

    debugLog('APPROVE_SUCCESS', 'Match approved and PSA card created', {
      psaLabelId,
      cardId,
      psaCardId: psaCard._id,
      certificationNumber: psaCard.certificationNumber
    });

    res.json({
      success: true,
      data: {
        psaCard,
        approvalDetails: {
          psaLabelId,
          matchedCardId: cardId,
          confidence: matchConfidence,
          approvedAt: new Date(),
          userConfirmed
        }
      },
      message: `Successfully created PSA card for ${psaCard.cardName} (Cert: ${psaCard.certificationNumber})`,
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

    // Handle specific error types
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'Duplicate PSA card detected',
        details: 'A PSA card with this certification number already exists'
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
    // Get the PSA card with populated card information
    const psaCard = await PsaGradedCard.findById(psaGradedCardId)
      .populate('cardId')
      .populate('setId')
      .lean();

    if (!psaCard) {
      return res.status(404).json({
        success: false,
        error: 'PSA graded card not found'
      });
    }

    // Create collection item data
    const collectionItemData = {
      // Card reference
      cardId: psaCard.cardId._id,

      // Grading information
      gradingInfo: {
        gradingService: psaCard.gradingService,
        grade: psaCard.grade,
        certificationNumber: psaCard.certificationNumber,
        gradedDate: psaCard.approvedAt
      },

      // Collection metadata
      addedDate: new Date(),
      addedSource: 'psa_ocr_approval',

      // Condition and notes
      condition: `PSA ${psaCard.grade}`,
      notes: `Added via OCR matching. Original OCR: "${psaCard.originalOcrText?.substring(0, 100)}..."`,

      // Valuation
      purchasePrice: collectionData.purchasePrice || null,
      currentValue: psaCard.currentPrice || null,

      // Storage information
      storageLocation: collectionData.storageLocation || 'PSA Case',

      // Images
      images: [
        psaCard.imageUrl,
        psaCard.labelImage
      ].filter(Boolean),

      // PSA specific metadata
      psaGradedCardId: psaCard._id,
      ...collectionData
    };

    // Here you would typically save to a Collection model
    // For now, we'll return the collection item data
    debugLog('CREATE_COLLECTION_SUCCESS', 'Collection item created', {
      psaGradedCardId,
      cardName: psaCard.cardName
    });

    res.json({
      success: true,
      data: {
        collectionItem: collectionItemData,
        psaCard
      },
      message: `Collection item created for ${psaCard.cardName} (PSA ${psaCard.grade})`,
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
    // Check if PSA label exists
    const psaLabel = await PsaLabel.findById(id);

    if (!psaLabel) {
      return res.status(404).json({
        success: false,
        error: 'PSA label not found'
      });
    }

    // Check if there's an associated PSA card
    const associatedPsaCard = await PsaGradedCard.findOne({
      $or: [
        { 'originalPsaLabelId': id },
        { 'certificationNumber': psaLabel.certificationNumber }
      ]
    });

    if (associatedPsaCard) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete PSA label - associated PSA card exists',
        data: {
          associatedPsaCard: {
            id: associatedPsaCard._id,
            cardName: associatedPsaCard.cardName,
            certificationNumber: associatedPsaCard.certificationNumber
          }
        }
      });
    }

    // Soft delete - mark as deleted rather than removing completely
    await PsaLabel.findByIdAndUpdate(id, {
      $set: {
        status: 'deleted',
        deletedAt: new Date(),
        deletionReason: reason,
        'psaData.deleted': true
      }
    });

    debugLog('DELETE_LABEL_SUCCESS', 'PSA label deleted', { id, reason });

    res.json({
      success: true,
      data: {
        deletedLabelId: id,
        deletionReason: reason,
        deletedAt: new Date()
      },
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
export default approveMatch;;
