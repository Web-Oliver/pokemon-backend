/**
 * Email Validator
 *
 * Specialized validator for email address validation
 * Handles various email formats, domain validation, and business rules
 */

import BaseValidator from './BaseValidator.js';
import ValidationErrors from './ValidationErrors.js';
import ValidationRules from './ValidationRules.js';
/**
 * Email validation specialist
 * Handles all email-related validation scenarios
 */
class EmailValidator extends BaseValidator {
  /**
   * Validate an email address
   * @param {any} email - Email address to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether email is required
   * @param {number} options.maxLength - Maximum email length
   * @param {Array} options.allowedDomains - Whitelist of allowed domains
   * @param {Array} options.blockedDomains - Blacklist of blocked domains
   * @param {boolean} options.requireTLD - Whether to require top-level domain
   * @param {boolean} options.allowInternational - Whether to allow international characters
   * @throws {ValidationError} If validation fails
   * @returns {string} Normalized email address
   */
  static validateEmail(email, fieldName = 'Email', options = {}) {
    const {
      required = false,
      maxLength = ValidationRules.STRING.EMAIL_MAX_LENGTH,
      allowedDomains = null,
      blockedDomains = null,
      requireTLD = true,
      allowInternational = true
    } = options;

    // Handle null/undefined
    if (email === null || email === undefined || email === '') {
      if (required) {
        throw ValidationErrors.required(fieldName);
      }
      return null;
    }

    // Type validation
    this.validateType(email, 'string', fieldName, false);

    // Trim whitespace
    const trimmedEmail = email.trim();

    // Length validation
    if (trimmedEmail.length === 0) {
      if (required) {
        throw ValidationErrors.required(fieldName);
      }
      return null;
    }

    if (trimmedEmail.length > maxLength) {
      throw ValidationErrors.invalidLength(fieldName, 0, maxLength, trimmedEmail);
    }

    // Format validation using comprehensive regex
    const emailRegex = allowInternational
      ? this._getInternationalEmailRegex()
      : ValidationRules.EMAIL_REGEX;

    if (!emailRegex.test(trimmedEmail)) {
      throw ValidationErrors.invalidEmail(fieldName, trimmedEmail);
    }

    // Parse email parts
    const emailParts = this._parseEmail(trimmedEmail);
    const { localPart, domain } = emailParts;

    // Local part validation
    this._validateLocalPart(localPart, fieldName);

    // Domain validation
    this._validateDomain(domain, fieldName, { requireTLD, allowedDomains, blockedDomains });

    return trimmedEmail.toLowerCase();
  }

  /**
   * Validate array of email addresses
   * @param {any} emails - Array of email addresses to validate
   * @param {string} fieldName - Name of the field for error messages
   * @param {Object} options - Validation options
   * @param {boolean} options.required - Whether array is required
   * @param {number} options.maxEmails - Maximum number of emails allowed
   * @param {boolean} options.allowDuplicates - Whether to allow duplicate emails
   * @throws {ValidationError} If validation fails
   * @returns {Array} Array of normalized email addresses
   */
  static validateEmailArray(emails, fieldName = 'Emails', options = {}) {
    const {
      required = false,
      maxEmails = 100,
      allowDuplicates = false
    } = options;

    // Array validation
    this.validateArray(emails, fieldName, { required, maxLength: maxEmails });

    if (emails === null || emails === undefined) {
      return null;
    }

    const validatedEmails = [];

    emails.forEach((email, index) => {
      try {
        const validatedEmail = this.validateEmail(email, `${fieldName}[${index}]`, { required: true });

        if (validatedEmail) {
          validatedEmails.push(validatedEmail);
        }
      } catch (error) {
        throw ValidationErrors.custom(
          `${fieldName}[${index}]`,
          error.message,
          email,
          { arrayIndex: index }
        );
      }
    });

    // Check for duplicates if not allowed
    if (!allowDuplicates && validatedEmails.length > 0) {
      const uniqueEmails = new Set(validatedEmails);

      if (uniqueEmails.size !== validatedEmails.length) {
        const duplicates = validatedEmails.filter((email, index) =>
          validatedEmails.indexOf(email) !== index
        );

        throw ValidationErrors.custom(
          fieldName,
          `Duplicate email addresses found: ${duplicates.join(', ')}`,
          emails,
          { duplicates }
        );
      }
    }

    return validatedEmails;
  }

  /**
   * Validate email with business logic constraints
   * @param {string} email - Email to validate
   * @param {string} context - Business context ('user', 'admin', 'support', etc.)
   * @param {Object} options - Additional validation options
   * @throws {ValidationError} If validation fails
   */
  static validateBusinessEmail(email, context = 'user', options = {}) {
    // First validate basic email format
    const validatedEmail = this.validateEmail(email, 'Email', { required: true, ...options });

    // Apply business logic based on context
    switch (context) {
      case 'admin':
        this._validateAdminEmail(validatedEmail);
        break;
      case 'support':
        this._validateSupportEmail(validatedEmail);
        break;
      case 'buyer':
        this._validateBuyerEmail(validatedEmail);
        break;
      case 'notification':
        this._validateNotificationEmail(validatedEmail);
        break;
      default:
        // No additional validation for generic user context
        break;
    }

    return validatedEmail;
  }

  /**
   * Extract domain from email address
   * @param {string} email - Email address
   * @returns {string} Domain part of email
   * @throws {ValidationError} If email is invalid
   */
  static extractDomain(email) {
    const validatedEmail = this.validateEmail(email, 'Email', { required: true });
    const emailParts = this._parseEmail(validatedEmail);

    return emailParts.domain;
  }

  /**
   * Check if email belongs to a disposable email service
   * @param {string} email - Email to check
   * @returns {boolean} True if disposable
   */
  static isDisposableEmail(email) {
    const validatedEmail = this.validateEmail(email, 'Email', { required: true });
    const domain = this.extractDomain(validatedEmail);

    // Common disposable email domains
    const disposableDomains = [
      '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 'mailinator.com',
      'temp-mail.org', 'throwaway.email', 'maildrop.cc', 'trashmail.com',
      'yopmail.com', 'mohmal.com', 'sharklasers.com', 'grr.la'
    ];

    return disposableDomains.includes(domain.toLowerCase());
  }

  /**
   * Safe email validation - returns result object instead of throwing
   * @param {any} email - Email to validate
   * @param {string} fieldName - Field name for errors
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static safeValidateEmail(email, fieldName = 'Email', options = {}) {
    try {
      const validatedEmail = this.validateEmail(email, fieldName, options);

      return {
        isValid: true,
        email: validatedEmail,
        error: null
      };
    } catch (error) {
      return {
        isValid: false,
        email: null,
        error
      };
    }
  }

  /**
   * Normalize email address for comparison
   * @param {string} email - Email to normalize
   * @param {Object} options - Normalization options
   * @returns {string} Normalized email
   */
  static normalizeEmail(email, options = {}) {
    const { removeDotsFromGmail = false, removePlusAliases = false } = options;

    const validatedEmail = this.validateEmail(email, 'Email', { required: true });
    const { localPart, domain } = this._parseEmail(validatedEmail);

    let normalizedLocal = localPart.toLowerCase();
    const normalizedDomain = domain.toLowerCase();

    // Gmail-specific normalization
    if (normalizedDomain === 'gmail.com' || normalizedDomain === 'googlemail.com') {
      if (removeDotsFromGmail) {
        normalizedLocal = normalizedLocal.replace(/\./g, '');
      }
      if (removePlusAliases) {
        const plusIndex = normalizedLocal.indexOf('+');

        if (plusIndex !== -1) {
          normalizedLocal = normalizedLocal.substring(0, plusIndex);
        }
      }
    }

    // Remove plus aliases for other providers if requested
    if (removePlusAliases && normalizedDomain !== 'gmail.com' && normalizedDomain !== 'googlemail.com') {
      const plusIndex = normalizedLocal.indexOf('+');

      if (plusIndex !== -1) {
        normalizedLocal = normalizedLocal.substring(0, plusIndex);
      }
    }

    return `${normalizedLocal}@${normalizedDomain}`;
  }

  /**
   * Private helper methods
   */
  static _parseEmail(email) {
    const atIndex = email.lastIndexOf('@');

    if (atIndex === -1) {
      throw ValidationErrors.invalidEmail('Email', email);
    }

    return {
      localPart: email.substring(0, atIndex),
      domain: email.substring(atIndex + 1)
    };
  }

  static _validateLocalPart(localPart, fieldName) {
    if (localPart.length === 0) {
      throw ValidationErrors.custom(fieldName, 'Email local part cannot be empty', localPart);
    }

    if (localPart.length > 64) {
      throw ValidationErrors.custom(fieldName, 'Email local part cannot exceed 64 characters', localPart);
    }

    // Check for consecutive dots
    if (localPart.includes('..')) {
      throw ValidationErrors.custom(fieldName, 'Email local part cannot contain consecutive dots', localPart);
    }

    // Check for dots at start or end
    if (localPart.startsWith('.') || localPart.endsWith('.')) {
      throw ValidationErrors.custom(fieldName, 'Email local part cannot start or end with a dot', localPart);
    }
  }

  static _validateDomain(domain, fieldName, options = {}) {
    const { requireTLD = true, allowedDomains = null, blockedDomains = null } = options;

    if (domain.length === 0) {
      throw ValidationErrors.custom(fieldName, 'Email domain cannot be empty', domain);
    }

    if (domain.length > 255) {
      throw ValidationErrors.custom(fieldName, 'Email domain cannot exceed 255 characters', domain);
    }

    // TLD validation
    if (requireTLD) {
      const parts = domain.split('.');

      if (parts.length < 2 || parts[parts.length - 1].length < 2) {
        throw ValidationErrors.custom(fieldName, 'Email must have a valid top-level domain', domain);
      }
    }

    // Domain whitelist validation
    if (allowedDomains && !allowedDomains.includes(domain.toLowerCase())) {
      throw ValidationErrors.custom(
        fieldName,
        `Email domain must be one of: ${allowedDomains.join(', ')}`,
        domain
      );
    }

    // Domain blacklist validation
    if (blockedDomains && blockedDomains.includes(domain.toLowerCase())) {
      throw ValidationErrors.custom(fieldName, `Email domain ${domain} is not allowed`, domain);
    }
  }

  static _validateAdminEmail(email) {
    const domain = this.extractDomain(email);

    // Example: Admin emails must be from company domain
    const allowedAdminDomains = ['company.com', 'admin.company.com'];

    if (!allowedAdminDomains.includes(domain.toLowerCase())) {
      throw ValidationErrors.custom(
        'Admin email',
        'Admin email must be from company domain',
        email
      );
    }
  }

  static _validateSupportEmail(email) {
    // Support emails should not be disposable
    if (this.isDisposableEmail(email)) {
      throw ValidationErrors.custom(
        'Support email',
        'Support email cannot be from disposable email service',
        email
      );
    }
  }

  static _validateBuyerEmail(email) {
    // Basic validation for buyer emails - no special restrictions
    return email;
  }

  static _validateNotificationEmail(email) {
    // Notification emails should be deliverable
    const domain = this.extractDomain(email);

    // Block common non-deliverable domains
    const nonDeliverableDomains = ['example.com', 'test.com', 'localhost'];

    if (nonDeliverableDomains.includes(domain.toLowerCase())) {
      throw ValidationErrors.custom(
        'Notification email',
        'Notification email domain appears to be non-deliverable',
        email
      );
    }
  }

  static _getInternationalEmailRegex() {
    // More permissive regex that allows international characters
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  }

  /**
   * Create an email validator instance for fluent validation
   * @returns {EmailValidatorInstance} Email validator instance
   */
  static create() {
    return new EmailValidatorInstance();
  }
}

/**
 * Fluent email validator instance for chaining validations
 */
class EmailValidatorInstance {
  constructor() {
    this.validations = [];
    this.currentValue = null;
    this.currentFieldName = 'Email';
    this.options = {};
  }

  /**
   * Set the email value to validate
   * @param {any} email - Email value
   * @param {string} fieldName - Field name for errors
   * @returns {EmailValidatorInstance} This instance for chaining
   */
  value(email, fieldName = 'Email') {
    this.currentValue = email;
    this.currentFieldName = fieldName;
    return this;
  }

  /**
   * Mark email as required
   * @returns {EmailValidatorInstance} This instance for chaining
   */
  required() {
    this.options.required = true;
    return this;
  }

  /**
   * Set maximum length
   * @param {number} maxLength - Maximum length
   * @returns {EmailValidatorInstance} This instance for chaining
   */
  maxLength(maxLength) {
    this.options.maxLength = maxLength;
    return this;
  }

  /**
   * Set allowed domains
   * @param {Array} domains - Array of allowed domains
   * @returns {EmailValidatorInstance} This instance for chaining
   */
  allowedDomains(domains) {
    this.options.allowedDomains = domains;
    return this;
  }

  /**
   * Set blocked domains
   * @param {Array} domains - Array of blocked domains
   * @returns {EmailValidatorInstance} This instance for chaining
   */
  blockedDomains(domains) {
    this.options.blockedDomains = domains;
    return this;
  }

  /**
   * Require top-level domain
   * @returns {EmailValidatorInstance} This instance for chaining
   */
  requireTLD() {
    this.options.requireTLD = true;
    return this;
  }

  /**
   * Block disposable email services
   * @returns {EmailValidatorInstance} This instance for chaining
   */
  noDisposable() {
    this.validations.push(() => {
      if (EmailValidator.isDisposableEmail(this.currentValue)) {
        throw ValidationErrors.custom(
          this.currentFieldName,
          'Disposable email addresses are not allowed',
          this.currentValue
        );
      }
    });
    return this;
  }

  /**
   * Set business context for validation
   * @param {string} context - Business context
   * @returns {EmailValidatorInstance} This instance for chaining
   */
  context(context) {
    this.businessContext = context;
    return this;
  }

  /**
   * Execute all validations
   * @returns {string} Validated email
   * @throws {ValidationError} If any validation fails
   */
  validate() {
    // First validate basic email requirements
    let validatedEmail;

    if (this.businessContext) {
      validatedEmail = EmailValidator.validateBusinessEmail(
        this.currentValue,
        this.businessContext,
        this.options
      );
    } else {
      validatedEmail = EmailValidator.validateEmail(
        this.currentValue,
        this.currentFieldName,
        this.options
      );
    }

    // Update current value for additional validations
    this.currentValue = validatedEmail;

    // Then run additional validations
    this.validations.forEach(validation => validation());

    return validatedEmail;
  }
}

export default EmailValidator;
