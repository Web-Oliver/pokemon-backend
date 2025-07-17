const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');
const ImageManager = require('../shared/imageManager');
const SaleService = require('../shared/saleService');
const ActivityService = require('../activityService');

/**
 * Collection Service
 *
 * Provides business logic for collection management operations.
 * Uses repository pattern for data access and dependency injection for services.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles collection item business logic
 * - Open/Closed: Extensible for new collection types
 * - Dependency Inversion: Depends on repository abstractions
 */
class CollectionService {
  /**
   * Creates a new collection service instance
   * @param {BaseRepository} repository - Repository for data access
   * @param {Object} options - Service configuration options
   */
  constructor(repository, options = {}) {
    this.repository = repository;
    this.options = {
      entityName: options.entityName || 'CollectionItem',
      imageManager: options.imageManager || ImageManager,
      saleService: options.saleService || SaleService,
      enableImageManagement: options.enableImageManagement !== false,
      enableSaleTracking: options.enableSaleTracking !== false,
      ...options,
    };
  }

  /**
   * Gets all collection items
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of collection items
   */
  async getAll(filters = {}, options = {}) {
    try {
      const items = await this.repository.findAll(filters, options);

      return items;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets collection items with pagination
   * @param {Object} filters - Query filters
   * @param {Object} options - Query options including pagination
   * @returns {Promise<Object>} - Paginated collection items
   */
  async getAllWithPagination(filters = {}, options = {}) {
    try {
      return await this.repository.findWithPagination(filters, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets a single collection item by ID
   * @param {string} id - Item ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Collection item
   */
  async getById(id, options = {}) {
    try {
      return await this.repository.findById(id, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Creates a new collection item
   * @param {Object} data - Item data
   * @param {Object} options - Creation options
   * @returns {Promise<Object>} - Created collection item
   */
  async create(data, options = {}) {
    try {
      // Validate required fields
      this.validateCreateData(data);

      // Set default values
      const itemData = {
        ...data,
        sold: false,
        dateAdded: new Date(),
        priceHistory: data.myPrice
          ? [
              {
                price: data.myPrice,
                dateUpdated: new Date(),
              },
            ]
          : [],
      };

      // Create the item
      const item = await this.repository.create(itemData, options);

      return item;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates a collection item
   * @param {string} id - Item ID
   * @param {Object} data - Update data
   * @param {Object} options - Update options
   * @returns {Promise<Object>} - Updated collection item
   */
  async update(id, data, options = {}) {
    try {
      // Get existing item
      const existingItem = await this.repository.findById(id);

      // Prepare update data
      const updateData = { ...data };

      // Handle price history updates
      if (data.priceHistory && Array.isArray(data.priceHistory)) {
        console.log('[COLLECTION SERVICE] Frontend sent priceHistory:', data.priceHistory.length, 'entries');
        // Frontend is managing price history - use their complete array
        updateData.priceHistory = data.priceHistory;
        
        // Set myPrice to the most recent price from history
        if (data.priceHistory.length > 0) {
          const latestPrice = data.priceHistory[data.priceHistory.length - 1].price;

          updateData.myPrice = latestPrice;
          console.log('[COLLECTION SERVICE] Set myPrice to latest price from history:', latestPrice);
        }
      } else if (data.myPrice && data.myPrice !== existingItem.myPrice) {
        console.log('[COLLECTION SERVICE] Only myPrice provided, adding to existing history');
        // Only myPrice provided - add to existing history
        updateData.priceHistory = [
          ...existingItem.priceHistory,
          {
            price: data.myPrice,
            dateUpdated: new Date(),
          },
        ];
      }

      // Update the item
      const updatedItem = await this.repository.update(id, updateData, options);

      return updatedItem;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deletes a collection item
   * @param {string} id - Item ID
   * @returns {Promise<Object>} - Deleted collection item
   */
  async delete(id) {
    try {
      // Get the item first to handle cleanup and activity tracking
      // Use proper populate configuration based on entity type
      const populateConfig = this.getDeletePopulateConfig();
      const item = await this.repository.findById(id, { populate: populateConfig });

      // Determine card type based on entity name and collection type
      let cardType = 'raw'; // default
      const entityName = this.options.entityName?.toLowerCase();
      
      if (entityName?.includes('psa') || entityName?.includes('graded')) {
        cardType = 'psa';
      } else if (entityName?.includes('sealed') || entityName?.includes('product')) {
        cardType = 'sealed';
      } else if (entityName?.includes('raw')) {
        cardType = 'raw';
      }

      // Log deletion activity before actually deleting
      if (item) {
        try {
          console.log(`[COLLECTION SERVICE] Logging deletion activity for ${this.options.entityName} ${id} (cardType: ${cardType})`);
          console.log('[COLLECTION SERVICE] Item to delete:', {
            id: item._id,
            cardName: item.cardName || item.cardId?.cardName,
            setName: item.setName || item.cardId?.setId?.setName
          });
          
          const activity = await ActivityService.logCardDeleted(item, cardType);

          console.log(`[COLLECTION SERVICE] Deletion activity created successfully:`, activity._id);
        } catch (activityError) {
          console.error(`[COLLECTION SERVICE] Failed to log deletion activity for ${this.options.entityName} ${id}:`, activityError);
          // Don't let activity logging failures prevent deletion
        }
      }

      // Delete associated images if enabled
      if (this.options.enableImageManagement && item && item.images && item.images.length > 0) {
        try {
          await this.options.imageManager.deleteImageFiles(item.images);
        } catch (imageError) {
          console.warn(`Failed to delete images for ${this.options.entityName} ${id}:`, imageError.message);
        }
      }

      // Delete the item
      const deletedItem = await this.repository.delete(id);

      return deletedItem;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Marks a collection item as sold
   * @param {string} id - Item ID
   * @param {Object} saleDetails - Sale details
   * @returns {Promise<Object>} - Updated collection item
   */
  async markAsSold(id, saleDetails) {
    try {
      if (!this.options.enableSaleTracking) {
        throw new ValidationError('Sale tracking is not enabled for this collection type');
      }

      // Validate sale details
      this.options.saleService.validateSaleDetails(saleDetails);

      // Get existing item
      const existingItem = await this.repository.findById(id);

      if (existingItem.sold) {
        throw new ValidationError(`${this.options.entityName} is already marked as sold`);
      }

      // Prepare sale data
      const saleData = {
        sold: true,
        saleDetails: {
          ...saleDetails,
          dateSold: new Date(),
        },
      };

      // Update the item
      const updatedItem = await this.repository.update(id, saleData);

      return updatedItem;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Marks a collection item as unsold
   * @param {string} id - Item ID
   * @returns {Promise<Object>} - Updated collection item
   */
  async markAsUnsold(id) {
    try {
      if (!this.options.enableSaleTracking) {
        throw new ValidationError('Sale tracking is not enabled for this collection type');
      }

      // Get existing item
      const existingItem = await this.repository.findById(id);

      if (!existingItem.sold) {
        throw new ValidationError(`${this.options.entityName} is not marked as sold`);
      }

      // Prepare unsale data
      const unsaleData = {
        sold: false,
        saleDetails: {
          dateSold: null,
          paymentMethod: null,
          actualSoldPrice: null,
          deliveryMethod: null,
          source: null,
          buyerFullName: null,
          buyerAddress: null,
          buyerPhoneNumber: null,
          buyerEmail: null,
          trackingNumber: null,
        },
      };

      // Update the item
      const updatedItem = await this.repository.update(id, unsaleData);

      return updatedItem;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets collection statistics
   * @returns {Promise<Object>} - Collection statistics
   */
  async getStatistics() {
    try {
      return await this.repository.getStatistics();
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches collection items
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Array of matching collection items
   */
  async search(searchTerm, options = {}) {
    try {
      if (!searchTerm || searchTerm.trim() === '') {
        throw new ValidationError('Search term is required');
      }

      return await this.repository.search(searchTerm.trim(), options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets sold items
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of sold items
   */
  async getSoldItems(options = {}) {
    try {
      return await this.repository.findSold(options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets unsold items
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of unsold items
   */
  async getUnsoldItems(options = {}) {
    try {
      return await this.repository.findUnsold(options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets items by price range
   * @param {number} minPrice - Minimum price
   * @param {number} maxPrice - Maximum price
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of items in price range
   */
  async getItemsByPriceRange(minPrice, maxPrice, options = {}) {
    try {
      if (minPrice < 0 || maxPrice < 0) {
        throw new ValidationError('Price values must be non-negative');
      }

      if (minPrice > maxPrice) {
        throw new ValidationError('Minimum price cannot be greater than maximum price');
      }

      return await this.repository.findByPriceRange(minPrice, maxPrice, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets items with recent price changes
   * @param {number} days - Number of days to look back
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of items with recent price changes
   */
  async getItemsWithRecentPriceChanges(days = 30, options = {}) {
    try {
      if (days < 1) {
        throw new ValidationError('Days must be a positive number');
      }

      return await this.repository.findWithRecentPriceChanges(days, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets populate configuration for deletion operations
   * @returns {Object|string|null} - Populate configuration
   */
  getDeletePopulateConfig() {
    const entityName = this.options.entityName?.toLowerCase();
    
    // Return appropriate populate configuration based on entity type
    if (entityName?.includes('psa') || entityName?.includes('graded')) {
      return {
        path: 'cardId',
        populate: {
          path: 'setId',
          model: 'Set',
        },
      };
    } else if (entityName?.includes('raw')) {
      return {
        path: 'cardId',
        populate: {
          path: 'setId',
          model: 'Set',
        },
      };
    } else if (entityName?.includes('sealed') || entityName?.includes('product')) {
      return 'productId';
    }
    
    // Default: no population
    return null;
  }

  /**
   * Validates create data
   * @param {Object} data - Data to validate
   * @throws {ValidationError} - If validation fails
   */
  validateCreateData(data) {
    if (!data) {
      throw new ValidationError('Item data is required');
    }

    if (data.myPrice !== undefined && (typeof data.myPrice !== 'number' || data.myPrice < 0)) {
      throw new ValidationError('Price must be a non-negative number');
    }

    if (data.images && !Array.isArray(data.images)) {
      throw new ValidationError('Images must be an array');
    }

    // Entity-specific validations can be added in subclasses
  }

  /**
   * Bulk updates multiple items
   * @param {Array} updates - Array of update operations
   * @returns {Promise<Object>} - Bulk operation result
   */
  async bulkUpdate(updates) {
    try {
      const operations = updates.map((update) => ({
        updateOne: {
          filter: { _id: update.id },
          update: { $set: update.data },
        },
      }));

      return await this.repository.bulkWrite(operations);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets total value of items matching filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} - Total value
   */
  async getTotalValue(filters = {}) {
    try {
      return await this.repository.getTotalValue(filters);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Counts items matching filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} - Count of matching items
   */
  async count(filters = {}) {
    try {
      return await this.repository.count(filters);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Checks if an item exists
   * @param {Object} filters - Query filters
   * @returns {Promise<boolean>} - True if item exists
   */
  async exists(filters) {
    try {
      return await this.repository.exists(filters);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CollectionService;
