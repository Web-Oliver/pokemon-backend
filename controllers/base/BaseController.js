const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../../middleware/errorHandler');
const SaleService = require('../../services/shared/saleService');

/**
 * Base Controller Class
 * 
 * Provides common CRUD operations for all resource controllers.
 * Eliminates code duplication and standardizes controller patterns.
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
   * @param {Object} model - Mongoose model
   * @param {Object} queryService - Query service for filtering/searching
   * @param {Object} crudService - CRUD service for business logic
   * @param {Object} options - Configuration options
   */
  constructor(model, queryService, crudService, options = {}) {
    this.model = model;
    this.queryService = queryService;
    this.crudService = crudService;
    this.options = {
      entityName: model.modelName,
      pluralName: model.modelName.toLowerCase() + 's',
      includeMarkAsSold: true,
      defaultPopulate: null,
      defaultSort: { createdAt: -1 },
      defaultLimit: 15,
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
      // Use query service if available, otherwise build basic query
      let results;
      if (this.queryService && this.queryService.getFilteredQuery) {
        results = await this.queryService.getFilteredQuery(req.query);
      } else {
        // Fallback to basic query building
        const query = this.buildBasicQuery(req.query);
        results = await this.model.find(query)
          .populate(this.options.defaultPopulate)
          .sort(this.options.defaultSort)
          .limit(parseInt(req.query.limit) || this.options.defaultLimit);
      }

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

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ValidationError('Invalid ObjectId format');
    }

    try {
      const entity = await this.model.findById(req.params.id)
        .populate(this.options.defaultPopulate);

      if (!entity) {
        throw new NotFoundError(`${this.options.entityName} not found`);
      }

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
      // Use CRUD service if available, otherwise create directly
      let entity;
      if (this.crudService && this.crudService.create) {
        entity = await this.crudService.create(req.body);
      } else {
        // Fallback to direct model creation
        entity = await this.model.create(req.body);
        if (this.options.defaultPopulate) {
          await entity.populate(this.options.defaultPopulate);
        }
      }

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
      
      // Standardize validation errors
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        throw new ValidationError(error.message);
      }
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

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ValidationError('Invalid ObjectId format');
    }

    try {
      // Use CRUD service if available, otherwise update directly
      let entity;
      if (this.crudService && this.crudService.update) {
        entity = await this.crudService.update(req.params.id, req.body);
      } else {
        // Fallback to direct model update
        entity = await this.model.findByIdAndUpdate(
          req.params.id,
          req.body,
          { new: true, runValidators: true }
        );
        
        if (!entity) {
          throw new NotFoundError(`${this.options.entityName} not found`);
        }
        
        if (this.options.defaultPopulate) {
          await entity.populate(this.options.defaultPopulate);
        }
      }

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
      
      // Standardize validation errors
      if (error.message.includes('required') || error.message.includes('Invalid')) {
        throw new ValidationError(error.message);
      }
      if (error.message.includes('not found')) {
        throw new NotFoundError(error.message);
      }
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

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ValidationError('Invalid ObjectId format');
    }

    try {
      // Use CRUD service if available, otherwise delete directly
      let entity;
      if (this.crudService && this.crudService.delete) {
        entity = await this.crudService.delete(req.params.id);
      } else {
        // Fallback to direct model deletion
        entity = await this.model.findByIdAndDelete(req.params.id);
        
        if (!entity) {
          throw new NotFoundError(`${this.options.entityName} not found`);
        }
      }

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
      
      if (error.message.includes('not found')) {
        throw new NotFoundError(error.message);
      }
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
      
      // Validate sale details
      SaleService.validateSaleDetails(saleDetails);
      
      // Determine sale method based on model type
      let entity;
      if (this.options.entityName === 'SealedProduct') {
        entity = await SaleService.markSealedProductAsSold(this.model, req.params.id, saleDetails);
      } else {
        // Default to card sale method for PsaGradedCard and RawCard
        entity = await SaleService.markCardAsSold(this.model, req.params.id, saleDetails);
      }

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

  /**
   * Build basic query for filtering
   * 
   * @param {Object} queryParams - Query parameters
   * @returns {Object} - MongoDB query object
   */
  buildBasicQuery(queryParams) {
    const query = {};
    
    // Common filters
    if (queryParams.sold !== undefined) {
      query.sold = queryParams.sold === 'true';
    }
    
    // Text search patterns
    if (queryParams.name) {
      query.name = new RegExp(queryParams.name, 'i');
    }
    
    if (queryParams.setName) {
      query.setName = new RegExp(queryParams.setName, 'i');
    }
    
    if (queryParams.cardName) {
      query.cardName = new RegExp(queryParams.cardName, 'i');
    }
    
    // Category filter
    if (queryParams.category) {
      query.category = queryParams.category;
    }
    
    // Grade filter (for PSA cards)
    if (queryParams.grade) {
      query.grade = queryParams.grade;
    }
    
    // Condition filter (for Raw cards)
    if (queryParams.condition) {
      query.condition = queryParams.condition;
    }
    
    return query;
  }
}

module.exports = BaseController;