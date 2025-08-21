import { validationResult } from 'express-validator';
import psaLabelService from '@/Application/Services/Core/psaLabelService.js';
import { ValidationError, NotFoundError   } from '@/Infrastructure/Utilities/errorHandler.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
class PsaLabelController {
  /**
   * Create a new PSA label from OCR processing
   * POST /api/psa-labels
   */
  async createPsaLabel(req, res, next) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const {
        labelImage,
        ocrText,
        ocrConfidence,
        textAnnotations,
        processingTime,
        psaData,
        batchId,
        batchIndex
      } = req.body;

      Logger.info('PsaLabelController', 'Creating PSA label from OCR data');

      const psaLabel = await psaLabelService.createPsaLabel({
        labelImage,
        ocrText,
        ocrConfidence,
        textAnnotations,
        processingTime,
        psaData,
        batchId,
        batchIndex
      });

      Logger.info('PsaLabelController', `PSA label created successfully: ${psaLabel._id}`);

      res.status(201).json({
        success: true,
        data: psaLabel,
        message: 'PSA label created successfully'
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error creating PSA label:', error);
      next(error);
    }
  }

  /**
   * Process image and create PSA label with OCR
   * POST /api/psa-labels/process-image
   */
  async processImageAndCreateLabel(req, res, next) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const image = req.file || req.body.image;
      const { batchId, batchIndex } = req.body;

      if (!image) {
        throw new ValidationError('Image is required');
      }

      Logger.info('PsaLabelController', 'Processing image for PSA label OCR');

      const psaLabel = await psaLabelService.processImageAndCreateLabel(image, {
        batchId,
        batchIndex
      });

      Logger.info('PsaLabelController', `PSA label processed and created: ${psaLabel._id}`);

      res.status(201).json({
        success: true,
        data: psaLabel,
        message: 'PSA label processed and created successfully'
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error processing image and creating PSA label:', error);
      next(error);
    }
  }

  /**
   * Get PSA label by ID
   * GET /api/psa-labels/:id
   */
  async getPsaLabel(req, res, next) {
    try {
      const { id } = req.params;

      Logger.info('PsaLabelController', `Fetching PSA label: ${id}`);

      const psaLabel = await psaLabelService.getPsaLabelById(id);

      if (!psaLabel) {
        throw new NotFoundError('PSA label not found');
      }

      res.json({
        success: true,
        data: psaLabel
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error fetching PSA label:', error);
      next(error);
    }
  }

  /**
   * Get all PSA labels with filtering and pagination
   * GET /api/psa-labels
   */
  async getPsaLabels(req, res, next) {
    try {
      const {
        page = 1,
        limit = 50,
        grade,
        matched,
        verified,
        batchId,
        sortBy = 'processedAt',
        sortOrder = 'desc',
        search
      } = req.query;

      Logger.info('PsaLabelController', 'Fetching PSA labels with filters');

      const filters = {};

      if (grade) filters['psaData.dynamicFields'] = { $exists: true }; // Grade now in dynamic fields
      if (matched !== undefined) {
        filters.matchedCard = matched === 'true' ? { $exists: true } : { $exists: false };
      }
      if (verified !== undefined) filters.userVerified = verified === 'true';
      if (batchId) filters.batchId = batchId;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder,
        search
      };

      const result = await psaLabelService.getPsaLabels(filters, options);

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
      Logger.error('PsaLabelController', 'Error fetching PSA labels:', error);
      next(error);
    }
  }

  /**
   * Search PSA labels by OCR text
   * GET /api/psa-labels/search
   */
  async searchPsaLabels(req, res, next) {
    try {
      const { q: query, limit = 20 } = req.query;

      if (!query) {
        throw new ValidationError('Search query is required');
      }

      Logger.info('PsaLabelController', `Searching PSA labels for: "${query}"`);

      const results = await psaLabelService.searchPsaLabels(query, parseInt(limit));

      res.json({
        success: true,
        data: results,
        query,
        count: results.length
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error searching PSA labels:', error);
      next(error);
    }
  }

  /**
   * Get PSA label by certification number
   * GET /api/psa-labels/cert/:certNumber
   */
  async getPsaLabelByCertNumber(req, res, next) {
    try {
      const { certNumber } = req.params;

      Logger.info('PsaLabelController', `Fetching PSA label by cert number: ${certNumber}`);

      const psaLabel = await psaLabelService.getPsaLabelByCertNumber(certNumber);

      if (!psaLabel) {
        throw new NotFoundError('PSA label with this certification number not found');
      }

      res.json({
        success: true,
        data: psaLabel
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error fetching PSA label by cert number:', error);
      next(error);
    }
  }

  /**
   * Update PSA label (for user corrections)
   * PUT /api/psa-labels/:id
   */
  async updatePsaLabel(req, res, next) {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { id } = req.params;
      const updates = req.body;

      Logger.info('PsaLabelController', `Updating PSA label: ${id}`);

      const psaLabel = await psaLabelService.updatePsaLabel(id, updates);

      if (!psaLabel) {
        throw new NotFoundError('PSA label not found');
      }

      res.json({
        success: true,
        data: psaLabel,
        message: 'PSA label updated successfully'
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error updating PSA label:', error);
      next(error);
    }
  }

  /**
   * Mark PSA label as user verified
   * PATCH /api/psa-labels/:id/verify
   */
  async verifyPsaLabel(req, res, next) {
    try {
      const { id } = req.params;
      const { corrections } = req.body;

      Logger.info('PsaLabelController', `Verifying PSA label: ${id}`);

      const psaLabel = await psaLabelService.verifyPsaLabel(id, corrections);

      if (!psaLabel) {
        throw new NotFoundError('PSA label not found');
      }

      res.json({
        success: true,
        data: psaLabel,
        message: 'PSA label verified successfully'
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error verifying PSA label:', error);
      next(error);
    }
  }

  /**
   * Get batch PSA labels
   * GET /api/psa-labels/batch/:batchId
   */
  async getBatchPsaLabels(req, res, next) {
    try {
      const { batchId } = req.params;

      Logger.info('PsaLabelController', `Fetching PSA labels for batch: ${batchId}`);

      const psaLabels = await psaLabelService.getBatchPsaLabels(batchId);

      res.json({
        success: true,
        data: psaLabels,
        batchId,
        count: psaLabels.length
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error fetching batch PSA labels:', error);
      next(error);
    }
  }

  /**
   * Get unmatched PSA labels
   * GET /api/psa-labels/unmatched
   */
  async getUnmatchedPsaLabels(req, res, next) {
    try {
      const { limit = 50 } = req.query;

      Logger.info('PsaLabelController', 'Fetching unmatched PSA labels');

      const psaLabels = await psaLabelService.getUnmatchedPsaLabels(parseInt(limit));

      res.json({
        success: true,
        data: psaLabels,
        count: psaLabels.length
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error fetching unmatched PSA labels:', error);
      next(error);
    }
  }

  /**
   * Get PSA labels by grade
   * GET /api/psa-labels/grade/:grade
   */
  async getPsaLabelsByGrade(req, res, next) {
    try {
      const { grade } = req.params;
      const { limit = 50 } = req.query;

      Logger.info('PsaLabelController', `Fetching PSA labels for grade: ${grade}`);

      const psaLabels = await psaLabelService.getPsaLabelsByGrade(grade, parseInt(limit));

      res.json({
        success: true,
        data: psaLabels,
        grade,
        count: psaLabels.length
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error fetching PSA labels by grade:', error);
      next(error);
    }
  }

  /**
   * Delete PSA label
   * DELETE /api/psa-labels/:id
   */
  async deletePsaLabel(req, res, next) {
    try {
      const { id } = req.params;

      Logger.info('PsaLabelController', `Deleting PSA label: ${id}`);

      const deleted = await psaLabelService.deletePsaLabel(id);

      if (!deleted) {
        throw new NotFoundError('PSA label not found');
      }

      res.json({
        success: true,
        message: 'PSA label deleted successfully'
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error deleting PSA label:', error);
      next(error);
    }
  }

  /**
   * Get OCR statistics
   * GET /api/psa-labels/stats
   */
  async getOcrStats(req, res, next) {
    try {
      Logger.info('PsaLabelController', 'Fetching OCR statistics');

      const stats = await psaLabelService.getOcrStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      Logger.error('PsaLabelController', 'Error fetching OCR stats:', error);
      next(error);
    }
  }
}

export default new PsaLabelController();
