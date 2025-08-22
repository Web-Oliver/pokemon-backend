/**
 * Centralized Error Handler - Eliminates DRY violations
 *
 * Single Responsibility: Standardize error handling, logging, and response formatting
 * across all controllers and services in the application.
 *
 * Replaces 40+ repeated try-catch blocks with consistent error handling patterns.
 */

import { ValidationError, NotFoundError, AppError   } from '@/Presentation/Middleware/errorHandler.js';
/**
 * Error context types for consistent logging and handling
 */
const ERROR_CONTEXTS = {
  // DBA Operations
  DBA_EXPORT: 'DBA_EXPORT',
  DBA_POST: 'DBA_POST',
  DBA_STATUS: 'DBA_STATUS',
  DBA_TEST: 'DBA_TEST',
  DBA_SELECTION: 'DBA_SELECTION',

  // OCR Operations
  OCR_PROCESSING: 'OCR_PROCESSING',
  OCR_MATCHING: 'OCR_MATCHING',
  OCR_DETECTION: 'OCR_DETECTION',
  GOOGLE_VISION: 'GOOGLE_VISION',

  // Search Operations
  SEARCH_CARDS: 'SEARCH_CARDS',
  SEARCH_PRODUCTS: 'SEARCH_PRODUCTS',
  SEARCH_SETS: 'SEARCH_SETS',
  FLEXSEARCH: 'FLEXSEARCH',

  // Collection Operations
  COLLECTION_FETCH: 'COLLECTION_FETCH',
  BATCH_FETCH: 'BATCH_FETCH',
  ITEM_VALIDATION: 'ITEM_VALIDATION',

  // Sales Operations
  SALES_DATA: 'SALES_DATA',
  SALES_ANALYTICS: 'SALES_ANALYTICS',

  // Upload Operations
  UPLOAD: 'UPLOAD',
  THUMBNAIL: 'THUMBNAIL',

  // External API Operations
  FACEBOOK_POST: 'FACEBOOK_POST',
  EXTERNAL_API: 'EXTERNAL_API',

  // Database Operations
  DATABASE: 'DATABASE',
  MONGODB: 'MONGODB',

  // General Operations
  GENERAL: 'GENERAL',
  INITIALIZATION: 'INITIALIZATION'
};

/**
 * Centralized Error Handler Class
 */
class CentralizedErrorHandler {
  /**
   * Handle and log errors consistently across the application
   *
   * @param {string} context - Error context from ERROR_CONTEXTS
   * @param {string} operation - Description of the operation that failed
   * @param {Error} error - The error object
   * @param {Object} metadata - Additional context data
   * @param {Object} options - Handler options
   * @returns {void} - Throws the error for upstream handling
   */
  static handle(context, operation, error, metadata = {}, options = {}) {
    const {
      throwError = true,
      logLevel = 'error',
      includeStack = process.env.NODE_ENV !== 'production'
    } = options;

    // Validate context
    if (!ERROR_CONTEXTS[context]) {
      console.warn(`[ERROR HANDLER] Unknown context: ${context}. Using GENERAL.`);
      context = 'GENERAL';
    }

    // Format error log entry
    const logEntry = {
      context: `[${context}]`,
      operation: operation || 'Unknown operation',
      errorMessage: error?.message || 'Unknown error',
      errorName: error?.name || 'UnknownError',
      errorCode: error?.code || null,
      metadata,
      timestamp: new Date().toISOString()
    };

    // Add stack trace in development
    if (includeStack && error?.stack) {
      logEntry.stack = error.stack;
    }

    // Log error with consistent format
    this._logError(logLevel, logEntry);

    // Re-throw error for upstream handling if requested
    if (throwError) {
      throw error;
    }
  }

  /**
   * Handle async operation errors with automatic context detection
   *
   * @param {string} context - Error context from ERROR_CONTEXTS
   * @param {string} operation - Description of the operation
   * @param {Function} asyncOperation - The async operation to execute
   * @param {Object} metadata - Additional context data
   * @param {Object} options - Handler options
   * @returns {Promise<any>} - Result of the async operation
   */
  static async handleAsync(context, operation, asyncOperation, metadata = {}, options = {}) {
    try {
      const result = await asyncOperation();

      return result;
    } catch (error) {
      this.handle(context, operation, error, metadata, options);
    }
  }

  /**
   * Create a standardized error wrapper for route handlers
   *
   * @param {string} context - Error context from ERROR_CONTEXTS
   * @param {string} operation - Description of the operation
   * @param {Object} metadata - Additional context data
   * @returns {Function} - Express route handler wrapper
   */
  static wrapRoute(context, operation, metadata = {}) {
    return (asyncHandler) => async (req, res, next) => {
        try {
          await asyncHandler(req, res, next);
        } catch (error) {
          // Add request context to metadata
          const requestMetadata = {
            ...metadata,
            method: req.method,
            path: req.path,
            query: req.query,
            body: this._sanitizeBody(req.body),
            userAgent: req.get('user-agent'),
            ip: req.ip
          };

          this.handle(context, operation, error, requestMetadata, { throwError: false });
          next(error); // Pass to Express error handler
        }
      };
  }

  /**
   * Handle database operation errors with automatic retry logic
   *
   * @param {string} context - Error context from ERROR_CONTEXTS
   * @param {string} operation - Description of the database operation
   * @param {Function} dbOperation - The database operation to execute
   * @param {Object} options - Retry and error handling options
   * @returns {Promise<any>} - Result of the database operation
   */
  static async handleDatabaseOperation(context, operation, dbOperation, options = {}) {
    const {
      maxRetries = 3,
      retryDelay = 1000,
      retryableErrors = ['MongoNetworkError', 'MongoTimeoutError'],
      metadata = {}
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await dbOperation();

        // Log successful retry if this wasn't the first attempt
        if (attempt > 1) {
          console.log(`[${context}] ${operation} succeeded after ${attempt} attempts`);
        }

        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = retryableErrors.includes(error.name) ||
                           error.code === 'ECONNRESET' ||
                           error.code === 'ETIMEDOUT';

        if (attempt < maxRetries && isRetryable) {
          console.warn(`[${context}] ${operation} failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }

        // Final attempt failed or error is not retryable
        this.handle(context, operation, error, {
          ...metadata,
          attempt,
          maxRetries,
          isRetryable
        });
      }
    }
  }

  /**
   * Handle validation errors with field-specific details
   *
   * @param {string} context - Error context from ERROR_CONTEXTS
   * @param {Object} validationResult - Validation result object
   * @param {Object} metadata - Additional context data
   * @returns {ValidationError} - Standardized validation error
   */
  static handleValidationError(context, validationResult, metadata = {}) {
    const { isValid, errors, fieldErrors } = validationResult;

    if (isValid) {
      return null; // No error
    }

    const errorMessage = errors.length > 0 ? errors[0] : 'Validation failed';
    const validationError = new ValidationError(errorMessage);

    // Add field-specific error details
    if (fieldErrors && Object.keys(fieldErrors).length > 0) {
      validationError.fieldErrors = fieldErrors;
    }

    this.handle(context, 'Input validation failed', validationError, {
      ...metadata,
      validationErrors: errors,
      fieldErrors
    }, { throwError: false });

    return validationError;
  }

  /**
   * Create operation-specific error handlers for common patterns
   *
   * @param {string} context - Error context from ERROR_CONTEXTS
   * @param {Object} operations - Map of operation names to descriptions
   * @returns {Object} - Map of operation handlers
   */
  static createOperationHandlers(context, operations = {}) {
    const handlers = {};

    Object.entries(operations).forEach(([operationName, description]) => {
      handlers[operationName] = (error, metadata = {}) => {
        this.handle(context, description, error, metadata);
      };
    });

    return handlers;
  }

  /**
   * Log error with consistent formatting
   *
   * @private
   * @param {string} level - Log level (error, warn, info)
   * @param {Object} logEntry - Formatted log entry
   */
  static _logError(level, logEntry) {
    const logMessage = `${logEntry.context} ${logEntry.operation} failed: ${logEntry.errorMessage}`;

    switch (level) {
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'error':
      default:
        console.error(logMessage);
        break;
    }

    // Log additional details in development
    if (process.env.NODE_ENV !== 'production') {
      if (logEntry.errorName) console.error(`Error name: ${logEntry.errorName}`);
      if (logEntry.errorCode) console.error(`Error code: ${logEntry.errorCode}`);
      if (logEntry.metadata && Object.keys(logEntry.metadata).length > 0) {
        console.error('Metadata:', JSON.stringify(logEntry.metadata, null, 2));
      }
      if (logEntry.stack) console.error('Stack trace:', logEntry.stack);
    }
  }

  /**
   * Sanitize request body for logging (remove sensitive data)
   *
   * @private
   * @param {Object} body - Request body
   * @returns {Object} - Sanitized body
   */
  static _sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth'];

    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}

/**
 * Async wrapper utility for clean error handling
 *
 * @param {string} context - Error context from ERROR_CONTEXTS
 * @param {string} operation - Description of the operation
 * @param {Object} metadata - Additional context data
 * @returns {Function} - Wrapper function for async operations
 */
const withErrorHandler = (context, operation, metadata = {}) => (asyncFunction) => async (...args) => CentralizedErrorHandler.handleAsync(context, operation, () => asyncFunction(...args), metadata);

/**
 * Route wrapper for automatic error handling
 *
 * @param {string} context - Error context from ERROR_CONTEXTS
 * @param {string} operation - Description of the operation
 * @param {Object} metadata - Additional context data
 * @returns {Function} - Route wrapper function
 */
const withRouteErrorHandler = (context, operation, metadata = {}) => CentralizedErrorHandler.wrapRoute(context, operation, metadata);

export {
  CentralizedErrorHandler,
  ERROR_CONTEXTS,
  withErrorHandler,
  withRouteErrorHandler
};
export default CentralizedErrorHandler;;
