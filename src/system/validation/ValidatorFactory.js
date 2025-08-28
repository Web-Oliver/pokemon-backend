/**
 * ValidatorFactory - Simple validation utilities
 */

import mongoose from 'mongoose';

class ValidatorFactory {
  // ObjectId validation
  static validateObjectId(id, fieldName) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error(`${fieldName} must be a valid ObjectId`);
    }
  }

  static isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
  }

  // Pagination validation
  static validatePagination(page = 1, limit = 10, maxLimit = 100) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 10));
    return { pageNum, limitNum };
  }

  // Number validation
  static number(value, fieldName, options = {}) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a number`);
    }
    if (options.min !== undefined && num < options.min) {
      throw new Error(`${fieldName} must be at least ${options.min}`);
    }
    if (options.max !== undefined && num > options.max) {
      throw new Error(`${fieldName} must be at most ${options.max}`);
    }
    if (options.integer && !Number.isInteger(num)) {
      throw new Error(`${fieldName} must be an integer`);
    }
    if (options.required && value === undefined) {
      throw new Error(`${fieldName} is required`);
    }
  }

  // Enum validation
  static enum(value, allowedValues, fieldName) {
    if (!allowedValues.includes(value)) {
      throw new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
    }
  }

  // Year validation
  static validateYear(year) {
    const yearNum = parseInt(year, 10);
    if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 10) {
      throw new Error('Year must be a valid year');
    }
    return yearNum;
  }

  // Sale details validation
  static saleDetails(saleDetails) {
    if (!saleDetails || typeof saleDetails !== 'object') {
      throw new Error('Sale details must be an object');
    }
    // Add specific sale validation as needed
  }

  // Collection item data validation
  static collectionItemData(data, entityName) {
    if (!data || typeof data !== 'object') {
      throw new Error(`${entityName} data must be an object`);
    }
    // Add specific collection item validation as needed
  }

  // Pokemon-specific validators
  static validateUniquePokemonId(pokemonId) {
    // Implementation for unique Pokemon ID validation
    return true;
  }

  static validateUniqueSetId(setId) {
    // Implementation for unique Set ID validation
    return true;
  }

  static validateGrades(grades) {
    // Implementation for grades validation
    return true;
  }

  static validateTotalGrades(totalGrades) {
    // Implementation for total grades validation
    return true;
  }

  // Sales utilities
  static get salesUtils() {
    return {
      validators: {
        // Add sales-specific validators as needed
      },
      errorHandlers: {
        // Add error handlers as needed
      },
      successLoggers: {
        // Add success loggers as needed
      }
    };
  }
}

export default ValidatorFactory;
