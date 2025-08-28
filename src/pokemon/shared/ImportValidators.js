/**
 * Import Data Validators
 *
 * Comprehensive validation utilities for import data using Context7 best practices.
 * Implements robust validation patterns with detailed error reporting.
 *
 * Based on Mongoose documentation and Context7 optimization research:
 * - Pre-validation prevents invalid data from reaching MongoDB
 * - Structured error handling with actionable feedback
 * - Performance-optimized validation patterns
 */

class ImportValidationError extends Error {
  constructor(message, field, value, source) {
    super(message);
    this.name = 'ImportValidationError';
    this.field = field;
    this.value = value;
    this.source = source;
  }
}

class ImportValidators {
  /**
   * Validates Set data structure from new_sets JSON files
   * @param {Object} setData - Set data to validate
   * @param {string} source - Source file name for error reporting
   * @returns {Object} Validated and normalized set data
   * @throws {ImportValidationError} If validation fails
   */
  static validateSetData(setData, source = 'unknown') {
    const errors = [];

    // Validate required structure
    if (!setData.set_details) {
      throw new ImportValidationError('Missing set_details structure', 'set_details', undefined, source);
    }

    if (!setData.set_details.set_info) {
      throw new ImportValidationError('Missing set_info structure', 'set_info', undefined, source);
    }

    const setInfo = setData.set_details.set_info;
    const totalGrades = setData.set_details.total_grades || {};

    // Required fields validation
    const requiredFields = {
      name: 'string',
      year: ['string', 'number'],
      url: 'string',
      total_cards: ['string', 'number'],
      unique_set_id: ['string', 'number']
    };

    for (const [field, expectedType] of Object.entries(requiredFields)) {
      if (setInfo[field] === undefined || setInfo[field] === null) {
        errors.push(`Missing required field: ${field}`);
        continue;
      }

      const actualType = typeof setInfo[field];
      const acceptedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];

      if (!acceptedTypes.includes(actualType)) {
        errors.push(`Field '${field}' must be of type ${acceptedTypes.join(' or ')}, got ${actualType}`);
      }
    }

    // Specific field validations
    if (setInfo.name && typeof setInfo.name === 'string') {
      if (setInfo.name.trim().length === 0) {
        errors.push('Set name cannot be empty');
      }
      if (setInfo.name.length > 200) {
        errors.push('Set name cannot exceed 200 characters');
      }
    }

    if (setInfo.year) {
      const year = parseInt(setInfo.year, 10);

      if (isNaN(year) || year < 1996 || year > new Date().getFullYear() + 2) {
        errors.push(`Invalid year: ${setInfo.year}. Must be between 1996 and ${new Date().getFullYear() + 2}`);
      }
    }

    if (setInfo.url && typeof setInfo.url === 'string') {
      try {
        new URL(setInfo.url);
      } catch {
        errors.push(`Invalid URL format: ${setInfo.url}`);
      }
    }

    if (setInfo.total_cards) {
      const totalCards = parseInt(setInfo.total_cards, 10);

      if (isNaN(totalCards) || totalCards < 1 || totalCards > 5000) {
        errors.push(`Invalid total_cards: ${setInfo.total_cards}. Must be between 1 and 5000`);
      }
    }

    if (setInfo.unique_set_id) {
      const uniqueSetId = parseInt(setInfo.unique_set_id, 10);

      if (isNaN(uniqueSetId) || uniqueSetId < 1) {
        errors.push(`Invalid unique_set_id: ${setInfo.unique_set_id}. Must be a positive integer`);
      }
    }

    // Validate total_grades structure
    if (totalGrades) {
      const gradeFields = ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5',
                          'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'total_graded'];

      for (const gradeField of gradeFields) {
        if (totalGrades[gradeField] !== undefined) {
          const gradeValue = parseInt(totalGrades[gradeField], 10);

          if (isNaN(gradeValue) || gradeValue < 0) {
            errors.push(`Invalid ${gradeField}: ${totalGrades[gradeField]}. Must be a non-negative integer`);
          }
        }
      }

      // Validate total_graded consistency
      if (totalGrades.total_graded !== undefined) {
        const calculatedTotal = gradeFields.slice(0, -1) // Exclude total_graded
          .reduce((sum, field) => sum + (parseInt(totalGrades[field], 10) || 0), 0);

        const reportedTotal = parseInt(totalGrades.total_graded, 10);

        if (Math.abs(calculatedTotal - reportedTotal) > calculatedTotal * 0.1) { // Allow 10% variance
          errors.push(`Total graded mismatch: calculated ${calculatedTotal}, reported ${reportedTotal}`);
        }
      }
    }

    if (errors.length > 0) {
      throw new ImportValidationError(
        `Set validation failed: ${errors.join('; ')}`,
        'multiple',
        setData,
        source
      );
    }

    // Return normalized data
    return {
      setName: setInfo.name.trim(),
      year: parseInt(setInfo.year, 10),
      setUrl: setInfo.url,
      totalCardsInSet: parseInt(setInfo.total_cards, 10),
      uniqueSetId: parseInt(setInfo.unique_set_id, 10),
      total_grades: {
        grade_1: parseInt(totalGrades.grade_1, 10) || 0,
        grade_2: parseInt(totalGrades.grade_2, 10) || 0,
        grade_3: parseInt(totalGrades.grade_3, 10) || 0,
        grade_4: parseInt(totalGrades.grade_4, 10) || 0,
        grade_5: parseInt(totalGrades.grade_5, 10) || 0,
        grade_6: parseInt(totalGrades.grade_6, 10) || 0,
        grade_7: parseInt(totalGrades.grade_7, 10) || 0,
        grade_8: parseInt(totalGrades.grade_8, 10) || 0,
        grade_9: parseInt(totalGrades.grade_9, 10) || 0,
        grade_10: parseInt(totalGrades.grade_10, 10) || 0,
        total_graded: parseInt(totalGrades.total_graded, 10) || 0
      }
    };
  }

  /**
   * Validates Card data structure from new_sets JSON files
   * @param {Object} cardData - Card data to validate
   * @param {number} uniqueSetId - Parent set's unique ID
   * @param {string} source - Source file name for error reporting
   * @returns {Object} Validated and normalized card data
   * @throws {ImportValidationError} If validation fails
   */
  static validateCardData(cardData, uniqueSetId, source = 'unknown') {
    const errors = [];

    // Required fields validation
    if (!cardData.unique_pokemon_id) {
      errors.push('Missing required field: unique_pokemon_id');
    } else {
      const uniquePokemonId = parseInt(cardData.unique_pokemon_id, 10);

      if (isNaN(uniquePokemonId) || uniquePokemonId < 1) {
        errors.push(`Invalid unique_pokemon_id: ${cardData.unique_pokemon_id}. Must be a positive integer`);
      }
    }

    if (!cardData.name || typeof cardData.name !== 'string') {
      errors.push('Missing or invalid card name');
    } else if (cardData.name.trim().length === 0) {
      errors.push('Card name cannot be empty');
    } else if (cardData.name.length > 150) {
      errors.push('Card name cannot exceed 150 characters');
    }

    if (!cardData.card_number) {
      errors.push('Missing required field: card_number');
    } else if (typeof cardData.card_number !== 'string' && typeof cardData.card_number !== 'number') {
      errors.push('Card number must be a string or number');
    }

    // Optional fields validation
    if (cardData.variety && typeof cardData.variety !== 'string') {
      errors.push('Variety must be a string');
    }

    // Validate grades structure
    if (cardData.grades) {
      const gradeFields = ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5',
                          'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_total'];

      for (const gradeField of gradeFields) {
        if (cardData.grades[gradeField] !== undefined) {
          const gradeValue = parseInt(cardData.grades[gradeField], 10);

          if (isNaN(gradeValue) || gradeValue < 0) {
            errors.push(`Invalid ${gradeField}: ${cardData.grades[gradeField]}. Must be a non-negative integer`);
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new ImportValidationError(
        `Card validation failed: ${errors.join('; ')}`,
        'multiple',
        cardData,
        source
      );
    }

    // Return normalized data
    return {
      cardName: cardData.name.trim(),
      variety: cardData.variety ? cardData.variety.trim() : '',
      cardNumber: cardData.card_number.toString(),
      uniquePokemonId: parseInt(cardData.unique_pokemon_id, 10),
      uniqueSetId,
      grades: {
        grade_1: parseInt(cardData.grades?.grade_1, 10) || 0,
        grade_2: parseInt(cardData.grades?.grade_2, 10) || 0,
        grade_3: parseInt(cardData.grades?.grade_3, 10) || 0,
        grade_4: parseInt(cardData.grades?.grade_4, 10) || 0,
        grade_5: parseInt(cardData.grades?.grade_5, 10) || 0,
        grade_6: parseInt(cardData.grades?.grade_6, 10) || 0,
        grade_7: parseInt(cardData.grades?.grade_7, 10) || 0,
        grade_8: parseInt(cardData.grades?.grade_8, 10) || 0,
        grade_9: parseInt(cardData.grades?.grade_9, 10) || 0,
        grade_10: parseInt(cardData.grades?.grade_10, 10) || 0,
        grade_total: parseInt(cardData.grades?.grade_total, 10) || 0
      }
    };
  }

  /**
   * Validates SetProduct data structure from Products JSON files
   * @param {Object} productData - Product data containing setProductName
   * @param {string} source - Source file name for error reporting
   * @returns {Object} Validated and normalized set product data
   * @throws {ImportValidationError} If validation fails
   */
  static validateSetProductData(productData, source = 'unknown') {
    const errors = [];

    if (!productData.setProductName || typeof productData.setProductName !== 'string') {
      errors.push('Missing or invalid setProductName');
    } else if (productData.setProductName.trim().length === 0) {
      errors.push('setProductName cannot be empty');
    } else if (productData.setProductName.length > 200) {
      errors.push('setProductName cannot exceed 200 characters');
    }

    if (!productData.uniqueSetProductId) {
      errors.push('Missing required field: uniqueSetProductId');
    } else {
      const uniqueSetProductId = parseInt(productData.uniqueSetProductId, 10);

      if (isNaN(uniqueSetProductId) || uniqueSetProductId < 1) {
        errors.push(`Invalid uniqueSetProductId: ${productData.uniqueSetProductId}. Must be a positive integer`);
      }
    }

    if (errors.length > 0) {
      throw new ImportValidationError(
        `SetProduct validation failed: ${errors.join('; ')}`,
        'multiple',
        productData,
        source
      );
    }

    return {
      setProductName: productData.setProductName.trim(),
      uniqueSetProductId: parseInt(productData.uniqueSetProductId, 10)
    };
  }

  /**
   * Validates Product data structure from Products JSON files
   * @param {Object} productData - Product data to validate
   * @param {string} source - Source file name for error reporting
   * @returns {Object} Validated and normalized product data
   * @throws {ImportValidationError} If validation fails
   */
  static validateProductData(productData, source = 'unknown') {
    const errors = [];

    // Required fields validation
    const requiredStringFields = ['productName', 'setProductName', 'category'];

    for (const field of requiredStringFields) {
      if (!productData[field] || typeof productData[field] !== 'string') {
        errors.push(`Missing or invalid ${field}`);
      } else if (productData[field].trim().length === 0) {
        errors.push(`${field} cannot be empty`);
      }
    }

    if (!productData.uniqueProductId) {
      errors.push('Missing required field: uniqueProductId');
    } else {
      const uniqueProductId = parseInt(productData.uniqueProductId, 10);

      if (isNaN(uniqueProductId) || uniqueProductId < 1) {
        errors.push(`Invalid uniqueProductId: ${productData.uniqueProductId}. Must be a positive integer`);
      }
    }

    // Validate category against enum
    const validCategories = [
      'Blisters', 'Booster-Boxes', 'Boosters', 'Box-Sets',
      'Elite-Trainer-Boxes', 'Theme-Decks', 'Tins', 'Trainer-Kits'
    ];

    if (productData.category && !validCategories.includes(productData.category)) {
      errors.push(`Invalid category: ${productData.category}. Must be one of: ${validCategories.join(', ')}`);
    }

    // Validate available field
    if (productData.available !== undefined) {
      const availableStr = productData.available.toString().replace(/[^\d]/g, '');
      const availableNum = parseInt(availableStr, 10);

      if (isNaN(availableNum) || availableNum < 0) {
        errors.push(`Invalid available count: ${productData.available}. Must be a non-negative number`);
      }
    }

    // Validate price format - allow N/A and various formats
    if (productData.price && typeof productData.price === 'string') {
      // Allow N/A, various price formats like "10.50 €", "$10.50", "10,50", etc.
      const priceRegex = /^(N\/A|[\d.,]+.*)$/i;

      if (!priceRegex.test(productData.price)) {
        errors.push(`Invalid price format: ${productData.price}`);
      }
    }

    // Validate URL if provided
    if (productData.url && typeof productData.url === 'string') {
      try {
        new URL(productData.url);
      } catch {
        errors.push(`Invalid URL format: ${productData.url}`);
      }
    }

    if (errors.length > 0) {
      throw new ImportValidationError(
        `Product validation failed: ${errors.join('; ')}`,
        'multiple',
        productData,
        source
      );
    }

    // Parse available count
    let availableNum = 0;

    if (productData.available) {
      const availableStr = productData.available.toString().replace(/[^\d]/g, '');

      availableNum = parseInt(availableStr, 10) || 0;
    }

    return {
      productName: productData.productName.trim(),
      available: availableNum,
      price: productData.price ? productData.price.toString() : '0',
      category: productData.category,
      url: productData.url || '',
      uniqueProductId: parseInt(productData.uniqueProductId, 10),
      setProductName: productData.setProductName.trim()
    };
  }

  /**
   * Validates batch data for bulk operations
   * @param {Array} batch - Array of data items to validate
   * @param {string} dataType - Type of data ('set', 'card', 'setProduct', 'product')
   * @param {Object} context - Additional context for validation
   * @returns {Array} Array of validated data items
   * @throws {ImportValidationError} If any item fails validation
   */
  static validateBatch(batch, dataType, context = {}) {
    if (!Array.isArray(batch)) {
      throw new ImportValidationError('Batch must be an array', 'batch', batch, context.source);
    }

    if (batch.length === 0) {
      throw new ImportValidationError('Batch cannot be empty', 'batch', batch, context.source);
    }

    if (batch.length > 1000) {
      throw new ImportValidationError('Batch size cannot exceed 1000 items', 'batch', batch, context.source);
    }

    const validatedItems = [];
    const errors = [];

    for (let i = 0; i < batch.length; i++) {
      try {
        let validatedItem;

        switch (dataType) {
          case 'set':
            validatedItem = this.validateSetData(batch[i], context.source);
            break;
          case 'card':
            validatedItem = this.validateCardData(batch[i], context.uniqueSetId, context.source);
            break;
          case 'setProduct':
            validatedItem = this.validateSetProductData(batch[i], context.source);
            break;
          case 'product':
            validatedItem = this.validateProductData(batch[i], context.source);
            break;
          default:
            throw new ImportValidationError(`Unknown data type: ${dataType}`, 'dataType', dataType, context.source);
        }
        validatedItems.push(validatedItem);
      } catch (error) {
        errors.push(`Item ${i}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new ImportValidationError(
        `Batch validation failed: ${errors.join('; ')}`,
        'batch',
        batch,
        context.source
      );
    }

    return validatedItems;
  }

  /**
   * Validates import configuration and options
   * @param {Object} options - Import options to validate
   * @returns {Object} Validated and normalized options
   * @throws {ImportValidationError} If validation fails
   */
  static validateImportOptions(options) {
    const validated = {
      dryRun: Boolean(options.dryRun),
      skipExisting: Boolean(options.skipExisting !== false), // Default true
      batchSize: 100,
      verbose: Boolean(options.verbose !== false), // Default true
      maxErrors: 50,
      validateReferences: Boolean(options.validateReferences !== false), // Default true
      ...options
    };

    if (options.batchSize !== undefined) {
      const batchSize = parseInt(options.batchSize, 10);

      if (isNaN(batchSize) || batchSize < 1 || batchSize > 1000) {
        throw new ImportValidationError('batchSize must be between 1 and 1000', 'batchSize', options.batchSize);
      }
      validated.batchSize = batchSize;
    }

    if (options.maxErrors !== undefined) {
      const maxErrors = parseInt(options.maxErrors, 10);

      if (isNaN(maxErrors) || maxErrors < 1) {
        throw new ImportValidationError('maxErrors must be a positive integer', 'maxErrors', options.maxErrors);
      }
      validated.maxErrors = maxErrors;
    }

    return validated;
  }
}

export {
  ImportValidators,
  ImportValidationError
};
export default ImportValidators; ;
