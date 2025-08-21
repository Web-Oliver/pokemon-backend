/**
 * Date Validation Helpers
 * Provides utilities for validating date ranges and formats
 */

/**
 * Validates a date range and returns validation results
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date
 * @param {Object} options - Validation options
 * @param {boolean} options.throwOnError - Whether to throw errors or return validation object
 * @param {string} options.context - Context for error messages
 * @returns {Object} Validation result
 */
export function validateDateRange(startDate, endDate, options = {}) {
  const { throwOnError = false, context = 'DATE_VALIDATION' } = options;
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    // Convert to Date objects if they're strings
    let start = startDate ? new Date(startDate) : null;
    let end = endDate ? new Date(endDate) : null;

    // Check for invalid dates
    if (startDate && (isNaN(start.getTime()) || start.toString() === 'Invalid Date')) {
      validation.isValid = false;
      validation.errors.push(`Invalid start date: ${startDate}`);
    }

    if (endDate && (isNaN(end.getTime()) || end.toString() === 'Invalid Date')) {
      validation.isValid = false;
      validation.errors.push(`Invalid end date: ${endDate}`);
    }

    // Check date range logic
    if (start && end && start > end) {
      validation.isValid = false;
      validation.errors.push('Start date cannot be after end date');
    }

    // Check for future dates (warning)
    const now = new Date();
    if (start && start > now) {
      validation.warnings.push('Start date is in the future');
    }
    if (end && end > now) {
      validation.warnings.push('End date is in the future');
    }

    // If throwing on error and validation failed
    if (throwOnError && !validation.isValid) {
      const errorMessage = `${context}: ${validation.errors.join(', ')}`;
      throw new Error(errorMessage);
    }

    return validation;

  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    
    return {
      isValid: false,
      errors: [error.message],
      warnings: []
    };
  }
}

/**
 * Validates a single date
 * @param {string|Date} date - Date to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export function validateDate(date, options = {}) {
  const { throwOnError = false, context = 'DATE_VALIDATION' } = options;
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    if (!date) {
      validation.isValid = false;
      validation.errors.push('Date is required');
    } else {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime()) || dateObj.toString() === 'Invalid Date') {
        validation.isValid = false;
        validation.errors.push(`Invalid date: ${date}`);
      }
    }

    if (throwOnError && !validation.isValid) {
      const errorMessage = `${context}: ${validation.errors.join(', ')}`;
      throw new Error(errorMessage);
    }

    return validation;

  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    
    return {
      isValid: false,
      errors: [error.message],
      warnings: []
    };
  }
}

/**
 * Parse and normalize date string to Date object
 * @param {string} dateString - Date string to parse
 * @returns {Date|null} Parsed date or null if invalid
 */
export function parseDate(dateString) {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {string} format - Format type ('short', 'long', 'iso')
 * @returns {string} Formatted date string
 */
export function formatDate(date, format = 'short') {
  if (!date) return '';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  
  switch (format) {
    case 'short':
      return dateObj.toLocaleDateString();
    case 'long':
      return dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    case 'iso':
      return dateObj.toISOString().split('T')[0];
    default:
      return dateObj.toLocaleDateString();
  }
}

export default {
  validateDateRange,
  validateDate,
  parseDate,
  formatDate
};