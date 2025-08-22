/**
 * Sales Validator
 *
 * Specialized validator for sales-related validation
 * Consolidates existing SalesValidationUtils into the new validation architecture
 */

import BaseValidator from './BaseValidator.js';
import ValidationErrors from './ValidationErrors.js';
import ValidationRules from './ValidationRules.js';
import DateValidator from './DateValidator.js';
import PriceValidator from './PriceValidator.js';
import EmailValidator from './EmailValidator.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
/**
 * Sales validation specialist
 * Handles all sales-related validation scenarios
 */
class SalesValidator extends BaseValidator {
  /**
   * Validate sales query parameters
   * @param {Object} params - Query parameters
   * @param {string} params.category - Sales category filter
   * @param {string} params.startDate - Start date for range filter
   * @param {string} params.endDate - End date for range filter
   * @param {Object} options - Validation options
   * @param {string} options.context - Logging context for error tracking
   * @returns {Object} Validation result with normalized parameters
   * @throws {ValidationError} If validation fails
   */
  static validateSalesQueryParams(params, options = {}) {
    const { context = 'SALES_VALIDATION' } = options;
    const { category, startDate, endDate } = params;

    this.validateType(params, 'object', 'Sales query parameters', true);

    const validatedParams = {};

    // Validate category if provided
    if (category !== null && category !== undefined) {
      this.validateEnum(category, 'SALES_CATEGORIES', 'category', false);
      validatedParams.category = category;
    }

    // Validate date range if provided
    if (startDate || endDate) {
      const dateResult = DateValidator.validateDateRange(startDate, endDate, {
        required: false,
        allowSameDay: true,
        context
      });

      validatedParams.startDate = dateResult.startDate;
      validatedParams.endDate = dateResult.endDate;
    }

    return {
      isValid: true,
      params: validatedParams,
      errors: []
    };
  }

  /**
   * Validate sales category
   * @param {string} category - Category to validate
   * @returns {Object} Validation result
   */
  static validateSalesCategory(category) {
    try {
      this.validateEnum(category, 'SALES_CATEGORIES', 'category', false);
      return {
        isValid: true,
        category,
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        category: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Validate sales date range parameters
   * @param {string} startDate - Start date string
   * @param {string} endDate - End date string
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateSalesDateRange(startDate, endDate, options = {}) {
    const { context = 'SALES_DATE_VALIDATION' } = options;

    try {
      const result = DateValidator.validateDateRange(startDate, endDate, {
        required: false,
        allowSameDay: true,
        context
      });

      return {
        isValid: true,
        startDate: result.startDate,
        endDate: result.endDate,
        errors: []
      };
    } catch (error) {
      return {
        isValid: false,
        startDate: null,
        endDate: null,
        errors: [error.message]
      };
    }
  }

  /**
   * Validate and throw error if validation fails
   * @param {Object} params - Parameters to validate
   * @param {Object} options - Validation options
   * @throws {ValidationError} When validation fails
   */
  static validateSalesParamsOrThrow(params, options = {}) {
    const { context = 'SALES_VALIDATION', operation = 'SALES_OPERATION' } = options;

    const validation = this.validateSalesQueryParams(params, { context });

    if (!validation.isValid) {
      const error = ValidationErrors.create(
        `Validation failed: ${validation.errors.join(', ')}`,
        'Sales parameters',
        params,
        { operation, context }
      );

      Logger.operationError(
        `${operation}_VALIDATION_FAILED`,
        `${operation.toLowerCase().replace('_', ' ')} validation failed`,
        error,
        {
          validationErrors: validation.errors,
          providedParams: params
        }
      );

      throw error;
    }

    return validation.params;
  }

  /**
   * Validate sale details object
   * @param {Object} saleDetails - Sale details to validate
   * @throws {ValidationError} If validation fails
   */
  static validateSaleDetails(saleDetails) {
    this.validateRequired(saleDetails, 'Sale details');
    this.validateType(saleDetails, 'object', 'Sale details', true);

    // Validate price if provided
    if (saleDetails.actualSoldPrice !== undefined) {
      PriceValidator.validatePrice(saleDetails.actualSoldPrice, 'Actual sold price', {
        required: false,
        allowZero: false
      });
    }

    // Validate original price if provided
    if (saleDetails.originalPrice !== undefined) {
      PriceValidator.validatePrice(saleDetails.originalPrice, 'Original price', {
        required: false,
        allowZero: true
      });
    }

    // Validate payment method if provided
    if (saleDetails.paymentMethod !== undefined) {
      this.validateEnum(
        saleDetails.paymentMethod,
        'PAYMENT_METHODS',
        'Payment method',
        false
      );
    }

    // Validate delivery method if provided
    if (saleDetails.deliveryMethod !== undefined) {
      this.validateEnum(
        saleDetails.deliveryMethod,
        'DELIVERY_METHODS',
        'Delivery method',
        false
      );
    }

    // Validate buyer email if provided
    if (saleDetails.buyerEmail !== undefined && saleDetails.buyerEmail !== '') {
      EmailValidator.validateBusinessEmail(saleDetails.buyerEmail, 'buyer', {
        required: false
      });
    }

    // Validate date sold if provided
    if (saleDetails.dateSold !== undefined) {
      DateValidator.validateDate(saleDetails.dateSold, 'Date sold', {
        required: false,
        pastOnly: true
      });
    }

    // Business logic validation
    this._validateSaleDetailsBusinessLogic(saleDetails);
  }

  /**
   * Validate collection item sale data
   * @param {Object} itemData - Collection item data
   * @throws {ValidationError} If validation fails
   */
  static validateCollectionItemSaleData(itemData) {
    this.validateRequired(itemData, 'Collection item data');
    this.validateType(itemData, 'object', 'Collection item data', true);

    // Validate sold status
    if (itemData.sold !== undefined) {
      this.validateType(itemData.sold, 'boolean', 'Sold status', false);
    }

    // If item is sold, validate sale details
    if (itemData.sold && itemData.saleDetails) {
      this.validateSaleDetails(itemData.saleDetails);
    }

    // Validate pricing information
    PriceValidator.validateCollectionItemPricing(itemData);
  }

  /**
   * Validate sales analytics parameters
   * @param {Object} params - Analytics parameters
   * @throws {ValidationError} If validation fails
   */
  static validateSalesAnalyticsParams(params) {
    this.validateType(params, 'object', 'Sales analytics parameters', true);

    // Validate basic query parameters
    const validatedParams = this.validateSalesParamsOrThrow(params, {
      context: 'SALES_ANALYTICS_VALIDATION',
      operation: 'SALES_ANALYTICS'
    });

    // Additional analytics-specific validation
    if (params.groupBy !== undefined) {
      const allowedGroupBy = ['day', 'week', 'month', 'year', 'category'];

      this.validateEnum(params.groupBy, allowedGroupBy, 'groupBy', false);
      validatedParams.groupBy = params.groupBy;
    }

    if (params.sortBy !== undefined) {
      const allowedSortBy = ['date', 'amount', 'quantity', 'category'];

      this.validateEnum(params.sortBy, allowedSortBy, 'sortBy', false);
      validatedParams.sortBy = params.sortBy;
    }

    if (params.sortOrder !== undefined) {
      this.validateEnum(params.sortOrder, 'SORT_ORDERS', 'sortOrder', false);
      validatedParams.sortOrder = params.sortOrder;
    }

    return validatedParams;
  }

  /**
   * Handle service errors consistently across sales operations
   * @param {Error} error - Error from sales service
   * @param {Object} params - Original request parameters
   * @param {Object} options - Error handling options
   * @throws {ValidationError|Error} Processed error
   */
  static handleSalesServiceError(error, params, options = {}) {
    const { operation = 'SALES_OPERATION', context = 'SALES_SERVICE_ERROR' } = options;
    const { category, startDate, endDate } = params;

    if (error.message.includes('Invalid') || error.name === 'ValidationError') {
      Logger.operationError(
        `${operation}_VALIDATION_ERROR`,
        `${operation.toLowerCase().replace('_', ' ')} validation error`,
        error,
        { category, startDate, endDate }
      );
      throw ValidationErrors.create(error.message, 'Sales service', params, { operation });
    }

    Logger.operationError(
      `${operation}_FAILED`,
      `Failed to ${operation.toLowerCase().replace('_', ' ')}`,
      error,
      { category, startDate, endDate }
    );

    throw error;
  }

  /**
   * Log successful sales operations
   * @param {string} operation - Operation identifier
   * @param {string} message - Success message
   * @param {Object} params - Request parameters
   * @param {Object} result - Operation result
   */
  static logSalesOperationSuccess(operation, message, params, result = {}) {
    const { category, startDate, endDate } = params;

    Logger.operationSuccess(operation, message, {
      category: category || 'all',
      startDate,
      endDate,
      hasDateFilter: Boolean(startDate || endDate),
      ...result
    });
  }

  /**
   * Private helper methods
   */
  static _validateSaleDetailsBusinessLogic(saleDetails) {
    const { actualSoldPrice, originalPrice, discountAmount, shippingCost } = saleDetails;

    // Validate price relationships
    if (actualSoldPrice !== undefined && originalPrice !== undefined && discountAmount !== undefined) {
      const expectedSoldPrice = originalPrice - discountAmount;
      const tolerance = 0.01; // Allow for rounding differences

      if (Math.abs(actualSoldPrice - expectedSoldPrice) > tolerance) {
        throw ValidationErrors.custom(
          'Sale details',
          'Actual sold price does not match original price minus discount',
          saleDetails,
          { actualSoldPrice, originalPrice, discountAmount, expectedSoldPrice }
        );
      }
    }

    // Validate discount doesn't exceed original price
    if (originalPrice !== undefined && discountAmount !== undefined && discountAmount > originalPrice) {
      throw ValidationErrors.custom(
        'Sale details',
        'Discount amount cannot exceed original price',
        saleDetails,
        { originalPrice, discountAmount }
      );
    }

    // Validate total calculation if shipping is included
    if (actualSoldPrice !== undefined && originalPrice !== undefined && shippingCost !== undefined) {
      const totalWithShipping = actualSoldPrice + shippingCost;

      // Just log this for now, might be business logic specific
      Logger.debug('Sale calculation check', {
        actualSoldPrice,
        originalPrice,
        shippingCost,
        totalWithShipping
      });
    }
  }

  /**
   * Create a sales validator instance for fluent validation
   * @returns {SalesValidatorInstance} Sales validator instance
   */
  static create() {
    return new SalesValidatorInstance();
  }
}

/**
 * Pre-configured sales validators for common operations
 */
class SalesValidators {
  /**
   * Validate parameters for getSales operation
   */
  static validateGetSalesParams(params) {
    return SalesValidator.validateSalesParamsOrThrow(params, {
      context: 'SALES_QUERY_VALIDATION',
      operation: 'GET_SALES_DATA'
    });
  }

  /**
   * Validate parameters for getSalesSummary operation
   */
  static validateGetSalesSummaryParams(params) {
    return SalesValidator.validateSalesParamsOrThrow(params, {
      context: 'SALES_SUMMARY_VALIDATION',
      operation: 'GET_SALES_SUMMARY'
    });
  }

  /**
   * Validate parameters for getSalesGraphData operation
   */
  static validateGetSalesGraphDataParams(params) {
    return SalesValidator.validateSalesParamsOrThrow(params, {
      context: 'SALES_GRAPH_VALIDATION',
      operation: 'GET_SALES_GRAPH_DATA'
    });
  }
}

/**
 * Sales service error handlers for each operation
 */
class SalesErrorHandlers {
  static handleGetSalesError(error, params) {
    return SalesValidator.handleSalesServiceError(error, params, {
      operation: 'SALES_DATA_FETCH',
      context: 'SALES_DATA_FETCH_ERROR'
    });
  }

  static handleGetSalesSummaryError(error, params) {
    return SalesValidator.handleSalesServiceError(error, params, {
      operation: 'SALES_SUMMARY_CALCULATION',
      context: 'SALES_SUMMARY_ERROR'
    });
  }

  static handleGetSalesGraphDataError(error, params) {
    return SalesValidator.handleSalesServiceError(error, params, {
      operation: 'SALES_GRAPH_GENERATION',
      context: 'SALES_GRAPH_ERROR'
    });
  }
}

/**
 * Sales operation success loggers
 */
class SalesSuccessLoggers {
  static logGetSalesSuccess(params, result) {
    SalesValidator.logSalesOperationSuccess(
      'GET_SALES_DATA',
      'Successfully fetched sales data',
      params,
      { resultsCount: result.length }
    );
  }

  static logGetSalesSummarySuccess(params, result) {
    SalesValidator.logSalesOperationSuccess(
      'GET_SALES_SUMMARY',
      'Successfully calculated sales summary',
      params,
      {
        salesDataCount: result.salesDataCount || 0,
        summaryMetrics: {
          totalSales: result.totalSales || 0,
          totalValue: result.totalValue || 0,
          averageValue: result.averageValue || 0
        }
      }
    );
  }

  static logGetSalesGraphDataSuccess(params, result) {
    SalesValidator.logSalesOperationSuccess(
      'GET_SALES_GRAPH_DATA',
      'Successfully generated sales graph data',
      params,
      {
        salesDataCount: result.salesDataCount || 0,
        graphDataPoints: Array.isArray(result.graphData)
          ? result.graphData.length
          : Object.keys(result.graphData || {}).length
      }
    );
  }
}

/**
 * Fluent sales validator instance for chaining validations
 */
class SalesValidatorInstance {
  constructor() {
    this.validations = [];
    this.currentParams = {};
    this.context = 'SALES_VALIDATION';
  }

  /**
   * Set the sales parameters to validate
   * @param {Object} params - Sales parameters
   * @returns {SalesValidatorInstance} This instance for chaining
   */
  params(params) {
    this.currentParams = params;
    return this;
  }

  /**
   * Set validation context
   * @param {string} context - Validation context
   * @returns {SalesValidatorInstance} This instance for chaining
   */
  context(context) {
    this.context = context;
    return this;
  }

  /**
   * Require category parameter
   * @returns {SalesValidatorInstance} This instance for chaining
   */
  requireCategory() {
    this.validations.push(() => {
      if (!this.currentParams.category) {
        throw ValidationErrors.required('category');
      }
    });
    return this;
  }

  /**
   * Require date range
   * @returns {SalesValidatorInstance} This instance for chaining
   */
  requireDateRange() {
    this.validations.push(() => {
      if (!this.currentParams.startDate && !this.currentParams.endDate) {
        throw ValidationErrors.required('Date range');
      }
    });
    return this;
  }

  /**
   * Execute all validations
   * @returns {Object} Validated parameters
   * @throws {ValidationError} If any validation fails
   */
  validate() {
    // First validate basic sales parameters
    const result = SalesValidator.validateSalesQueryParams(this.currentParams, {
      context: this.context
    });

    if (!result.isValid) {
      throw ValidationErrors.create(
        `Validation failed: ${result.errors.join(', ')}`,
        'Sales parameters',
        this.currentParams
      );
    }

    // Update current params with validated values
    this.currentParams = result.params;

    // Then run additional validations
    this.validations.forEach(validation => validation());

    return this.currentParams;
  }
}

export {
  SalesValidator,
  SalesValidators,
  SalesErrorHandlers,
  SalesSuccessLoggers
};

export default SalesValidator;
