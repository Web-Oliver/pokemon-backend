/**
 * Collection CRUD Service
 *
 * Replaces the massively duplicated CRUD services:
 * - psaGradedCardCrudService.js (314 lines)
 * - rawCardCrudService.js (338 lines)
 * - sealedProductCrudService.js (352 lines)
 * Total: 1,004 lines → ~200 lines (80% reduction)
 */

import mongoose from 'mongoose';
import Logger from '@/Infrastructure/Utilities/Logger.js';
import ValidatorFactory from '@/Application/Validators/ValidatorFactory.js';
import ImageManager from './shared/imageManager.js';
import CardService from './shared/cardService.js';
/**
 * CRUD operations for collection models
 */
class CollectionCrudService {
  constructor(Model, entityType) {
    this.Model = Model;
    this.entityType = entityType;
  }

  /**
   * Validate create data based on entity type
   */
  validateCreateData(data) {
    const { cardName, setName, myPrice } = data;

    Logger.service(this.entityType, 'validateCreateData', 'Starting validation', data);

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

    Logger.service(this.entityType, 'validateCreateData', 'Validation completed successfully');
  }

  /**
   * Create new entity
   */
  async create(data) {
    this.validateCreateData(data);

    const entity = new this.Model(data);
    const savedEntity = await entity.save();

    Logger.service(this.entityType, 'create', 'Entity created successfully', { id: savedEntity._id });
    return savedEntity;
  }

  /**
   * Find all entities with filters
   */
  async findAll(filters = {}) {
    const query = this.buildQuery(filters);
    const results = await this.Model.find(query).populate(this.getPopulateConfig());

    Logger.service(this.entityType, 'findAll', 'Query executed', { count: results.length });
    return results;
  }

  /**
   * Find entity by ID
   */
  async findById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ObjectId format');
    }

    const entity = await this.Model.findById(id).populate(this.getPopulateConfig());

    if (!entity) {
      throw new Error(`${this.entityType} not found`);
    }

    return entity;
  }

  /**
   * Update entity by ID
   */
  async updateById(id, updateData) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ObjectId format');
    }

    const entity = await this.Model.findByIdAndUpdate(id, updateData, { new: true });

    if (!entity) {
      throw new Error(`${this.entityType} not found`);
    }

    Logger.service(this.entityType, 'updateById', 'Entity updated', { id });
    return entity;
  }

  /**
   * Delete entity by ID
   */
  async deleteById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid ObjectId format');
    }

    // First get the entity to retrieve image paths before deletion
    const entity = await this.Model.findById(id);
    if (!entity) {
      throw new Error(`${this.entityType} not found`);
    }

    // Delete images if they exist
    if (entity.imageUrls && entity.imageUrls.length > 0) {
      Logger.service(this.entityType, 'deleteById', 'Deleting associated images', { 
        id, 
        imageCount: entity.imageUrls.length 
      });
      await ImageManager.deleteImageFiles(entity.imageUrls);
    }

    // Now delete the entity from database
    const deletedEntity = await this.Model.findByIdAndDelete(id);
    
    Logger.service(this.entityType, 'deleteById', 'Entity and images deleted successfully', { id });
    return deletedEntity;
  }

  /**
   * Mark entity as sold
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

    return await this.updateById(id, updateData);
  }

  /**
   * Build query based on filters
   */
  buildQuery(filters) {
    const query = {};

    // Common filters
    if (filters.sold !== undefined) {
      query.sold = filters.sold;
    }

    // Entity-specific filters
    switch (this.entityType) {
      case 'PsaGradedCard':
        if (filters.grade) query.grade = filters.grade;
        break;
      case 'RawCard':
        if (filters.condition) query.condition = filters.condition;
        break;
      case 'SealedProduct':
        if (filters.category) query.category = filters.category;
        if (filters.available) query.available = { $gt: 0 };
        break;
    }

    return query;
  }

  /**
   * Get populate configuration based on entity type
   */
  getPopulateConfig() {
    switch (this.entityType) {
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

  /**
   * Get entity count
   */
  async count(filters = {}) {
    const query = this.buildQuery(filters);

    return await this.Model.countDocuments(query);
  }

  /**
   * Paginated find
   */
  async findPaginated(filters = {}, options = {}) {
    const { page = 1, limit = 20, sort = { _id: 1 } } = options;
    const skip = (page - 1) * limit;

    const query = this.buildQuery(filters);
    const [items, total] = await Promise.all([
      this.Model.find(query)
        .populate(this.getPopulateConfig())
        .sort(sort)
        .skip(skip)
        .limit(limit),
      this.Model.countDocuments(query)
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    };
  }
}

export default CollectionCrudService;
