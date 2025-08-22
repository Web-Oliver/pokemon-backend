import mongoose from 'mongoose';
import { NotFoundError, ValidationError   } from '@/Application/ErrorTypes.js';
/**
 * Base Repository Class
 *
 * Provides common data access patterns for all repositories.
 * Implements the Repository pattern to abstract data access from business logic.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles only data access operations
 * - Open/Closed: Extensible for specific repository needs
 * - Dependency Inversion: Depends on abstractions (model interface)
 */
class BaseRepository {
  /**
   * Creates a new base repository instance
   * @param {mongoose.Model} model - The Mongoose model to operate on
   * @param {Object} options - Repository configuration options
   */
  constructor(model, options = {}) {
    this.model = model;
    this.options = {
      defaultPopulate: options.defaultPopulate || null,
      defaultSort: options.defaultSort || { dateAdded: -1 },
      defaultLimit: options.defaultLimit || 1000,
      entityName: options.entityName || model.modelName,
      ...options,
    };
  }

  /**
   * Finds a single document by ID
   * @param {string} id - Document ID
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} - The found document or null
   */
  async findById(id, options = {}) {
    // Use MongoDB's built-in ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ObjectId format');
    }

    let query = this.model.findById(id);

    // Apply population if specified
    const populate = options.populate || this.options.defaultPopulate;

    if (populate) {
      query = query.populate(populate);
    }

    const document = await query;

    if (!document) {
      throw new NotFoundError(`${this.options.entityName} not found`);
    }

    return document;
  }

  /**
   * Finds multiple documents based on filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of found documents
   */
  async findAll(filters = {}, options = {}) {
    const {
      populate = this.options.defaultPopulate,
      sort = this.options.defaultSort,
      limit = this.options.defaultLimit,
      skip = 0,
      select = null,
    } = options;

    let query = this.model.find(filters);

    // Apply population
    if (populate) {
      query = query.populate(populate);
    }

    // Apply field selection
    if (select) {
      query = query.select(select);
    }

    // Apply sorting
    if (sort) {
      query = query.sort(sort);
    }

    // Apply pagination
    if (skip > 0) {
      query = query.skip(skip);
    }

    if (limit > 0) {
      query = query.limit(limit);
    }

    return await query;
  }

  /**
   * Counts documents matching the filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} - Count of matching documents
   */
  async count(filters = {}) {
    return await this.model.countDocuments(filters);
  }

  /**
   * Finds documents with pagination support
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options including pagination
   * @returns {Promise<Object>} - Object containing data, count, and pagination info
   */
  async findWithPagination(filters = {}, options = {}) {
    const { page = 1, limit = this.options.defaultLimit, ...queryOptions } = options;

    const skip = (page - 1) * limit;
    const data = await this.findAll(filters, { ...queryOptions, limit, skip });
    const totalCount = await this.count(filters);
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Creates a new document
   * @param {Object} data - Document data
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} - Created document
   */
  async create(data, options = {}) {
    try {
      // eslint-disable-next-line new-cap
      const document = new this.model(data);
      const savedDocument = await document.save();

      // Apply population if specified
      const populate = options.populate || this.options.defaultPopulate;

      if (populate) {
        return await this.findById(savedDocument._id, { populate });
      }

      return savedDocument;
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  }

  /**
   * Updates a document by ID
   * @param {string} id - Document ID
   * @param {Object} data - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} - Updated document
   */
  async update(id, data, options = {}) {
    // Use MongoDB's built-in ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ObjectId format');
    }

    try {
      const updateOptions = {
        new: true,
        runValidators: true,
        ...options,
      };

      const document = await this.model.findByIdAndUpdate(id, data, updateOptions);

      if (!document) {
        throw new NotFoundError(`${this.options.entityName} not found`);
      }

      // Apply population if specified
      const populate = options.populate || this.options.defaultPopulate;

      if (populate) {
        return await this.findById(document._id, { populate });
      }

      return document;
    } catch (error) {
      if (error.name === 'ValidationError') {
        throw new ValidationError(error.message);
      }
      throw error;
    }
  }

  /**
   * Deletes a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object>} - Deleted document
   */
  async delete(id) {
    // Use MongoDB's built-in ObjectId validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError('Invalid ObjectId format');
    }

    const document = await this.model.findByIdAndDelete(id);

    if (!document) {
      throw new NotFoundError(`${this.options.entityName} not found`);
    }

    return document;
  }

  /**
   * Finds one document matching the filters
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Object|null>} - Found document or null
   */
  async findOne(filters = {}, options = {}) {
    let query = this.model.findOne(filters);

    const populate = options.populate || this.options.defaultPopulate;

    if (populate) {
      query = query.populate(populate);
    }

    return await query;
  }

  /**
   * Updates multiple documents
   * @param {Object} filters - Query filters
   * @param {Object} data - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} - Update result
   */
  async updateMany(filters, data, options = {}) {
    const updateOptions = {
      runValidators: true,
      ...options,
    };

    return await this.model.updateMany(filters, data, updateOptions);
  }

  /**
   * Deletes multiple documents
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} - Delete result
   */
  async deleteMany(filters) {
    return await this.model.deleteMany(filters);
  }

  /**
   * Checks if a document exists
   * @param {Object} filters - Query filters
   * @returns {Promise<boolean>} - True if document exists
   */
  async exists(filters) {
    const count = await this.model.countDocuments(filters);

    return count > 0;
  }

  /**
   * Performs aggregation operations
   * @param {Array} pipeline - Aggregation pipeline
   * @returns {Promise<Array>} - Aggregation result
   */
  async aggregate(pipeline) {
    return await this.model.aggregate(pipeline);
  }

  /**
   * Finds documents and streams them
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Stream} - Mongoose query stream
   */
  createStream(filters = {}, options = {}) {
    let query = this.model.find(filters);

    const populate = options.populate || this.options.defaultPopulate;

    if (populate) {
      query = query.populate(populate);
    }

    return query.stream();
  }

  /**
   * Bulk operations helper
   * @param {Array} operations - Array of bulk operations
   * @returns {Promise<Object>} - Bulk operation result
   */
  async bulkWrite(operations) {
    return await this.model.bulkWrite(operations);
  }

  // BULK/BATCH OPERATIONS REMOVED
  // Frontend genericApiOperations.ts explicitly removed bulk operations
  // Removed to avoid over-engineering and maintain DRY/SOLID principles
}

export default BaseRepository;
