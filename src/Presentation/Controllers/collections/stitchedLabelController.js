import { validationResult } from 'express-validator';
import stitchedLabelService from '@/Application/Services/Core/stitchedLabelService.js';
import { ValidationError, NotFoundError   } from '@/Presentation/Middleware/errorHandler.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
class StitchedLabelController {
  /**
   * Create stitched label from multiple images
   * POST /api/stitched-labels/create
   */
  async createStitchedLabel(req, res, next) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const images = req.files || [];
      const {
        batchId,
        labelWidth,
        labelHeight,
        spacing,
        backgroundColor
      } = req.body;

      if (!images || images.length === 0) {
        throw new ValidationError('At least one image is required');
      }

      if (images.length > 50) {
        throw new ValidationError('Maximum 50 images allowed per batch');
      }

      Logger.info('StitchedLabelController', `Creating stitched label with ${images.length} images`);

      const options = {
        batchId,
        labelWidth: labelWidth ? parseInt(labelWidth) : undefined,
        labelHeight: labelHeight ? parseInt(labelHeight) : undefined,
        spacing: spacing ? parseInt(spacing) : undefined,
        backgroundColor
      };

      const stitchedLabel = await stitchedLabelService.createStitchedLabel(images, options);

      Logger.info('StitchedLabelController', `Stitched label created successfully: ${stitchedLabel._id}`);

      res.status(201).json({
        success: true,
        data: stitchedLabel,
        message: 'Stitched label created successfully'
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error creating stitched label:', error);
      next(error);
    }
  }

  /**
   * Create and process stitched label with OCR in one operation
   * POST /api/stitched-labels/create-and-process
   */
  async createAndProcessStitchedLabel(req, res, next) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const images = req.files || [];
      const {
        batchId,
        labelWidth,
        labelHeight,
        spacing,
        backgroundColor
      } = req.body;

      if (!images || images.length === 0) {
        throw new ValidationError('At least one image is required');
      }

      if (images.length > 50) {
        throw new ValidationError('Maximum 50 images allowed per batch');
      }

      Logger.info('StitchedLabelController', `Creating and processing stitched label with ${images.length} images`);

      const options = {
        batchId,
        labelWidth: labelWidth ? parseInt(labelWidth) : undefined,
        labelHeight: labelHeight ? parseInt(labelHeight) : undefined,
        spacing: spacing ? parseInt(spacing) : undefined,
        backgroundColor
      };

      const stitchedLabel = await stitchedLabelService.createAndProcessStitchedLabel(images, options);

      Logger.info('StitchedLabelController', `Stitched label created and processed: ${stitchedLabel._id}`);

      res.status(201).json({
        success: true,
        data: stitchedLabel,
        message: 'Stitched label created and processed successfully',
        processing: stitchedLabel.getProcessingSummary()
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error creating and processing stitched label:', error);
      next(error);
    }
  }

  /**
   * Process existing stitched label with OCR
   * POST /api/stitched-labels/:id/process
   */
  async processStitchedLabel(req, res, next) {
    try {
      const { id } = req.params;

      Logger.info('StitchedLabelController', `Processing stitched label: ${id}`);

      const stitchedLabel = await stitchedLabelService.processStitchedLabelWithOcr(id);

      if (!stitchedLabel) {
        throw new NotFoundError('Stitched label not found');
      }

      res.json({
        success: true,
        data: stitchedLabel,
        message: 'Stitched label processed successfully',
        processing: stitchedLabel.getProcessingSummary()
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error processing stitched label:', error);
      next(error);
    }
  }

  /**
   * Get stitched label by ID
   * GET /api/stitched-labels/:id
   */
  async getStitchedLabel(req, res, next) {
    try {
      const { id } = req.params;

      Logger.info('StitchedLabelController', `Fetching stitched label: ${id}`);

      const stitchedLabel = await stitchedLabelService.getStitchedLabelById(id);

      if (!stitchedLabel) {
        throw new NotFoundError('Stitched label not found');
      }

      res.json({
        success: true,
        data: stitchedLabel,
        processing: stitchedLabel.getProcessingSummary()
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error fetching stitched label:', error);
      next(error);
    }
  }

  /**
   * Get all stitched labels with filtering and pagination
   * GET /api/stitched-labels
   */
  async getStitchedLabels(req, res, next) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        batchId,
        verified,
        sortBy = 'processedAt',
        sortOrder = 'desc'
      } = req.query;

      Logger.info('StitchedLabelController', 'Fetching stitched labels with filters');

      const filters = {};

      if (status) filters.status = status;
      if (batchId) filters.batchId = batchId;
      if (verified !== undefined) filters.userVerified = verified === 'true';

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      };

      const result = await stitchedLabelService.getStitchedLabels(filters, options);

      res.json({
        success: true,
        data: result.labels,
        pagination: {
          current: result.currentPage,
          pages: result.totalPages,
          total: result.totalCount,
          limit: result.limit
        }
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error fetching stitched labels:', error);
      next(error);
    }
  }

  /**
   * Get stitched label by batch ID
   * GET /api/stitched-labels/batch/:batchId
   */
  async getStitchedLabelByBatch(req, res, next) {
    try {
      const { batchId } = req.params;

      Logger.info('StitchedLabelController', `Fetching stitched label by batch: ${batchId}`);

      const stitchedLabel = await stitchedLabelService.getStitchedLabelByBatchId(batchId);

      if (!stitchedLabel) {
        throw new NotFoundError('Stitched label not found for this batch');
      }

      res.json({
        success: true,
        data: stitchedLabel,
        processing: stitchedLabel.getProcessingSummary()
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error fetching stitched label by batch:', error);
      next(error);
    }
  }

  /**
   * Get stitched labels by status
   * GET /api/stitched-labels/status/:status
   */
  async getStitchedLabelsByStatus(req, res, next) {
    try {
      const { status } = req.params;
      const { limit = 50 } = req.query;

      Logger.info('StitchedLabelController', `Fetching stitched labels by status: ${status}`);

      const stitchedLabels = await stitchedLabelService.getStitchedLabels(
        { status },
        { limit: parseInt(limit) }
      );

      res.json({
        success: true,
        data: stitchedLabels.labels,
        status,
        count: stitchedLabels.labels.length,
        totalCount: stitchedLabels.totalCount
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error fetching stitched labels by status:', error);
      next(error);
    }
  }

  /**
   * Update stitched label
   * PUT /api/stitched-labels/:id
   */
  async updateStitchedLabel(req, res, next) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { id } = req.params;
      const updates = req.body;

      Logger.info('StitchedLabelController', `Updating stitched label: ${id}`);

      const stitchedLabel = await stitchedLabelService.updateStitchedLabel(id, updates);

      if (!stitchedLabel) {
        throw new NotFoundError('Stitched label not found');
      }

      res.json({
        success: true,
        data: stitchedLabel,
        message: 'Stitched label updated successfully'
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error updating stitched label:', error);
      next(error);
    }
  }

  /**
   * Verify stitched label (mark as user verified)
   * PATCH /api/stitched-labels/:id/verify
   */
  async verifyStitchedLabel(req, res, next) {
    try {
      const { id } = req.params;
      const { notes } = req.body;

      Logger.info('StitchedLabelController', `Verifying stitched label: ${id}`);

      const updates = {
        userVerified: true,
        userNotes: notes || null
      };

      const stitchedLabel = await stitchedLabelService.updateStitchedLabel(id, updates);

      if (!stitchedLabel) {
        throw new NotFoundError('Stitched label not found');
      }

      res.json({
        success: true,
        data: stitchedLabel,
        message: 'Stitched label verified successfully'
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error verifying stitched label:', error);
      next(error);
    }
  }

  /**
   * Delete stitched label and associated data
   * DELETE /api/stitched-labels/:id
   */
  async deleteStitchedLabel(req, res, next) {
    try {
      const { id } = req.params;
      const { deleteAssociatedFiles = true } = req.query;

      Logger.info('StitchedLabelController', `Deleting stitched label: ${id}`);

      const deleted = await stitchedLabelService.deleteStitchedLabel(id);

      if (!deleted) {
        throw new NotFoundError('Stitched label not found');
      }

      res.json({
        success: true,
        message: 'Stitched label deleted successfully',
        deletedFiles: deleteAssociatedFiles === 'true'
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error deleting stitched label:', error);
      next(error);
    }
  }

  /**
   * Get processing statistics
   * GET /api/stitched-labels/stats
   */
  async getProcessingStats(req, res, next) {
    try {
      Logger.info('StitchedLabelController', 'Fetching processing statistics');

      const stats = await stitchedLabelService.getProcessingStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error fetching processing stats:', error);
      next(error);
    }
  }

  /**
   * Get unverified stitched labels
   * GET /api/stitched-labels/unverified
   */
  async getUnverifiedStitchedLabels(req, res, next) {
    try {
      const { limit = 50 } = req.query;

      Logger.info('StitchedLabelController', 'Fetching unverified stitched labels');

      const stitchedLabels = await stitchedLabelService.getStitchedLabels(
        { userVerified: false, status: 'completed' },
        { limit: parseInt(limit) }
      );

      res.json({
        success: true,
        data: stitchedLabels.labels,
        count: stitchedLabels.labels.length,
        totalCount: stitchedLabels.totalCount
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error fetching unverified stitched labels:', error);
      next(error);
    }
  }

  /**
   * Get individual label from stitched label
   * GET /api/stitched-labels/:id/labels/:position
   */
  async getIndividualLabel(req, res, next) {
    try {
      const { id, position } = req.params;
      const pos = parseInt(position);

      Logger.info('StitchedLabelController', `Fetching individual label at position ${pos} from stitched label ${id}`);

      const stitchedLabel = await stitchedLabelService.getStitchedLabelById(id);

      if (!stitchedLabel) {
        throw new NotFoundError('Stitched label not found');
      }

      if (pos < 0 || pos >= stitchedLabel.individualLabels.length) {
        throw new ValidationError('Invalid label position');
      }

      const individualLabel = stitchedLabel.individualLabels[pos];
      const associatedPsaLabel = stitchedLabel.psaLabels.find(
        (label, index) => index === pos
      );

      res.json({
        success: true,
        data: {
          labelInfo: individualLabel,
          psaLabel: associatedPsaLabel,
          position: pos,
          stitchedLabelId: stitchedLabel._id
        }
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error fetching individual label:', error);
      next(error);
    }
  }

  /**
   * Get cost savings report
   * GET /api/stitched-labels/cost-savings
   */
  async getCostSavingsReport(req, res, next) {
    try {
      Logger.info('StitchedLabelController', 'Fetching cost savings report');

      const stats = await stitchedLabelService.getProcessingStats();

      res.json({
        success: true,
        data: stats.costSavingsReport,
        message: 'Cost savings calculated based on Google Vision API pricing'
      });

    } catch (error) {
      Logger.error('StitchedLabelController', 'Error fetching cost savings report:', error);
      next(error);
    }
  }
}

export default new StitchedLabelController();
