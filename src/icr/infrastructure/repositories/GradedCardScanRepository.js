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
      defaultSort: { createdAt: -1 },
      defaultLimit: 50
    });
  }

  /**
   * Find scan by image hash
   */
  async findByHash(imageHash) {
    return await this.findOne({ imageHash });
  }

  /**
   * Find scans by processing status with pagination
   */
  async findByStatus(status, options = {}) {
    const { skip = 0, limit = 50, sort = { createdAt: -1 } } = options;

    return await this.findAll(
      { processingStatus: status },
      { skip, limit: parseInt(limit, 10), sort }
    );
  }

  /**
   * Find scans by multiple image hashes
   */
  async findByHashes(imageHashes) {
    return await this.findAll({
      imageHash: { $in: imageHashes }
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
    return await this.count({ processingStatus: status });
  }

  /**
   * Update scan processing status
   */
  async updateStatus(scanId, status) {
    return await this.update(scanId, { processingStatus: status });
  }

  /**
   * Update multiple scan statuses by hashes
   */
  async updateStatusByHashes(imageHashes, status) {
    return await this.updateMany(
      { imageHash: { $in: imageHashes } },
      { processingStatus: status }
    );
  }

  /**
   * Update scan by image hash
   */
  async updateByHash(imageHash, updateData) {
    return await this.updateMany(
      { imageHash },
      updateData
    );
  }

  /**
   * Delete scans by IDs
   */
  async deleteManyByIds(scanIds) {
    return await this.deleteMany({
      _id: { $in: scanIds }
    });
  }

  /**
   * Get scan statistics
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

export default GradedCardScanRepository;