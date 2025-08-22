import mongoose from 'mongoose';
import { asyncHandler, NotFoundError, ValidationError   } from '@/Presentation/Middleware/errorHandler.js';
import container from '@/Infrastructure/DependencyInjection/index.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
import { getEntityConfig   } from '@/Infrastructure/Configuration/entityConfigurations.js';
import { cacheManager   } from '@/Presentation/Middleware/searchCache.js';
import ControllerPluginManager from './ControllerPluginManager.js';
import ControllerMetrics from './ControllerMetrics.js';
/**
 * Enhanced Base Controller Class
 *
 * Provides common CRUD operations for all resource controllers with plugin support.
 * Uses dependency injection and repository pattern for improved architecture.
 *
 * Following SOLID principles:
 * - Single Responsibility: Each method has one clear purpose
 * - Open/Closed: Extended by subclasses and plugins, closed for modification
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
      enablePlugins: options.enablePlugins !== false,
      enableMetrics: options.enableMetrics !== false,
      ...options,
    };

    // Initialize plugin manager and metrics (SRP compliance)
    this.pluginManager = new ControllerPluginManager();
    this.metricsManager = new ControllerMetrics();

    // Bind methods to maintain context
    this.getAll = this.getAll.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    this.markAsSold = this.markAsSold.bind(this);

    // Initialize default plugins if enabled
    if (this.options.enablePlugins) {
      this.initializeDefaultPlugins();
    }
  }

  /**
   * Initialize default plugins for common functionality
   */
  initializeDefaultPlugins() {
    // Cache invalidation plugin
    if (this.options.enableCaching) {
      this.pluginManager.addPlugin('cacheInvalidation', {
        afterOperation: (operation, result, context) => {
          if (['create', 'update', 'delete', 'markAsSold'].includes(operation)) {
            setTimeout(() => {
              cacheManager.invalidateByEntity(
                this.options.entityName.toLowerCase(),
                context.entityId || result?._id
              );
            }, 100);
          }
        }
      });
    }

    // Metrics tracking plugin
    if (this.options.enableMetrics) {
      this.pluginManager.addPlugin('metricsTracking', {
        beforeOperation: (operation, context) => {
          context.startTime = Date.now();
        },
        afterOperation: (operation, result, context) => {
          const duration = Date.now() - context.startTime;
          this.metricsManager.updateMetrics(operation, 'success', duration);
        },
        onError: (operation, error, context) => {
          const duration = Date.now() - (context.startTime || Date.now());
          this.metricsManager.updateMetrics(operation, 'error', duration);
        }
      });
    }

    // Response transformation plugin
    this.pluginManager.addPlugin('responseTransformation', {
      beforeResponse: (operation, data, context) => {
        if (data && typeof data === 'object') {
          // Add metadata to response
          if (!data.meta) {
            data.meta = {};
          }

          data.meta.operation = operation;
          data.meta.entityType = this.options.entityName;
          data.meta.timestamp = new Date().toISOString();

          if (this.options.enableMetrics) {
            data.meta.metrics = this.metricsManager.getOperationMetrics(operation);
          }
        }
        return data;
      }
    });
  }

  /**
   * Add a plugin to the controller (delegates to PluginManager)
   * @param {string} name - Plugin name
   * @param {Object} plugin - Plugin object with hook handlers
   */
  addPlugin(name, plugin) {
    this.pluginManager.addPlugin(name, plugin);
  }

  /**
   * Remove a plugin from the controller (delegates to PluginManager)
   * @param {string} name - Plugin name
   */
  removePlugin(name) {
    this.pluginManager.removePlugin(name);
  }

  /**
   * Execute hooks for a specific event (delegates to PluginManager)
   * @param {string} hookName - Hook name
   * @param {string} operation - Operation name
   * @param {*} data - Hook data
   * @param {Object} context - Operation context
   */
  async executeHooks(hookName, operation, data, context = {}) {
    return this.pluginManager.executeHooks(hookName, operation, data, context);
  }

  /**
   * Update operation metrics (delegates to MetricsManager)
   * @param {string} operation - Operation name
   * @param {string} status - Operation status ('success' or 'error')
   * @param {number} duration - Operation duration in ms
   */
  updateMetrics(operation, status, duration) {
    this.metricsManager.updateMetrics(operation, status, duration);
  }

  /**
   * Get metrics for a specific operation (delegates to MetricsManager)
   * @param {string} operation - Operation name
   * @returns {Object} - Operation metrics
   */
  getOperationMetrics(operation) {
    return this.metricsManager.getOperationMetrics(operation);
  }

  /**
   * Get all controller metrics (delegates to MetricsManager)
   * @returns {Object} - Complete metrics object
   */
  getMetrics() {
    return this.metricsManager.getAllMetrics(
      this.options.entityName,
      this.pluginManager.getPluginNames()
    );
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
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, req.query, context);

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
          limit: parseInt(req.query.limit, 10) || this.options.defaultLimit,
        },
      );

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, results, context);

      Logger.operationSuccess(`${this.options.entityName}S`, 'GET ALL', {
        [`Found ${this.options.pluralName}`]: results.length
      });

      let responseData = {
        success: true,
        count: results.length,
        data: results,
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);

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
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, { id: req.params.id }, context);

      const entity = await this.service.getById(req.params.id, {
        populate: this.options.defaultPopulate,
      });

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, entity, context);

      Logger.operationSuccess(this.options.entityName, 'GET BY ID', {
        [`${this.options.entityName} found`]: entity._id
      });

      let responseData = {
        success: true,
        data: entity,
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);

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
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, req.body, context);

      const entity = await this.service.create(req.body, {
        populate: this.options.defaultPopulate,
      });

      // Update context with created entity ID
      context.entityId = entity._id;

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, entity, context);

      Logger.operationSuccess(this.options.entityName, 'CREATE', {
        [`${this.options.entityName} created successfully`]: entity._id
      });

      let responseData = {
        success: true,
        data: entity,
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(201).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);

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
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, { id: req.params.id, data: req.body }, context);

      const entity = await this.service.update(req.params.id, req.body, {
        populate: this.options.defaultPopulate,
      });

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, entity, context);

      Logger.operationSuccess(this.options.entityName, 'UPDATE', {
        [`${this.options.entityName} updated successfully`]: entity._id
      });

      let responseData = {
        success: true,
        data: entity,
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);

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
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, { id: req.params.id }, context);

      const entity = await this.service.delete(req.params.id);

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, entity, context);

      Logger.operationSuccess(this.options.entityName, 'DELETE', {
        [`${this.options.entityName} deleted successfully`]: req.params.id
      });

      let responseData = {
        success: true,
        message: `${this.options.entityName} deleted successfully`,
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);

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
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, { id: req.params.id, saleDetails: req.body }, context);

      // Extract sale details from request body
      const saleDetails = req.body.saleDetails || req.body;

      // Use service to mark as sold
      const entity = await this.service.markAsSold(req.params.id, saleDetails);

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, entity, context);

      Logger.operationSuccess(this.options.entityName, 'MARK AS SOLD', {
        [`${this.options.entityName} marked as sold`]: entity._id
      });

      let responseData = {
        success: true,
        data: entity,
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);

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
