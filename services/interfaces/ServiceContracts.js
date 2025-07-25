/**
 * Service Interface Contracts
 * 
 * This file defines the interface contracts for all services in the Pokemon Collection Backend.
 * These contracts ensure consistent behavior across service implementations and provide
 * clear documentation for expected method signatures and behaviors.
 * 
 * Following SOLID principles:
 * - Interface Segregation: Focused interfaces for specific responsibilities
 * - Liskov Substitution: All implementations must honor these contracts
 * - Dependency Inversion: High-level modules depend on these abstractions
 */

/**
 * @typedef {Object} ServiceOptions
 * @property {string} entityName - Name of the entity being managed
 * @property {Object} imageManager - Image management service instance
 * @property {Object} saleService - Sale tracking service instance
 * @property {boolean} enableImageManagement - Whether image management is enabled
 * @property {boolean} enableSaleTracking - Whether sale tracking is enabled
 */

/**
 * @typedef {Object} QueryOptions
 * @property {Object} populate - Population configuration for related entities
 * @property {Object} sort - Sort configuration
 * @property {number} limit - Maximum number of results
 * @property {number} skip - Number of results to skip
 * @property {boolean} lean - Whether to return lean documents
 */

/**
 * @typedef {Object} PaginationResult
 * @property {Array} items - Array of items for current page
 * @property {number} total - Total number of items
 * @property {number} page - Current page number
 * @property {number} limit - Items per page
 * @property {number} totalPages - Total number of pages
 * @property {boolean} hasNext - Whether there is a next page
 * @property {boolean} hasPrev - Whether there is a previous page
 */

/**
 * @typedef {Object} SaleDetails
 * @property {Date} dateSold - Date when item was sold
 * @property {string} paymentMethod - Method of payment
 * @property {number} actualSoldPrice - Actual sale price
 * @property {string} deliveryMethod - Method of delivery
 * @property {string} source - Source of sale (eBay, local, etc.)
 * @property {string} buyerFullName - Full name of buyer
 * @property {string} buyerAddress - Address of buyer
 * @property {string} buyerPhoneNumber - Phone number of buyer
 * @property {string} buyerEmail - Email of buyer
 * @property {string} trackingNumber - Shipping tracking number
 */

/**
 * @typedef {Object} ActivityData
 * @property {string} type - Type of activity
 * @property {string} title - Activity title
 * @property {string} description - Activity description
 * @property {string} details - Detailed activity information
 * @property {string} priority - Activity priority level
 * @property {string} entityType - Type of entity involved
 * @property {string} entityId - ID of entity involved
 * @property {Object} metadata - Additional activity metadata
 */

/**
 * @typedef {Object} SearchResult
 * @property {Array} results - Array of search results
 * @property {number} total - Total number of matching results
 * @property {number} relevanceScore - Relevance score for ranking
 * @property {Object} metadata - Search metadata and statistics
 */

/**
 * Collection Service Interface Contract
 * 
 * Defines the standard interface for collection management services.
 * All collection services (PSA, Raw, Sealed) must implement this interface.
 * 
 * @interface ICollectionService
 */
class ICollectionService {
  /**
   * Creates a new collection service instance
   * @param {Object} repository - Repository for data access
   * @param {ServiceOptions} options - Service configuration options
   */
  constructor(repository, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets all collection items with optional filtering
   * @param {Object} filters - Query filters to apply
   * @param {QueryOptions} options - Query options (populate, sort, etc.)
   * @returns {Promise<Array>} Array of collection items
   * @throws {ValidationError} When filters are invalid
   * @throws {DatabaseError} When database operation fails
   */
  async getAll(filters = {}, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets collection items with pagination support
   * @param {Object} filters - Query filters to apply
   * @param {QueryOptions} options - Query options including pagination
   * @returns {Promise<PaginationResult>} Paginated collection items
   * @throws {ValidationError} When pagination parameters are invalid
   * @throws {DatabaseError} When database operation fails
   */
  async getAllWithPagination(filters = {}, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets a single collection item by ID
   * @param {string} id - Item ID (must be valid ObjectId)
   * @param {QueryOptions} options - Query options (populate, etc.)
   * @returns {Promise<Object>} Collection item
   * @throws {ValidationError} When ID is invalid
   * @throws {NotFoundError} When item is not found
   * @throws {DatabaseError} When database operation fails
   */
  async getById(id, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Creates a new collection item
   * @param {Object} data - Item data to create
   * @param {QueryOptions} options - Creation options
   * @returns {Promise<Object>} Created collection item
   * @throws {ValidationError} When data is invalid or incomplete
   * @throws {DuplicateError} When item already exists
   * @throws {DatabaseError} When database operation fails
   */
  async create(data, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Updates an existing collection item
   * @param {string} id - Item ID (must be valid ObjectId)
   * @param {Object} data - Update data
   * @param {QueryOptions} options - Update options
   * @returns {Promise<Object>} Updated collection item
   * @throws {ValidationError} When ID or data is invalid
   * @throws {NotFoundError} When item is not found
   * @throws {DatabaseError} When database operation fails
   */
  async update(id, data, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Deletes a collection item
   * @param {string} id - Item ID (must be valid ObjectId)
   * @returns {Promise<Object>} Deleted collection item
   * @throws {ValidationError} When ID is invalid
   * @throws {NotFoundError} When item is not found
   * @throws {DatabaseError} When database operation fails
   */
  async delete(id) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Marks a collection item as sold
   * @param {string} id - Item ID (must be valid ObjectId)
   * @param {SaleDetails} saleDetails - Sale transaction details
   * @returns {Promise<Object>} Updated collection item
   * @throws {ValidationError} When ID or sale details are invalid
   * @throws {NotFoundError} When item is not found
   * @throws {BusinessRuleError} When item is already sold
   * @throws {DatabaseError} When database operation fails
   */
  async markAsSold(id, saleDetails) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Marks a collection item as unsold
   * @param {string} id - Item ID (must be valid ObjectId)
   * @returns {Promise<Object>} Updated collection item
   * @throws {ValidationError} When ID is invalid
   * @throws {NotFoundError} When item is not found
   * @throws {BusinessRuleError} When item is not sold
   * @throws {DatabaseError} When database operation fails
   */
  async markAsUnsold(id) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets collection statistics
   * @returns {Promise<Object>} Collection statistics
   * @throws {DatabaseError} When database operation fails
   */
  async getStatistics() {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Searches collection items
   * @param {string} searchTerm - Search term (must not be empty)
   * @param {QueryOptions} options - Search options
   * @returns {Promise<Array>} Array of matching collection items
   * @throws {ValidationError} When search term is empty or invalid
   * @throws {DatabaseError} When database operation fails
   */
  async search(searchTerm, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets sold items
   * @param {QueryOptions} options - Query options
   * @returns {Promise<Array>} Array of sold items
   * @throws {DatabaseError} When database operation fails
   */
  async getSoldItems(options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets unsold items
   * @param {QueryOptions} options - Query options
   * @returns {Promise<Array>} Array of unsold items
   * @throws {DatabaseError} When database operation fails
   */
  async getUnsoldItems(options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets items by price range
   * @param {number} minPrice - Minimum price (must be non-negative)
   * @param {number} maxPrice - Maximum price (must be >= minPrice)
   * @param {QueryOptions} options - Query options
   * @returns {Promise<Array>} Array of items in price range
   * @throws {ValidationError} When price values are invalid
   * @throws {DatabaseError} When database operation fails
   */
  async getItemsByPriceRange(minPrice, maxPrice, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets items with recent price changes
   * @param {number} days - Number of days to look back (must be positive)
   * @param {QueryOptions} options - Query options
   * @returns {Promise<Array>} Array of items with recent price changes
   * @throws {ValidationError} When days parameter is invalid
   * @throws {DatabaseError} When database operation fails
   */
  async getItemsWithRecentPriceChanges(days = 30, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Validates create data according to entity-specific rules
   * @param {Object} data - Data to validate
   * @throws {ValidationError} When validation fails
   */
  validateCreateData(data) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Bulk updates multiple items
   * @param {Array} updates - Array of update operations
   * @returns {Promise<Object>} Bulk operation result
   * @throws {ValidationError} When updates array is invalid
   * @throws {DatabaseError} When database operation fails
   */
  async bulkUpdate(updates) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets total value of items matching filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} Total value
   * @throws {DatabaseError} When database operation fails
   */
  async getTotalValue(filters = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Counts items matching filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} Count of matching items
   * @throws {DatabaseError} When database operation fails
   */
  async count(filters = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Checks if an item exists
   * @param {Object} filters - Query filters
   * @returns {Promise<boolean>} True if item exists
   * @throws {DatabaseError} When database operation fails
   */
  async exists(filters) {
    throw new Error('Interface method must be implemented');
  }
}

/**
 * Activity Service Interface Contract
 * 
 * Defines the standard interface for activity tracking services.
 * Ensures consistent activity logging across the application.
 * 
 * @interface IActivityService
 */
class IActivityService {
  /**
   * Creates a new activity record
   * @param {ActivityData} activityData - Activity data to create
   * @returns {Promise<Object>} Created activity or queued confirmation
   * @throws {ValidationError} When activity data is invalid
   * @throws {DatabaseError} When database operation fails
   */
  static async createActivity(activityData) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Logs card addition activity
   * @param {Object} cardData - Card data
   * @param {string} cardType - Type of card (psa, raw, sealed)
   * @returns {Promise<Object>} Created activity
   * @throws {ValidationError} When card data is invalid
   * @throws {DatabaseError} When database operation fails
   */
  static async logCardAdded(cardData, cardType) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Logs card update activity
   * @param {Object} cardData - Card data
   * @param {string} cardType - Type of card (psa, raw, sealed)
   * @param {Object} changes - Changes made to the card
   * @returns {Promise<Object>} Created activity
   * @throws {ValidationError} When card data is invalid
   * @throws {DatabaseError} When database operation fails
   */
  static async logCardUpdated(cardData, cardType, changes) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Logs card deletion activity
   * @param {Object} cardData - Card data
   * @param {string} cardType - Type of card (psa, raw, sealed)
   * @returns {Promise<Object>} Created activity
   * @throws {ValidationError} When card data is invalid
   * @throws {DatabaseError} When database operation fails
   */
  static async logCardDeleted(cardData, cardType) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Logs price update activity
   * @param {Object} cardData - Card data
   * @param {string} cardType - Type of card (psa, raw, sealed)
   * @param {number} oldPrice - Previous price
   * @param {number} newPrice - New price
   * @returns {Promise<Object>} Created activity
   * @throws {ValidationError} When price data is invalid
   * @throws {DatabaseError} When database operation fails
   */
  static async logPriceUpdate(cardData, cardType, oldPrice, newPrice) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Logs sale completion activity
   * @param {Object} cardData - Card data
   * @param {string} cardType - Type of card (psa, raw, sealed)
   * @param {SaleDetails} saleDetails - Sale transaction details
   * @returns {Promise<Object>} Created activity
   * @throws {ValidationError} When sale data is invalid
   * @throws {DatabaseError} When database operation fails
   */
  static async logSaleCompleted(cardData, cardType, saleDetails) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets activities with filtering and pagination
   * @param {Object} options - Query options including filters and pagination
   * @returns {Promise<Object>} Activities with pagination metadata
   * @throws {ValidationError} When options are invalid
   * @throws {DatabaseError} When database operation fails
   */
  static async getActivities(options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets activity statistics
   * @returns {Promise<Object>} Activity statistics
   * @throws {DatabaseError} When database operation fails
   */
  static async getActivityStats() {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Validates activity data
   * @param {ActivityData} activityData - Activity data to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static validateActivityData(activityData) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Archives old activities
   * @param {number} daysOld - Number of days old to archive (default: 90)
   * @returns {Promise<Object>} Archive operation result
   * @throws {ValidationError} When days parameter is invalid
   * @throws {DatabaseError} When database operation fails
   */
  static async archiveOldActivities(daysOld = 90) {
    throw new Error('Interface method must be implemented');
  }
}

/**
 * Search Service Interface Contract
 * 
 * Defines the standard interface for search services.
 * Ensures consistent search behavior across different search implementations.
 * 
 * @interface ISearchService
 */
class ISearchService {
  /**
   * Performs unified search across all collection types
   * @param {string} query - Search query (must not be empty)
   * @param {Object} options - Search options and filters
   * @returns {Promise<SearchResult>} Search results with metadata
   * @throws {ValidationError} When query is empty or invalid
   * @throws {DatabaseError} When database operation fails
   */
  async search(query, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Searches specific entity type
   * @param {string} entityType - Type of entity to search (cards, sets, products)
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of search results
   * @throws {ValidationError} When parameters are invalid
   * @throws {DatabaseError} When database operation fails
   */
  async searchByType(entityType, query, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets search suggestions based on partial query
   * @param {string} partialQuery - Partial search query
   * @param {number} limit - Maximum number of suggestions
   * @returns {Promise<Array>} Array of search suggestions
   * @throws {ValidationError} When parameters are invalid
   * @throws {DatabaseError} When database operation fails
   */
  async getSuggestions(partialQuery, limit = 10) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Normalizes search query for consistent processing
   * @param {string} query - Raw search query
   * @returns {string} Normalized search query
   */
  normalizeQuery(query) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Calculates relevance score for search results
   * @param {string} text - Text to score
   * @param {string} query - Original search query
   * @returns {number} Relevance score
   */
  calculateRelevanceScore(text, query) {
    throw new Error('Interface method must be implemented');
  }
}

/**
 * Image Manager Interface Contract
 * 
 * Defines the standard interface for image management services.
 * Ensures consistent image handling across the application.
 * 
 * @interface IImageManager
 */
class IImageManager {
  /**
   * Deletes multiple image files from the filesystem
   * @param {Array<string>} imageUrls - Array of image URLs to delete
   * @returns {Promise<void>}
   * @throws {FileSystemError} When file operations fail
   */
  static async deleteImageFiles(imageUrls) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Deletes a single image file from the filesystem
   * @param {string} imageUrl - Image URL to delete
   * @returns {Promise<void>}
   * @throws {FileSystemError} When file operation fails
   */
  static async deleteImageFile(imageUrl) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Validates if an image URL is valid for deletion
   * @param {string} imageUrl - Image URL to validate
   * @returns {boolean} True if valid, false otherwise
   */
  static isValidImageUrl(imageUrl) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Gets the file path for an image URL
   * @param {string} imageUrl - Image URL
   * @returns {string} File path
   * @throws {ValidationError} When URL is invalid
   */
  static getImageFilePath(imageUrl) {
    throw new Error('Interface method must be implemented');
  }
}

/**
 * Repository Interface Contract
 * 
 * Defines the standard interface for data access repositories.
 * Ensures consistent data access patterns across all repositories.
 * 
 * @interface IRepository
 */
class IRepository {
  /**
   * Finds all documents matching filters
   * @param {Object} filters - Query filters
   * @param {QueryOptions} options - Query options
   * @returns {Promise<Array>} Array of documents
   * @throws {DatabaseError} When database operation fails
   */
  async findAll(filters = {}, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Finds documents with pagination
   * @param {Object} filters - Query filters
   * @param {QueryOptions} options - Query options including pagination
   * @returns {Promise<PaginationResult>} Paginated results
   * @throws {DatabaseError} When database operation fails
   */
  async findWithPagination(filters = {}, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Finds a single document by ID
   * @param {string} id - Document ID
   * @param {QueryOptions} options - Query options
   * @returns {Promise<Object>} Document
   * @throws {NotFoundError} When document is not found
   * @throws {DatabaseError} When database operation fails
   */
  async findById(id, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Creates a new document
   * @param {Object} data - Document data
   * @param {QueryOptions} options - Creation options
   * @returns {Promise<Object>} Created document
   * @throws {ValidationError} When data is invalid
   * @throws {DatabaseError} When database operation fails
   */
  async create(data, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Updates a document by ID
   * @param {string} id - Document ID
   * @param {Object} data - Update data
   * @param {QueryOptions} options - Update options
   * @returns {Promise<Object>} Updated document
   * @throws {NotFoundError} When document is not found
   * @throws {DatabaseError} When database operation fails
   */
  async update(id, data, options = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Deletes a document by ID
   * @param {string} id - Document ID
   * @returns {Promise<Object>} Deleted document
   * @throws {NotFoundError} When document is not found
   * @throws {DatabaseError} When database operation fails
   */
  async delete(id) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Counts documents matching filters
   * @param {Object} filters - Query filters
   * @returns {Promise<number>} Count of matching documents
   * @throws {DatabaseError} When database operation fails
   */
  async count(filters = {}) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Checks if a document exists
   * @param {Object} filters - Query filters
   * @returns {Promise<boolean>} True if document exists
   * @throws {DatabaseError} When database operation fails
   */
  async exists(filters) {
    throw new Error('Interface method must be implemented');
  }

  /**
   * Performs bulk write operations
   * @param {Array} operations - Array of bulk operations
   * @returns {Promise<Object>} Bulk operation result
   * @throws {DatabaseError} When database operation fails
   */
  async bulkWrite(operations) {
    throw new Error('Interface method must be implemented');
  }
}

module.exports = {
  ICollectionService,
  IActivityService,
  ISearchService,
  IImageManager,
  IRepository,
};