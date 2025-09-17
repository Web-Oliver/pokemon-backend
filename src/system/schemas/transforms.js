/**
 * Schema Transform Functions
 *
 * Shared transform functions for converting data types in JSON responses.
 * Eliminates duplication of Decimal128 conversion logic across models.
 */

/**
 * Creates a transform function for converting Decimal128 to numbers, dates to strings, and ObjectIds to strings
 *
 * @param {Object} options - Transform options
 * @param {Array} options.priceFields - Array of price field names to convert
 * @param {Array} options.nestedPriceFields - Array of nested price field paths
 * @param {Array} options.dateFields - Array of date field names to convert
 * @param {Array} options.nestedDateFields - Array of nested date field paths
 * @returns {Function} - Transform function for schema.set('toJSON')
 */
function createDecimal128Transform(options = {}) {
    const {
        priceFields = ['myPrice'],
        nestedPriceFields = ['saleDetails.actualSoldPrice', 'priceHistory.price'],
        dateFields = ['dateAdded'],
        nestedDateFields = ['saleDetails.dateSold', 'priceHistory.dateUpdated']
    } = options;

    return function transform(doc, ret) {
        // Convert ObjectIds to strings (applies to _id and all nested _id fields)
        ret = convertObjectIdsToStrings(ret);

        // Convert main price fields
        priceFields.forEach((field) => {
            if (ret[field]) {
                ret[field] = convertDecimal128ToNumber(ret[field]);
            }
        });

        // Convert main date fields
        dateFields.forEach((field) => {
            if (ret[field]) {
                ret[field] = convertDateToString(ret[field]);
            }
        });

        // Convert nested price fields
        nestedPriceFields.forEach((fieldPath) => {
            const fieldParts = fieldPath.split('.');
            let current = ret;

            // Navigate to the nested field
            for (let i = 0; i < fieldParts.length - 1; i++) {
                if (current[fieldParts[i]]) {
                    current = current[fieldParts[i]];
                } else {
                    return; // Field doesn't exist
                }
            }

            const finalField = fieldParts[fieldParts.length - 1];

            // Handle array fields (like priceHistory)
            if (Array.isArray(current)) {
                current.forEach((item) => {
                    if (item[finalField]) {
                        item[finalField] = convertDecimal128ToNumber(item[finalField]);
                    }
                });
            } else if (current[finalField]) {
                current[finalField] = convertDecimal128ToNumber(current[finalField]);
            }
        });

        // Convert nested date fields
        nestedDateFields.forEach((fieldPath) => {
            const fieldParts = fieldPath.split('.');
            let current = ret;

            // Navigate to the nested field
            for (let i = 0; i < fieldParts.length - 1; i++) {
                if (current[fieldParts[i]]) {
                    current = current[fieldParts[i]];
                } else {
                    return; // Field doesn't exist
                }
            }

            const finalField = fieldParts[fieldParts.length - 1];

            // Handle array fields (like priceHistory)
            if (Array.isArray(current)) {
                current.forEach((item) => {
                    if (item[finalField]) {
                        item[finalField] = convertDateToString(item[finalField]);
                    }
                });
            } else if (current[finalField]) {
                current[finalField] = convertDateToString(current[finalField]);
            }
        });

        return ret;
    };
}

/**
 * Converts a Decimal128 value to a number
 *
 * @param {*} value - Value to convert
 * @returns {number} - Converted number value
 */
function convertDecimal128ToNumber(value) {
    if (value && value.$numberDecimal) {
        return parseFloat(value.$numberDecimal);
    } else if (value && value.toString) {
        return parseFloat(value.toString());
    }
    return value;
}

/**
 * Converts a MongoDB Date value to a string
 *
 * @param {*} value - Value to convert
 * @returns {string} - Converted date string
 */
function convertDateToString(value) {
    if (!value) {
        return null;
    }

    // Handle MongoDB Date object or native Date FIRST (before empty object check)
    if (value instanceof Date) {
        return value.toISOString();
    }

    // Handle MongoDB Date serialization with $date
    if (value && value.$date) {
        return new Date(value.$date).toISOString();
    }

    // Handle already converted dates
    if (typeof value === 'string') {
        return value;
    }

    // Handle MongoDB ObjectId-like objects that might contain dates
    if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectID') {
        // ObjectID contains timestamp - extract it
        return new Date(value.getTimestamp()).toISOString();
    }

    // Handle empty objects (corrupted MongoDB dates) - AFTER Date checks
    if (typeof value === 'object' && Object.keys(value).length === 0) {
        return null;
    }

    // Try to create a Date from the value
    try {
        const date = new Date(value);

        if (!isNaN(date.getTime())) {
            return date.toISOString();
        }
    } catch (error) {
        // If all else fails, return null
        return null;
    }

    return null;
}

/**
 * Standard transform for collection items (cards)
 * Converts myPrice, saleDetails.actualSoldPrice, priceHistory prices, and all date fields
 */
const collectionItemTransform = createDecimal128Transform({
    priceFields: ['myPrice'],
    nestedPriceFields: ['saleDetails.actualSoldPrice', 'priceHistory.price'],
    dateFields: ['dateAdded'],
    nestedDateFields: ['saleDetails.dateSold', 'priceHistory.dateUpdated']
});

/**
 * Transform for sealed products
 * Converts myPrice, cardMarketPrice, saleDetails.actualSoldPrice, priceHistory prices, and all date fields
 */
const sealedProductTransform = createDecimal128Transform({
    priceFields: ['myPrice', 'cardMarketPrice'],
    nestedPriceFields: ['saleDetails.actualSoldPrice', 'priceHistory.price'],
    dateFields: ['dateAdded'],
    nestedDateFields: ['saleDetails.dateSold', 'priceHistory.dateUpdated']
});

/**
 * Standard transform for auction items
 * Converts totalValue, soldValue, and date fields
 */
const auctionTransform = createDecimal128Transform({
    priceFields: ['totalValue', 'soldValue'],
    nestedPriceFields: [],
    dateFields: ['auctionDate'],
    nestedDateFields: []
});

/**
 * Standard transform for products (SetProduct → Product hierarchy)
 * Converts price and date fields for Product model
 */
const productTransform = createDecimal128Transform({
    priceFields: ['price'],
    nestedPriceFields: [],
    dateFields: ['lastUpdated'],
    nestedDateFields: []
});

/**
 * Converts MongoDB ObjectIds to strings throughout the data structure
 *
 * @param {*} obj - Object to process
 * @param {number} depth - Current recursion depth to prevent stack overflow
 * @returns {*} - Object with ObjectIds converted to strings
 */
function convertObjectIdsToStrings(obj, depth = 0) {
    // Prevent infinite recursion by limiting depth
    const MAX_DEPTH = 10;

    if (depth > MAX_DEPTH) {
        console.warn('Maximum recursion depth reached in convertObjectIdsToStrings, stopping recursion');
        return obj;
    }

    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    // Handle circular references by tracking processed objects
    if (obj._circularRefCheck) {
        return obj; // Already processing this object, return as-is
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        return obj.map(item => convertObjectIdsToStrings(item, depth + 1));
    }

    // Handle objects
    const processed = {};

    // Mark object to prevent circular references
    obj._circularRefCheck = true;

    try {
        for (const [key, value] of Object.entries(obj)) {
            // Skip the circular reference marker
            if (key === '_circularRefCheck') {
                continue;
            }

            if (value && typeof value === 'object') {
                // IMPORTANT: Check for Date objects FIRST to avoid corrupting them
                if (value instanceof Date) {
                    processed[key] = value; // Keep Date objects as-is
                }
                // Check if it's an ObjectId with buffer property
                else if (value.buffer && typeof value.buffer === 'object' && Object.keys(value.buffer).every(k => !isNaN(k))) {
                    // Convert buffer-based ObjectId to string
                    const bytesArray = Object.keys(value.buffer).map(k => value.buffer[k]);
                    const buffer = Buffer.from(bytesArray);

                    processed[key] = buffer.toString('hex');
                }
                // Check if it's a Mongoose ObjectId
                else if (value.constructor && (value.constructor.name === 'ObjectID' || value.constructor.name === 'ObjectId')) {
                    processed[key] = value.toString();
                }
                // Check if it's already a proper ObjectId string format (24 hex characters)
                else if (typeof value === 'string' && (/^[0-9a-fA-F]{24}$/).test(value)) {
                    processed[key] = value;
                }
                // Recursively process nested objects and arrays with depth tracking
                else {
                    processed[key] = convertObjectIdsToStrings(value, depth + 1);
                }
            } else {
                processed[key] = value;
            }
        }
    } finally {
        // Clean up circular reference marker
        delete obj._circularRefCheck;
    }

    return processed;
}

export {
    createDecimal128Transform,
    convertDecimal128ToNumber,
    convertDateToString,
    convertObjectIdsToStrings,
    collectionItemTransform,
    sealedProductTransform,
    auctionTransform,
    productTransform
};
export default createDecimal128Transform;

