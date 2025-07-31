/**
 * Date Validation Helpers
 * 
 * Essential date validation functions used by services.
 * Recreated to provide only the functions actually being used.
 */

const { ValidationError } = require('../middleware/errorHandler');

/**
 * Validate date ranges
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @param {Object} options - Validation options
 * @param {boolean} options.throwOnError - Whether to throw errors or return them
 * @param {string} options.context - Context for logging
 * @returns {Object} Validation result with isValid and errors properties
 */
function validateDateRange(startDate, endDate, options = {}) {
  const { throwOnError = false, context = 'DATE_VALIDATION' } = options;
  const errors = [];

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime())) {
      const error = 'Start date must be a valid date';
      if (throwOnError) {
        throw new ValidationError(error);
      }
      errors.push(error);
    }

    if (isNaN(end.getTime())) {
      const error = 'End date must be a valid date';
      if (throwOnError) {
        throw new ValidationError(error);
      }
      errors.push(error);
    }

    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
      const error = 'Start date must be before end date';
      if (throwOnError) {
        throw new ValidationError(error);
      }
      errors.push(error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateDateRange
};