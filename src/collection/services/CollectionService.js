/**
 * Collection Service - Business Logic Layer
 *
 * SOLID Principles:
 * - Single Responsibility: Handles all collection business operations
 * - Dependency Inversion: Uses repositories for data access
 * - Interface Segregation: Focused collection operations
 */

import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import fs from 'fs/promises';
import path from 'path';
import Logger from '@/system/logging/Logger.js';

export class OcrCollectionService {
  constructor() {
    // Initialize any dependencies here
  }

  /**
   * Approve OCR match and create PSA card
   */
  async approveMatch(psaLabelId, cardId, extractedData, matchConfidence, userConfirmed = false) {
    try {
      Logger.info('OcrCollectionService', 'Starting match approval', {
        psaLabelId, cardId, matchConfidence, userConfirmed
      });

      // Get PSA label
      const PsaLabel = (await import('@/icr/infrastructure/persistence/PsaLabel.js')).default;
      const psaLabel = await PsaLabel.findById(psaLabelId);

      if (!psaLabel) {
        throw new Error('PSA label not found');
      }

      // Get matched card
      const Card = (await import('@/pokemon/cards/Card.js')).default;
      const matchedCard = await Card.findById(cardId)
        .populate('setId', 'setName year series abbreviation')
        .lean();

      if (!matchedCard) {
        throw new Error('Matched card not found');
      }

      // Check for existing PSA card
      const existingPsaCard = await PsaGradedCard.findOne({
        certificationNumber: psaLabel.certificationNumber || extractedData?.certificationNumber
      });

      if (existingPsaCard) {
        throw new Error('PSA card with this certification number already exists');
      }

      // Handle image file operations
      const collectionImagePath = await this.moveImageToCollection(psaLabel);

      // Create PSA card data
      const psaCardData = this.createPsaCardData(matchedCard, psaLabel, extractedData, matchConfidence, collectionImagePath, userConfirmed);

      const psaCard = new PsaGradedCard(psaCardData);
      await psaCard.save();

      // Update PSA label status
      await PsaLabel.findByIdAndUpdate(psaLabelId, {
        $set: {
          'psaData.approved': true,
          'psaData.approvedAt': new Date(),
          'psaData.approvedCardId': cardId,
          'psaData.psaGradedCardId': psaCard._id,
          'psaData.matchConfidence': matchConfidence,
          'psaData.userConfirmed': userConfirmed,
          status: 'approved',
          isAddedToCollection: true,
          collectionItemId: psaCard._id,
          collectionAddedAt: new Date()
        }
      });

      Logger.info('OcrCollectionService', 'Match approved successfully', {
        psaCardId: psaCard._id,
        certificationNumber: psaCard.certificationNumber
      });

      return {
        psaCard,
        approvalDetails: {
          psaLabelId,
          matchedCardId: cardId,
          confidence: matchConfidence,
          approvedAt: new Date(),
          userConfirmed
        }
      };

    } catch (error) {
      Logger.error('OcrCollectionService', 'Match approval failed', error, { psaLabelId, cardId });
      throw error;
    }
  }

  /**
   * Create collection item from PSA card
   */
  async createCollectionItem(psaGradedCardId, collectionData = {}) {
    try {
      const psaCard = await PsaGradedCard.findById(psaGradedCardId)
        .populate('cardId')
        .populate('setId')
        .lean();

      if (!psaCard) {
        throw new Error('PSA graded card not found');
      }

      const collectionItemData = {
        cardId: psaCard.cardId._id,
        gradingInfo: {
          gradingService: psaCard.gradingService,
          grade: psaCard.grade,
          certificationNumber: psaCard.certificationNumber,
          gradedDate: psaCard.approvedAt
        },
        addedDate: new Date(),
        addedSource: 'psa_ocr_approval',
        condition: `PSA ${psaCard.grade}`,
        notes: `Added via OCR matching. Original OCR: "${psaCard.originalOcrText?.substring(0, 100)}..."`,
        purchasePrice: collectionData.purchasePrice || null,
        currentValue: psaCard.currentPrice || null,
        storageLocation: collectionData.storageLocation || 'PSA Case',
        images: [psaCard.imageUrl, psaCard.labelImage].filter(Boolean),
        psaGradedCardId: psaCard._id,
        ...collectionData
      };

      Logger.info('OcrCollectionService', 'Collection item created', {
        psaGradedCardId,
        cardName: psaCard.cardName
      });

      return {
        collectionItem: collectionItemData,
        psaCard
      };

    } catch (error) {
      Logger.error('OcrCollectionService', 'Collection item creation failed', error, { psaGradedCardId });
      throw error;
    }
  }

  /**
   * Delete PSA label
   */
  async deletePsaLabel(id, reason = 'user_request') {
    try {
      const PsaLabel = (await import('@/icr/infrastructure/persistence/PsaLabel.js')).default;

      const psaLabel = await PsaLabel.findById(id);
      if (!psaLabel) {
        throw new Error('PSA label not found');
      }

      // Check for associated PSA card
      const associatedPsaCard = await PsaGradedCard.findOne({
        $or: [
          { 'originalPsaLabelId': id },
          { 'certificationNumber': psaLabel.certificationNumber }
        ]
      });

      if (associatedPsaCard) {
        throw new Error('Cannot delete PSA label - associated PSA card exists');
      }

      // Soft delete
      await PsaLabel.findByIdAndUpdate(id, {
        $set: {
          status: 'deleted',
          deletedAt: new Date(),
          deletionReason: reason,
          'psaData.deleted': true
        }
      });

      Logger.info('OcrCollectionService', 'PSA label deleted', { id, reason });

      return {
        deletedLabelId: id,
        deletionReason: reason,
        deletedAt: new Date()
      };

    } catch (error) {
      Logger.error('OcrCollectionService', 'PSA label deletion failed', error, { id });
      throw error;
    }
  }

  /**
   * Move image to collection storage
   * @private
   */
  async moveImageToCollection(psaLabel) {
    try {
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1e9);
      const imageExtension = path.extname(psaLabel.labelImage) || '.jpg';
      const newImageName = `image-${timestamp}-${randomSuffix}${imageExtension}`;

      const sourcePath = path.resolve(process.cwd(), 'uploads', 'ocr', 'full-images', psaLabel.labelImage);
      const destinationPath = path.resolve(process.cwd(), 'uploads', 'collection', newImageName);

      await fs.copyFile(sourcePath, destinationPath);

      Logger.info('OcrCollectionService', 'Image moved to collection storage', {
        sourcePath,
        destinationPath,
        newImageName
      });

      return `/uploads/${newImageName}`;

    } catch (error) {
      Logger.warn('OcrCollectionService', 'Failed to move image to collection', error);
      return psaLabel._id.toString(); // Fallback
    }
  }

  /**
   * Create PSA card data object
   * @private
   */
  createPsaCardData(matchedCard, psaLabel, extractedData, matchConfidence, collectionImagePath, userConfirmed) {
    return {
      cardId: matchedCard._id,
      cardName: matchedCard.cardName,
      cardNumber: matchedCard.cardNumber,
      setName: matchedCard.setId?.setName || extractedData?.setName,
      setId: matchedCard.setId,
      variety: matchedCard.variety,
      rarity: matchedCard.rarity,
      certificationNumber: psaLabel.certificationNumber || extractedData?.certificationNumber,
      grade: extractedData?.grade || psaLabel.psaData?.extractedData?.grade,
      gradingService: 'PSA',
      images: [collectionImagePath].filter(Boolean),
      ocrConfidence: matchConfidence,
      approvalSource: 'ocr_matching',
      approvedAt: new Date(),
      ocrSourceLabelId: psaLabel._id,
      originalOcrText: psaLabel.ocrText,
      extractedData,
      setYear: matchedCard.setId?.year,
      setSeries: matchedCard.setId?.series,
      currentPrice: matchedCard.price,
      myPrice: matchedCard.price
    };
  }
}

export default OcrCollectionService;