/**
 * Validation Rules
 *
 * Centralized validation rule definitions and constants
 * Eliminates magic numbers and provides consistent validation standards
 */

/**
 * Common validation patterns and constants
 */
class ValidationRules {
  // Email validation regex
  static EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // ObjectId validation regex (24-character hex string)
  static OBJECTID_REGEX = /^[a-f\d]{24}$/i;

  // URL validation - more permissive than built-in URL constructor
  static URL_REGEX = /^https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\._~!$&'()*+,;=:@]|%[\da-fA-F]{2})*)*(?:\?(?:[\w\._~!$&'()*+,;=:@/?]|%[\da-fA-F]{2})*)?(?:\#(?:[\w\._~!$&'()*+,;=:@/?]|%[\da-fA-F]{2})*)?$/;

  /**
   * String validation rules
   */
  static STRING = {
    DEFAULT_MAX_LENGTH: 1000,
    SHORT_STRING_MAX: 100,
    LONG_STRING_MAX: 5000,
    NAME_MIN_LENGTH: 1,
    NAME_MAX_LENGTH: 200,
    DESCRIPTION_MAX_LENGTH: 2000,
    EMAIL_MAX_LENGTH: 254
  };

  /**
   * Number validation rules
   */
  static NUMBER = {
    PRICE_MIN: 0,
    PRICE_MAX: 1000000,
    GRADE_MIN: 1,
    GRADE_MAX: 10,
    CONFIDENCE_MIN: 0,
    CONFIDENCE_MAX: 1,
    YEAR_MIN: 1900,
    YEAR_MAX: new Date().getFullYear() + 10,
    PERCENTAGE_MIN: 0,
    PERCENTAGE_MAX: 100
  };

  /**
   * Array validation rules
   */
  static ARRAY = {
    DEFAULT_MAX_LENGTH: 1000,
    IMAGE_ARRAY_MAX: 50,
    TAG_ARRAY_MAX: 20,
    OBJECTID_ARRAY_MAX: 100
  };

  /**
   * Pagination validation rules
   */
  static PAGINATION = {
    PAGE_MIN: 1,
    PAGE_DEFAULT: 1,
    LIMIT_MIN: 1,
    LIMIT_DEFAULT: 50,
    LIMIT_MAX: 1000
  };

  /**
   * File validation rules
   */
  static FILE = {
    ALLOWED_IMAGE_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    ALLOWED_DOCUMENT_EXTENSIONS: ['.pdf', '.doc', '.docx', '.txt'],
    MAX_FILENAME_LENGTH: 255
  };

  /**
   * Date validation rules
   */
  static DATE = {
    MIN_DATE: new Date('1900-01-01'),
    MAX_DATE: new Date('2100-12-31'),
    DEFAULT_FORMAT: 'YYYY-MM-DD'
  };

  /**
   * Enum validation rules for common domain values
   */
  static ENUMS = {
    SALES_CATEGORIES: ['all', 'sealedProducts', 'psaGradedCards', 'rawCards'],

    PAYMENT_METHODS: ['cash', 'card', 'bank_transfer', 'paypal', 'other'],

    DELIVERY_METHODS: ['pickup', 'shipping', 'delivery', 'other'],

    CARD_CONDITIONS: ['mint', 'near_mint', 'excellent', 'good', 'light_played', 'played', 'poor'],

    SEARCH_TYPES: ['fuse', 'mongo_text', 'aggregate'],

    SORT_ORDERS: ['asc', 'desc'],

    BOOLEAN_STRINGS: ['true', 'false', '1', '0', 'yes', 'no'],

    GRADES: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],

    GRADE_STRINGS: ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5',
                   'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10',
                   'grade_total', 'total_graded']
  };

  /**
   * Get validation rules for specific field types
   */
  static getStringRules(type = 'default') {
    const rules = {
      required: false,
      minLength: 0,
      maxLength: this.STRING.DEFAULT_MAX_LENGTH
    };

    switch (type) {
      case 'name':
        rules.minLength = this.STRING.NAME_MIN_LENGTH;
        rules.maxLength = this.STRING.NAME_MAX_LENGTH;
        rules.required = true;
        break;
      case 'short':
        rules.maxLength = this.STRING.SHORT_STRING_MAX;
        break;
      case 'long':
        rules.maxLength = this.STRING.LONG_STRING_MAX;
        break;
      case 'description':
        rules.maxLength = this.STRING.DESCRIPTION_MAX_LENGTH;
        break;
      case 'email':
        rules.maxLength = this.STRING.EMAIL_MAX_LENGTH;
        rules.required = true;
        break;
    }

    return rules;
  }

  /**
   * Get validation rules for specific number types
   */
  static getNumberRules(type = 'default') {
    const rules = {
      required: false,
      min: -Infinity,
      max: Infinity,
      integer: false
    };

    switch (type) {
      case 'price':
        rules.min = this.NUMBER.PRICE_MIN;
        rules.max = this.NUMBER.PRICE_MAX;
        break;
      case 'grade':
        rules.min = this.NUMBER.GRADE_MIN;
        rules.max = this.NUMBER.GRADE_MAX;
        rules.integer = true;
        rules.required = true;
        break;
      case 'confidence':
        rules.min = this.NUMBER.CONFIDENCE_MIN;
        rules.max = this.NUMBER.CONFIDENCE_MAX;
        break;
      case 'year':
        rules.min = this.NUMBER.YEAR_MIN;
        rules.max = this.NUMBER.YEAR_MAX;
        rules.integer = true;
        break;
      case 'percentage':
        rules.min = this.NUMBER.PERCENTAGE_MIN;
        rules.max = this.NUMBER.PERCENTAGE_MAX;
        break;
      case 'positive':
        rules.min = 0;
        break;
      case 'positive_integer':
        rules.min = 0;
        rules.integer = true;
        break;
    }

    return rules;
  }

  /**
   * Get validation rules for specific array types
   */
  static getArrayRules(type = 'default') {
    const rules = {
      required: false,
      minLength: 0,
      maxLength: this.ARRAY.DEFAULT_MAX_LENGTH
    };

    switch (type) {
      case 'images':
        rules.maxLength = this.ARRAY.IMAGE_ARRAY_MAX;
        break;
      case 'tags':
        rules.maxLength = this.ARRAY.TAG_ARRAY_MAX;
        break;
      case 'objectids':
        rules.maxLength = this.ARRAY.OBJECTID_ARRAY_MAX;
        break;
    }

    return rules;
  }

  /**
   * Check if value is in allowed enum
   */
  static isValidEnum(value, enumType) {
    if (!this.ENUMS[enumType]) {
      return false;
    }
    return this.ENUMS[enumType].includes(value);
  }

  /**
   * Get allowed values for enum type
   */
  static getEnumValues(enumType) {
    return this.ENUMS[enumType] || [];
  }

  /**
   * Normalize boolean values from various string representations
   */
  static normalizeBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase();

      return ['true', '1', 'yes'].includes(lower);
    }

    return Boolean(value);
  }

  /**
   * Check if a string contains only allowed characters for specific contexts
   */
  static isValidStringPattern(value, pattern) {
    const patterns = {
      alphanumeric: /^[a-zA-Z0-9\s]+$/,
      alphanumeric_underscore: /^[a-zA-Z0-9_\s]+$/,
      name: /^[a-zA-Z0-9\s\-.'&()]+$/,
      filename: /^[a-zA-Z0-9\s\-._()]+$/,
      slug: /^[a-z0-9\-]+$/
    };

    return patterns[pattern] ? patterns[pattern].test(value) : true;
  }

  /**
   * Grade validation helpers
   */
  static GRADE_VALIDATION = {
    /**
     * Validate individual grade value
     */
    isValidGrade(grade) {
      return this.ENUMS.GRADES.includes(grade);
    },

    /**
     * Validate grade object structure
     */
    validateGradeStructure(grades, isSetGrades = false) {
      const requiredFields = isSetGrades
        ? ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5',
           'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'total_graded']
        : ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5',
           'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_total'];

      const errors = [];

      for (const field of requiredFields) {
        if (grades[field] === undefined || grades[field] === null) {
          errors.push(`${field} is required`);
          continue;
        }

        const value = parseInt(grades[field], 10);

        if (isNaN(value) || value < 0) {
          errors.push(`${field} must be a non-negative number`);
        }
      }

      return { isValid: errors.length === 0, errors };
    }
  };
}

export default ValidationRules;
