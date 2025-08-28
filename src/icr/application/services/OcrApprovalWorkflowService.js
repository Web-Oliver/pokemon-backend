/**
 * OCR Approval Workflow Service
 *
 * FIXES SOLID VIOLATIONS by extracting business logic from OcrApprovalController
 *
 * BEFORE: Controller had direct database access, file operations, business logic (SRP violation)
 * AFTER: Clean service layer handles all workflow operations
 */

import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import { FileSystemUtils } from '@/icr/shared/FileSystemUtils.js';
import Logger from '@/system/logging/Logger.js';
import path from 'path';

export class OcrApprovalWorkflowService {
  constructor() {
    this.gradedCardScanRepository = new GradedCardScanRepository();
    this.icrUploadsDir = path.join(process.cwd(), 'uploads', 'icr');
    this.collectionUploadsDir = path.join(process.cwd(), 'uploads', 'collection');
  }

  /**
   * Approve OCR result and create collection item
   * SINGLE RESPONSIBILITY: Handles complete approval workflow
   */
  async approveOcrForCollection(psaLabelId, cardId, userApprovalData = {}) {
    try {
      Logger.operationStart('OCR_APPROVAL_WORKFLOW', 'Starting OCR approval workflow', {
        psaLabelId,
        cardId
      });

      // 1. Get ICR data from repository
      const gradedCardScan = await this.gradedCardScanRepository.findById(psaLabelId);
      if (!gradedCardScan) {
        throw new Error('ICR result not found');
      }

      // 2. Copy image from ICR to collection storage
      const collectionImagePath = await this.copyImageToCollection(gradedCardScan);

      // 3. Create collection item
      const collectionItem = await this.createCollectionItem(gradedCardScan, cardId, collectionImagePath, userApprovalData);

      // 4. Mark ICR scan as approved
      await this.markScanAsApproved(psaLabelId);

      Logger.operationSuccess('OCR_APPROVAL_WORKFLOW', 'OCR approval workflow completed', {
        psaLabelId,
        collectionItemId: collectionItem._id,
        certificationNumber: collectionItem.certificationNumber
      });

      return {
        collectionItem,
        workflow: {
          icrSourceId: psaLabelId,
          approvedAt: new Date(),
          imageCopied: true,
          collectionPath: collectionImagePath
        }
      };

    } catch (error) {
      Logger.operationError('OCR_APPROVAL_WORKFLOW', 'OCR approval workflow failed', error);
      throw error;
    }
  }

  /**
   * Reject ICR result
   * SINGLE RESPONSIBILITY: Handles rejection workflow
   */
  async rejectIcrResult(scanId, reason = 'user_rejection') {
    try {
      Logger.operationStart('OCR_REJECTION_WORKFLOW', 'Starting OCR rejection workflow', { scanId, reason });

      await this.gradedCardScanRepository.updateById(scanId, {
        processingStatus: 'rejected',
        userDenied: true,
        processedAt: new Date(),
        rejectionReason: reason
      });

      Logger.operationSuccess('OCR_REJECTION_WORKFLOW', 'OCR rejection workflow completed', { scanId });

      return {
        rejectedScanId: scanId,
        rejectedAt: new Date(),
        reason
      };

    } catch (error) {
      Logger.operationError('OCR_REJECTION_WORKFLOW', 'OCR rejection workflow failed', error);
      throw error;
    }
  }

  /**
   * Copy image from ICR storage to collection storage
   * @private
   */
  async copyImageToCollection(gradedCardScan) {
    try {
      const timestamp = Date.now();
      const randomSuffix = Math.round(Math.random() * 1e9);
      const imageExtension = path.extname(gradedCardScan.fullImage) || '.jpg';
      const newImageName = `psa-${timestamp}-${randomSuffix}${imageExtension}`;

      const sourcePath = gradedCardScan.fullImage;
      const destinationPath = path.join(this.collectionUploadsDir, newImageName);

      // Use centralized file system utilities with validation
      await FileSystemUtils.copyFileWithValidation(
        sourcePath,
        destinationPath,
        this.icrUploadsDir,
        this.collectionUploadsDir
      );

      const collectionImagePath = `/uploads/${newImageName}`;

      Logger.info('OcrApprovalWorkflowService', 'Image copied to collection storage', {
        sourceIcrPath: sourcePath,
        destinationCollectionPath: collectionImagePath
      });

      return collectionImagePath;

    } catch (error) {
      Logger.error('OcrApprovalWorkflowService', 'Failed to copy ICR image to collection', error);
      throw new Error('Failed to prepare image for collection');
    }
  }

  /**
   * Create collection item from ICR data
   * @private
   */
  async createCollectionItem(gradedCardScan, cardId, collectionImagePath, userApprovalData) {
    const collectionItemData = {
      // Card information (if cardId provided)
      cardId: cardId || null,

      // PSA specific information from ICR
      certificationNumber: gradedCardScan.gradedData?.certificationNumber,
      grade: gradedCardScan.gradedData?.grade,
      gradingService: 'PSA',

      // Collection metadata
      images: [collectionImagePath],
      addedDate: new Date(),
      addedSource: 'icr_approval_workflow',

      // User provided data
      ...userApprovalData,

      // Audit trail (reference to ICR source)
      icrSourceId: gradedCardScan._id,
      originalOcrText: gradedCardScan.ocrText
    };

    const collectionItem = new PsaGradedCard(collectionItemData);
    await collectionItem.save();

    return collectionItem;
  }

  /**
   * Mark ICR scan as approved
   * @private
   */
  async markScanAsApproved(psaLabelId) {
    await this.gradedCardScanRepository.updateById(psaLabelId, {
      processingStatus: 'approved',
      userVerified: true,
      processedAt: new Date()
    });
  }
}