/**
 * Validation Utilities
 * 
 * Essential validation functions used by controllers.
 * Recreated to provide only the functions actually being used.
 */

const mongoose = require('mongoose');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Validate pagination parameters
 */
function validatePagination(page = 1, limit = 50, maxLimit = 100) {
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ValidationError('Page must be a positive integer');
  }

  if (isNaN(limitNum) || limitNum < 1) {
    throw new ValidationError('Limit must be a positive integer');
  }

  if (limitNum > maxLimit) {
    throw new ValidationError(`Limit cannot exceed ${maxLimit}`);
  }

  return { pageNum, limitNum };
}

/**
 * Validate year values
 */
function validateYear(year) {
  const yearNum = parseInt(year, 10);
  const currentYear = new Date().getFullYear();

  if (isNaN(yearNum)) {
    throw new ValidationError('Year must be a valid number');
  }

  if (yearNum < 1900 || yearNum > currentYear + 10) {
    throw new ValidationError(`Year must be between 1900 and ${currentYear + 10}`);
  }

  return yearNum;
}

/**
 * Validate MongoDB ObjectId
 */
function validateObjectId(id, fieldName = 'ID') {
  if (!id) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${fieldName} must be a valid ObjectId`);
  }
}

module.exports = {
  validatePagination,
  validateYear,
  validateObjectId
};