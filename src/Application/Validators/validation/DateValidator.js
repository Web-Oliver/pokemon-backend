/**
 * Date Validator
 *
 * Specialized validator for date validation and date range operations
 * Handles various date formats, timezones, and business logic validations
 */

import BaseValidator from './BaseValidator.js';
import ValidationErrors from './ValidationErrors.js';
import ValidationRules from './ValidationRules.js';
/**
 * Date validation specialist
 * Handles all date-related validation scenarios
 */
class DateValidator extends BaseValidator {
  /**
   * Validate a date value
   * @param {any} date - Date value to validate (Date, string, number)
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether date is required
   * @param {Date} options.minDate - Minimum allowed date
   * @param {Date} options.maxDate - Maximum allowed date
   * @param {boolean} options.futureOnly - Only allow future dates
   * @param {boolean} options.pastOnly - Only allow past dates
   * @param {string} options.format - Expected date format for strings
   * @throws {ValidationError} If validation fails
   * @returns {Date} Validated date object
   */
  static validateDate(date, fieldName = 'Date', options = {}) {
    const {
      required = false,
      minDate = ValidationRules.DATE.MIN_DATE,
      maxDate = ValidationRules.DATE.MAX_DATE,
      futureOnly = false,
      pastOnly = false,
      format = null
    } = options;

    // Handle null/undefined
    if (date === null || date === undefined) {
      if (required) {
        throw ValidationErrors.required(fieldName);
      }
      return null;
    }

    // Convert to Date object
    let dateObj;

    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
    } else {
      throw ValidationErrors.invalidType(fieldName, 'Date, string, or number', date);
    }

    // Validate date is valid
    if (isNaN(dateObj.getTime())) {
      throw ValidationErrors.invalidDate(fieldName, date);
    }

    // Range validation
    if (minDate && dateObj < minDate) {
      throw ValidationErrors.custom(
        fieldName,
        `${fieldName} must be after ${minDate.toISOString().split('T')[0]}`,
        date
      );
    }

    if (maxDate && dateObj > maxDate) {
      throw ValidationErrors.custom(
        fieldName,
        `${fieldName} must be before ${maxDate.toISOString().split('T')[0]}`,
        date
      );
    }

    // Future/Past validation
    const now = new Date();

    if (futureOnly && dateObj <= now) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a future date`, date);
    }

    if (pastOnly && dateObj >= now) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a past date`, date);
    }

    // Format validation for strings
    if (format && typeof date === 'string') {
      this._validateDateFormat(date, format, fieldName);
    }

    return dateObj;
  }

  /**
   * Validate date range (start and end dates)
   * @param {any} startDate - Start date
   * @param {any} endDate - End date
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether both dates are required
   * @param {boolean} options.allowSameDay - Whether start and end can be the same day
   * @param {number} options.maxRangeDays - Maximum range in days
   * @param {string} options.context - Context for logging
   * @returns {Object} Validation result with normalized dates
   * @throws {ValidationError} If validation fails
   */
  static validateDateRange(startDate, endDate, options = {}) {
    const {
      required = false,
      allowSameDay = true,
      maxRangeDays = null,
      context = 'DATE_VALIDATION'
    } = options;

    let validatedStartDate = null;
    let validatedEndDate = null;

    // Individual date validation
    if (startDate !== null && startDate !== undefined) {
      validatedStartDate = this.validateDate(startDate, 'Start date', { required: false });
    }

    if (endDate !== null && endDate !== undefined) {
      validatedEndDate = this.validateDate(endDate, 'End date', { required: false });
    }

    // Required validation
    if (required) {
      if (!validatedStartDate && !validatedEndDate) {
        throw ValidationErrors.required('Date range');
      }
    }

    // Range logic validation
    if (validatedStartDate && validatedEndDate) {
      if (validatedStartDate > validatedEndDate) {
        throw ValidationErrors.custom(
          'Date range',
          'Start date must be before or equal to end date',
          { startDate, endDate }
        );
      }

      if (!allowSameDay && this._isSameDay(validatedStartDate, validatedEndDate)) {
        throw ValidationErrors.custom(
          'Date range',
          'Start date and end date cannot be the same day',
          { startDate, endDate }
        );
      }

      // Maximum range validation
      if (maxRangeDays) {
        const daysDifference = this._getDaysDifference(validatedStartDate, validatedEndDate);

        if (daysDifference > maxRangeDays) {
          throw ValidationErrors.custom(
            'Date range',
            `Date range cannot exceed ${maxRangeDays} days`,
            { startDate, endDate, daysDifference }
          );
        }
      }
    }

    return {
      isValid: true,
      startDate: validatedStartDate,
      endDate: validatedEndDate,
      errors: []
    };
  }

  /**
   * Validate year value
   * @param {any} year - Year value to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @throws {ValidationError} If validation fails
   * @returns {number} Validated year
   */
  static validateYear(year, fieldName = 'Year', options = {}) {
    const {
      required = false,
      min = ValidationRules.NUMBER.YEAR_MIN,
      max = ValidationRules.NUMBER.YEAR_MAX
    } = options;

    if (year === null || year === undefined) {
      if (required) {
        throw ValidationErrors.required(fieldName);
      }
      return null;
    }

    const yearNum = parseInt(year, 10);

    if (isNaN(yearNum)) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a valid number`, year);
    }

    if (yearNum < min || yearNum > max) {
      throw ValidationErrors.outOfRange(fieldName, min, max, yearNum);
    }

    return yearNum;
  }

  /**
   * Validate timestamp (Unix timestamp)
   * @param {any} timestamp - Timestamp to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether timestamp is required
   * @param {boolean} options.milliseconds - Whether timestamp is in milliseconds (default) or seconds
   * @throws {ValidationError} If validation fails
   * @returns {Date} Date object from timestamp
   */
  static validateTimestamp(timestamp, fieldName = 'Timestamp', options = {}) {
    const { required = false, milliseconds = true } = options;

    if (timestamp === null || timestamp === undefined) {
      if (required) {
        throw ValidationErrors.required(fieldName);
      }
      return null;
    }

    if (typeof timestamp !== 'number') {
      throw ValidationErrors.invalidType(fieldName, 'number', timestamp);
    }

    // Convert seconds to milliseconds if needed
    const timestampMs = milliseconds ? timestamp : timestamp * 1000;

    const date = new Date(timestampMs);

    if (isNaN(date.getTime())) {
      throw ValidationErrors.custom(fieldName, `${fieldName} must be a valid timestamp`, timestamp);
    }

    // Reasonable timestamp range check (1970 to ~2100)
    const minTimestamp = new Date('1970-01-01').getTime();
    const maxTimestamp = new Date('2100-01-01').getTime();

    if (timestampMs < minTimestamp || timestampMs > maxTimestamp) {
      throw ValidationErrors.custom(
        fieldName,
        `${fieldName} must be between 1970 and 2100`,
        timestamp
      );
    }

    return date;
  }

  /**
   * Validate ISO date string
   * @param {any} dateString - ISO date string to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @throws {ValidationError} If validation fails
   * @returns {Date} Parsed date object
   */
  static validateISODate(dateString, fieldName = 'Date', options = {}) {
    const { required = false } = options;

    if (dateString === null || dateString === undefined) {
      if (required) {
        throw ValidationErrors.required(fieldName);
      }
      return null;
    }

    if (typeof dateString !== 'string') {
      throw ValidationErrors.invalidType(fieldName, 'string', dateString);
    }

    // ISO 8601 format regex
    const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2}))?$/;

    if (!isoRegex.test(dateString)) {
      throw ValidationErrors.invalidFormat(fieldName, 'ISO 8601 format', dateString);
    }

    const date = new Date(dateString);

    if (isNaN(date.getTime())) {
      throw ValidationErrors.invalidDate(fieldName, dateString);
    }

    return date;
  }

  /**
   * Safe date range validation - returns result object instead of throwing
   * @param {any} startDate - Start date
   * @param {any} endDate - End date
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static safeValidateDateRange(startDate, endDate, options = {}) {
    try {
      const result = this.validateDateRange(startDate, endDate, options);

      return result;
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
        startDate: null,
        endDate: null
      };
    }
  }

  /**
   * Parse various date formats to Date object
   * @param {any} dateInput - Date input in various formats
   * @param {string} fieldName - Name of the field for error messages
   * @param {Array} allowedFormats - Array of allowed format types
   * @returns {Date} Parsed date object
   * @throws {ValidationError} If parsing fails
   */
  static parseDate(dateInput, fieldName = 'Date', allowedFormats = ['iso', 'timestamp', 'datestring']) {
    if (dateInput === null || dateInput === undefined) {
      return null;
    }

    if (dateInput instanceof Date) {
      return dateInput;
    }

    // Try different parsing methods based on allowed formats
    const errors = [];

    if (allowedFormats.includes('iso') && typeof dateInput === 'string') {
      try {
        return this.validateISODate(dateInput, fieldName);
      } catch (error) {
        errors.push(`ISO format: ${error.message}`);
      }
    }

    if (allowedFormats.includes('timestamp') && typeof dateInput === 'number') {
      try {
        return this.validateTimestamp(dateInput, fieldName);
      } catch (error) {
        errors.push(`Timestamp format: ${error.message}`);
      }
    }

    if (allowedFormats.includes('datestring')) {
      try {
        return this.validateDate(dateInput, fieldName);
      } catch (error) {
        errors.push(`Date string format: ${error.message}`);
      }
    }

    throw ValidationErrors.custom(
      fieldName,
      `Could not parse date. Attempted formats: ${errors.join(', ')}`,
      dateInput
    );
  }

  /**
   * Normalize date to start or end of day
   * @param {Date} date - Date to normalize
   * @param {string} type - 'start' for start of day, 'end' for end of day
   * @returns {Date} Normalized date
   */
  static normalizeToDay(date, type = 'start') {
    if (!date instanceof Date) {
      throw ValidationErrors.invalidDate('date', date);
    }

    const normalized = new Date(date);

    if (type === 'start') {
      normalized.setHours(0, 0, 0, 0);
    } else if (type === 'end') {
      normalized.setHours(23, 59, 59, 999);
    } else {
      throw ValidationErrors.custom('type', 'Type must be "start" or "end"', type);
    }

    return normalized;
  }

  /**
   * Private helper methods
   */
  static _validateDateFormat(dateString, format, fieldName) {
    const formats = {
      'YYYY-MM-DD': /^\d{4}-\d{2}-\d{2}$/,
      'MM/DD/YYYY': /^\d{2}\/\d{2}\/\d{4}$/,
      'DD-MM-YYYY': /^\d{2}-\d{2}-\d{4}$/,
      'YYYY': /^\d{4}$/
    };

    if (!formats[format]) {
      throw ValidationErrors.custom(fieldName, `Unsupported date format: ${format}`, dateString);
    }

    if (!formats[format].test(dateString)) {
      throw ValidationErrors.invalidFormat(fieldName, format, dateString);
    }
  }

  static _isSameDay(date1, date2) {
    return date1.toDateString() === date2.toDateString();
  }

  static _getDaysDifference(startDate, endDate) {
    const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds

    return Math.round(Math.abs((endDate - startDate) / oneDay));
  }

  /**
   * Create a date validator instance for fluent validation
   * @returns {DateValidatorInstance} Date validator instance
   */
  static create() {
    return new DateValidatorInstance();
  }
}

/**
 * Fluent date validator instance for chaining validations
 */
class DateValidatorInstance {
  constructor() {
    this.validations = [];
    this.currentValue = null;
    this.currentFieldName = 'Date';
  }

  /**
   * Set the date value to validate
   * @param {any} date - Date value
   * @param {string} fieldName - Field name for errors
   * @returns {DateValidatorInstance} This instance for chaining
   */
  value(date, fieldName = 'Date') {
    this.currentValue = date;
    this.currentFieldName = fieldName;
    return this;
  }

  /**
   * Mark date as required
   * @returns {DateValidatorInstance} This instance for chaining
   */
  required() {
    this.validations.push(() => {
      DateValidator.validateRequired(this.currentValue, this.currentFieldName);
    });
    return this;
  }

  /**
   * Set minimum date
   * @param {Date} minDate - Minimum date
   * @returns {DateValidatorInstance} This instance for chaining
   */
  after(minDate) {
    this.validations.push(() => {
      if (this.currentValue && this.currentValue <= minDate) {
        throw ValidationErrors.custom(
          this.currentFieldName,
          `${this.currentFieldName} must be after ${minDate.toISOString().split('T')[0]}`,
          this.currentValue
        );
      }
    });
    return this;
  }

  /**
   * Set maximum date
   * @param {Date} maxDate - Maximum date
   * @returns {DateValidatorInstance} This instance for chaining
   */
  before(maxDate) {
    this.validations.push(() => {
      if (this.currentValue && this.currentValue >= maxDate) {
        throw ValidationErrors.custom(
          this.currentFieldName,
          `${this.currentFieldName} must be before ${maxDate.toISOString().split('T')[0]}`,
          this.currentValue
        );
      }
    });
    return this;
  }

  /**
   * Require future date
   * @returns {DateValidatorInstance} This instance for chaining
   */
  future() {
    this.validations.push(() => {
      if (this.currentValue && this.currentValue <= new Date()) {
        throw ValidationErrors.custom(this.currentFieldName, `${this.currentFieldName} must be a future date`, this.currentValue);
      }
    });
    return this;
  }

  /**
   * Require past date
   * @returns {DateValidatorInstance} This instance for chaining
   */
  past() {
    this.validations.push(() => {
      if (this.currentValue && this.currentValue >= new Date()) {
        throw ValidationErrors.custom(this.currentFieldName, `${this.currentFieldName} must be a past date`, this.currentValue);
      }
    });
    return this;
  }

  /**
   * Execute all validations
   * @returns {Date} Validated date
   * @throws {ValidationError} If any validation fails
   */
  validate() {
    // First validate basic date requirements
    const validatedDate = DateValidator.validateDate(this.currentValue, this.currentFieldName, { required: false });

    // Update current value with validated date for additional validations
    this.currentValue = validatedDate;

    // Then run additional validations
    this.validations.forEach(validation => validation());

    return validatedDate;
  }
}

export default DateValidator;
