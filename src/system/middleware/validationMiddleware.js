/**
 * Validation Middleware - SOLID & DRY Implementation
 * Using express-validator patterns with Mongoose validation principles
 */

import mongoose from 'mongoose';

/**
 * Core validation utility - runs validation chains in parallel
 */
const validate = (validations) => {
  return async (req, res, next) => {
    console.log('🔍 VALIDATE MIDDLEWARE: Starting validation for', req.method, req.originalUrl);
    const errors = [];

    // Run all validations in parallel
    await Promise.all(validations.map(validation => validation.run(req, errors)));

    console.log('🔍 VALIDATE MIDDLEWARE: Validation completed', { 
      errorCount: errors.length, 
      errors: errors 
    });

    if (errors.length > 0) {
      console.error('🔴 VALIDATE MIDDLEWARE: Validation failed', { errors });
      return res.status(400).json({
        success: false,
        error: {
          type: 'ValidationError',
          message: 'Request validation failed',
          details: errors
        }
      });
    }

    console.log('✅ VALIDATE MIDDLEWARE: Validation passed, calling next()');
    next();
  };
};

/**
 * Base validation chain class following express-validator patterns
 */
class ValidationChain {
  constructor(field, location = 'body') {
    this.field = field;
    this.location = location;
    this.validators = [];
  }

  async run(req, errors) {
    const value = this._getValue(req);

    for (const validator of this.validators) {
      const result = await validator(value, this.field, req);
      if (result === 'skip') {
        break; // Skip remaining validators
      }
      if (result) {
        errors.push(result);
        break; // Stop on first error
      }
    }
  }

  _getValue(req) {
    let value;
    switch (this.location) {
      case 'params':
        value = req.params[this.field];
        break;
      case 'query':
        value = req.query[this.field];
        break;
      case 'body':
        value = req.body[this.field];
        break;
      default:
        value = req.body[this.field];
    }
    return value;
  }

  // Validation methods following express-validator API
  exists() {
    this.validators.push((value, field) => {
      if (value === undefined || value === null || value === '') {
        return { field, message: `${field} is required` };
      }
      return null;
    });
    return this;
  }

  isString() {
    this.validators.push((value, field) => {
      if (value !== undefined && typeof value !== 'string') {
        return { field, message: `${field} must be a string` };
      }
      return null;
    });
    return this;
  }

  isLength(options) {
    this.validators.push((value, field) => {
      if (value === undefined) return null;
      const length = String(value).length;
      if (options.min && length < options.min) {
        return { field, message: `${field} must be at least ${options.min} characters` };
      }
      if (options.max && length > options.max) {
        return { field, message: `${field} must be at most ${options.max} characters` };
      }
      return null;
    });
    return this;
  }

  matches(pattern) {
    this.validators.push((value, field) => {
      if (value !== undefined && !pattern.test(String(value))) {
        return { field, message: `${field} format is invalid` };
      }
      return null;
    });
    return this;
  }

  isObjectId() {
    this.validators.push((value, field) => {
      if (value !== undefined && !mongoose.Types.ObjectId.isValid(value)) {
        return { field, message: `${field} must be a valid ObjectId` };
      }
      return null;
    });
    return this;
  }

  isInt(options = {}) {
    this.validators.push((value, field) => {
      if (value === undefined) return null;
      const num = parseInt(value, 10);
      if (isNaN(num)) {
        return { field, message: `${field} must be an integer` };
      }
      if (options.min !== undefined && num < options.min) {
        return { field, message: `${field} must be at least ${options.min}` };
      }
      if (options.max !== undefined && num > options.max) {
        return { field, message: `${field} must be at most ${options.max}` };
      }
      return null;
    });
    return this;
  }

  isIn(values) {
    this.validators.push((value, field) => {
      if (value !== undefined && !values.includes(value)) {
        return { field, message: `${field} must be one of: ${values.join(', ')}` };
      }
      return null;
    });
    return this;
  }

  custom(validator) {
    this.validators.push(async (value, field, req) => {
      try {
        const result = await validator(value, { req, location: this.location, path: this.field });
        if (result === true || result === undefined) {
          return null;
        }
        if (typeof result === 'string') {
          return { field, message: result };
        }
        return result;
      } catch (error) {
        return { field, message: error.message };
      }
    });
    return this;
  }

  optional() {
    // Mark as optional - if undefined/null, skip other validators
    this.validators.unshift((value) => {
      if (value === undefined || value === null || value === '') {
        return 'skip'; // Special return to skip remaining validators
      }
      return null;
    });
    return this;
  }
}

// Factory functions following express-validator API
const param = (field) => new ValidationChain(field, 'params');
const query = (field) => new ValidationChain(field, 'query');
const body = (field) => new ValidationChain(field, 'body');

/**
 * Pre-built validation middleware functions
 */
export const validationMiddlewares = {
  // Search endpoint validation
  validateSearchEndpoint: validate([
    query('query').optional().isString().isLength({ max: 500 }),
    query('types').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('page').optional().isInt({ min: 1 }),
    query('sort').optional().isString(),
    query('filters').optional().isString()
  ]),

  // Search query validation
  validateSearchQuery: validate([
    query('query').exists().isString().isLength({ min: 1, max: 500 })
  ]),

  // ObjectId parameter validation
  validateObjectIdParam: validate([
    param('id').optional().isObjectId(),
    param('cardId').optional().isObjectId(),
    param('productId').optional().isObjectId()
  ]),

  // Pagination validation
  validatePaginationQuery: validate([
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 1000 })
  ]),

  // Export body validation
  validateExportBody: validate([
    body('items').exists().isString(),
    body('format').optional().isIn(['json', 'csv', 'xlsx'])
  ]),

  // ICR upload session validation
  validateUploadSessionId: validate([
    param('uploadSessionId').exists().isString().isLength({ min: 3, max: 50 })
  ]),

  // ICR OCR request validation
  validateOcrRequest: validate([
    body('stitchedImagePath').optional().isString().isLength({ max: 500 })
  ]),

  // ICR distribute request validation - ocrResult is optional for auto-lookup
  validateDistributeRequest: validate([
    body('ocrResult').optional().custom((value) => {
      // If provided, must be an object with required properties
      if (value !== undefined) {
        if (typeof value !== 'object' || value === null) {
          return 'ocrResult must be an object';
        }
        if (value.textAnnotations && !Array.isArray(value.textAnnotations)) {
          return 'ocrResult.textAnnotations must be an array';
        }
      }
      return true;
    })
  ]),

  // Filename validation for images
  validateFilename: validate([
    param('filename').exists().isString().matches(/^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|gif|webp)$/i)
  ]),

  // Image hashes validation for ICR operations
  validateImageHashes: validate([
    body('imageHashes').exists().custom((value) => {
      if (!Array.isArray(value)) {
        return 'imageHashes must be an array';
      }
      if (value.length === 0) {
        return 'imageHashes array cannot be empty';
      }
      for (const hash of value) {
        if (typeof hash !== 'string' || hash.length === 0) {
          return 'All imageHashes must be non-empty strings';
        }
      }
      return true;
    })
  ]),

  // ICR stitching status validation - validates scans can be stitched
  validateStitchingRequest: validate([
    body('imageHashes').exists().custom(async (value) => {
      console.log('🔍 VALIDATION DEBUG: Starting stitching validation', { 
        valueType: typeof value, 
        isArray: Array.isArray(value), 
        length: value?.length,
        firstFew: value?.slice?.(0, 3),
        fullValue: value
      });
      
      if (!Array.isArray(value)) {
        console.error('🔴 VALIDATION ERROR: imageHashes is not an array:', typeof value, value);
        return 'imageHashes must be an array';
      }
      if (value.length === 0) {
        console.error('🔴 VALIDATION ERROR: imageHashes array is empty');
        return 'imageHashes array cannot be empty';
      }
      
      // Validate each hash is a non-empty string
      for (let i = 0; i < value.length; i++) {
        const hash = value[i];
        if (typeof hash !== 'string' || hash.trim().length === 0) {
          console.error('🔴 VALIDATION ERROR: Invalid hash at index', i, ':', hash);
          return `imageHashes[${i}] must be a non-empty string`;
        }
      }
      
      // Check scan statuses - only allow 'extracted' and 'stitched' scans to be stitched/re-stitched
      try {
        console.log('🔍 VALIDATION DEBUG: Using repository pattern to query scans...');
        const GradedCardScanRepository = (await import('../../icr/infrastructure/repositories/GradedCardScanRepository.js')).default;
        const repository = new GradedCardScanRepository();
        
        console.log('🔍 VALIDATION DEBUG: Querying scans for hashes...', { hashCount: value.length });
        const scans = await repository.findMany({ 
          imageHash: { $in: value } 
        });
        
        console.log('🔍 VALIDATION DEBUG: Found scans:', { 
          scansFound: scans.length, 
          statuses: scans.map(s => ({ 
            id: s._id.toString().substring(0, 8), 
            status: s.processingStatus, 
            fileName: s.originalFileName,
            imageHash: s.imageHash.substring(0, 16) + '...' 
          }))
        });
        
        if (scans.length === 0) {
          console.error('🔴 VALIDATION ERROR: No scans found for provided image hashes');
          return 'No scans found for provided image hashes';
        }
        
        const invalidScans = scans.filter(scan => 
          !['extracted', 'stitched'].includes(scan.processingStatus)
        );
        
        if (invalidScans.length > 0) {
          const invalidStatuses = invalidScans.map(s => `${s.originalFileName} (${s.processingStatus})`).join(', ');
          console.error('🔴 VALIDATION ERROR: Invalid scan statuses found:', { 
            invalidCount: invalidScans.length, 
            invalidStatuses 
          });
          return `Cannot stitch images with invalid statuses: ${invalidStatuses}. Only 'extracted' and 'stitched' images can be stitched/re-stitched.`;
        }
        
        console.log('✅ VALIDATION SUCCESS: All scans have valid statuses for stitching');
        return null; // SUCCESS - return null, not true!
      } catch (error) {
        console.error('🔴 VALIDATION ERROR: Exception during validation:', error);
        return 'Failed to validate scan statuses: ' + error.message;
      }
    })
  ])
};

/**
 * Factory function for creating custom validation middleware
 */
export const createValidationMiddleware = (validationChains) => {
  return validate(validationChains);
};

// Export individual validator factories
export { param, query, body, validate };

export default createValidationMiddleware;
