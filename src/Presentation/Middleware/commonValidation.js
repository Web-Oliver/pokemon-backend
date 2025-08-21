import { body, param, query } from 'express-validator';

/**
 * Common validation middleware to eliminate duplication across routes
 * Follows DRY principles by centralizing validation patterns
 */

// MongoDB ObjectId validation
const validateMongoId = [
  param('id').isMongoId().withMessage('Invalid ID format')
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

// Search query validation
const validateSearchQuery = [
  query('q')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  query('type')
    .optional()
    .isIn(['cards', 'sets', 'products', 'all'])
    .withMessage('Invalid search type')
];

// OCR text validation
const validateOcrText = [
  body('ocrText')
    .isString()
    .isLength({ min: 1, max: 10000 })
    .withMessage('OCR text must be between 1 and 10000 characters'),
  body('ocrConfidence')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('OCR confidence must be between 0 and 1')
];

// Batch processing validation
const validateBatchRequest = [
  body('items')
    .isArray({ min: 1, max: 50 })
    .withMessage('Items array must contain 1-50 items'),
  body('batchId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Batch ID must be between 1 and 100 characters')
];

// Image upload validation
const validateImageUpload = [
  body('labelImage')
    .notEmpty()
    .withMessage('Label image path is required'),
  body('processingTime')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Processing time must be a positive integer')
];

// Price/value validation
const validatePriceFields = [
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('sold')
    .optional()
    .isBoolean()
    .withMessage('Sold field must be boolean')
];

// Date range validation
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be valid ISO 8601 format'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be valid ISO 8601 format')
];

// Card type validation
const validateCardType = [
  body('cardType')
    .optional()
    .isIn(['psa-label', 'english-pokemon', 'japanese-pokemon', 'generic'])
    .withMessage('Invalid card type')
];

// Collection item validation
const validateCollectionItem = [
  body('itemId')
    .isMongoId()
    .withMessage('Item ID must be valid MongoDB ObjectId'),
  body('itemType')
    .isIn(['Card', 'Product', 'SetProduct', 'PsaGradedCard', 'RawCard', 'SealedProduct'])
    .withMessage('Invalid item type')
];

// Export validation
const validateExportRequest = [
  query('format')
    .optional()
    .isIn(['json', 'csv', 'excel'])
    .withMessage('Export format must be json, csv, or excel'),
  query('includeImages')
    .optional()
    .isBoolean()
    .withMessage('includeImages must be boolean')
];

export {
  validateMongoId,
  validatePagination,
  validateSearchQuery,
  validateOcrText,
  validateBatchRequest,
  validateImageUpload,
  validatePriceFields,
  validateDateRange,
  validateCardType,
  validateCollectionItem,
  validateExportRequest
};
export default validateMongoId;;
