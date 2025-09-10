import mongoose from 'mongoose';
import { asyncHandler, NotFoundError, ValidationError } from '@/system/middleware/CentralizedErrorHandler.js';
import { container } from '@/system/dependency-injection/ServiceContainer.js';
import Logger from '@/system/logging/Logger.js';
import { getEntityConfig } from '@/system/database/entityConfigurations.js';
/**
 * Enhanced Base Controller Class
 *
 * Provides common CRUD operations for all resource controllers.
 * Uses dependency injection and repository pattern for improved architecture.
 *
 * Following SOLID principles:
 * - Single Responsibility: Each method has one clear purpose
 * - Open/Closed: Extended by subclasses, closed for modification
 * - Dependency Inversion: Depends on abstractions (services) not implementations
 * - Interface Segregation: Focused interfaces for different concerns
 * - Liskov Substitution: Consistent behavior across all implementations
 */
class BaseController {
  /**
   * Initialize Enhanced BaseController
   *
   * @param {string} serviceName - Service name to resolve from container
   * @param {Object} options - Configuration options
   */
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.service = container.resolve(serviceName);

    // Get centralized entity configuration if available
    const entityConfig = getEntityConfig(options.entityName || 'entity');

    this.options = {
      entityName: options.entityName || 'Entity',
      pluralName: options.pluralName || entityConfig?.pluralName || 'entities',
      includeMarkAsSold: options.includeMarkAsSold !== undefined
        ? options.includeMarkAsSold
        : entityConfig?.includeMarkAsSold !== false,
      defaultPopulate: options.defaultPopulate || entityConfig?.defaultPopulate || null,
      defaultSort: options.defaultSort || entityConfig?.defaultSort || { dateAdded: -1 },
      defaultLimit: options.defaultLimit || 100,
      filterableFields: entityConfig?.filterableFields || [],
      enableCaching: options.enableCaching !== false,
      enableMetrics: options.enableMetrics !== false,
      ...options
    };


    // Bind methods to maintain context
    this.getAll = this.getAll.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.markAsSold = this.markAsSold.bind(this);

  }






  /**
   * Get all entities with filtering and pagination
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  getAll = asyncHandler(async (req, res) => {
    const operation = 'getAll';
    const context = { req, res, operation };

    Logger.operationStart(`${this.options.entityName}S`, 'GET ALL', {
      'Query parameters': req.query
    });

    try {

      // Extract filters from query parameters using centralized configuration
      const filters = {};

      // Process filterable fields based on entity configuration
      this.options.filterableFields.forEach(field => {
        if (req.query[field] !== undefined) {
          // Special handling for boolean fields
          if (field === 'sold' || field === 'isActive') {
            filters[field] = req.query[field] === 'true';
          } else {
            filters[field] = req.query[field];
          }
        }
      });

      Logger.debug('BaseController', 'Applied filters', filters);

      // Use the service to get all items with filters
      const results = await this.service.getAll(
        filters,
        {
          populate: this.options.defaultPopulate,
          sort: this.options.defaultSort,
          limit: parseInt(req.query.limit, 10) || this.options.defaultLimit
        }
      );


      Logger.operationSuccess(`${this.options.entityName}S`, 'GET ALL', {
        [`Found ${this.options.pluralName}`]: results.length
      });

      let responseData = {
        success: true,
        count: results.length,
        data: results
      };


      res.status(200).json(responseData);
    } catch (error) {

      Logger.operationError(`${this.options.entityName}S`, 'GET ALL', error, {
        'Query params': req.query
      });
      throw error;
    }
  });

  /**
   * Get single entity by ID
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  getById = asyncHandler(async (req, res) => {
    const operation = 'getById';
    const context = { req, res, operation, entityId: req.params.id };

    Logger.operationStart(this.options.entityName, 'GET BY ID', {
      'ID': req.params.id
    });

    try {

      const entity = await this.service.getById(req.params.id, {
        populate: this.options.defaultPopulate
      });


      Logger.operationSuccess(this.options.entityName, 'GET BY ID', {
        [`${this.options.entityName} found`]: entity._id
      });

      let responseData = {
        success: true,
        data: entity
      };


      res.status(200).json(responseData);
    } catch (error) {

      Logger.operationError(this.options.entityName, 'GET BY ID', error, {
        'ID': req.params.id
      });
      throw error;
    }
  });

  /**
   * Create new entity
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  create = asyncHandler(async (req, res) => {
    const operation = 'create';
    const context = { req, res, operation };

    Logger.operationStart(this.options.entityName, 'CREATE', {
      'Request body': JSON.stringify(req.body, null, 2)
    });

    try {

      const entity = await this.service.create(req.body, {
        populate: this.options.defaultPopulate
      });

      // Update context with created entity ID
      context.entityId = entity._id;


      Logger.operationSuccess(this.options.entityName, 'CREATE', {
        [`${this.options.entityName} created successfully`]: entity._id
      });

      let responseData = {
        success: true,
        data: entity
      };


      res.status(201).json(responseData);
    } catch (error) {

      Logger.operationError(this.options.entityName, 'CREATE', error, {
        'Request body that caused error': JSON.stringify(req.body, null, 2)
      });

      throw error;
    }
  });

  /**
   * Update entity by ID
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  update = asyncHandler(async (req, res) => {
    const operation = 'update';
    const context = { req, res, operation, entityId: req.params.id };

    Logger.operationStart(this.options.entityName, 'UPDATE', {
      'ID': req.params.id,
      'Request body': JSON.stringify(req.body, null, 2)
    });

    try {

      const entity = await this.service.update(req.params.id, req.body, {
        populate: this.options.defaultPopulate
      });


      Logger.operationSuccess(this.options.entityName, 'UPDATE', {
        [`${this.options.entityName} updated successfully`]: entity._id
      });

      let responseData = {
        success: true,
        data: entity
      };


      res.status(200).json(responseData);
    } catch (error) {

      Logger.operationError(this.options.entityName, 'UPDATE', error, {
        'ID': req.params.id,
        'Request body': JSON.stringify(req.body, null, 2)
      });

      throw error;
    }
  });

  /**
   * Delete entity by ID
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  delete = asyncHandler(async (req, res) => {
    const operation = 'delete';
    const context = { req, res, operation, entityId: req.params.id };

    Logger.operationStart(this.options.entityName, 'DELETE', {
      'ID': req.params.id
    });

    try {

      const entity = await this.service.delete(req.params.id);


      Logger.operationSuccess(this.options.entityName, 'DELETE', {
        [`${this.options.entityName} deleted successfully`]: req.params.id
      });

      let responseData = {
        success: true,
        message: `${this.options.entityName} deleted successfully`
      };


      res.status(200).json(responseData);
    } catch (error) {

      Logger.operationError(this.options.entityName, 'DELETE', error, {
        'ID': req.params.id
      });

      throw error;
    }
  });

  /**
   * Mark entity as sold
   *
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Promise<void>}
   */
  markAsSold = asyncHandler(async (req, res) => {
    if (!this.options.includeMarkAsSold) {
      throw new NotFoundError('Mark as sold not supported for this resource');
    }

    const operation = 'markAsSold';
    const context = { req, res, operation, entityId: req.params.id };

    Logger.operationStart(this.options.entityName, 'MARK AS SOLD', {
      'ID': req.params.id,
      'Sale details': JSON.stringify(req.body, null, 2)
    });

    try {

      // Extract sale details from request body
      const saleDetails = req.body.saleDetails || req.body;

      // Use service to mark as sold
      const entity = await this.service.markAsSold(req.params.id, saleDetails);


      Logger.operationSuccess(this.options.entityName, 'MARK AS SOLD', {
        [`${this.options.entityName} marked as sold`]: entity._id
      });

      let responseData = {
        success: true,
        data: entity
      };


      res.status(200).json(responseData);
    } catch (error) {

      Logger.operationError(this.options.entityName, 'MARK AS SOLD', error, {
        'ID': req.params.id,
        'Sale details': JSON.stringify(req.body, null, 2)
      });
      throw error;
    }
  });
}

// BULK/BATCH OPERATIONS REMOVED
// Frontend genericApiOperations.ts explicitly removed bulk operations
// Removed to avoid over-engineering and maintain DRY/SOLID principles

export default BaseController;
