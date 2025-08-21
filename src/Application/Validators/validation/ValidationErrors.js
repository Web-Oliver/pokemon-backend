/**
 * Validation Errors
 *
 * Centralized validation error types and standardized error creation
 * Provides consistent error handling across all validation operations
 */

import { ValidationError   } from '@/Presentation/Middleware/errorHandler.js';
/**
 * Standardized validation error creator
 * Ensures consistent error format throughout the application
 */
class ValidationErrors {
  /**
   * Create a validation error with standardized format
   * @param {string} message - Error message
   * @param {string} field - Field name that failed validation
   * @param {any} value - Value that failed validation
   * @param {Object} context - Additional context information
   * @returns {ValidationError} Standardized validation error
   */
  static create(message, field = null, value = null, context = {}) {
    const errorMessage = field ? `${field}: ${message}` : message;
    const error = new ValidationError(errorMessage);

    // Add metadata for debugging and logging
    error.field = field;
    error.value = value;
    error.context = context;

    return error;
  }

  /**
   * Create required field error
   * @param {string} fieldName - Name of the required field
   * @returns {ValidationError} Required field error
   */
  static required(fieldName) {
    return this.create(`${fieldName} is required`, fieldName, null, { type: 'required' });
  }

  /**
   * Create invalid type error
   * @param {string} fieldName - Name of the field
   * @param {string} expectedType - Expected type
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} Type validation error
   */
  static invalidType(fieldName, expectedType, actualValue) {
    return this.create(
      `${fieldName} must be a ${expectedType}`,
      fieldName,
      actualValue,
      { type: 'invalid_type', expectedType, actualType: typeof actualValue }
    );
  }

  /**
   * Create range validation error
   * @param {string} fieldName - Name of the field
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} Range validation error
   */
  static outOfRange(fieldName, min, max, actualValue) {
    let message;

    if (min !== undefined && max !== undefined) {
      message = `${fieldName} must be between ${min} and ${max}`;
    } else if (min !== undefined) {
      message = `${fieldName} must be at least ${min}`;
    } else if (max !== undefined) {
      message = `${fieldName} must be at most ${max}`;
    } else {
      message = `${fieldName} is out of valid range`;
    }

    return this.create(message, fieldName, actualValue, { type: 'out_of_range', min, max });
  }

  /**
   * Create length validation error
   * @param {string} fieldName - Name of the field
   * @param {number} minLength - Minimum allowed length
   * @param {number} maxLength - Maximum allowed length
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} Length validation error
   */
  static invalidLength(fieldName, minLength, maxLength, actualValue) {
    const actualLength = actualValue ? actualValue.length : 0;
    let message;

    if (minLength !== undefined && maxLength !== undefined) {
      message = `${fieldName} must be between ${minLength} and ${maxLength} characters long`;
    } else if (minLength !== undefined) {
      message = `${fieldName} must be at least ${minLength} characters long`;
    } else if (maxLength !== undefined) {
      message = `${fieldName} must be at most ${maxLength} characters long`;
    } else {
      message = `${fieldName} has invalid length`;
    }

    return this.create(message, fieldName, actualValue, {
      type: 'invalid_length',
      minLength,
      maxLength,
      actualLength
    });
  }

  /**
   * Create enum validation error
   * @param {string} fieldName - Name of the field
   * @param {Array} allowedValues - Array of allowed values
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} Enum validation error
   */
  static invalidEnum(fieldName, allowedValues, actualValue) {
    return this.create(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      fieldName,
      actualValue,
      { type: 'invalid_enum', allowedValues }
    );
  }

  /**
   * Create format validation error
   * @param {string} fieldName - Name of the field
   * @param {string} expectedFormat - Expected format description
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} Format validation error
   */
  static invalidFormat(fieldName, expectedFormat, actualValue) {
    return this.create(
      `${fieldName} must be a valid ${expectedFormat}`,
      fieldName,
      actualValue,
      { type: 'invalid_format', expectedFormat }
    );
  }

  /**
   * Create ObjectId validation error
   * @param {string} fieldName - Name of the field
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} ObjectId validation error
   */
  static invalidObjectId(fieldName, actualValue) {
    return this.create(
      `${fieldName} must be a valid 24-character hex string`,
      fieldName,
      actualValue,
      { type: 'invalid_objectid' }
    );
  }

  /**
   * Create date validation error
   * @param {string} fieldName - Name of the field
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} Date validation error
   */
  static invalidDate(fieldName, actualValue) {
    return this.create(
      `${fieldName} must be a valid date`,
      fieldName,
      actualValue,
      { type: 'invalid_date' }
    );
  }

  /**
   * Create email validation error
   * @param {string} fieldName - Name of the field
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} Email validation error
   */
  static invalidEmail(fieldName, actualValue) {
    return this.create(
      `${fieldName} must be a valid email address`,
      fieldName,
      actualValue,
      { type: 'invalid_email' }
    );
  }

  /**
   * Create URL validation error
   * @param {string} fieldName - Name of the field
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} URL validation error
   */
  static invalidUrl(fieldName, actualValue) {
    return this.create(
      `${fieldName} must be a valid URL`,
      fieldName,
      actualValue,
      { type: 'invalid_url' }
    );
  }

  /**
   * Create array validation error
   * @param {string} fieldName - Name of the field
   * @param {string} reason - Specific reason for array validation failure
   * @param {any} actualValue - Actual value provided
   * @returns {ValidationError} Array validation error
   */
  static invalidArray(fieldName, reason, actualValue) {
    return this.create(
      `${fieldName} ${reason}`,
      fieldName,
      actualValue,
      { type: 'invalid_array' }
    );
  }

  /**
   * Create custom validation error
   * @param {string} fieldName - Name of the field
   * @param {string} customMessage - Custom validation message
   * @param {any} actualValue - Actual value provided
   * @param {Object} customContext - Custom context information
   * @returns {ValidationError} Custom validation error
   */
  static custom(fieldName, customMessage, actualValue, customContext = {}) {
    return this.create(
      customMessage,
      fieldName,
      actualValue,
      { type: 'custom', ...customContext }
    );
  }
}

export default ValidationErrors;
