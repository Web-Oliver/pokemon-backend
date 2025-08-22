/**
 * Base Validator
 *
 * Abstract base class providing common validation patterns and utilities
 * All specialized validators extend this class for consistency
 */

import ValidationErrors from './ValidationErrors.js';
import ValidationRules from './ValidationRules.js';
/**
 * Base validator class with common validation patterns
 * Provides foundation for all specialized validators
 */
class BaseValidator {
  /**
   * Validate that a value is not null or undefined
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field
   * @throws {ValidationError} If value is null or undefined
   */
  static validateRequired(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      throw ValidationErrors.required(fieldName);
    }
  }

  /**
   * Validate value type
   * @param {any} value - Value to validate
   * @param {string} expectedType - Expected type ('string', 'number', 'boolean', 'object', 'array')
   * @param {string} fieldName - Name of the field
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} If type validation fails
   */
  static validateType(value, expectedType, fieldName, required = false) {
    if (required) {
      this.validateRequired(value, fieldName);
    }

    if (value === null || value === undefined) {
      return; // Allow null/undefined for non-required fields
    }

    let isValidType = false;

    switch (expectedType) {
      case 'string':
        isValidType = typeof value === 'string';
        break;
      case 'number':
        isValidType = typeof value === 'number' && !isNaN(value);
        break;
      case 'boolean':
        isValidType = typeof value === 'boolean';
        break;
      case 'object':
        isValidType = typeof value === 'object' && value !== null && !Array.isArray(value);
        break;
      case 'array':
        isValidType = Array.isArray(value);
        break;
      case 'function':
        isValidType = typeof value === 'function';
        break;
      default:
        throw ValidationErrors.custom(fieldName, `Unknown expected type: ${expectedType}`, value);
    }

    if (!isValidType) {
      throw ValidationErrors.invalidType(fieldName, expectedType, value);
    }
  }

  /**
   * Validate string with comprehensive options
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether field is required
   * @param {number} options.minLength - Minimum length
   * @param {number} options.maxLength - Maximum length
   * @param {string} options.pattern - Pattern type from ValidationRules
   * @param {RegExp} options.customRegex - Custom regex pattern
   * @throws {ValidationError} If validation fails
   */
  static validateString(value, fieldName, options = {}) {
    const {
      required = false,
      minLength = 0,
      maxLength = ValidationRules.STRING.DEFAULT_MAX_LENGTH,
      pattern = null,
      customRegex = null
    } = options;

    // Type validation
    this.validateType(value, 'string', fieldName, required);

    if (value === null || value === undefined) {
      return; // Already handled by type validation
    }

    // Length validation
    if (value.length < minLength || value.length > maxLength) {
      throw ValidationErrors.invalidLength(fieldName, minLength, maxLength, value);
    }

    // Pattern validation
    if (pattern && !ValidationRules.isValidStringPattern(value, pattern)) {
      throw ValidationErrors.invalidFormat(fieldName, `${pattern} pattern`, value);
    }

    // Custom regex validation
    if (customRegex && !customRegex.test(value)) {
      throw ValidationErrors.invalidFormat(fieldName, 'specified format', value);
    }
  }

  /**
   * Validate number with comprehensive options
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether field is required
   * @param {number} options.min - Minimum value
   * @param {number} options.max - Maximum value
   * @param {boolean} options.integer - Whether value must be integer
   * @throws {ValidationError} If validation fails
   */
  static validateNumber(value, fieldName, options = {}) {
    const {
      required = false,
      min = -Infinity,
      max = Infinity,
      integer = false
    } = options;

    // Type validation
    this.validateType(value, 'number', fieldName, required);

    if (value === null || value === undefined) {
      return; // Already handled by type validation
    }

    // Finite validation
    if (!isFinite(value)) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a finite number`, value);
    }

    // Integer validation
    if (integer && !Number.isInteger(value)) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be an integer`, value);
    }

    // Range validation
    if (value < min || value > max) {
      throw ValidationErrors.outOfRange(fieldName, min, max, value);
    }
  }

  /**
   * Validate array with comprehensive options
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether field is required
   * @param {number} options.minLength - Minimum array length
   * @param {number} options.maxLength - Maximum array length
   * @param {Function} options.itemValidator - Function to validate each item
   * @throws {ValidationError} If validation fails
   */
  static validateArray(value, fieldName, options = {}) {
    const {
      required = false,
      minLength = 0,
      maxLength = ValidationRules.ARRAY.DEFAULT_MAX_LENGTH,
      itemValidator = null
    } = options;

    // Type validation
    this.validateType(value, 'array', fieldName, required);

    if (value === null || value === undefined) {
      return; // Already handled by type validation
    }

    // Length validation
    if (value.length < minLength || value.length > maxLength) {
      throw ValidationErrors.invalidLength(fieldName, minLength, maxLength, value);
    }

    // Item validation
    if (itemValidator && typeof itemValidator === 'function') {
      value.forEach((item, index) => {
        try {
          itemValidator(item, `${fieldName}[${index}]`);
        } catch (error) {
          throw ValidationErrors.custom(
            `${fieldName}[${index}]`,
            error.message,
            item,
            { arrayIndex: index }
          );
        }
      });
    }
  }

  /**
   * Validate enum value
   * @param {any} value - Value to validate
   * @param {string} enumType - Enum type from ValidationRules.ENUMS
   * @param {string} fieldName - Name of the field
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} If validation fails
   */
  static validateEnum(value, enumType, fieldName, required = false) {
    if (required) {
      this.validateRequired(value, fieldName);
    }

    if (value === null || value === undefined) {
      return; // Allow null/undefined for non-required fields
    }

    const allowedValues = ValidationRules.getEnumValues(enumType);

    if (allowedValues.length === 0) {
      throw ValidationErrors.custom(fieldName, `Unknown enum type: ${enumType}`, value);
    }

    if (!allowedValues.includes(value)) {
      throw ValidationErrors.invalidEnum(fieldName, allowedValues, value);
    }
  }

  /**
   * Validate object has required fields
   * @param {any} obj - Object to validate
   * @param {Array} requiredFields - Array of required field names
   * @param {string} objectName - Name of object for error messages
   * @throws {ValidationError} If validation fails
   */
  static validateRequiredFields(obj, requiredFields, objectName) {
    this.validateType(obj, 'object', objectName, true);

    const missingFields = requiredFields.filter(field =>
      obj[field] === undefined || obj[field] === null || obj[field] === ''
    );

    if (missingFields.length > 0) {
      throw ValidationErrors.custom(
        objectName,
        `Missing required fields: ${missingFields.join(', ')}`,
        obj,
        { missingFields }
      );
    }
  }

  /**
   * Batch validation helper - validates multiple fields and collects errors
   * @param {Array} validations - Array of validation functions to execute
   * @param {boolean} throwOnFirst - Whether to throw on first error or collect all
   * @returns {Array} Array of validation errors (empty if all valid)
   * @throws {ValidationError} If throwOnFirst is true and validation fails
   */
  static batchValidate(validations, throwOnFirst = true) {
    const errors = [];

    for (const validation of validations) {
      try {
        if (typeof validation === 'function') {
          validation();
        }
      } catch (error) {
        if (throwOnFirst) {
          throw error;
        }
        errors.push(error);
      }
    }

    return errors;
  }

  /**
   * Create validation result object
   * @param {boolean} isValid - Whether validation passed
   * @param {Array} errors - Array of validation errors
   * @param {Object} context - Additional context information
   * @returns {Object} Validation result
   */
  static createValidationResult(isValid, errors = [], context = {}) {
    return {
      isValid,
      errors: errors.map(error => ({
        message: error.message,
        field: error.field,
        value: error.value,
        context: error.context
      })),
      context
    };
  }

  /**
   * Safe validation wrapper - catches errors and returns result object
   * @param {Function} validationFn - Validation function to execute
   * @param {Object} context - Context information for result
   * @returns {Object} Validation result with isValid and errors
   */
  static safeValidate(validationFn, context = {}) {
    try {
      validationFn();
      return this.createValidationResult(true, [], context);
    } catch (error) {
      return this.createValidationResult(false, [error], context);
    }
  }
}

export default BaseValidator;
