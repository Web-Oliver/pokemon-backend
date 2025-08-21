/**
 * Price Validator
 *
 * Specialized validator for price and monetary value validation
 * Handles various price formats and validation scenarios
 */

import BaseValidator from './BaseValidator.js';
import ValidationErrors from './ValidationErrors.js';
import ValidationRules from './ValidationRules.js';
/**
 * Price validation specialist
 * Handles all price-related validation with business logic
 */
class PriceValidator extends BaseValidator {
  /**
   * Validate a price value
   * @param {any} price - Price value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether price is required
   * @param {number} options.min - Minimum allowed price
   * @param {number} options.max - Maximum allowed price
   * @param {boolean} options.allowZero - Whether to allow zero values
   * @param {number} options.decimalPlaces - Maximum decimal places allowed
   * @throws {ValidationError} If validation fails
   */
  static validatePrice(price, fieldName = 'Price', options = {}) {
    const {
      required = false,
      min = ValidationRules.NUMBER.PRICE_MIN,
      max = ValidationRules.NUMBER.PRICE_MAX,
      allowZero = true,
      decimalPlaces = 2
    } = options;

    // Handle null/undefined
    if (price === null || price === undefined) {
      if (required) {
        throw ValidationErrors.required(fieldName);
      }
      return; // Allow null/undefined for non-required prices
    }

    // Type validation
    this.validateType(price, 'number', fieldName, false);

    // Finite validation
    if (!isFinite(price)) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a finite number`, price);
    }

    // Zero validation
    if (!allowZero && price === 0) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be greater than zero`, price);
    }

    // Range validation
    if (price < min || price > max) {
      throw ValidationErrors.outOfRange(fieldName, min, max, price);
    }

    // Decimal places validation
    if (decimalPlaces !== null) {
      const decimalPart = price.toString().split('.')[1];

      if (decimalPart && decimalPart.length > decimalPlaces) {
        throw ValidationErrors.custom(
          fieldName,
          `${fieldName} can have at most ${decimalPlaces} decimal places`,
          price
        );
      }
    }
  }

  /**
   * Validate price range (min and max prices)
   * @param {number} minPrice - Minimum price
   * @param {number} maxPrice - Maximum price
   * @param {Object} options - Validation options
   * @throws {ValidationError} If validation fails
   */
  static validatePriceRange(minPrice, maxPrice, options = {}) {
    const { required = false } = options;

    if (minPrice !== null && minPrice !== undefined) {
      this.validatePrice(minPrice, 'Minimum price', { required: false, allowZero: true });
    }

    if (maxPrice !== null && maxPrice !== undefined) {
      this.validatePrice(maxPrice, 'Maximum price', { required: false, allowZero: false });
    }

    // Range logic validation
    if (minPrice !== null && minPrice !== undefined &&
        maxPrice !== null && maxPrice !== undefined &&
        minPrice > maxPrice) {
      throw ValidationErrors.custom(
        'Price range',
        'Minimum price must be less than or equal to maximum price',
        { minPrice, maxPrice }
      );
    }

    if (required && minPrice === null && maxPrice === null) {
      throw ValidationErrors.required('Price range');
    }
  }

  /**
   * Validate sale price details
   * @param {Object} saleDetails - Sale details object
   * @throws {ValidationError} If validation fails
   */
  static validateSaleDetails(saleDetails) {
    this.validateRequired(saleDetails, 'Sale details');
    this.validateType(saleDetails, 'object', 'Sale details', true);

    // Validate actual sold price
    if (saleDetails.actualSoldPrice !== undefined) {
      this.validatePrice(saleDetails.actualSoldPrice, 'Actual sold price', {
        required: false,
        allowZero: false
      });
    }

    // Validate original price if provided
    if (saleDetails.originalPrice !== undefined) {
      this.validatePrice(saleDetails.originalPrice, 'Original price', {
        required: false,
        allowZero: true
      });
    }

    // Validate discount if provided
    if (saleDetails.discountAmount !== undefined) {
      this.validatePrice(saleDetails.discountAmount, 'Discount amount', {
        required: false,
        allowZero: true
      });
    }

    // Validate shipping cost if provided
    if (saleDetails.shippingCost !== undefined) {
      this.validatePrice(saleDetails.shippingCost, 'Shipping cost', {
        required: false,
        allowZero: true
      });
    }

    // Business logic validations
    this._validateSaleDetailsBusinessLogic(saleDetails);
  }

  /**
   * Validate collection item price data
   * @param {Object} itemData - Collection item data
   * @throws {ValidationError} If validation fails
   */
  static validateCollectionItemPricing(itemData) {
    if (!itemData || typeof itemData !== 'object') {
      throw ValidationErrors.invalidType('Item data', 'object', itemData);
    }

    // Validate my price (what I paid)
    if (itemData.myPrice !== undefined) {
      this.validatePrice(itemData.myPrice, 'My price', {
        required: false,
        allowZero: true
      });
    }

    // Validate current market price if provided
    if (itemData.currentMarketPrice !== undefined) {
      this.validatePrice(itemData.currentMarketPrice, 'Current market price', {
        required: false,
        allowZero: false
      });
    }

    // Validate asking price if provided
    if (itemData.askingPrice !== undefined) {
      this.validatePrice(itemData.askingPrice, 'Asking price', {
        required: false,
        allowZero: false
      });
    }
  }

  /**
   * Parse and validate price from string
   * @param {string} priceString - Price as string (e.g., "$99.99", "99.99", "99")
   * @param {string} fieldName - Name of the field
   * @param {Object} options - Validation options
   * @returns {number} Parsed and validated price
   * @throws {ValidationError} If parsing or validation fails
   */
  static parseAndValidatePrice(priceString, fieldName = 'Price', options = {}) {
    if (priceString === null || priceString === undefined || priceString === '') {
      if (options.required) {
        throw ValidationErrors.required(fieldName);
      }
      return null;
    }

    let cleanPrice = priceString;

    // Handle string input
    if (typeof priceString === 'string') {
      // Remove currency symbols and whitespace
      cleanPrice = priceString.replace(/[$£€¥,\s]/g, '');
    }

    // Parse to number
    const numericPrice = parseFloat(cleanPrice);

    if (isNaN(numericPrice)) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a valid number`, priceString);
    }

    // Validate the parsed price
    this.validatePrice(numericPrice, fieldName, options);

    return numericPrice;
  }

  /**
   * Validate price comparison data
   * @param {Object} comparisonData - Price comparison data
   * @throws {ValidationError} If validation fails
   */
  static validatePriceComparison(comparisonData) {
    this.validateRequired(comparisonData, 'Price comparison data');
    this.validateType(comparisonData, 'object', 'Price comparison data', true);

    const priceFields = ['lowPrice', 'midPrice', 'highPrice', 'marketPrice'];

    priceFields.forEach(field => {
      if (comparisonData[field] !== undefined) {
        this.validatePrice(comparisonData[field], field, {
          required: false,
          allowZero: false
        });
      }
    });

    // Validate price ordering if multiple prices provided
    const { lowPrice, midPrice, highPrice } = comparisonData;

    if (lowPrice !== undefined && midPrice !== undefined && lowPrice > midPrice) {
      throw ValidationErrors.custom(
        'Price comparison',
        'Low price must be less than or equal to mid price',
        comparisonData
      );
    }

    if (midPrice !== undefined && highPrice !== undefined && midPrice > highPrice) {
      throw ValidationErrors.custom(
        'Price comparison',
        'Mid price must be less than or equal to high price',
        comparisonData
      );
    }
  }

  /**
   * Business logic validation for sale details
   * @private
   */
  static _validateSaleDetailsBusinessLogic(saleDetails) {
    const { actualSoldPrice, originalPrice, discountAmount, shippingCost } = saleDetails;

    // If both actual sold price and original price exist, validate relationship
    if (actualSoldPrice !== undefined && originalPrice !== undefined && discountAmount !== undefined) {
      const expectedSoldPrice = originalPrice - discountAmount;
      const tolerance = 0.01; // Allow for rounding differences

      if (Math.abs(actualSoldPrice - expectedSoldPrice) > tolerance) {
        throw ValidationErrors.custom(
          'Sale details',
          'Actual sold price does not match original price minus discount',
          saleDetails
        );
      }
    }

    // Validate discount doesn't exceed original price
    if (originalPrice !== undefined && discountAmount !== undefined && discountAmount > originalPrice) {
      throw ValidationErrors.custom(
        'Sale details',
        'Discount amount cannot exceed original price',
        saleDetails
      );
    }
  }

  /**
   * Create a price validator instance for fluent validation
   * @returns {PriceValidatorInstance} Price validator instance
   */
  static create() {
    return new PriceValidatorInstance();
  }
}

/**
 * Fluent price validator instance for chaining validations
 */
class PriceValidatorInstance {
  constructor() {
    this.validations = [];
    this.currentValue = null;
    this.currentFieldName = 'Price';
  }

  /**
   * Set the price value to validate
   * @param {any} price - Price value
   * @param {string} fieldName - Field name for errors
   * @returns {PriceValidatorInstance} This instance for chaining
   */
  value(price, fieldName = 'Price') {
    this.currentValue = price;
    this.currentFieldName = fieldName;
    return this;
  }

  /**
   * Mark price as required
   * @returns {PriceValidatorInstance} This instance for chaining
   */
  required() {
    this.validations.push(() => {
      PriceValidator.validateRequired(this.currentValue, this.currentFieldName);
    });
    return this;
  }

  /**
   * Set minimum price
   * @param {number} min - Minimum price
   * @returns {PriceValidatorInstance} This instance for chaining
   */
  min(min) {
    this.validations.push(() => {
      if (this.currentValue !== null && this.currentValue !== undefined && this.currentValue < min) {
        throw ValidationErrors.outOfRange(this.currentFieldName, min, undefined, this.currentValue);
      }
    });
    return this;
  }

  /**
   * Set maximum price
   * @param {number} max - Maximum price
   * @returns {PriceValidatorInstance} This instance for chaining
   */
  max(max) {
    this.validations.push(() => {
      if (this.currentValue !== null && this.currentValue !== undefined && this.currentValue > max) {
        throw ValidationErrors.outOfRange(this.currentFieldName, undefined, max, this.currentValue);
      }
    });
    return this;
  }

  /**
   * Disallow zero values
   * @returns {PriceValidatorInstance} This instance for chaining
   */
  nonZero() {
    this.validations.push(() => {
      if (this.currentValue === 0) {
        throw ValidationErrors.custom(this.currentFieldName, `${this.currentFieldName} must be greater than zero`, this.currentValue);
      }
    });
    return this;
  }

  /**
   * Execute all validations
   * @throws {ValidationError} If any validation fails
   */
  validate() {
    // First validate basic price requirements
    if (this.currentValue !== null && this.currentValue !== undefined) {
      PriceValidator.validatePrice(this.currentValue, this.currentFieldName, { required: false });
    }

    // Then run additional validations
    this.validations.forEach(validation => validation());
  }
}

export default PriceValidator;
