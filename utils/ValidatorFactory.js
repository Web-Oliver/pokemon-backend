const mongoose = require('mongoose');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Validator Factory
 *
 * Provides reusable validation methods to eliminate DRY violations.
 * Centralizes common validation logic used across services and controllers.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles data validation only
 * - Open/Closed: Extensible for new validation types
 * - Interface Segregation: Specific validation methods for specific needs
 * - Dependency Inversion: Uses ValidationError abstraction
 */
class ValidatorFactory {
  /**
   * Validates price values
   * @param {any} price - Price value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {ValidationError} - If validation fails
   */
  static price(price, fieldName = 'Price') {
    if (price === null || price === undefined) {
      return; // Allow null/undefined prices
    }

    if (typeof price !== 'number') {
      throw new ValidationError(`${fieldName} must be a number`);
    }

    if (price < 0) {
      throw new ValidationError(`${fieldName} must be a non-negative number`);
    }

    if (!isFinite(price)) {
      throw new ValidationError(`${fieldName} must be a finite number`);
    }
  }

  /**
   * Validates MongoDB ObjectId
   * @param {any} id - ID value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {ValidationError} - If validation fails
   */
  static objectId(id, fieldName = 'ID') {
    if (!id) {
      throw new ValidationError(`${fieldName} is required`);
    }

    if (typeof id !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError(`${fieldName} must be a valid ObjectId`);
    }
  }

  /**
   * Validates array of images
   * @param {any} images - Images array to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {ValidationError} - If validation fails
   */
  static imageArray(images, fieldName = 'Images') {
    if (images === null || images === undefined) {
      return; // Allow null/undefined images
    }

    if (!Array.isArray(images)) {
      throw new ValidationError(`${fieldName} must be an array`);
    }

    // Validate each image entry
    images.forEach((image, index) => {
      if (typeof image !== 'string' || image.trim() === '') {
        throw new ValidationError(`${fieldName}[${index}] must be a non-empty string`);
      }
    });
  }

  /**
   * Validates required field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {ValidationError} - If validation fails
   */
  static required(value, fieldName = 'Field') {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  /**
   * Validates string field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {number} options.minLength - Minimum length
   * @param {number} options.maxLength - Maximum length
   * @param {boolean} options.required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static string(value, fieldName = 'String field', options = {}) {
    const { minLength, maxLength, required = false } = options;

    if (required && (value === null || value === undefined || value === '')) {
      throw new ValidationError(`${fieldName} is required`);
    }

    if (value === null || value === undefined) {
      return; // Allow null/undefined for non-required fields
    }

    if (typeof value !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`);
    }

    if (minLength !== undefined && value.length < minLength) {
      throw new ValidationError(`${fieldName} must be at least ${minLength} characters long`);
    }

    if (maxLength !== undefined && value.length > maxLength) {
      throw new ValidationError(`${fieldName} must be no more than ${maxLength} characters long`);
    }
  }

  /**
   * Validates number field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {number} options.min - Minimum value
   * @param {number} options.max - Maximum value
   * @param {boolean} options.required - Whether field is required
   * @param {boolean} options.integer - Whether value must be integer
   * @throws {ValidationError} - If validation fails
   */
  static number(value, fieldName = 'Number field', options = {}) {
    const { min, max, required = false, integer = false } = options;

    if (required && (value === null || value === undefined)) {
      throw new ValidationError(`${fieldName} is required`);
    }

    if (value === null || value === undefined) {
      return; // Allow null/undefined for non-required fields
    }

    if (typeof value !== 'number') {
      throw new ValidationError(`${fieldName} must be a number`);
    }

    if (!isFinite(value)) {
      throw new ValidationError(`${fieldName} must be a finite number`);
    }

    if (integer && !Number.isInteger(value)) {
      throw new ValidationError(`${fieldName} must be an integer`);
    }

    if (min !== undefined && value < min) {
      throw new ValidationError(`${fieldName} must be at least ${min}`);
    }

    if (max !== undefined && value > max) {
      throw new ValidationError(`${fieldName} must be no more than ${max}`);
    }
  }

  /**
   * Validates boolean field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static boolean(value, fieldName = 'Boolean field', required = false) {
    if (required && (value === null || value === undefined)) {
      throw new ValidationError(`${fieldName} is required`);
    }

    if (value === null || value === undefined) {
      return; // Allow null/undefined for non-required fields
    }

    if (typeof value !== 'boolean') {
      throw new ValidationError(`${fieldName} must be a boolean`);
    }
  }

  /**
   * Validates email format
   * @param {any} email - Email to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static email(email, fieldName = 'Email', required = false) {
    if (required && (!email || email.trim() === '')) {
      throw new ValidationError(`${fieldName} is required`);
    }

    if (!email || email.trim() === '') {
      return; // Allow empty for non-required fields
    }

    if (typeof email !== 'string') {
      throw new ValidationError(`${fieldName} must be a string`);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      throw new ValidationError(`${fieldName} must be a valid email address`);
    }
  }

  /**
   * Validates date field
   * @param {any} date - Date to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static date(date, fieldName = 'Date', required = false) {
    if (required && !date) {
      throw new ValidationError(`${fieldName} is required`);
    }

    if (!date) {
      return; // Allow null/undefined for non-required fields
    }

    const dateObj = new Date(date);

    if (isNaN(dateObj.getTime())) {
      throw new ValidationError(`${fieldName} must be a valid date`);
    }
  }

  /**
   * Validates enum/choice field
   * @param {any} value - Value to validate
   * @param {Array} choices - Array of valid choices
   * @param {string} fieldName - Name of the field for error messages
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static enum(value, choices, fieldName = 'Field', required = false) {
    if (required && (value === null || value === undefined)) {
      throw new ValidationError(`${fieldName} is required`);
    }

    if (value === null || value === undefined) {
      return; // Allow null/undefined for non-required fields
    }

    if (!choices || !Array.isArray(choices)) {
      throw new ValidationError('Validation choices must be an array');
    }

    if (!choices.includes(value)) {
      throw new ValidationError(`${fieldName} must be one of: ${choices.join(', ')}`);
    }
  }

  /**
   * Validates MongoDB collection item data
   * @param {Object} data - Data object to validate
   * @param {string} entityType - Type of entity for context
   * @throws {ValidationError} - If validation fails
   */
  static collectionItemData(data, entityType = 'Item') {
    this.required(data, `${entityType} data`);

    if (typeof data !== 'object') {
      throw new ValidationError(`${entityType} data must be an object`);
    }

    // Validate common collection item fields
    if (data.myPrice !== undefined) {
      this.price(data.myPrice, 'Price');
    }

    if (data.images !== undefined) {
      this.imageArray(data.images, 'Images');
    }

    if (data.sold !== undefined) {
      this.boolean(data.sold, 'Sold status');
    }

    if (data.dateAdded !== undefined) {
      this.date(data.dateAdded, 'Date added');
    }
  }

  /**
   * Validates sale details object
   * @param {Object} saleDetails - Sale details to validate
   * @throws {ValidationError} - If validation fails
   */
  static saleDetails(saleDetails) {
    this.required(saleDetails, 'Sale details');

    if (typeof saleDetails !== 'object') {
      throw new ValidationError('Sale details must be an object');
    }

    // Validate price if provided
    if (saleDetails.actualSoldPrice !== undefined) {
      this.price(saleDetails.actualSoldPrice, 'Actual sold price');
    }

    // Validate payment method if provided
    if (saleDetails.paymentMethod !== undefined) {
      this.enum(
        saleDetails.paymentMethod,
        ['cash', 'card', 'bank_transfer', 'paypal', 'other'],
        'Payment method'
      );
    }

    // Validate delivery method if provided
    if (saleDetails.deliveryMethod !== undefined) {
      this.enum(
        saleDetails.deliveryMethod,
        ['pickup', 'shipping', 'delivery', 'other'],
        'Delivery method'
      );
    }

    // Validate email if provided
    if (saleDetails.buyerEmail !== undefined && saleDetails.buyerEmail !== '') {
      this.email(saleDetails.buyerEmail, 'Buyer email');
    }

    // Validate date sold if provided
    if (saleDetails.dateSold !== undefined) {
      this.date(saleDetails.dateSold, 'Date sold');
    }
  }

  /**
   * Validates pagination parameters
   * @param {Object} params - Pagination parameters
   * @throws {ValidationError} - If validation fails
   */
  static paginationParams(params = {}) {
    if (params.page !== undefined) {
      this.number(params.page, 'Page', { min: 1, integer: true });
    }

    if (params.limit !== undefined) {
      this.number(params.limit, 'Limit', { min: 1, max: 1000, integer: true });
    }

    if (params.sort !== undefined) {
      this.string(params.sort, 'Sort parameter');
    }
  }

  /**
   * Validates search parameters
   * @param {Object} params - Search parameters
   * @throws {ValidationError} - If validation fails
   */
  static searchParams(params = {}) {
    if (params.searchTerm !== undefined) {
      this.string(params.searchTerm, 'Search term', { minLength: 1, maxLength: 200 });
    }

    if (params.searchType !== undefined) {
      this.enum(
        params.searchType,
        ['fuse', 'mongo_text', 'aggregate'],
        'Search type'
      );
    }

    // Validate pagination if included
    this.paginationParams(params);
  }
}

module.exports = ValidatorFactory;