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
    // If data is already in standard format, enhance it
    if (data && typeof data === 'object' && data.hasOwnProperty('success')) {
      return this.enhanceStandardResponse(data, req, res);
    }

    // Detect response type and apply appropriate transformation
    const responseType = this.detectResponseType(data, req, res);
    const transformer = this.options.transformers.get(responseType);

    if (transformer) {
      return transformer(data, req, res);
    }

    // Default transformation for unknown types
    return this.transformEntity(data, req, res);
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
    let results; let searchTerm; let total;

    // Extract search parameters
    searchTerm = req.query.searchTerm || req.body.searchTerm || '';

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
      message = data.message;
      details = data.details || data.stack;
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
 * Pre-configured transformers for common use cases
 */
const presets = {
  // API responses with full metadata
  api: createResponseTransformer({
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
  development: createResponseTransformer({
    includeMetadata: true,
    includeTimestamp: true,
    logResponses: true,
    includeVersion: true,
  }),
};

module.exports = {
  ResponseTransformer,
  createResponseTransformer,
  presets,
  RESPONSE_FORMATS,
};