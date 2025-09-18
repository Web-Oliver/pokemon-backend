/**
 * Unified Response Format Middleware
 *
 * Standardizes API response formats across all controllers.
 * Eliminates response format inconsistencies identified in the analysis.
 *
 * Before: 4+ different response formats across controllers
 * After: Single, consistent response format with rich metadata
 */

/**
 * Standard API Response Format
 *
 * {
 *   success: boolean,
 *   data: any,
 *   meta: {
 *     operation: string,
 *     entityType: string,
 *     timestamp: string,
 *     processingTime: number,
 *     pagination?: PaginationMeta,
 *     metrics?: OperationMetrics,
 *     version: string
 *   },
 *   error?: ErrorDetails
 * }
 */

/**
 * Response formatter middleware
 * Intercepts responses and applies standardized format
 */
export const responseFormatter = (options = {}) => {
    const {
        version = '2.0',
        includeProcessingTime = true,
        includeMetrics = false
    } = options;

    return (req, res, next) => {
        const startTime = Date.now();

        // Store original methods
        const originalJson = res.json;
        const originalSend = res.send;

        // Override res.json to apply formatting
        res.json = function (data) {
            const formattedResponse = formatResponse(data, {
                req,
                res,
                startTime,
                version,
                includeProcessingTime,
                includeMetrics
            });

            return originalJson.call(this, formattedResponse);
        };

        // Override res.send for non-JSON responses
        res.send = function (data) {
            // Check if response formatting should be bypassed
            if (res._skipResponseFormatter || res.headersSent) {
                return originalSend.call(this, data);
            }

            // Don't format binary data (Buffer objects)
            if (Buffer.isBuffer(data)) {
                return originalSend.call(this, data);
            }

            // Don't format if content-type indicates binary data
            const contentType = res.get('Content-Type') || '';
            if (contentType.startsWith('image/') ||
                contentType.startsWith('video/') ||
                contentType.startsWith('audio/') ||
                contentType.includes('octet-stream')) {
                return originalSend.call(this, data);
            }

            // Only format if data looks like JSON
            if (typeof data === 'object' && data !== null) {
                return res.json(data);
            }

            return originalSend.call(this, data);
        };

        // Add helper methods to response object
        res.success = function (data, meta = {}) {
            return res.json({
                success: true,
                data,
                ...meta
            });
        };

        res.error = function (error, statusCode = 500) {
            return res.status(statusCode).json({
                success: false,
                error: formatError(error)
            });
        };

        res.paginated = function (data, pagination, meta = {}) {
            return res.json({
                success: true,
                data,
                pagination,
                ...meta
            });
        };

        next();
    };
};

/**
 * Format response data into standardized format
 */
function formatResponse(data, context) {

    // If data is already in our standard format, enhance it
    if (isStandardFormat(data)) {
        return enhanceStandardResponse(data, context);
    }

    // If data is a simple value or array, wrap it
    if (!data || typeof data !== 'object') {
        return createStandardResponse({
            success: true,
            data
        }, context);
    }

    // Handle various legacy response formats
    if (data.success !== undefined) {
        // Already has success field, just enhance metadata
        return enhanceStandardResponse(data, context);
    }

    // Handle raw data objects
    return createStandardResponse({
        success: true,
        data
    }, context);
}

/**
 * Check if response is already in standard format
 */
function isStandardFormat(data) {
    return data &&
        typeof data === 'object' &&
        data.hasOwnProperty('success') &&
        data.hasOwnProperty('data');
}

/**
 * Enhance standard response with metadata
 */
function enhanceStandardResponse(response, context) {
    const { req, res, startTime, version, includeProcessingTime, includeMetrics } = context;

    // Ensure meta object exists
    if (!response.meta) {
        response.meta = {};
    }

    // Add standard metadata
    response.meta = {
        ...response.meta,
        timestamp: new Date().toISOString(),
        version,
        architecture: 'STANDARDIZED_RESPONSE_FORMAT',
        endpoint: `${req.method} ${req.originalUrl}`,
        ...getOperationMetadata(req, res)
    };

    // Add processing time if enabled
    if (includeProcessingTime) {
        response.meta.processingTime = Date.now() - startTime;
    }

    // Add metrics if enabled and available
    if (includeMetrics && res.locals.metrics) {
        response.meta.metrics = res.locals.metrics;
    }

    // Clean up any legacy fields
    delete response.status; // Remove redundant status field

    return response;
}

/**
 * Create standard response from scratch
 */
function createStandardResponse(baseResponse, context) {
    const { req, res, startTime, version, includeProcessingTime, includeMetrics } = context;

    const response = {
        ...baseResponse,
        meta: {
            timestamp: new Date().toISOString(),
            version,
            architecture: 'STANDARDIZED_RESPONSE_FORMAT',
            endpoint: `${req.method} ${req.originalUrl}`,
            ...getOperationMetadata(req, res)
        }
    };

    // Add processing time if enabled
    if (includeProcessingTime) {
        response.meta.processingTime = Date.now() - startTime;
    }

    // Add metrics if enabled and available
    if (includeMetrics && res.locals.metrics) {
        response.meta.metrics = res.locals.metrics;
    }

    return response;
}

/**
 * Extract operation metadata from request/response
 */
function getOperationMetadata(req) {
    const metadata = {};

    // Try to determine operation type from HTTP method and path
    const method = req.method.toLowerCase();
    const path = req.route?.path || req.path;

    if (method === 'get' && path?.includes(':id')) {
        metadata.operation = 'getById';
    } else if (method === 'get') {
        metadata.operation = 'getAll';
    } else if (method === 'post') {
        metadata.operation = 'create';
    } else if (method === 'put' || method === 'patch') {
        metadata.operation = 'update';
    } else if (method === 'delete') {
        metadata.operation = 'delete';
    }

    // Try to determine entity type from path
    const pathSegments = path?.split('/').filter(Boolean) || [];
    for (const segment of pathSegments) {
        if (!segment.includes(':') && segment !== 'api') {
            // Convert to singular, capitalized form
            const entityType = segment
                .replace(/s$/, '') // Remove trailing 's'
                .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()) // Convert kebab-case
                .replace(/^[a-z]/, letter => letter.toUpperCase()); // Capitalize first letter

            if (entityType.length > 1) {
                metadata.entityType = entityType;
                break;
            }
        }
    }

    return metadata;
}

/**
 * Format error for consistent error responses
 */
function formatError(error) {
    const formattedError = {
        message: error.message || 'An error occurred',
        type: error.constructor.name
    };

    // Include stack trace in development
    if (process.env.NODE_ENV !== 'production' && error.stack) {
        formattedError.stack = error.stack;
    }

    // Include validation errors if available
    if (error.errors) {
        formattedError.validation = error.errors;
    }

    // Include HTTP status code if available
    if (error.statusCode || error.status) {
        formattedError.statusCode = error.statusCode || error.status;
    }

    return formattedError;
}

/**
 * Response format presets for common use cases
 */
export const responsePresets = {
    /**
     * Success preset with data
     */
    success: (data, meta = {}) => ({
        success: true,
        data,
        ...meta
    }),

    /**
     * Paginated response preset
     */
    paginated: (data, pagination, meta = {}) => ({
        success: true,
        data,
        pagination,
        ...meta
    }),

    /**
     * Error response preset
     */
    error: (message, details = {}) => ({
        success: false,
        error: {
            message,
            ...details
        }
    }),

    /**
     * Created resource preset
     */
    created: (data, meta = {}) => ({
        success: true,
        data,
        ...meta,
        _statusCode: 201
    }),

    /**
     * No content preset
     */
    noContent: () => ({
        success: true,
        data: null,
        _statusCode: 204
    }),

    /**
     * Batch operation result preset
     */
    batchResult: (results, meta = {}) => ({
        success: true,
        data: {
            successful: results.successful || [],
            failed: results.failed || [],
            total: results.total || 0,
            successCount: (results.successful || []).length,
            failureCount: (results.failed || []).length
        },
        ...meta
    })
};


export default responseFormatter;
