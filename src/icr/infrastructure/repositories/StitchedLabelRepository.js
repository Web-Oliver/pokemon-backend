/**
 * Stitched Label Repository - Data Access Layer
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles StitchedLabel data access
 * - Dependency Inversion: Abstracts database operations from services
 */

import BaseRepository from '@/system/database/BaseRepository.js';
import StitchedLabel from '@/icr/infrastructure/persistence/StitchedLabel.js';

export class StitchedLabelRepository extends BaseRepository {
    constructor() {
        super(StitchedLabel, {
            entityName: 'StitchedLabel',
            defaultSort: { createdAt: -1 },
            defaultLimit: 50
        });
    }

    /**
     * Find stitched label by image hash
     */
    async findByHash(stitchedImageHash) {
        return await this.findOne({ stitchedImageHash });
    }

    /**
     * Find stitched labels by multiple hashes
     */
    async findByHashes(stitchedImageHashes) {
        return await this.findAll({
            stitchedImageHash: { $in: stitchedImageHashes }
        });
    }

    /**
     * Find stitched label by label hashes (using static method)
     */
    async findByLabelHashes(labelHashes) {
        return await this.model.findByLabelHashes(labelHashes);
    }

    /**
     * Find many stitched labels with filters (using base repository method)
     */
    async findMany(filters = {}, options = {}) {
        return await this.findAll(filters, options);
    }

    /**
     * Find stitched labels with pagination (override base method)
     */
    async findWithPagination(options = {}) {
        const { skip = 0, limit = 50, sort = { createdAt: -1 } } = options;

        return await this.findAll(
            {},
            { skip, limit: parseInt(limit, 10), sort }
        );
    }

    /**
     * Find labels by processing status
     */
    async findByStatus(status) {
        return await this.findAll({ processingStatus: status });
    }

    /**
     * Delete stitched labels by IDs
     */
    async deleteManyByIds(labelIds) {
        return await this.deleteMany({
            _id: { $in: labelIds }
        });
    }

    /**
     * Update label processing status
     */
    async updateStatus(labelId, status) {
        return await this.update(labelId, { processingStatus: status });
    }

    /**
     * Find stitched label by batch ID (using gradedCardScanIds)
     */
    async findByBatchId(batchId) {
        // For now, find by any matching scan ID - this may need refinement
        return await this.findOne({
            gradedCardScanIds: { $in: [batchId] }
        });
    }

    /**
     * Update processing status with optional metadata
     */
    async updateProcessingStatus(labelId, status, metadata = {}) {
        const updateData = {
            processingStatus: status,
            ...metadata
        };
        return await this.update(labelId, updateData);
    }

    /**
     * Update OCR results
     */
    async updateOcrResults(labelId, ocrData) {
        const updateData = {
            ocrText: ocrData.ocrText,
            ocrConfidence: ocrData.ocrConfidence,
            ocrAnnotations: ocrData.ocrAnnotations,
            processingStatus: 'ocr_complete'
        };
        return await this.update(labelId, updateData);
    }

    /**
     * Get stitched label statistics
     */
    async getStatusStatistics() {
        const pipeline = [
            {
                $group: {
                    _id: '$processingStatus',
                    count: { $sum: 1 }
                }
            }
        ];
        return await this.aggregate(pipeline);
    }
}

export default StitchedLabelRepository;