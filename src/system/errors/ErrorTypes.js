/**
 * Error Types and Definitions - Standardized Error Catalog
 *
 * Single Responsibility: Define all error types, messages, and handling strategies
 * used throughout the application for consistent error management.
 */

/**
 * Base Error Classes - Consolidated from errorHandler.js to eliminate duplication
 */

/**
 * Base Application Error
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Validation Error - 400 status code
 */
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

/**
 * Not Found Error - 404 status code
 */
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

/**
 * Database Error - 500 status code
 */
class DatabaseError extends AppError {
    constructor(message = 'Database operation failed') {
        super(message, 500);
    }
}

/**
 * External Service Error - 502 status code
 */
class ExternalServiceError extends AppError {
    constructor(message = 'External service unavailable') {
        super(message, 502);
    }
}

/**
 * Authentication Error - 401 status code
 */
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
    }
}

/**
 * Error Severity Levels
 */
const ERROR_SEVERITY = {
    LOW: 'low', // Non-critical errors that don't affect core functionality
    MEDIUM: 'medium', // Errors that affect functionality but have fallbacks
    HIGH: 'high', // Critical errors that significantly impact functionality
    CRITICAL: 'critical' // Errors that can cause system-wide issues
};

/**
 * Error Categories for better organization and handling
 */
const ERROR_CATEGORIES = {
    // Database related errors
    DATABASE: 'DATABASE',
    VALIDATION: 'VALIDATION',
    AUTHENTICATION: 'AUTHENTICATION',
    AUTHORIZATION: 'AUTHORIZATION',

    // External service errors
    EXTERNAL_API: 'EXTERNAL_API',
    NETWORK: 'NETWORK',
    RATE_LIMIT: 'RATE_LIMIT',

    // Application logic errors
    BUSINESS_LOGIC: 'BUSINESS_LOGIC',
    CONFIGURATION: 'CONFIGURATION',
    FILE_SYSTEM: 'FILE_SYSTEM',

    // Processing errors
    OCR_PROCESSING: 'OCR_PROCESSING',
    IMAGE_PROCESSING: 'IMAGE_PROCESSING',
    DATA_PROCESSING: 'DATA_PROCESSING'
};

/**
 * Standardized Error Messages by Context
 */
const ERROR_MESSAGES = {
    // DBA Export/Import Operations
    DBA_EXPORT: {
        NO_ITEMS: 'No items provided for DBA export',
        INVALID_ITEM_TYPE: 'Invalid item type provided',
        ITEM_NOT_FOUND: 'Item not found for DBA export',
        EXPORT_FAILED: 'DBA export generation failed',
        ZIP_CREATION_FAILED: 'Failed to create DBA export ZIP file',
        NO_EXPORT_DATA: 'No DBA export data found. Please generate export first.'
    },

    DBA_INTEGRATION: {
        POSTING_FAILED: 'Failed to post items to DBA.dk',
        STATUS_CHECK_FAILED: 'Failed to retrieve DBA integration status',
        TEST_FAILED: 'DBA integration test failed',
        AUTHENTICATION_FAILED: 'DBA.dk authentication failed'
    },

    DBA_SELECTION: {
        ITEM_ALREADY_SELECTED: 'Item is already selected for DBA',
        ITEM_NOT_IN_SELECTION: 'Item not found in DBA selection',
        BATCH_VALIDATION_FAILED: 'Batch item validation failed'
    },

    // OCR Processing Operations
    OCR_PROCESSING: {
        INVALID_IMAGE: 'Invalid or corrupted image provided',
        NO_TEXT_DETECTED: 'No text detected in the provided image',
        API_QUOTA_EXCEEDED: 'OCR API quota exceeded',
        PROCESSING_TIMEOUT: 'OCR processing timeout',
        INSUFFICIENT_QUALITY: 'Image quality insufficient for OCR processing'
    },

    GOOGLE_VISION: {
        NOT_INITIALIZED: 'Google Vision API not initialized. Check credentials.',
        AUTHENTICATION_FAILED: 'Google Vision API authentication failed',
        QUOTA_EXCEEDED: 'Google Vision API quota exceeded',
        RATE_LIMIT_EXCEEDED: 'Google Vision API rate limit exceeded',
        REQUEST_TIMEOUT: 'Google Vision API request timeout',
        INVALID_IMAGE_FORMAT: 'Invalid image format for Google Vision API'
    },

    OCR_MATCHING: {
        NO_MATCHES_FOUND: 'No matching cards found for OCR text',
        FUZZY_MATCHING_FAILED: 'Fuzzy matching algorithm failed',
        CONFIDENCE_TOO_LOW: 'OCR confidence too low for reliable matching',
        MULTIPLE_AMBIGUOUS_MATCHES: 'Multiple ambiguous matches found'
    },

    // Search Operations
    SEARCH: {
        INVALID_QUERY: 'Invalid search query provided',
        SEARCH_INDEX_UNAVAILABLE: 'Search index not available',
        SEARCH_TIMEOUT: 'Search operation timeout',
        NO_RESULTS: 'No results found for the search query'
    },

    FLEXSEARCH: {
        INITIALIZATION_FAILED: 'FlexSearch initialization failed',
        INDEX_CORRUPTION: 'Search index appears to be corrupted',
        MEMORY_LIMIT_EXCEEDED: 'Search index memory limit exceeded'
    },

    // Collection Management
    COLLECTION: {
        ITEM_NOT_FOUND: 'Collection item not found',
        INVALID_ITEM_ID: 'Invalid item ID format',
        BATCH_FETCH_FAILED: 'Batch item fetching failed',
        DUPLICATE_ITEM: 'Item already exists in collection'
    },

    // Sales Operations
    SALES: {
        INVALID_DATE_RANGE: 'Invalid date range provided',
        NO_SALES_DATA: 'No sales data found for the specified criteria',
        ANALYTICS_CALCULATION_FAILED: 'Sales analytics calculation failed'
    },

    // Upload Operations
    UPLOAD: {
        FILE_TOO_LARGE: 'File size exceeds maximum limit',
        INVALID_FILE_TYPE: 'Invalid file type provided',
        UPLOAD_FAILED: 'File upload failed',
        THUMBNAIL_GENERATION_FAILED: 'Thumbnail generation failed',
        STORAGE_LIMIT_EXCEEDED: 'Storage limit exceeded'
    },

    // Database Operations
    DATABASE: {
        CONNECTION_FAILED: 'Database connection failed',
        QUERY_TIMEOUT: 'Database query timeout',
        CONSTRAINT_VIOLATION: 'Database constraint violation',
        TRANSACTION_FAILED: 'Database transaction failed'
    },

    // External API Operations
    EXTERNAL_API: {
        SERVICE_UNAVAILABLE: 'External service temporarily unavailable',
        INVALID_RESPONSE: 'Invalid response from external service',
        AUTHENTICATION_REQUIRED: 'External service authentication required',
        RATE_LIMITED: 'External service rate limit exceeded'
    },

    // General Application Errors
    GENERAL: {
        INTERNAL_ERROR: 'An internal error occurred',
        INVALID_INPUT: 'Invalid input provided',
        OPERATION_FAILED: 'Operation failed to complete',
        RESOURCE_LOCKED: 'Resource is currently locked',
        INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this operation'
    }
};

/**
 * Error Type Definitions with metadata
 */
class ErrorType {
    constructor(code, message, category, severity = ERROR_SEVERITY.MEDIUM, statusCode = 500) {
        this.code = code;
        this.message = message;
        this.category = category;
        this.severity = severity;
        this.statusCode = statusCode;
    }

    /**
     * Create an error instance with additional context
     *
     * @param {Object} context - Additional error context
     * @param {Error} originalError - Original error if this is a wrapper
     * @returns {AppError} - Configured error instance
     */
    createError(context = {}, originalError = null) {
        const error = new AppError(this.message, this.statusCode);

        error.code = this.code;
        error.category = this.category;
        error.severity = this.severity;
        error.context = context;

        if (originalError) {
            error.originalError = originalError;
            error.stack = originalError.stack;
        }

        return error;
    }
}

/**
 * Pre-defined Error Types for common scenarios
 */
const ERROR_TYPES = {
    // DBA Operations
    DBA_NO_ITEMS: new ErrorType(
        'DBA_NO_ITEMS',
        ERROR_MESSAGES.DBA_EXPORT.NO_ITEMS,
        ERROR_CATEGORIES.VALIDATION,
        ERROR_SEVERITY.MEDIUM,
        400
    ),

    DBA_ITEM_NOT_FOUND: new ErrorType(
        'DBA_ITEM_NOT_FOUND',
        ERROR_MESSAGES.DBA_EXPORT.ITEM_NOT_FOUND,
        ERROR_CATEGORIES.DATABASE,
        ERROR_SEVERITY.MEDIUM,
        404
    ),

    DBA_EXPORT_FAILED: new ErrorType(
        'DBA_EXPORT_FAILED',
        ERROR_MESSAGES.DBA_EXPORT.EXPORT_FAILED,
        ERROR_CATEGORIES.BUSINESS_LOGIC,
        ERROR_SEVERITY.HIGH,
        500
    ),

    // Google Vision API Errors
    GOOGLE_VISION_NOT_INITIALIZED: new ErrorType(
        'GOOGLE_VISION_NOT_INITIALIZED',
        ERROR_MESSAGES.GOOGLE_VISION.NOT_INITIALIZED,
        ERROR_CATEGORIES.CONFIGURATION,
        ERROR_SEVERITY.CRITICAL,
        503
    ),

    GOOGLE_VISION_QUOTA_EXCEEDED: new ErrorType(
        'GOOGLE_VISION_QUOTA_EXCEEDED',
        ERROR_MESSAGES.GOOGLE_VISION.QUOTA_EXCEEDED,
        ERROR_CATEGORIES.RATE_LIMIT,
        ERROR_SEVERITY.HIGH,
        429
    ),

    GOOGLE_VISION_RATE_LIMITED: new ErrorType(
        'GOOGLE_VISION_RATE_LIMITED',
        ERROR_MESSAGES.GOOGLE_VISION.RATE_LIMIT_EXCEEDED,
        ERROR_CATEGORIES.RATE_LIMIT,
        ERROR_SEVERITY.MEDIUM,
        429
    ),

    // OCR Processing Errors
    OCR_NO_TEXT_DETECTED: new ErrorType(
        'OCR_NO_TEXT_DETECTED',
        ERROR_MESSAGES.OCR_PROCESSING.NO_TEXT_DETECTED,
        ERROR_CATEGORIES.OCR_PROCESSING,
        ERROR_SEVERITY.LOW,
        422
    ),

    OCR_PROCESSING_TIMEOUT: new ErrorType(
        'OCR_PROCESSING_TIMEOUT',
        ERROR_MESSAGES.OCR_PROCESSING.PROCESSING_TIMEOUT,
        ERROR_CATEGORIES.NETWORK,
        ERROR_SEVERITY.MEDIUM,
        408
    ),

    // Search Errors
    FLEXSEARCH_INITIALIZATION_FAILED: new ErrorType(
        'FLEXSEARCH_INIT_FAILED',
        ERROR_MESSAGES.FLEXSEARCH.INITIALIZATION_FAILED,
        ERROR_CATEGORIES.CONFIGURATION,
        ERROR_SEVERITY.HIGH,
        503
    ),

    SEARCH_INDEX_UNAVAILABLE: new ErrorType(
        'SEARCH_INDEX_UNAVAILABLE',
        ERROR_MESSAGES.SEARCH.SEARCH_INDEX_UNAVAILABLE,
        ERROR_CATEGORIES.CONFIGURATION,
        ERROR_SEVERITY.MEDIUM,
        503
    ),

    // Collection Management Errors
    COLLECTION_ITEM_NOT_FOUND: new ErrorType(
        'COLLECTION_ITEM_NOT_FOUND',
        ERROR_MESSAGES.COLLECTION.ITEM_NOT_FOUND,
        ERROR_CATEGORIES.DATABASE,
        ERROR_SEVERITY.MEDIUM,
        404
    ),

    BATCH_FETCH_FAILED: new ErrorType(
        'BATCH_FETCH_FAILED',
        ERROR_MESSAGES.COLLECTION.BATCH_FETCH_FAILED,
        ERROR_CATEGORIES.DATABASE,
        ERROR_SEVERITY.HIGH,
        500
    ),

    // Upload Errors
    UPLOAD_FILE_TOO_LARGE: new ErrorType(
        'UPLOAD_FILE_TOO_LARGE',
        ERROR_MESSAGES.UPLOAD.FILE_TOO_LARGE,
        ERROR_CATEGORIES.VALIDATION,
        ERROR_SEVERITY.LOW,
        413
    ),

    THUMBNAIL_GENERATION_FAILED: new ErrorType(
        'THUMBNAIL_GENERATION_FAILED',
        ERROR_MESSAGES.UPLOAD.THUMBNAIL_GENERATION_FAILED,
        ERROR_CATEGORIES.IMAGE_PROCESSING,
        ERROR_SEVERITY.MEDIUM,
        500
    ),

    // Database Errors
    DATABASE_CONNECTION_FAILED: new ErrorType(
        'DATABASE_CONNECTION_FAILED',
        ERROR_MESSAGES.DATABASE.CONNECTION_FAILED,
        ERROR_CATEGORIES.DATABASE,
        ERROR_SEVERITY.CRITICAL,
        503
    ),

    DATABASE_QUERY_TIMEOUT: new ErrorType(
        'DATABASE_QUERY_TIMEOUT',
        ERROR_MESSAGES.DATABASE.QUERY_TIMEOUT,
        ERROR_CATEGORIES.DATABASE,
        ERROR_SEVERITY.HIGH,
        408
    ),

    // General Errors
    INVALID_INPUT: new ErrorType(
        'INVALID_INPUT',
        ERROR_MESSAGES.GENERAL.INVALID_INPUT,
        ERROR_CATEGORIES.VALIDATION,
        ERROR_SEVERITY.LOW,
        400
    ),

    OPERATION_FAILED: new ErrorType(
        'OPERATION_FAILED',
        ERROR_MESSAGES.GENERAL.OPERATION_FAILED,
        ERROR_CATEGORIES.BUSINESS_LOGIC,
        ERROR_SEVERITY.MEDIUM,
        500
    )
};

/**
 * Error Factory for creating contextual errors
 */
class ErrorFactory {
    /**
     * Create a DBA operation error
     *
     * @param {string} operation - DBA operation type
     * @param {string} details - Error details
     * @param {Object} context - Additional context
     * @returns {AppError} - Configured DBA error
     */
    static createDbaError(operation, details, context = {}) {
        const errorType = ERROR_TYPES[`DBA_${operation.toUpperCase()}`] || ERROR_TYPES.OPERATION_FAILED;

        return errorType.createError({ operation, details, ...context });
    }

    /**
     * Create an OCR processing error
     *
     * @param {string} phase - OCR processing phase
     * @param {string} details - Error details
     * @param {Object} context - Additional context
     * @returns {AppError} - Configured OCR error
     */
    static createOcrError(phase, details, context = {}) {
        const errorType = ERROR_TYPES[`OCR_${phase.toUpperCase()}`] || ERROR_TYPES.OPERATION_FAILED;

        return errorType.createError({ phase, details, ...context });
    }

    /**
     * Create a search operation error
     *
     * @param {string} searchType - Type of search operation
     * @param {string} details - Error details
     * @param {Object} context - Additional context
     * @returns {AppError} - Configured search error
     */
    static createSearchError(searchType, details, context = {}) {
        const errorType = ERROR_TYPES[`SEARCH_${searchType.toUpperCase()}`] || ERROR_TYPES.OPERATION_FAILED;

        return errorType.createError({ searchType, details, ...context });
    }

    /**
     * Create a validation error with field details
     *
     * @param {string} field - Field that failed validation
     * @param {string} details - Validation failure details
     * @param {Object} context - Additional context
     * @returns {ValidationError} - Configured validation error
     */
    static createValidationError(field, details, context = {}) {
        const error = new ValidationError(`Validation failed for field: ${field}. ${details}`);

        error.field = field;
        error.details = details;
        error.context = context;
        return error;
    }
}

export {
    ERROR_SEVERITY,
    ERROR_CATEGORIES,
    ERROR_MESSAGES,
    ERROR_TYPES,
    ErrorType,
    ErrorFactory,
    AppError,
    ValidationError,
    NotFoundError,
    DatabaseError,
    ExternalServiceError,
    AuthenticationError
};
export default ERROR_SEVERITY;

