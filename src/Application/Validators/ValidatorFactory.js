import mongoose from 'mongoose';
import { ValidationError   } from '@/Presentation/Middleware/errorHandler.js';
// Import specialized validators
import BaseValidator from './validation/BaseValidator.js';
import ValidationErrors from './validation/ValidationErrors.js';
import ValidationRules from './validation/ValidationRules.js';
import PriceValidator from './validation/PriceValidator.js';
import ObjectIdValidator from './validation/ObjectIdValidator.js';
import DateValidator from './validation/DateValidator.js';
import EmailValidator from './validation/EmailValidator.js';
import { SalesValidator, SalesValidators, SalesErrorHandlers, SalesSuccessLoggers   } from './validation/SalesValidator.js';
import PaginationValidator from './validation/PaginationValidator.js';
/**
 * Unified Validator Factory
 *
 * Central entry point for all validation operations in the application.
 * Provides access to specialized validators while maintaining backward compatibility.
 *
 * Following SOLID principles:
 * - Single Responsibility: Orchestrates validation operations
 * - Open/Closed: Extensible through specialized validator addition
 * - Interface Segregation: Each validator handles specific domain
 * - Dependency Inversion: Uses ValidationError abstraction
 * - Liskov Substitution: All validators implement consistent interfaces
 */
class ValidatorFactory {
  /**
   * Create a price validator instance
   * @returns {PriceValidator} Price validator class
   */
  static price() {
    return PriceValidator;
  }

  /**
   * Validate price value (backward compatibility)
   * @param {any} price - Price value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @throws {ValidationError} - If validation fails
   */
  static validatePrice(price, fieldName = 'Price', options = {}) {
    return PriceValidator.validatePrice(price, fieldName, options);
  }

  /**
   * Create an ObjectId validator instance
   * @returns {ObjectIdValidator} ObjectId validator class
   */
  static objectId() {
    return ObjectIdValidator;
  }

  /**
   * Validate ObjectId value (backward compatibility)
   * @param {any} id - ID value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @throws {ValidationError} - If validation fails
   */
  static validateObjectId(id, fieldName = 'ID', options = {}) {
    return ObjectIdValidator.validateObjectId(id, fieldName, options);
  }

  /**
   * Validate array of images
   * @param {any} images - Images array to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {ValidationError} - If validation fails
   */
  static imageArray(images, fieldName = 'Images') {
    return BaseValidator.validateArray(images, fieldName, {
      required: false,
      maxLength: ValidationRules.ARRAY.IMAGE_ARRAY_MAX,
      itemValidator: (image, itemFieldName) => {
        BaseValidator.validateString(image, itemFieldName, {
          required: true,
          minLength: 1,
          maxLength: 500
        });
      }
    });
  }

  /**
   * Validate required field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {ValidationError} - If validation fails
   */
  static required(value, fieldName = 'Field') {
    return BaseValidator.validateRequired(value, fieldName);
  }

  /**
   * Validate string field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @throws {ValidationError} - If validation fails
   */
  static string(value, fieldName = 'String field', options = {}) {
    return BaseValidator.validateString(value, fieldName, options);
  }

  /**
   * Validate number field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @throws {ValidationError} - If validation fails
   */
  static number(value, fieldName = 'Number field', options = {}) {
    return BaseValidator.validateNumber(value, fieldName, options);
  }

  /**
   * Validate boolean field
   * @param {any} value - Value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static boolean(value, fieldName = 'Boolean field', required = false) {
    return BaseValidator.validateType(value, 'boolean', fieldName, required);
  }

  /**
   * Create an email validator instance
   * @returns {EmailValidator} Email validator class
   */
  static email() {
    return EmailValidator;
  }

  /**
   * Validate email format (backward compatibility)
   * @param {any} email - Email to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static validateEmail(email, fieldName = 'Email', required = false) {
    return EmailValidator.validateEmail(email, fieldName, { required });
  }

  /**
   * Create a date validator instance
   * @returns {DateValidator} Date validator class
   */
  static date() {
    return DateValidator;
  }

  /**
   * Validate date field (backward compatibility)
   * @param {any} date - Date to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static validateDate(date, fieldName = 'Date', required = false) {
    return DateValidator.validateDate(date, fieldName, { required });
  }

  /**
   * Validate enum/choice field
   * @param {any} value - Value to validate
   * @param {Array|string} choices - Array of valid choices or enum type name
   * @param {string} fieldName - Name of the field for error messages
   * @param {boolean} required - Whether field is required
   * @throws {ValidationError} - If validation fails
   */
  static enum(value, choices, fieldName = 'Field', required = false) {
    if (typeof choices === 'string') {
      // Use ValidationRules enum
      return BaseValidator.validateEnum(value, choices, fieldName, required);
    } else if (Array.isArray(choices)) {
      // Direct array validation (backward compatibility)
      if (required && (value === null || value === undefined)) {
        throw ValidationErrors.required(fieldName);
      }

      if (value === null || value === undefined) {
        return; // Allow null/undefined for non-required fields
      }

      if (!choices.includes(value)) {
        throw ValidationErrors.invalidEnum(fieldName, choices, value);
      }
    } else {
      throw ValidationErrors.custom(fieldName, 'Validation choices must be an array or enum type name', choices);
    }
  }

  /**
   * Validate MongoDB collection item data
   * @param {Object} data - Data object to validate
   * @param {string} entityType - Type of entity for context
   * @throws {ValidationError} - If validation fails
   */
  static collectionItemData(data, entityType = 'Item') {
    this.required(data, `${entityType} data`);

    if (typeof data !== 'object') {
      throw ValidationErrors.invalidType(`${entityType} data`, 'object', data);
    }

    // Validate common collection item fields using specialized validators
    if (data.myPrice !== undefined) {
      PriceValidator.validatePrice(data.myPrice, 'Price');
    }

    if (data.images !== undefined) {
      this.imageArray(data.images, 'Images');
    }

    if (data.sold !== undefined) {
      this.boolean(data.sold, 'Sold status');
    }

    if (data.dateAdded !== undefined) {
      DateValidator.validateDate(data.dateAdded, 'Date added');
    }
  }

  /**
   * Create a sales validator instance
   * @returns {SalesValidator} Sales validator class
   */
  static sales() {
    return SalesValidator;
  }

  /**
   * Validate sale details object (backward compatibility)
   * @param {Object} saleDetails - Sale details to validate
   * @throws {ValidationError} - If validation fails
   */
  static saleDetails(saleDetails) {
    return SalesValidator.validateSaleDetails(saleDetails);
  }

  /**
   * Create a pagination validator instance
   * @returns {PaginationValidator} Pagination validator class
   */
  static pagination() {
    return PaginationValidator;
  }

  /**
   * Validate pagination parameters (backward compatibility)
   * @param {Object} params - Pagination parameters
   * @throws {ValidationError} - If validation fails
   */
  static paginationParams(params = {}) {
    return PaginationValidator.validatePaginationParams(params);
  }

  /**
   * Validate search parameters (backward compatibility)
   * @param {Object} params - Search parameters
   * @throws {ValidationError} - If validation fails
   */
  static searchParams(params = {}) {
    return PaginationValidator.validateSearchParams(params);
  }

  // ===== SPECIALIZED VALIDATOR ACCESS =====

  /**
   * Get ValidationRules for constants and rule definitions
   * @returns {ValidationRules} Validation rules class
   */
  static get rules() {
    return ValidationRules;
  }

  /**
   * Get ValidationErrors for error creation
   * @returns {ValidationErrors} Validation errors class
   */
  static get errors() {
    return ValidationErrors;
  }

  /**
   * Get BaseValidator for custom validation logic
   * @returns {BaseValidator} Base validator class
   */
  static get base() {
    return BaseValidator;
  }

  /**
   * Get pre-configured sales validators and utilities
   * @returns {Object} Sales validation utilities
   */
  static get salesUtils() {
    return {
      validators: SalesValidators,
      errorHandlers: SalesErrorHandlers,
      successLoggers: SalesSuccessLoggers
    };
  }

  // ===== GRADE VALIDATION (specialized domain logic) =====

  /**
   * Validate total grades structure for sets
   * @param {Object} totalGrades - Total grades object
   * @throws {ValidationError} - If validation fails
   */
  static validateTotalGrades(totalGrades) {
    const validation = ValidationRules.GRADE_VALIDATION.validateGradeStructure(totalGrades, true);

    if (!validation.isValid) {
      throw ValidationErrors.custom('Total grades', validation.errors.join(', '), totalGrades);
    }

    // Validate that total_graded equals sum of all individual grades
    const gradeSum = Object.keys(totalGrades)
      .filter(key => key.startsWith('grade_') && key !== 'total_graded')
      .reduce((sum, key) => sum + (parseInt(totalGrades[key], 10) || 0), 0);

    if (totalGrades.total_graded !== gradeSum) {
      throw ValidationErrors.custom(
        'Total grades',
        'total_graded must equal sum of all individual grade levels',
        totalGrades,
        { expectedSum: gradeSum, actualTotal: totalGrades.total_graded }
      );
    }
  }

  /**
   * Validate grades structure for cards
   * @param {Object} grades - Grades object
   * @throws {ValidationError} - If validation fails
   */
  static validateGrades(grades) {
    const validation = ValidationRules.GRADE_VALIDATION.validateGradeStructure(grades, false);

    if (!validation.isValid) {
      throw ValidationErrors.custom('Grades', validation.errors.join(', '), grades);
    }

    // Validate that grade_total equals sum of all individual grades
    const gradeSum = Object.keys(grades)
      .filter(key => key.startsWith('grade_') && key !== 'grade_total')
      .reduce((sum, key) => sum + (parseInt(grades[key], 10) || 0), 0);

    if (grades.grade_total !== gradeSum) {
      throw ValidationErrors.custom(
        'Grades',
        'grade_total must equal sum of all individual grade levels',
        grades,
        { expectedSum: gradeSum, actualTotal: grades.grade_total }
      );
    }
  }

  /**
   * Validate unique set ID for migration data
   * @param {any} uniqueSetId - Unique set ID
   * @returns {number} Validated unique set ID
   * @throws {ValidationError} - If validation fails
   */
  static validateUniqueSetId(uniqueSetId) {
    return ObjectIdValidator.validateUniqueSetId(uniqueSetId);
  }

  /**
   * Validate unique pokemon ID for migration data
   * @param {any} uniquePokemonId - Unique pokemon ID
   * @returns {number} Validated unique pokemon ID
   * @throws {ValidationError} - If validation fails
   */
  static validateUniquePokemonId(uniquePokemonId) {
    return ObjectIdValidator.validateUniquePokemonId(uniquePokemonId);
  }

  /**
   * Validate year value
   * @param {any} year - Year to validate
   * @returns {number} Validated year
   * @throws {ValidationError} - If validation fails
   */
  static validateYear(year) {
    return DateValidator.validateYear(year);
  }

  /**
   * Validate pagination parameters with normalization
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @param {number} maxLimit - Maximum allowed limit
   * @returns {Object} Normalized pagination parameters
   * @throws {ValidationError} - If validation fails
   */
  static validatePagination(page = 1, limit = 50, maxLimit = 100) {
    const pageNum = PaginationValidator.validatePage(page);
    const limitNum = PaginationValidator.validateLimit(limit, { maxLimit });

    return { pageNum, limitNum };
  }
}

export default ValidatorFactory;
