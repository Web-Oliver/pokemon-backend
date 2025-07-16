const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../../middleware/errorHandler');
const container = require('../../container');

/**
 * Base Controller Class
 * 
 * Provides common CRUD operations for all resource controllers.
 * Uses dependency injection and repository pattern for improved architecture.
 * 
 * Following SOLID principles:
 * - Single Responsibility: Each method has one clear purpose
 * - Open/Closed: Extended by subclasses, closed for modification
 * - Dependency Inversion: Depends on abstractions (services) not implementations
 */
class BaseController {
  /**
   * Initialize BaseController
   * 
   * @param {string} serviceName - Service name to resolve from container
   * @param {Object} options - Configuration options
   */
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.service = container.resolve(serviceName);
    this.options = {
      entityName: options.entityName || 'Entity',
      pluralName: options.pluralName || 'entities',
      includeMarkAsSold: options.includeMarkAsSold !== false,
      defaultPopulate: options.defaultPopulate || null,
      defaultSort: options.defaultSort || { dateAdded: -1 },
      defaultLimit: options.defaultLimit || 15,
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
    console.log(`=== GET ALL ${this.options.entityName.toUpperCase()}S START ===`);
    
    try {
      // Use the service to get all items
      const results = await this.service.getAll({}, {
        populate: this.options.defaultPopulate,
        sort: this.options.defaultSort,
        limit: parseInt(req.query.limit) || this.options.defaultLimit
      });

      console.log(`Found ${results.length} ${this.options.pluralName}`);
      console.log(`=== GET ALL ${this.options.entityName.toUpperCase()}S END ===`);

      res.status(200).json({
        success: true,
        count: results.length,
        data: results,
      });
    } catch (error) {
      console.error(`=== GET ALL ${this.options.entityName.toUpperCase()}S ERROR ===`);
      console.error('Error:', error.message);
      console.error('Query params:', req.query);
      console.error(`=== GET ALL ${this.options.entityName.toUpperCase()}S ERROR END ===`);
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
    console.log(`=== GET ${this.options.entityName.toUpperCase()} BY ID START ===`);
    console.log('ID:', req.params.id);

    try {
      const entity = await this.service.getById(req.params.id, {
        populate: this.options.defaultPopulate
      });

      console.log(`${this.options.entityName} found:`, entity._id);
      console.log(`=== GET ${this.options.entityName.toUpperCase()} BY ID END ===`);

      res.status(200).json({
        success: true,
        data: entity,
      });
    } catch (error) {
      console.error(`=== GET ${this.options.entityName.toUpperCase()} BY ID ERROR ===`);
      console.error('Error:', error.message);
      console.error('ID:', req.params.id);
      console.error(`=== GET ${this.options.entityName.toUpperCase()} BY ID ERROR END ===`);
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
    console.log(`=== CREATE ${this.options.entityName.toUpperCase()} START ===`);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    try {
      const entity = await this.service.create(req.body, {
        populate: this.options.defaultPopulate
      });

      console.log(`${this.options.entityName} created successfully:`, entity._id);
      console.log(`=== CREATE ${this.options.entityName.toUpperCase()} END ===`);

      res.status(201).json({
        success: true,
        data: entity,
      });
    } catch (error) {
      console.error(`=== CREATE ${this.options.entityName.toUpperCase()} ERROR ===`);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Request body that caused error:', JSON.stringify(req.body, null, 2));
      console.error(`=== CREATE ${this.options.entityName.toUpperCase()} ERROR END ===`);
      
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
    console.log(`=== UPDATE ${this.options.entityName.toUpperCase()} START ===`);
    console.log('ID:', req.params.id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    try {
      const entity = await this.service.update(req.params.id, req.body, {
        populate: this.options.defaultPopulate
      });

      console.log(`${this.options.entityName} updated successfully:`, entity._id);
      console.log(`=== UPDATE ${this.options.entityName.toUpperCase()} END ===`);

      res.status(200).json({
        success: true,
        data: entity,
      });
    } catch (error) {
      console.error(`=== UPDATE ${this.options.entityName.toUpperCase()} ERROR ===`);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('ID:', req.params.id);
      console.error('Request body:', JSON.stringify(req.body, null, 2));
      console.error(`=== UPDATE ${this.options.entityName.toUpperCase()} ERROR END ===`);
      
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
    console.log(`=== DELETE ${this.options.entityName.toUpperCase()} START ===`);
    console.log('ID:', req.params.id);

    try {
      const entity = await this.service.delete(req.params.id);

      console.log(`${this.options.entityName} deleted successfully:`, req.params.id);
      console.log(`=== DELETE ${this.options.entityName.toUpperCase()} END ===`);

      res.status(200).json({
        success: true,
        message: `${this.options.entityName} deleted successfully`,
      });
    } catch (error) {
      console.error(`=== DELETE ${this.options.entityName.toUpperCase()} ERROR ===`);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('ID:', req.params.id);
      console.error(`=== DELETE ${this.options.entityName.toUpperCase()} ERROR END ===`);
      
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

    console.log(`=== MARK ${this.options.entityName.toUpperCase()} AS SOLD START ===`);
    console.log('ID:', req.params.id);
    console.log('Sale details:', JSON.stringify(req.body, null, 2));

    try {
      // Extract sale details from request body
      const saleDetails = req.body.saleDetails || req.body;
      
      // Use service to mark as sold
      const entity = await this.service.markAsSold(req.params.id, saleDetails);

      console.log(`${this.options.entityName} marked as sold:`, entity._id);
      console.log(`=== MARK ${this.options.entityName.toUpperCase()} AS SOLD END ===`);

      res.status(200).json({
        success: true,
        data: entity,
      });
    } catch (error) {
      console.error(`=== MARK ${this.options.entityName.toUpperCase()} AS SOLD ERROR ===`);
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('ID:', req.params.id);
      console.error('Sale details:', JSON.stringify(req.body, null, 2));
      console.error(`=== MARK ${this.options.entityName.toUpperCase()} AS SOLD ERROR END ===`);
      throw error;
    }
  });

}

module.exports = BaseController;