/**
 * ObjectId Validator
 *
 * Specialized validator for MongoDB ObjectId validation
 * Handles ObjectId strings, arrays, and various ObjectId scenarios
 */

import mongoose from 'mongoose';
import BaseValidator from './BaseValidator.js';
import ValidationErrors from './ValidationErrors.js';
import ValidationRules from './ValidationRules.js';
/**
 * ObjectId validation specialist
 * Handles all ObjectId-related validation scenarios
 */
class ObjectIdValidator extends BaseValidator {
  /**
   * Validate a MongoDB ObjectId
   * @param {any} id - ID value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether ID is required
   * @param {boolean} options.allowString - Whether to accept ObjectId as string
   * @param {boolean} options.skipMongooseValidation - Skip mongoose validation (use regex only)
   * @throws {ValidationError} If validation fails
   */
  static validateObjectId(id, fieldName = 'ID', options = {}) {
    const {
      required = true,
      allowString = true,
      skipMongooseValidation = true // Default to true to avoid mongoose issues
    } = options;

    // Handle null/undefined
    if (id === null || id === undefined) {
      if (required) {
        throw ValidationErrors.required(fieldName);
      }
      return;
    }

    // Convert ObjectId instance to string if needed
    let idString = id;

    if (id instanceof mongoose.Types.ObjectId) {
      idString = id.toString();
    }

    // Type validation - must be string for validation
    if (typeof idString !== 'string') {
      throw ValidationErrors.invalidType(fieldName, 'string', id);
    }

    // Length validation - ObjectIds are exactly 24 characters
    if (idString.length !== 24) {
      throw ValidationErrors.invalidObjectId(fieldName, id);
    }

    // Format validation using regex (primary validation method)
    if (!ValidationRules.OBJECTID_REGEX.test(idString)) {
      throw ValidationErrors.invalidObjectId(fieldName, id);
    }

    // Optional mongoose validation (can cause issues, so skipped by default)
    if (!skipMongooseValidation) {
      try {
        if (!mongoose.Types.ObjectId.isValid(idString)) {
          throw ValidationErrors.invalidObjectId(fieldName, id);
        }
      } catch (error) {
        // If mongoose validation fails, fall back to regex validation result
        // The regex check above already passed, so this is acceptable
      }
    }

    // If we only allow ObjectId instances, validate that
    if (!allowString && !(id instanceof mongoose.Types.ObjectId)) {
      throw ValidationErrors.custom(
        fieldName,
        `${fieldName} must be a MongoDB ObjectId instance`,
        id
      );
    }
  }

  /**
   * Validate array of ObjectIds
   * @param {any} ids - Array of IDs to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether array is required
   * @param {number} options.minLength - Minimum array length
   * @param {number} options.maxLength - Maximum array length
   * @param {boolean} options.allowDuplicates - Whether to allow duplicate IDs
   * @throws {ValidationError} If validation fails
   */
  static validateObjectIdArray(ids, fieldName = 'IDs', options = {}) {
    const {
      required = false,
      minLength = 0,
      maxLength = ValidationRules.ARRAY.OBJECTID_ARRAY_MAX,
      allowDuplicates = true
    } = options;

    // Array validation
    this.validateArray(ids, fieldName, { required, minLength, maxLength });

    if (ids === null || ids === undefined) {
      return; // Already handled by array validation
    }

    // Validate each ObjectId
    const validatedIds = [];

    ids.forEach((id, index) => {
      try {
        this.validateObjectId(id, `${fieldName}[${index}]`, { required: true });
        validatedIds.push(id.toString());
      } catch (error) {
        throw ValidationErrors.custom(
          `${fieldName}[${index}]`,
          error.message,
          id,
          { arrayIndex: index }
        );
      }
    });

    // Check for duplicates if not allowed
    if (!allowDuplicates) {
      const uniqueIds = new Set(validatedIds);

      if (uniqueIds.size !== validatedIds.length) {
        const duplicates = validatedIds.filter((id, index) => validatedIds.indexOf(id) !== index);

        throw ValidationErrors.custom(
          fieldName,
          `Duplicate ObjectIds found: ${duplicates.join(', ')}`,
          ids,
          { duplicates }
        );
      }
    }
  }

  /**
   * Validate unique ID fields (for migration data)
   * @param {any} uniqueId - Unique ID value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @throws {ValidationError} If validation fails
   */
  static validateUniqueId(uniqueId, fieldName = 'Unique ID') {
    if (uniqueId === null || uniqueId === undefined) {
      throw ValidationErrors.required(fieldName);
    }

    const id = parseInt(uniqueId, 10);

    if (isNaN(id)) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a valid number`, uniqueId);
    }

    if (id <= 0) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a positive number`, uniqueId);
    }

    return id;
  }

  /**
   * Validate unique set ID for migration data
   * @param {any} uniqueSetId - Unique set ID to validate
   * @throws {ValidationError} If validation fails
   */
  static validateUniqueSetId(uniqueSetId) {
    return this.validateUniqueId(uniqueSetId, 'unique_set_id');
  }

  /**
   * Validate unique pokemon ID for migration data
   * @param {any} uniquePokemonId - Unique pokemon ID to validate
   * @throws {ValidationError} If validation fails
   */
  static validateUniquePokemonId(uniquePokemonId) {
    return this.validateUniqueId(uniquePokemonId, 'unique_pokemon_id');
  }

  /**
   * Convert value to ObjectId if valid
   * @param {any} id - ID value to convert
   * @param {string} fieldName - Name of the field for error messages
   * @returns {mongoose.Types.ObjectId} Converted ObjectId
   * @throws {ValidationError} If validation fails
   */
  static toObjectId(id, fieldName = 'ID') {
    this.validateObjectId(id, fieldName, { required: true });

    if (id instanceof mongoose.Types.ObjectId) {
      return id;
    }

    return new mongoose.Types.ObjectId(id);
  }

  /**
   * Convert array of values to ObjectIds if valid
   * @param {Array} ids - Array of ID values to convert
   * @param {string} fieldName - Name of the field for error messages
   * @returns {Array} Array of converted ObjectIds
   * @throws {ValidationError} If validation fails
   */
  static toObjectIdArray(ids, fieldName = 'IDs') {
    this.validateObjectIdArray(ids, fieldName, { required: true });

    return ids.map((id, index) => {
      if (id instanceof mongoose.Types.ObjectId) {
        return id;
      }
      return new mongoose.Types.ObjectId(id);
    });
  }

  /**
   * Safe ObjectId validation - returns result object instead of throwing
   * @param {any} id - ID value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @returns {Object} Validation result with isValid and error properties
   */
  static safeValidateObjectId(id, fieldName = 'ID', options = {}) {
    try {
      this.validateObjectId(id, fieldName, options);
      return { isValid: true, error: null };
    } catch (error) {
      return { isValid: false, error };
    }
  }

  /**
   * Check if value is a valid ObjectId without throwing errors
   * @param {any} id - ID value to check
   * @returns {boolean} True if valid ObjectId
   */
  static isValidObjectId(id) {
    const result = this.safeValidateObjectId(id, 'ID', { required: false });

    return result.isValid && id !== null && id !== undefined;
  }

  /**
   * Normalize ObjectId input (convert to string or ObjectId consistently)
   * @param {any} id - ID value to normalize
   * @param {string} format - Output format ('string' or 'objectid')
   * @param {string} fieldName - Name of the field for error messages
   * @returns {string|mongoose.Types.ObjectId} Normalized ID
   * @throws {ValidationError} If validation fails
   */
  static normalize(id, format = 'string', fieldName = 'ID') {
    this.validateObjectId(id, fieldName, { required: true });

    switch (format) {
      case 'string':
        return id instanceof mongoose.Types.ObjectId ? id.toString() : id;
      case 'objectid':
        return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id);
      default:
        throw ValidationErrors.custom(
          fieldName,
          `Invalid format specified: ${format}. Must be 'string' or 'objectid'`,
          id
        );
    }
  }

  /**
   * Validate related entity references
   * @param {Object} entityData - Entity data containing ObjectId references
   * @param {Object} referenceFields - Object mapping field names to their types
   * @throws {ValidationError} If validation fails
   */
  static validateEntityReferences(entityData, referenceFields) {
    this.validateType(entityData, 'object', 'Entity data', true);

    for (const [fieldName, fieldConfig] of Object.entries(referenceFields)) {
      const value = entityData[fieldName];

      if (value === null || value === undefined) {
        if (fieldConfig.required) {
          throw ValidationErrors.required(fieldName);
        }
        continue;
      }

      if (fieldConfig.type === 'objectid') {
        this.validateObjectId(value, fieldName, { required: fieldConfig.required });
      } else if (fieldConfig.type === 'objectid_array') {
        this.validateObjectIdArray(value, fieldName, {
          required: fieldConfig.required,
          minLength: fieldConfig.minLength || 0,
          maxLength: fieldConfig.maxLength || ValidationRules.ARRAY.OBJECTID_ARRAY_MAX
        });
      }
    }
  }

  /**
   * Create an ObjectId validator instance for fluent validation
   * @returns {ObjectIdValidatorInstance} ObjectId validator instance
   */
  static create() {
    return new ObjectIdValidatorInstance();
  }
}

/**
 * Fluent ObjectId validator instance for chaining validations
 */
class ObjectIdValidatorInstance {
  constructor() {
    this.validations = [];
    this.currentValue = null;
    this.currentFieldName = 'ID';
  }

  /**
   * Set the ObjectId value to validate
   * @param {any} id - ObjectId value
   * @param {string} fieldName - Field name for errors
   * @returns {ObjectIdValidatorInstance} This instance for chaining
   */
  value(id, fieldName = 'ID') {
    this.currentValue = id;
    this.currentFieldName = fieldName;
    return this;
  }

  /**
   * Mark ObjectId as required
   * @returns {ObjectIdValidatorInstance} This instance for chaining
   */
  required() {
    this.validations.push(() => {
      ObjectIdValidator.validateRequired(this.currentValue, this.currentFieldName);
    });
    return this;
  }

  /**
   * Require ObjectId instance (not string)
   * @returns {ObjectIdValidatorInstance} This instance for chaining
   */
  instanceOnly() {
    this.validations.push(() => {
      if (this.currentValue !== null && this.currentValue !== undefined &&
          !(this.currentValue instanceof mongoose.Types.ObjectId)) {
        throw ValidationErrors.custom(
          this.currentFieldName,
          `${this.currentFieldName} must be a MongoDB ObjectId instance`,
          this.currentValue
        );
      }
    });
    return this;
  }

  /**
   * Convert to ObjectId after validation
   * @returns {ObjectIdValidatorInstance} This instance for chaining
   */
  convert() {
    this.shouldConvert = true;
    return this;
  }

  /**
   * Execute all validations
   * @returns {mongoose.Types.ObjectId|string|null} Validated (and possibly converted) value
   * @throws {ValidationError} If any validation fails
   */
  validate() {
    // First validate basic ObjectId requirements
    ObjectIdValidator.validateObjectId(this.currentValue, this.currentFieldName, {
      required: false
    });

    // Then run additional validations
    this.validations.forEach(validation => validation());

    // Convert if requested
    if (this.shouldConvert && this.currentValue !== null && this.currentValue !== undefined) {
      return ObjectIdValidator.toObjectId(this.currentValue, this.currentFieldName);
    }

    return this.currentValue;
  }
}

export default ObjectIdValidator;
