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