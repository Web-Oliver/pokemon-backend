/**
 * Pagination Validator
 *
 * Specialized validator for pagination parameters
 * Handles page, limit, sorting, and other pagination-related validations
 */

import BaseValidator from './BaseValidator.js';
import ValidationErrors from './ValidationErrors.js';
import ValidationRules from './ValidationRules.js';
/**
 * Pagination validation specialist
 * Handles all pagination-related validation scenarios
 */
class PaginationValidator extends BaseValidator {
  /**
   * Validate pagination parameters
   * @param {Object} params - Pagination parameters
   * @param {number} params.page - Page number
   * @param {number} params.limit - Items per page
   * @param {string} params.sort - Sort field
   * @param {string} params.order - Sort order ('asc' or 'desc')
   * @param {Object} options - Validation options
   * @param {number} options.maxLimit - Maximum allowed limit
   * @param {Array} options.allowedSortFields - Allowed sort fields
   * @param {Object} options.defaults - Default values
   * @returns {Object} Validated and normalized pagination parameters
   * @throws {ValidationError} If validation fails
   */
  static validatePaginationParams(params, options = {}) {
    const {
      maxLimit = ValidationRules.PAGINATION.LIMIT_MAX,
      allowedSortFields = null,
      defaults = {
        page: ValidationRules.PAGINATION.PAGE_DEFAULT,
        limit: ValidationRules.PAGINATION.LIMIT_DEFAULT,
        sort: null,
        order: 'asc'
      }
    } = options;

    this.validateType(params, 'object', 'Pagination parameters', true);

    const validatedParams = {};

    // Validate page parameter
    const page = params.page !== undefined ? params.page : defaults.page;

    validatedParams.page = this.validatePage(page);

    // Validate limit parameter
    const limit = params.limit !== undefined ? params.limit : defaults.limit;

    validatedParams.limit = this.validateLimit(limit, { maxLimit });

    // Validate sort parameter
    if (params.sort !== undefined || defaults.sort) {
      const sort = params.sort || defaults.sort;

      validatedParams.sort = this.validateSortField(sort, { allowedSortFields });
    }

    // Validate order parameter
    if (params.order !== undefined || params.sort !== undefined || defaults.sort) {
      const order = params.order || defaults.order;

      validatedParams.order = this.validateSortOrder(order);
    }

    // Calculate derived values
    validatedParams.skip = (validatedParams.page - 1) * validatedParams.limit;
    validatedParams.offset = validatedParams.skip; // Alias for different naming conventions

    return validatedParams;
  }

  /**
   * Validate page number
   * @param {any} page - Page number to validate
   * @param {Object} options - Validation options
   * @returns {number} Validated page number
   * @throws {ValidationError} If validation fails
   */
  static validatePage(page = ValidationRules.PAGINATION.PAGE_DEFAULT, options = {}) {
    const { required = false } = options;

    if (page === null || page === undefined) {
      if (required) {
        throw ValidationErrors.required('Page');
      }
      return ValidationRules.PAGINATION.PAGE_DEFAULT;
    }

    // Parse string numbers
    let pageNum = page;

    if (typeof page === 'string') {
      pageNum = parseInt(page, 10);
      if (isNaN(pageNum)) {
        throw ValidationErrors.custom('Page', 'Page must be a valid number', page);
      }
    }

    // Validate number type and range
    this.validateNumber(pageNum, 'Page', {
      required: false,
      min: ValidationRules.PAGINATION.PAGE_MIN,
      integer: true
    });

    return pageNum;
  }

  /**
   * Validate limit parameter
   * @param {any} limit - Limit to validate
   * @param {Object} options - Validation options
   * @param {number} options.maxLimit - Maximum allowed limit
   * @returns {number} Validated limit
   * @throws {ValidationError} If validation fails
   */
  static validateLimit(limit = ValidationRules.PAGINATION.LIMIT_DEFAULT, options = {}) {
    const {
      required = false,
      maxLimit = ValidationRules.PAGINATION.LIMIT_MAX
    } = options;

    if (limit === null || limit === undefined) {
      if (required) {
        throw ValidationErrors.required('Limit');
      }
      return ValidationRules.PAGINATION.LIMIT_DEFAULT;
    }

    // Parse string numbers
    let limitNum = limit;

    if (typeof limit === 'string') {
      limitNum = parseInt(limit, 10);
      if (isNaN(limitNum)) {
        throw ValidationErrors.custom('Limit', 'Limit must be a valid number', limit);
      }
    }

    // Validate number type and range
    this.validateNumber(limitNum, 'Limit', {
      required: false,
      min: ValidationRules.PAGINATION.LIMIT_MIN,
      max: maxLimit,
      integer: true
    });

    return limitNum;
  }

  /**
   * Validate sort field
   * @param {any} sortField - Sort field to validate
   * @param {Object} options - Validation options
   * @param {Array} options.allowedSortFields - Allowed sort fields
   * @returns {string} Validated sort field
   * @throws {ValidationError} If validation fails
   */
  static validateSortField(sortField, options = {}) {
    const { allowedSortFields = null, required = false } = options;

    if (sortField === null || sortField === undefined) {
      if (required) {
        throw ValidationErrors.required('Sort field');
      }
      return null;
    }

    this.validateString(sortField, 'Sort field', {
      required: false,
      minLength: 1,
      maxLength: 100,
      pattern: 'alphanumeric_underscore'
    });

    // Check against allowed fields if specified
    if (allowedSortFields && allowedSortFields.length > 0) {
      if (!allowedSortFields.includes(sortField)) {
        throw ValidationErrors.invalidEnum('Sort field', allowedSortFields, sortField);
      }
    }

    return sortField;
  }

  /**
   * Validate sort order
   * @param {any} sortOrder - Sort order to validate
   * @returns {string} Validated sort order
   * @throws {ValidationError} If validation fails
   */
  static validateSortOrder(sortOrder = 'asc') {
    if (sortOrder === null || sortOrder === undefined) {
      return 'asc';
    }

    this.validateEnum(sortOrder, 'SORT_ORDERS', 'Sort order', false);

    return sortOrder.toLowerCase();
  }

  /**
   * Validate search parameters with pagination
   * @param {Object} params - Search and pagination parameters
   * @param {Object} options - Validation options
   * @returns {Object} Validated search and pagination parameters
   * @throws {ValidationError} If validation fails
   */
  static validateSearchParams(params, options = {}) {
    const {
      maxLimit = ValidationRules.PAGINATION.LIMIT_MAX,
      allowedSortFields = null,
      allowedSearchTypes = ValidationRules.ENUMS.SEARCH_TYPES
    } = options;

    this.validateType(params, 'object', 'Search parameters', true);

    const validatedParams = {};

    // Validate search term
    if (params.searchTerm !== undefined) {
      this.validateString(params.searchTerm, 'Search term', {
        required: false,
        minLength: 1,
        maxLength: 200
      });
      validatedParams.searchTerm = params.searchTerm;
    }

    // Validate search type
    if (params.searchType !== undefined) {
      this.validateEnum(params.searchType, allowedSearchTypes, 'Search type', false);
      validatedParams.searchType = params.searchType;
    }

    // Validate pagination parameters
    const paginationParams = this.validatePaginationParams(params, {
      maxLimit,
      allowedSortFields
    });

    return {
      ...validatedParams,
      ...paginationParams
    };
  }

  /**
   * Validate cursor-based pagination parameters
   * @param {Object} params - Cursor pagination parameters
   * @param {string} params.cursor - Cursor for next page
   * @param {number} params.limit - Items per page
   * @param {Object} options - Validation options
   * @returns {Object} Validated cursor pagination parameters
   * @throws {ValidationError} If validation fails
   */
  static validateCursorPagination(params, options = {}) {
    const { maxLimit = ValidationRules.PAGINATION.LIMIT_MAX } = options;

    this.validateType(params, 'object', 'Cursor pagination parameters', true);

    const validatedParams = {};

    // Validate cursor
    if (params.cursor !== undefined) {
      this.validateString(params.cursor, 'Cursor', {
        required: false,
        minLength: 1,
        maxLength: 500
      });
      validatedParams.cursor = params.cursor;
    }

    // Validate limit
    validatedParams.limit = this.validateLimit(params.limit, { maxLimit });

    // Validate direction (for bi-directional cursor pagination)
    if (params.direction !== undefined) {
      const allowedDirections = ['forward', 'backward', 'next', 'prev'];

      this.validateEnum(params.direction, allowedDirections, 'Direction', false);
      validatedParams.direction = params.direction;
    }

    return validatedParams;
  }

  /**
   * Create pagination metadata object
   * @param {Object} params - Pagination parameters
   * @param {number} totalCount - Total number of items
   * @returns {Object} Pagination metadata
   */
  static createPaginationMetadata(params, totalCount) {
    const { page, limit } = params;
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNextPage,
      hasPreviousPage,
      nextPage: hasNextPage ? page + 1 : null,
      previousPage: hasPreviousPage ? page - 1 : null,
      skip: (page - 1) * limit,
      offset: (page - 1) * limit
    };
  }

  /**
   * Normalize query parameters for pagination
   * @param {Object} query - Raw query parameters (e.g., from req.query)
   * @param {Object} options - Normalization options
   * @returns {Object} Normalized parameters
   */
  static normalizeQueryParams(query, options = {}) {
    const {
      pageParam = 'page',
      limitParam = 'limit',
      sortParam = 'sort',
      orderParam = 'order'
    } = options;

    return {
      page: query[pageParam],
      limit: query[limitParam],
      sort: query[sortParam],
      order: query[orderParam]
    };
  }

  /**
   * Safe pagination validation - returns result object instead of throwing
   * @param {Object} params - Pagination parameters to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static safeValidatePagination(params, options = {}) {
    try {
      const validatedParams = this.validatePaginationParams(params, options);

      return {
        isValid: true,
        params: validatedParams,
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        params: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Create a pagination validator instance for fluent validation
   * @returns {PaginationValidatorInstance} Pagination validator instance
   */
  static create() {
    return new PaginationValidatorInstance();
  }
}

/**
 * Fluent pagination validator instance for chaining validations
 */
class PaginationValidatorInstance {
  constructor() {
    this.validations = [];
    this.currentParams = {};
    this.options = {};
  }

  /**
   * Set the pagination parameters to validate
   * @param {Object} params - Pagination parameters
   * @returns {PaginationValidatorInstance} This instance for chaining
   */
  params(params) {
    this.currentParams = params;
    return this;
  }

  /**
   * Set maximum limit
   * @param {number} maxLimit - Maximum limit
   * @returns {PaginationValidatorInstance} This instance for chaining
   */
  maxLimit(maxLimit) {
    this.options.maxLimit = maxLimit;
    return this;
  }

  /**
   * Set allowed sort fields
   * @param {Array} fields - Array of allowed sort fields
   * @returns {PaginationValidatorInstance} This instance for chaining
   */
  allowedSortFields(fields) {
    this.options.allowedSortFields = fields;
    return this;
  }

  /**
   * Set default values
   * @param {Object} defaults - Default values
   * @returns {PaginationValidatorInstance} This instance for chaining
   */
  defaults(defaults) {
    this.options.defaults = defaults;
    return this;
  }

  /**
   * Require pagination parameters
   * @returns {PaginationValidatorInstance} This instance for chaining
   */
  required() {
    this.validations.push(() => {
      if (!this.currentParams.page && !this.currentParams.limit) {
        throw ValidationErrors.required('Pagination parameters');
      }
    });
    return this;
  }

  /**
   * Enforce minimum limit
   * @param {number} minLimit - Minimum limit
   * @returns {PaginationValidatorInstance} This instance for chaining
   */
  minLimit(minLimit) {
    this.validations.push(() => {
      const limit = this.currentParams.limit || ValidationRules.PAGINATION.LIMIT_DEFAULT;

      if (limit < minLimit) {
        throw ValidationErrors.outOfRange('Limit', minLimit, undefined, limit);
      }
    });
    return this;
  }

  /**
   * Include search validation
   * @returns {PaginationValidatorInstance} This instance for chaining
   */
  withSearch() {
    this.includeSearch = true;
    return this;
  }

  /**
   * Execute all validations
   * @returns {Object} Validated pagination parameters
   * @throws {ValidationError} If any validation fails
   */
  validate() {
    // Choose validation method based on configuration
    let validatedParams;

    if (this.includeSearch) {
      validatedParams = PaginationValidator.validateSearchParams(this.currentParams, this.options);
    } else {
      validatedParams = PaginationValidator.validatePaginationParams(this.currentParams, this.options);
    }

    // Update current params for additional validations
    this.currentParams = validatedParams;

    // Run additional validations
    this.validations.forEach(validation => validation());

    return validatedParams;
  }

  /**
   * Create pagination metadata
   * @param {number} totalCount - Total count of items
   * @returns {Object} Pagination metadata
   */
  createMetadata(totalCount) {
    return PaginationValidator.createPaginationMetadata(this.currentParams, totalCount);
  }
}

export default PaginationValidator;
