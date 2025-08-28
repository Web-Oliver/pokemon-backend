/**
 * Collection CRUD Service
 *
 * Updated to extend BaseService, eliminating service layer code duplication.
 * Replaces the massively duplicated CRUD services while extending BaseService:
 * - psaGradedCardCrudService.js (314 lines)
 * - rawCardCrudService.js (338 lines)
 * - sealedProductCrudService.js (352 lines)
 * Total: 1,004 lines → ~150 lines (85% reduction)
 */

import mongoose from 'mongoose';
import Logger from '@/system/logging/Logger.js';
import ValidatorFactory from '@/system/validation/ValidatorFactory.js';
import ImageManager from '@/uploads/imageManager.js';
import CardService from '@/pokemon/cards/cardService.js';
import BaseService from '@/system/services/BaseService.js';
import BaseRepository from '@/system/database/BaseRepository.js';

/**
 * Enhanced Collection CRUD service extending BaseService
 * Eliminates code duplication by leveraging base service infrastructure
 */
class CollectionCrudService extends BaseService {
  constructor(Model, entityType) {
    // Create repository for the model
    const repository = new BaseRepository(Model, {
      entityName: entityType,
      defaultPopulate: CollectionCrudService.getPopulateConfig(entityType),
      defaultSort: { dateAdded: -1 }
    });

    // Initialize BaseService with repository
    super(repository, {
      entityName: entityType,
      enableLogging: true,
      enableValidation: true
    });

    this.Model = Model;
    this.entityType = entityType;
  }

  /**
   * Override BaseService validation with collection-specific logic
   */
  async validateCreateData(data) {
    // Call parent validation first
    await super.validateCreateData(data);

    const { cardName, setName, myPrice } = data;

    Logger.service(this.entityType, 'validateCreateData', 'Starting collection validation', data);

    // Common validation for all entities
    if (cardName || setName) {
      CardService.validateCollectionItemData(data, {
        cardName: { type: 'string' },
        setName: { type: 'string' },
        myPrice: { type: 'number' }
      });
    }

    // Entity-specific validation
    switch (this.entityType) {
      case 'PsaGradedCard':
        ValidatorFactory.number(data.grade, 'Grade', { min: 1, max: 10, integer: true, required: true });
        break;
      case 'RawCard':
        ValidatorFactory.enum(data.condition, ['mint', 'near_mint', 'excellent', 'good', 'light_played', 'played', 'poor'], 'Condition');
        break;
      case 'SealedProduct':
        const requiredFields = ['category', 'setName', 'name', 'myPrice'];

        requiredFields.forEach(field => {
          if (!data[field]) {
            throw new Error(`${field} is required`);
          }
        });
        break;
    }

    Logger.service(this.entityType, 'validateCreateData', 'Collection validation completed successfully');
  }

  /**
   * Override BaseService delete to handle image cleanup
   * This is collection-specific business logic
   */
  async preprocessDelete(id) {
    // Get the entity to retrieve image paths before deletion
    const entity = await this.repository.findById(id);

    // Delete images if they exist
    if (entity.imageUrls && entity.imageUrls.length > 0) {
      Logger.service(this.entityType, 'preprocessDelete', 'Deleting associated images', {
        id,
        imageCount: entity.imageUrls.length
      });
      await ImageManager.deleteImageFiles(entity.imageUrls);
    }
  }

  /**
   * Mark entity as sold - Collection-specific business logic
   */
  async markAsSold(id, saleDetails) {
    const updateData = {
      sold: true,
      dateAdded: new Date(),
      saleDetails: {
        dateSold: new Date(),
        paymentMethod: saleDetails.paymentMethod || 'Unknown',
        actualSoldPrice: saleDetails.price || 0,
        deliveryMethod: saleDetails.deliveryMethod || 'Unknown',
        source: saleDetails.source || 'Unknown',
        buyerFullName: saleDetails.buyerName || 'Unknown',
        trackingInfo: saleDetails.trackingInfo || null
      }
    };

    return await this.update(id, updateData);
  }

  /**
   * Get statistics for the collection entity
   * Collection-specific business logic
   */
  async getStatistics() {
    const totalCount = await this.count({});
    const soldCount = await this.count({ sold: true });
    const availableCount = totalCount - soldCount;

    const stats = {
      total: totalCount,
      sold: soldCount,
      available: availableCount,
      soldPercentage: totalCount > 0 ? (soldCount / totalCount * 100).toFixed(2) : 0
    };

    // Entity-specific statistics
    switch (this.entityType) {
      case 'PsaGradedCard':
        const gradeStats = await this.repository.aggregate([
          { $group: { _id: '$grade', count: { $sum: 1 } } },
          { $sort: { _id: 1 } }
        ]);
        stats.gradeDistribution = gradeStats;
        break;
      case 'SealedProduct':
        const categoryStats = await this.repository.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]);
        stats.categoryDistribution = categoryStats;
        break;
    }

    return stats;
  }

  /**
   * Legacy method compatibility - maps to BaseService methods
   * Maintains backward compatibility with existing code
   */
  async findAll(filters = {}, options = {}) {
    return await this.getAll(filters, options);
  }

  async findById(id, options = {}) {
    return await this.getById(id, options);
  }

  async updateById(id, data, options = {}) {
    return await this.update(id, data, options);
  }

  async deleteById(id) {
    return await this.delete(id);
  }

  /**
   * Static method to get populate configuration based on entity type
   */
  static getPopulateConfig(entityType) {
    switch (entityType) {
      case 'PsaGradedCard':
      case 'RawCard':
        return {
          path: 'cardId',
          populate: {
            path: 'setId',
            model: 'Set'
          }
        };
      case 'SealedProduct':
        return 'productId';
      default:
        return null;
    }
  }
}

export default CollectionCrudService;
