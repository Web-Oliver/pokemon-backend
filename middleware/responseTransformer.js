const Logger = require('../utils/Logger');

/**
 * Response Transformation Middleware
 *
 * Provides consistent response formatting across all API endpoints.
 * Integrates with existing BaseController response patterns while
 * adding standardized metadata and transformation capabilities.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles response transformation only
 * - Open/Closed: Extensible for new transformation types
 * - Interface Segregation: Focused on response formatting
 */

/**
 * Standard API response format
 */
const RESPONSE_FORMATS = {
  SUCCESS: 'success',
  ERROR: 'error',
  PARTIAL: 'partial',
};

/**
 * Default response metadata
 */
const DEFAULT_METADATA = {
  timestamp: () => new Date().toISOString(),
  version: '1.0',
  cached: false,
};

/**
 * Response transformation configuration
 */
class ResponseTransformer {
  constructor(options = {}) {
    this.options = {
      includeMetadata: options.includeMetadata !== false,
      includeTimestamp: options.includeTimestamp !== false,
      includeVersion: options.includeVersion !== false,
      enableCompression: options.enableCompression !== false,
      logResponses: options.logResponses !== false,
      transformers: new Map(),
      ...options,
    };

    // Register default transformers
    this.registerTransformer('collection', this.transformCollection.bind(this));
    this.registerTransformer('entity', this.transformEntity.bind(this));
    this.registerTransformer('search', this.transformSearch.bind(this));
    this.registerTransformer('error', this.transformError.bind(this));
  }

  /**
   * Registers a custom transformer
   * @param {string} type - Transformer type
   * @param {Function} transformer - Transformation function
   */
  registerTransformer(type, transformer) {
    this.options.transformers.set(type, transformer);
  }

  /**
   * Creates the response transformation middleware
   * @returns {Function} - Express middleware function
   */
  createMiddleware() {
    return (req, res, next) => {
      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to add transformation
      res.json = (data) => {
        const transformedResponse = this.transformResponse(data, req, res);
        
        if (this.options.logResponses) {
          Logger.request(
            req.method,
            req.path,
            res.statusCode,
            Date.now() - req.startTime
          );
        }

        return originalJson(transformedResponse);
      };

      // Add convenience methods to response object
      res.success = (data, metadata = {}) => res.status(200).json(this.createSuccessResponse(data, metadata));

      res.created = (data, metadata = {}) => res.status(201).json(this.createSuccessResponse(data, metadata));

      res.error = (message, statusCode = 500, details = null) => res.status(statusCode).json(this.createErrorResponse(message, details));

      res.notFound = (message = 'Resource not found') => res.status(404).json(this.createErrorResponse(message));

      res.badRequest = (message, details = null) => res.status(400).json(this.createErrorResponse(message, details));

      // Track request start time for performance logging
      req.startTime = Date.now();

      next();
    };
  }

  /**
   * Transforms response data based on detected type
   * @param {any} data - Response data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Transformed response
   */
  transformResponse(data, req, res) {
    // Convert Decimal128 objects before any other processing
    const convertedData = this.convertDecimal128Fields(data);

    // If data is already in standard format, enhance it
    if (convertedData && typeof convertedData === 'object' && convertedData.hasOwnProperty('success')) {
      return this.enhanceStandardResponse(convertedData, req, res);
    }

    // Detect response type and apply appropriate transformation
    const responseType = this.detectResponseType(convertedData, req, res);
    const transformer = this.options.transformers.get(responseType);

    if (transformer) {
      return transformer(convertedData, req, res);
    }

    // Default transformation for unknown types
    return this.transformEntity(convertedData, req, res);
  }

  /**
   * Detects the type of response for appropriate transformation
   * @param {any} data - Response data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {string} - Response type
   */
  detectResponseType(data, req, res) {
    // Error responses
    if (res.statusCode >= 400) {
      return 'error';
    }

    // Collection responses (arrays or objects with array data)
    if (Array.isArray(data) || (data && data.data && Array.isArray(data.data))) {
      return 'collection';
    }

    // Search responses (based on URL pattern or query params)
    if (req.path.includes('/search') || req.query.searchTerm) {
      return 'search';
    }

    // Single entity responses
    return 'entity';
  }

  /**
   * Enhances existing standard responses with metadata
   * @param {Object} data - Standard response data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Enhanced response
   */
  enhanceStandardResponse(data, req, res) {
    const enhanced = { ...data };

    // Add status field if missing (required for new API format)
    if (!enhanced.status) {
      enhanced.status = enhanced.success ? RESPONSE_FORMATS.SUCCESS : RESPONSE_FORMATS.ERROR;
    }

    if (this.options.includeMetadata) {
      enhanced.meta = {
        ...this.createMetadata(req, res),
        ...enhanced.meta,
      };
    }

    return enhanced;
  }

  /**
   * Creates success response format
   * @param {any} data - Response data
   * @param {Object} metadata - Additional metadata
   * @returns {Object} - Success response
   */
  createSuccessResponse(data, metadata = {}) {
    const response = {
      success: true,
      status: RESPONSE_FORMATS.SUCCESS,
      data,
    };

    if (this.options.includeMetadata) {
      response.meta = {
        ...DEFAULT_METADATA,
        timestamp: DEFAULT_METADATA.timestamp(),
        ...metadata,
      };
    }

    return response;
  }

  /**
   * Creates error response format
   * @param {string} message - Error message
   * @param {any} details - Error details
   * @returns {Object} - Error response
   */
  createErrorResponse(message, details = null) {
    const response = {
      success: false,
      status: RESPONSE_FORMATS.ERROR,
      message,
    };

    if (details) {
      response.details = details;
    }

    if (this.options.includeMetadata) {
      response.meta = {
        timestamp: DEFAULT_METADATA.timestamp(),
      };
    }

    return response;
  }

  /**
   * Converts MongoDB Decimal128 objects to numbers throughout the data structure
   * @param {any} data - Data to process
   * @param {WeakSet} seen - Set to track visited objects for circular reference detection
   * @returns {any} - Data with converted Decimal128 fields
   */
  convertDecimal128Fields(data, seen = new WeakSet()) {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // Circular reference protection using WeakSet
    if (seen.has(data)) {
      return null; // Skip circular references entirely instead of showing placeholder text
    }
    seen.add(data);

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.convertDecimal128Fields(item, seen));
    }

    // Handle Date objects first (critical for Mongoose)
    if (data instanceof Date) {
      return data;
    }

    // Handle Mongoose documents by converting to plain object first
    if (data.constructor && (data.constructor.name === 'model' || data.constructor.name.includes('Document'))) {
      try {
        const plainObject = data.toObject({ virtuals: false, getters: false, transform: false });

        return this.convertDecimal128Fields(plainObject, seen);
      } catch (error) {
        console.warn('Failed to convert Mongoose document to object:', error.message);
        return data;
      }
    }

    // Handle objects with enhanced safety
    const processed = {};
    
    try {
      // Use safer object iteration
      const entries = Object.getOwnPropertyNames(data)
        .filter(key => key !== '_circularRefCheck') // Skip circular markers
        .map(key => [key, data[key]])
        .filter(([key, value]) => value !== undefined); // Skip undefined values

      for (const [key, value] of entries) {
        if (value && typeof value === 'object') {
          // IMPORTANT: Check for Date objects FIRST to avoid corrupting them
          if (value instanceof Date) {
            processed[key] = value; // Keep Date objects as-is
          }
          // Check if it's a Decimal128 object
          else if (value.$numberDecimal) {
            processed[key] = parseFloat(value.$numberDecimal);
          } 
          // Check if it's an ObjectId with buffer property
          else if (value.buffer && typeof value.buffer === 'object' && Object.keys(value.buffer).every(k => !isNaN(k))) {
            // Convert buffer-based ObjectId to string
            const bytesArray = Object.keys(value.buffer).map(k => value.buffer[k]);
            const buffer = Buffer.from(bytesArray);

            processed[key] = buffer.toString('hex');
          }
          // Check if it's a MongoDB Binary/Buffer object
          else if (value.bytes && typeof value.bytes === 'object' && Object.keys(value.bytes).every(k => !isNaN(k))) {
            const bytesArray = Object.keys(value.bytes).map(k => value.bytes[k]);

            try {
              const buffer = Buffer.from(bytesArray);
              let decimalValue = 0;
              
              if (buffer.length >= 8) {
                const lowBits = buffer.readUInt32LE(0);
                const highBits = buffer.readUInt32LE(4);
                
                if (highBits === 0 && lowBits < Number.MAX_SAFE_INTEGER) {
                  decimalValue = lowBits;
                } else {
                  decimalValue = lowBits;
                }
              }
              
              processed[key] = decimalValue;
            } catch (error) {
              Logger.warn('ResponseTransformer', `Failed to convert Binary field: ${key}`, { error: error.message });
              processed[key] = 0;
            }
          } else {
            // Recursively process nested objects and arrays with circular protection
            processed[key] = this.convertDecimal128Fields(value, seen);
          }
        } else {
          processed[key] = value;
        }
      }
    } catch (error) {
      console.error('Error in convertDecimal128Fields:', error.message);
      // Return simplified object on error to prevent crash
      return { error: 'Conversion failed', originalType: data.constructor?.name || 'unknown' };
    }

    return processed;
  }

  /**
   * Creates metadata object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Metadata object
   */
  createMetadata(req, res) {
    const metadata = {};

    if (this.options.includeTimestamp) {
      metadata.timestamp = new Date().toISOString();
    }

    if (this.options.includeVersion) {
      metadata.version = DEFAULT_METADATA.version;
    }

    // Check for cached response indicator
    if (req.fromCache || (res.locals && res.locals.cached)) {
      metadata.cached = true;
    }

    // Add request duration if available
    if (req.startTime) {
      metadata.duration = `${Date.now() - req.startTime}ms`;
    }

    return metadata;
  }

  /**
   * Transforms collection responses
   * @param {any} data - Collection data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Transformed collection response
   */
  transformCollection(data, req, res) {
    let count; let items;

    // Handle different collection formats
    if (Array.isArray(data)) {
      items = data;
      count = data.length;
    } else if (data && data.data && Array.isArray(data.data)) {
      items = data.data;
      count = data.count || data.data.length;
    } else {
      items = [];
      count = 0;
    }

    const response = {
      success: true,
      status: RESPONSE_FORMATS.SUCCESS,
      data: items,
      count,
    };

    if (this.options.includeMetadata) {
      response.meta = this.createMetadata(req, res);
    }

    return response;
  }

  /**
   * Transforms entity responses
   * @param {any} data - Entity data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Transformed entity response
   */
  transformEntity(data, req, res) {
    const response = {
      success: true,
      status: RESPONSE_FORMATS.SUCCESS,
      data,
    };

    if (this.options.includeMetadata) {
      response.meta = this.createMetadata(req, res);
    }

    return response;
  }

  /**
   * Transforms search responses
   * @param {any} data - Search data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Transformed search response
   */
  transformSearch(data, req, res) {
    let results; let total;

    // Extract search parameters
    const searchTerm = req.query.searchTerm || req.body.searchTerm || '';

    // Handle different search result formats
    if (Array.isArray(data)) {
      results = data;
      total = data.length;
    } else if (data && data.data) {
      results = Array.isArray(data.data) ? data.data : [data.data];
      total = data.count || data.total || results.length;
    } else {
      results = [];
      total = 0;
    }

    const response = {
      success: true,
      status: RESPONSE_FORMATS.SUCCESS,
      data: results,
      search: {
        term: searchTerm,
        total,
        returned: results.length,
      },
    };

    if (this.options.includeMetadata) {
      response.meta = this.createMetadata(req, res);
    }

    return response;
  }

  /**
   * Transforms error responses
   * @param {any} data - Error data
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @returns {Object} - Transformed error response
   */
  transformError(data, req, res) {
    let details; let message;

    if (typeof data === 'string') {
      message = data;
    } else if (data && data.message) {
      const { message: dataMessage, details: dataDetails, stack } = data;

      message = dataMessage;
      details = dataDetails || stack;
    } else {
      message = 'An error occurred';
      details = data;
    }

    return this.createErrorResponse(message, details);
  }
}

/**
 * Creates response transformer middleware with default configuration
 * @param {Object} options - Configuration options
 * @returns {Function} - Express middleware function
 */
function createResponseTransformer(options = {}) {
  const transformer = new ResponseTransformer(options);

  return transformer.createMiddleware();
}

/**
 * RFC 7807 Problem Details for HTTP APIs Support
 * Creates standardized error responses following RFC 7807 specification
 */
class ProblemDetailsHandler {
  static createProblemDetails({
    type = 'about:blank',
    title,
    status,
    detail,
    instance,
    extensions = {}
  }) {
    const problem = {
      type,
      title,
      status,
      detail,
      instance
    };

    // Add any extension members
    Object.assign(problem, extensions);

    return problem;
  }

  static validation(message, errors = [], instance = null) {
    return this.createProblemDetails({
      type: 'https://pokemon-collection.com/problems/validation-failed',
      title: 'Validation Failed',
      status: 400,
      detail: message,
      instance,
      extensions: {
        errors: errors.map(err => ({
          field: err.field || err.path,
          message: err.message,
          code: err.code || 'VALIDATION_ERROR'
        }))
      }
    });
  }

  static notFound(resource, instance = null) {
    return this.createProblemDetails({
      type: 'https://pokemon-collection.com/problems/resource-not-found',
      title: 'Resource Not Found',
      status: 404,
      detail: `The requested ${resource} could not be found`,
      instance
    });
  }

  static unauthorized(detail = 'Authentication required', instance = null) {
    return this.createProblemDetails({
      type: 'https://pokemon-collection.com/problems/unauthorized',
      title: 'Unauthorized',
      status: 401,
      detail,
      instance
    });
  }

  static forbidden(detail = 'Access denied', instance = null) {
    return this.createProblemDetails({
      type: 'https://pokemon-collection.com/problems/forbidden',
      title: 'Forbidden',
      status: 403,
      detail,
      instance
    });
  }

  static conflict(resource, detail, instance = null) {
    return this.createProblemDetails({
      type: 'https://pokemon-collection.com/problems/resource-conflict',
      title: 'Resource Conflict',
      status: 409,
      detail: detail || `Conflict with existing ${resource}`,
      instance
    });
  }

  static serverError(detail = 'An internal server error occurred', instance = null) {
    return this.createProblemDetails({
      type: 'https://pokemon-collection.com/problems/server-error',
      title: 'Internal Server Error',
      status: 500,
      detail,
      instance
    });
  }

  static badRequest(detail = 'The request could not be understood', instance = null) {
    return this.createProblemDetails({
      type: 'https://pokemon-collection.com/problems/bad-request',
      title: 'Bad Request',
      status: 400,
      detail,
      instance
    });
  }

  static rateLimited(detail = 'Too many requests', retryAfter = null, instance = null) {
    const extensions = retryAfter ? { 'retry-after': retryAfter } : {};
    return this.createProblemDetails({
      type: 'https://pokemon-collection.com/problems/rate-limited',
      title: 'Too Many Requests',
      status: 429,
      detail,
      instance,
      extensions
    });
  }
}

/**
 * Enhanced response transformer with RFC 7807 Problem Details support
 */
function createEnhancedResponseTransformer(options = {}) {
  const transformer = new ResponseTransformer(options);
  const middleware = transformer.createMiddleware();

  return (req, res, next) => {
    // Add RFC 7807 Problem Details methods to response object
    res.problem = (problemDetails) => {
      res.status(problemDetails.status)
         .set('Content-Type', 'application/problem+json')
         .json(problemDetails);
    };

    res.validationProblem = (message, errors = []) => {
      const problem = ProblemDetailsHandler.validation(message, errors, req.originalUrl);
      res.problem(problem);
    };

    res.notFoundProblem = (resource) => {
      const problem = ProblemDetailsHandler.notFound(resource, req.originalUrl);
      res.problem(problem);
    };

    res.unauthorizedProblem = (detail) => {
      const problem = ProblemDetailsHandler.unauthorized(detail, req.originalUrl);
      res.problem(problem);
    };

    res.forbiddenProblem = (detail) => {
      const problem = ProblemDetailsHandler.forbidden(detail, req.originalUrl);
      res.problem(problem);
    };

    res.conflictProblem = (resource, detail) => {
      const problem = ProblemDetailsHandler.conflict(resource, detail, req.originalUrl);
      res.problem(problem);
    };

    res.serverErrorProblem = (detail) => {
      const problem = ProblemDetailsHandler.serverError(detail, req.originalUrl);
      res.problem(problem);
    };

    res.badRequestProblem = (detail) => {
      const problem = ProblemDetailsHandler.badRequest(detail, req.originalUrl);
      res.problem(problem);
    };

    res.rateLimitedProblem = (detail, retryAfter) => {
      const problem = ProblemDetailsHandler.rateLimited(detail, retryAfter, req.originalUrl);
      res.problem(problem);
    };

    // Call the original middleware
    middleware(req, res, next);
  };
}

/**
 * Pre-configured transformers for common use cases
 */
const presets = {
  // API responses with full metadata and RFC 7807 support
  api: createEnhancedResponseTransformer({
    includeMetadata: true,
    includeTimestamp: true,
    logResponses: true,
  }),

  // Legacy API responses (backward compatibility)
  legacy: createResponseTransformer({
    includeMetadata: true,
    includeTimestamp: true,
    logResponses: true,
  }),

  // Minimal responses for high-performance endpoints
  minimal: createResponseTransformer({
    includeMetadata: false,
    includeTimestamp: false,
    logResponses: false,
  }),

  // Development responses with detailed logging
  development: createEnhancedResponseTransformer({
    includeMetadata: true,
    includeTimestamp: true,
    logResponses: true,
    includeVersion: true,
  }),
};

module.exports = {
  ResponseTransformer,
  createResponseTransformer,
  createEnhancedResponseTransformer,
  ProblemDetailsHandler,
  presets,
  RESPONSE_FORMATS,
};