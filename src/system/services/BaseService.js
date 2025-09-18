/**
 * BaseService Class
 *
 * Standardizes service layer operations to eliminate code duplication
 * across domain services. Provides common CRUD operations and patterns.
 *
 * This addresses the service layer DRY violations identified in analysis:
 * - Centralizes common service operations
 * - Provides consistent error handling
 * - Standardizes logging and validation patterns
 * - Reduces service boilerplate across domains
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles common service operations
 * - Open/Closed: Extensible for domain-specific needs
 * - Dependency Inversion: Depends on repository abstraction
 */

import Logger from '@/system/logging/Logger.js';
import ValidatorFactory from '@/system/validation/ValidatorFactory.js';

/**
 * Base Service Class
 *
 * Provides common service operations and patterns that can be extended
 * by domain-specific services to reduce code duplication.
 */
class BaseService {
    /**
     * Initialize base service
     *
     * @param {BaseRepository} repository - Repository for data access
     * @param {Object} options - Service configuration options
     */
    constructor(repository, options = {}) {
        if (!repository) {
            throw new Error('Repository is required for BaseService');
        }

        this.repository = repository;
        this.options = {
            entityName: options.entityName || repository.options?.entityName || 'Entity',
            enableLogging: options.enableLogging !== false,
            enableValidation: options.enableValidation !== false,
            enableActivityTracking: options.enableActivityTracking || false,
            ...options
        };

        // Initialize logger context
        this.logContext = `${this.options.entityName}Service`;
    }

    /**
     * Get all entities with optional filtering and pagination
     *
     * @param {Object} filters - Query filters
     * @param {Object} options - Query options (populate, sort, etc.)
     * @returns {Promise<Array>} - Array of entities
     */
    async getAll(filters = {}, options = {}) {
        this.log('getAll', 'Starting operation', { filters, options });

        try {
            const results = await this.repository.findAll(filters, options);

            this.log('getAll', 'Operation completed successfully', {
                resultCount: results.length,
                hasFilters: Object.keys(filters).length > 0
            });

            return results;
        } catch (error) {
            this.logError('getAll', error, { filters, options });
            throw error;
        }
    }

    /**
     * Get entity by ID with optional population
     *
     * @param {string} id - Entity ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Entity object
     */
    async getById(id, options = {}) {
        this.log('getById', 'Starting operation', { id, options });

        try {
            // Validate ID format
            if (this.options.enableValidation) {
                ValidatorFactory.objectId(id, 'Entity ID');
            }

            const entity = await this.repository.findById(id, options);

            this.log('getById', 'Entity retrieved successfully', {
                id: entity._id,
                entityName: this.options.entityName
            });

            return entity;
        } catch (error) {
            this.logError('getById', error, { id, options });
            throw error;
        }
    }

    /**
     * Create new entity with validation
     *
     * @param {Object} data - Entity data
     * @param {Object} options - Creation options
     * @returns {Promise<Object>} - Created entity
     */
    async create(data, options = {}) {
        this.log('create', 'Starting operation', {
            hasData: Boolean(data),
            dataKeys: data ? Object.keys(data) : []
        });

        try {
            // Validate data if validation is enabled
            if (this.options.enableValidation) {
                await this.validateCreateData(data);
            }

            // Pre-process data if needed
            const processedData = await this.preprocessCreateData(data);

            const entity = await this.repository.create(processedData, options);

            // Post-process if needed
            await this.postprocessCreate(entity, processedData);

            this.log('create', 'Entity created successfully', {
                id: entity._id,
                entityName: this.options.entityName
            });

            return entity;
        } catch (error) {
            this.logError('create', error, { data, options });
            throw error;
        }
    }

    /**
     * Update entity by ID
     *
     * @param {string} id - Entity ID
     * @param {Object} data - Update data
     * @param {Object} options - Update options
     * @returns {Promise<Object>} - Updated entity
     */
    async update(id, data, options = {}) {
        this.log('update', 'Starting operation', {
            id,
            hasData: Boolean(data),
            dataKeys: data ? Object.keys(data) : []
        });

        try {
            // Validate inputs
            if (this.options.enableValidation) {
                ValidatorFactory.objectId(id, 'Entity ID');
                await this.validateUpdateData(data, id);
            }

            // Pre-process update data
            const processedData = await this.preprocessUpdateData(data, id);

            const entity = await this.repository.update(id, processedData, options);

            // Post-process if needed
            await this.postprocessUpdate(entity, processedData, id);

            this.log('update', 'Entity updated successfully', {
                id: entity._id,
                entityName: this.options.entityName
            });

            return entity;
        } catch (error) {
            this.logError('update', error, { id, data, options });
            throw error;
        }
    }

    /**
     * Delete entity by ID
     *
     * @param {string} id - Entity ID
     * @returns {Promise<Object>} - Deleted entity
     */
    async delete(id) {
        this.log('delete', 'Starting operation', { id });

        try {
            // Validate ID
            if (this.options.enableValidation) {
                ValidatorFactory.objectId(id, 'Entity ID');
            }

            // Check for dependencies before deletion
            await this.checkDeleteDependencies(id);

            // Pre-delete processing
            await this.preprocessDelete(id);

            const entity = await this.repository.delete(id);

            // Post-delete processing
            await this.postprocessDelete(entity, id);

            this.log('delete', 'Entity deleted successfully', {
                id,
                entityName: this.options.entityName
            });

            return entity;
        } catch (error) {
            this.logError('delete', error, { id });
            throw error;
        }
    }

    /**
     * Count entities with optional filters
     *
     * @param {Object} filters - Count filters
     * @returns {Promise<number>} - Entity count
     */
    async count(filters = {}) {
        this.log('count', 'Starting operation', { filters });

        try {
            const count = await this.repository.count(filters);

            this.log('count', 'Count completed', { count, hasFilters: Object.keys(filters).length > 0 });

            return count;
        } catch (error) {
            this.logError('count', error, { filters });
            throw error;
        }
    }

    /**
     * Check if entity exists
     *
     * @param {Object} filters - Existence filters
     * @returns {Promise<boolean>} - True if exists
     */
    async exists(filters) {
        this.log('exists', 'Starting operation', { filters });

        try {
            const exists = await this.repository.exists(filters);

            this.log('exists', 'Existence check completed', { exists, filters });

            return exists;
        } catch (error) {
            this.logError('exists', error, { filters });
            throw error;
        }
    }

    /**
     * Find entities with pagination
     *
     * @param {Object} filters - Query filters
     * @param {Object} options - Pagination options
     * @returns {Promise<Object>} - Paginated results
     */
    async findPaginated(filters = {}, options = {}) {
        this.log('findPaginated', 'Starting operation', { filters, options });

        try {
            const results = await this.repository.findWithPagination(filters, options);

            this.log('findPaginated', 'Pagination completed', {
                resultCount: results.data.length,
                totalCount: results.pagination.totalCount,
                page: results.pagination.page
            });

            return results;
        } catch (error) {
            this.logError('findPaginated', error, { filters, options });
            throw error;
        }
    }

    // LIFECYCLE HOOKS - Override in subclasses for domain-specific logic

    /**
     * Validate data before creating entity
     * Override in subclasses for entity-specific validation
     *
     * @param {Object} data - Data to validate
     * @protected
     */
    async validateCreateData(data) {
        // Enhanced validation with ValidatorFactory
        ValidatorFactory.object(data, 'Create data', { required: true });

        // Common field validations that apply to most entities
        if (data.myPrice !== undefined) {
            ValidatorFactory.price(data.myPrice, 'My price', { min: 0 });
        }

        if (data.images !== undefined) {
            ValidatorFactory.array(data.images, 'Images', {
                itemValidator: (item) => ValidatorFactory.string(item, 'Image URL', { required: true })
            });
        }

        if (data.sold !== undefined) {
            ValidatorFactory.boolean(data.sold, 'Sold status');
        }

        if (data.dateAdded !== undefined) {
            ValidatorFactory.date(data.dateAdded, 'Date added');
        }

        // Reference field validations
        if (data.cardId !== undefined) {
            ValidatorFactory.cardReference(data.cardId, 'Card reference');
        }

        if (data.setId !== undefined) {
            ValidatorFactory.setReference(data.setId, 'Set reference');
        }

        if (data.productId !== undefined) {
            ValidatorFactory.objectId(data.productId, 'Product reference');
        }

        // Domain-specific validation hook - override in subclasses
        await this.validateEntitySpecificCreateData(data);
    }

    /**
     * Validate data before updating entity
     * Override in subclasses for entity-specific validation
     *
     * @param {Object} data - Data to validate
     * @param {string} id - Entity ID being updated
     * @protected
     */
    async validateUpdateData(data, id) {
        // Enhanced validation with ValidatorFactory
        ValidatorFactory.object(data, 'Update data', { required: true });

        // Common field validations for updates
        if (data.myPrice !== undefined) {
            ValidatorFactory.price(data.myPrice, 'My price', { min: 0 });
        }

        if (data.images !== undefined) {
            ValidatorFactory.array(data.images, 'Images', {
                itemValidator: (item) => ValidatorFactory.string(item, 'Image URL', { required: true })
            });
        }

        if (data.sold !== undefined) {
            ValidatorFactory.boolean(data.sold, 'Sold status');
        }

        if (data.saleDetails !== undefined && data.sold === true) {
            ValidatorFactory.saleDetails(data.saleDetails, 'Sale details');
        }

        // Reference field validations
        if (data.cardId !== undefined) {
            ValidatorFactory.cardReference(data.cardId, 'Card reference');
        }

        if (data.setId !== undefined) {
            ValidatorFactory.setReference(data.setId, 'Set reference');
        }

        // Domain-specific validation hook - override in subclasses
        await this.validateEntitySpecificUpdateData(data, id);
    }

    /**
     * Pre-process data before creation
     * Override in subclasses for entity-specific preprocessing
     *
     * @param {Object} data - Original data
     * @returns {Promise<Object>} - Processed data
     * @protected
     */
    async preprocessCreateData(data) {
        // Default implementation - return data as-is
        return { ...data };
    }

    /**
     * Pre-process data before update
     * Override in subclasses for entity-specific preprocessing
     *
     * @param {Object} data - Original data
     * @param {string} id - Entity ID being updated
     * @returns {Promise<Object>} - Processed data
     * @protected
     */
    async preprocessUpdateData(data) {
        // Default implementation - return data as-is
        return { ...data };
    }

    /**
     * Post-process after entity creation
     * Override in subclasses for post-creation tasks
     *
     * @param {Object} entity - Created entity
     * @param {Object} originalData - Original input data
     * @protected
     */
    async postprocessCreate(_entity, _originalData) {
        // Default implementation - no additional processing
    }

    /**
     * Post-process after entity update
     * Override in subclasses for post-update tasks
     *
     * @param {Object} entity - Updated entity
     * @param {Object} originalData - Original input data
     * @param {string} id - Entity ID
     * @protected
     */
    async postprocessUpdate(_entity, _originalData, _id) {
        // Default implementation - no additional processing
    }

    /**
     * Pre-process before deletion
     * Override in subclasses for pre-deletion tasks
     *
     * @param {string} id - Entity ID to delete
     * @protected
     */
    async preprocessDelete(_id) {
        // Default implementation - no preprocessing
    }

    /**
     * Post-process after deletion
     * Override in subclasses for post-deletion cleanup
     *
     * @param {Object} entity - Deleted entity
     * @param {string} id - Entity ID
     * @protected
     */
    async postprocessDelete(_entity, _id) {
        // Default implementation - no postprocessing
    }

    /**
     * Check for dependencies before deletion
     * Override in subclasses to prevent deletion of referenced entities
     *
     * @param {string} id - Entity ID to check
     * @protected
     */
    async checkDeleteDependencies(_id) {
        // Default implementation - no dependency checks
        // Override in subclasses to implement dependency validation
    }

    /**
     * Entity-specific validation for create operations
     * Override in subclasses for domain-specific validation logic
     *
     * @param {Object} data - Data to validate
     * @protected
     */
    async validateEntitySpecificCreateData(_data) {
        // Default implementation - no additional validation
        // Override in subclasses for entity-specific validation
    }

    /**
     * Entity-specific validation for update operations
     * Override in subclasses for domain-specific validation logic
     *
     * @param {Object} data - Data to validate
     * @param {string} id - Entity ID being updated
     * @protected
     */
    async validateEntitySpecificUpdateData(_data, _id) {
        // Default implementation - no additional validation
        // Override in subclasses for entity-specific validation
    }

    /**
     * Bulk operations - create multiple entities
     *
     * @param {Array} dataArray - Array of entity data
     * @param {Object} options - Creation options
     * @returns {Promise<Array>} - Array of created entities
     */
    async createMany(dataArray, options = {}) {
        this.log('createMany', 'Starting bulk creation', {
            itemCount: dataArray.length
        });

        try {
            ValidatorFactory.array(dataArray, 'Entity data array', {
                required: true,
                minLength: 1
            });

            const results = [];
            const errors = [];

            for (let i = 0; i < dataArray.length; i++) {
                try {
                    const entity = await this.create(dataArray[i], options);
                    results.push(entity);
                } catch (error) {
                    errors.push({
                        index: i,
                        data: dataArray[i],
                        error: error.message
                    });
                }
            }

            this.log('createMany', 'Bulk creation completed', {
                successful: results.length,
                failed: errors.length,
                total: dataArray.length
            });

            return {
                successful: results,
                failed: errors,
                totalProcessed: dataArray.length
            };
        } catch (error) {
            this.logError('createMany', error, { itemCount: dataArray.length });
            throw error;
        }
    }

    /**
     * Bulk operations - update multiple entities
     *
     * @param {Array} updates - Array of {id, data} objects
     * @param {Object} options - Update options
     * @returns {Promise<Object>} - Update results
     */
    async updateMany(updates, options = {}) {
        this.log('updateMany', 'Starting bulk update', {
            itemCount: updates.length
        });

        try {
            ValidatorFactory.array(updates, 'Updates array', {
                required: true,
                minLength: 1,
                itemValidator: (item) => {
                    ValidatorFactory.object(item, 'Update item', { required: true });
                    ValidatorFactory.objectId(item.id, 'Update item ID');
                    ValidatorFactory.object(item.data, 'Update item data', { required: true });
                }
            });

            const results = [];
            const errors = [];

            for (let i = 0; i < updates.length; i++) {
                const { id, data } = updates[i];
                try {
                    const entity = await this.update(id, data, options);
                    results.push(entity);
                } catch (error) {
                    errors.push({
                        index: i,
                        id,
                        data,
                        error: error.message
                    });
                }
            }

            this.log('updateMany', 'Bulk update completed', {
                successful: results.length,
                failed: errors.length,
                total: updates.length
            });

            return {
                successful: results,
                failed: errors,
                totalProcessed: updates.length
            };
        } catch (error) {
            this.logError('updateMany', error, { itemCount: updates.length });
            throw error;
        }
    }

    /**
     * Mark entity as sold with sale details
     *
     * @param {string} id - Entity ID
     * @param {Object} saleDetails - Sale information
     * @returns {Promise<Object>} - Updated entity
     */
    async markAsSold(id, saleDetails) {
        this.log('markAsSold', 'Starting sale operation', { id, saleDetails });

        try {
            // Validate inputs
            if (this.options.enableValidation) {
                ValidatorFactory.objectId(id, 'Entity ID');
                ValidatorFactory.saleDetails(saleDetails, 'Sale details');
            }

            const updateData = {
                sold: true,
                saleDetails: {
                    dateSold: new Date(),
                    ...saleDetails
                }
            };

            const entity = await this.update(id, updateData);

            this.log('markAsSold', 'Entity marked as sold', {
                id: entity._id,
                salePrice: saleDetails.price
            });

            return entity;
        } catch (error) {
            this.logError('markAsSold', error, { id, saleDetails });
            throw error;
        }
    }

    // UTILITY METHODS

    /**
     * Log operation with context
     * @private
     */
    log(operation, message, data = {}) {
        if (this.options.enableLogging) {
            Logger.info(this.logContext, `${operation}: ${message}`, data);
        }
    }

    /**
     * Log error with context
     * @private
     */
    logError(operation, error, data = {}) {
        if (this.options.enableLogging) {
            Logger.error(this.logContext, `${operation} failed`, error, data);
        }
    }
}

export default BaseService;