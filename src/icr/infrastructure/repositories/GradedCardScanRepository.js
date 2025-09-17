/**
 * Graded Card Scan Repository - Data Access Layer
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles GradedCardScan data access
 * - Dependency Inversion: Abstracts database operations from services
 */

import BaseRepository from '@/system/database/BaseRepository.js';
import GradedCardScan from '@/icr/infrastructure/persistence/GradedCardScan.js';

export class GradedCardScanRepository extends BaseRepository {
    constructor() {
        super(GradedCardScan, {
            entityName: 'GradedCardScan',
            defaultSort: {createdAt: -1},
            defaultLimit: 50
        });
    }

    /**
     * Find scan by image hash
     */
    async findByHash(imageHash) {
        return await this.findOne({imageHash});
    }

    /**
     * Find scans by processing status with pagination
     */
    async findByStatus(status, options = {}) {
        const {skip = 0, limit = 50, sort = {createdAt: -1}} = options;

        return await this.findAll(
            {processingStatus: status},
            {skip, limit: parseInt(limit, 10), sort}
        );
    }

    /**
     * Find scans by multiple image hashes
     */
    async findByHashes(imageHashes) {
        return await this.findAll({
            imageHash: {$in: imageHashes}
        });
    }

    /**
     * Find many scans with filters (using base repository method)
     */
    async findMany(filters = {}, options = {}) {
        return await this.findAll(filters, options);
    }

    /**
     * Count scans by status
     */
    async countByStatus(status) {
        if (status === undefined) {
            return await this.count({}); // Count all documents
        }
        return await this.count({processingStatus: status});
    }

    /**
     * Update scan processing status
     */
    async updateStatus(id, status) {
        return await this.update(id, {processingStatus: status});
    }

    /**
     * Update multiple scan statuses by hashes
     */
    async updateStatusByHashes(imageHashes, status) {
        return await this.updateMany(
            {imageHash: {$in: imageHashes}},
            {processingStatus: status}
        );
    }

    /**
     * Update scan by image hash
     */
    async updateByHash(imageHash, updateData) {
        return await this.updateMany(
            {imageHash},
            updateData
        );
    }

    /**
     * Delete scans by IDs
     */
    async deleteManyByIds(ids) {
        return await this.deleteMany({
            _id: {$in: ids}
        });
    }

    /**
     * Find scans by batch ID (this assumes batchId relates to scans somehow)
     * For now, we'll treat batchId as a group identifier
     */
    async findByBatchId(batchId) {
        // This may need refinement based on how batch IDs are actually stored
        // For now, assume we group by creation time or some batch field
        return await this.findAll({batchId});
    }

    /**
     * Update OCR results for a scan
     */
    async updateOcrResults(id, ocrData) {
        const updateData = {
            ocrText: ocrData.ocrText,
            ocrConfidence: ocrData.ocrConfidence,
            ocrAnnotations: ocrData.ocrAnnotations
            // NO PROCESSING STATUS UPDATES - CORE FUNCTIONALITY ONLY
        };
        return await this.update(id, updateData);
    }

    /**
     * Clear OCR data for scans in a batch
     */
    async clearOcrDataByBatch(batchId) {
        const clearData = {
            ocrText: null,
            ocrConfidence: null,
            ocrAnnotations: [],
            processingStatus: 'extracted'
        };
        return await this.updateMany(
            {batchId},
            clearData
        );
    }

    /**
     * Get scan statistics
     */
    async getStatusStatistics() {
        const pipeline = [
            {
                $group: {
                    _id: '$processingStatus',
                    count: {$sum: 1}
                }
            }
        ];
        return await this.aggregate(pipeline);
    }
}

export default GradedCardScanRepository;