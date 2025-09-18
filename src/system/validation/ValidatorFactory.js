/**
 * ValidatorFactory - Simple validation utilities
 */

import mongoose from 'mongoose';

class ValidatorFactory {
    // Sales utilities
    static get salesUtils() {
        return {
            validators: {
                saleDetails: this.saleDetails.bind(this),
                price: this.price.bind(this),
                validateGetSalesParams: ({ category, startDate, endDate }) => {
                    // Optional category validation
                    if (category !== undefined && category !== null && category !== '') {
                        ValidatorFactory.string(category, 'Category');
                    }

                    // Optional date validations
                    if (startDate !== undefined && startDate !== null && startDate !== '') {
                        ValidatorFactory.date(startDate, 'Start date');
                    }

                    if (endDate !== undefined && endDate !== null && endDate !== '') {
                        ValidatorFactory.date(endDate, 'End date');
                    }

                    return { category, startDate, endDate };
                }
            },
            errorHandlers: {
                handleValidationError: (error, field) => {
                    return {
                        field,
                        error: error.message,
                        type: 'validation'
                    };
                },
                handleGetSalesError: (error, params) => {
                    console.error('❌ Get Sales Error:', error.message, { params });
                    throw error;
                },
                handleGetSalesSummaryError: (error, params) => {
                    console.error('❌ Get Sales Summary Error:', error.message, { params });
                    throw error;
                },
                handleGetSalesGraphDataError: (error, params) => {
                    console.error('❌ Get Sales Graph Data Error:', error.message, { params });
                    throw error;
                }
            },
            successLoggers: {
                logValidationSuccess: (field, value) => {
                    console.log(`✅ ${field} validated successfully:`, value);
                },
                logGetSalesSuccess: (params, data) => {
                    console.log('✅ Get Sales Success:', { params, count: data.length });
                },
                logGetSalesSummarySuccess: (params, summary) => {
                    console.log('✅ Get Sales Summary Success:', { params, summary });
                },
                logGetSalesGraphDataSuccess: (params, result) => {
                    console.log('✅ Get Sales Graph Data Success:', { params, result });
                }
            }
        };
    }

    // ObjectId validation
    static objectId(id, fieldName = 'ID') {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error(`${fieldName} must be a valid ObjectId`);
        }
        return id;
    }

    static validateObjectId(id, fieldName) {
        return this.objectId(id, fieldName);
    }

    static isValidObjectId(id) {
        return mongoose.Types.ObjectId.isValid(id);
    }

    // String validation
    static string(value, fieldName, options = {}) {
        if (options.required && (value === undefined || value === null || value === '')) {
            throw new Error(`${fieldName} is required`);
        }

        if (value !== undefined && value !== null) {
            const str = String(value);
            if (options.minLength && str.length < options.minLength) {
                throw new Error(`${fieldName} must be at least ${options.minLength} characters long`);
            }
            if (options.maxLength && str.length > options.maxLength) {
                throw new Error(`${fieldName} must be at most ${options.maxLength} characters long`);
            }
            if (options.pattern && !options.pattern.test(str)) {
                throw new Error(`${fieldName} has invalid format`);
            }
            if (options.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
                throw new Error(`${fieldName} must be a valid email address`);
            }
        }
        return value;
    }

    // Array validation
    static array(value, fieldName, options = {}) {
        if (options.required && (!value || !Array.isArray(value) || value.length === 0)) {
            throw new Error(`${fieldName} is required and must be a non-empty array`);
        }

        if (value !== undefined && value !== null) {
            if (!Array.isArray(value)) {
                throw new Error(`${fieldName} must be an array`);
            }
            if (options.minLength && value.length < options.minLength) {
                throw new Error(`${fieldName} must contain at least ${options.minLength} items`);
            }
            if (options.maxLength && value.length > options.maxLength) {
                throw new Error(`${fieldName} must contain at most ${options.maxLength} items`);
            }
            if (options.itemValidator) {
                value.forEach((item, index) => {
                    try {
                        options.itemValidator(item, `${fieldName}[${index}]`);
                    } catch (error) {
                        throw new Error(`${fieldName}[${index}]: ${error.message}`);
                    }
                });
            }
        }
        return value;
    }

    // Boolean validation
    static boolean(value, fieldName, options = {}) {
        if (options.required && value === undefined) {
            throw new Error(`${fieldName} is required`);
        }

        if (value !== undefined && typeof value !== 'boolean') {
            throw new Error(`${fieldName} must be a boolean`);
        }
        return value;
    }

    // Date validation
    static date(value, fieldName, options = {}) {
        if (options.required && !value) {
            throw new Error(`${fieldName} is required`);
        }

        if (value !== undefined && value !== null) {
            const date = new Date(value);
            if (isNaN(date.getTime())) {
                throw new Error(`${fieldName} must be a valid date`);
            }
            if (options.minDate && date < new Date(options.minDate)) {
                throw new Error(`${fieldName} must be after ${options.minDate}`);
            }
            if (options.maxDate && date > new Date(options.maxDate)) {
                throw new Error(`${fieldName} must be before ${options.maxDate}`);
            }
            return date;
        }
        return value;
    }

    // Object validation
    static object(value, fieldName, options = {}) {
        if (options.required && (!value || typeof value !== 'object' || Array.isArray(value))) {
            throw new Error(`${fieldName} is required and must be an object`);
        }

        if (value !== undefined && value !== null) {
            if (typeof value !== 'object' || Array.isArray(value)) {
                throw new Error(`${fieldName} must be an object`);
            }
            if (options.schema) {
                Object.entries(options.schema).forEach(([key, validator]) => {
                    validator(value[key], `${fieldName}.${key}`);
                });
            }
        }
        return value;
    }

    // Pagination validation
    static validatePagination(page = 1, limit = 10, maxLimit = 100) {
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(maxLimit, Math.max(1, parseInt(limit, 10) || 10));
        return { pageNum, limitNum };
    }

    // Number validation
    static number(value, fieldName, options = {}) {
        if (options.required && (value === undefined || value === null)) {
            throw new Error(`${fieldName} is required`);
        }

        if (value !== undefined && value !== null) {
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
            return num;
        }
        return value;
    }

    // Enum validation
    static enum(value, allowedValues, fieldName, options = {}) {
        if (options.required && (value === undefined || value === null)) {
            throw new Error(`${fieldName} is required`);
        }

        if (value !== undefined && value !== null && !allowedValues.includes(value)) {
            throw new Error(`${fieldName} must be one of: ${allowedValues.join(', ')}`);
        }
        return value;
    }

    // Year validation
    static validateYear(year) {
        const yearNum = parseInt(year, 10);
        if (isNaN(yearNum) || yearNum < 1900 || yearNum > new Date().getFullYear() + 10) {
            throw new Error('Year must be a valid year');
        }
        return yearNum;
    }

    // Price validation
    static price(value, fieldName, options = {}) {
        const num = this.number(value, fieldName, {
            ...options,
            min: options.min || 0
        });

        if (num !== undefined && options.currency) {
            // Add currency-specific validation if needed
        }
        return num;
    }

    // Grade validation (PSA specific)
    static grade(value, fieldName, options = {}) {
        const grade = this.number(value, fieldName, {
            integer: true,
            min: options.min || 1,
            max: options.max || 10,
            ...options
        });
        return grade;
    }

    // Collection-specific validators
    static condition(value, fieldName) {
        const allowedConditions = ['mint', 'near_mint', 'excellent', 'good', 'light_played', 'played', 'poor'];
        return this.enum(value, allowedConditions, fieldName);
    }

    // Sale details validation
    static saleDetails(saleDetails, fieldName = 'Sale details') {
        this.object(saleDetails, fieldName, {
            required: true,
            schema: {
                price: (val) => this.price(val, 'Sale price', { required: true }),
                dateSold: (val) => this.date(val, 'Sale date'),
                paymentMethod: (val) => this.string(val, 'Payment method'),
                deliveryMethod: (val) => this.string(val, 'Delivery method'),
                buyerName: (val) => this.string(val, 'Buyer name')
            }
        });
        return saleDetails;
    }

    // Collection item data validation
    static collectionItemData(data, entityName) {
        this.object(data, `${entityName} data`, { required: true });

        // Common collection item validations
        if (data.myPrice !== undefined) {
            this.price(data.myPrice, 'My price', { required: true });
        }
        if (data.images !== undefined) {
            this.array(data.images, 'Images', {
                itemValidator: (item) => this.string(item, 'Image URL', { required: true })
            });
        }

        return data;
    }

    // Pokemon-specific validators
    static validateUniquePokemonId(pokemonId) {
        this.objectId(pokemonId, 'Pokemon ID');
        return true;
    }

    static validateUniqueSetId(setId) {
        this.objectId(setId, 'Set ID');
        return true;
    }

    static validateGrades(grades) {
        this.array(grades, 'Grades', {
            itemValidator: (grade) => this.grade(grade, 'Grade')
        });
        return true;
    }

    static validateTotalGrades(totalGrades) {
        this.number(totalGrades, 'Total grades', {
            integer: true,
            min: 0
        });
        return true;
    }

    // Composite validation for common patterns
    static cardReference(cardId, fieldName = 'Card reference') {
        this.objectId(cardId, fieldName);
        return cardId;
    }

    static setReference(setId, fieldName = 'Set reference') {
        this.objectId(setId, fieldName);
        return setId;
    }

    // Batch validation utility
    static validateBatch(data, validators) {
        const errors = [];

        Object.entries(validators).forEach(([field, validator]) => {
            try {
                if (typeof validator === 'function') {
                    validator(data[field], field);
                } else {
                    // Handle validator objects with method and options
                    this[validator.method](data[field], field, validator.options);
                }
            } catch (error) {
                errors.push({
                    field,
                    message: error.message,
                    value: data[field]
                });
            }
        });

        if (errors.length > 0) {
            const errorMessage = errors.map(e => `${e.field}: ${e.message}`).join('; ');
            throw new Error(`Validation failed: ${errorMessage}`);
        }

        return data;
    }
}

export default ValidatorFactory;
