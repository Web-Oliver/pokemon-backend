/**
 * Item Type Mapping Utility
 *
 * Centralizes item type mappings between different systems:
 * - Full class names (PsaGradedCard, RawCard, SealedProduct)
 * - Abbreviated types (psa, raw, sealed)
 * - Display names for UI
 *
 * Eliminates duplicate mapping logic across the codebase
 */

/**
 * Master item type mappings
 */
export const ITEM_TYPE_MAPPINGS = {
    'SealedProduct': {
        abbreviated: 'sealed',
        displayName: 'Sealed Product',
        pluralDisplay: 'Sealed Products',
        category: 'sealed',
        pluralName: 'sealedProducts',
        populate: 'productId',
        filterableFields: ['category', 'available', 'name', 'setName'],
        entitySpecificFilters: ['minPrice', 'maxPrice', 'categories']
    },
    'PsaGradedCard': {
        abbreviated: 'psa',
        displayName: 'PSA Graded Card',
        pluralDisplay: 'PSA Graded Cards',
        category: 'psa',
        pluralName: 'psaGradedCards',
        populate: {
            path: 'cardId',
            populate: {
                path: 'setId',
                model: 'Set'
            }
        },
        filterableFields: ['grade', 'cardName', 'setName'],
        entitySpecificFilters: ['minGrade', 'maxGrade']
    },
    'RawCard': {
        abbreviated: 'raw',
        displayName: 'Raw Card',
        pluralDisplay: 'Raw Cards',
        category: 'raw',
        pluralName: 'rawCards',
        populate: {
            path: 'cardId',
            populate: {
                path: 'setId',
                model: 'Set'
            }
        },
        filterableFields: ['condition', 'cardName', 'setName'],
        entitySpecificFilters: ['conditions']
    }
};

/**
 * Reverse mapping from abbreviated to full class names
 */
export const ABBREVIATED_TO_CLASS = {
    'sealed': 'SealedProduct',
    'psa': 'PsaGradedCard',
    'raw': 'RawCard'
};

/**
 * Valid item types (full class names)
 */
export const VALID_CLASS_NAMES = Object.keys(ITEM_TYPE_MAPPINGS);

/**
 * Valid abbreviated types
 */
export const VALID_ABBREVIATED_TYPES = Object.keys(ABBREVIATED_TO_CLASS);

/**
 * Convert full class name to abbreviated type
 * @param {string} className - Full class name (e.g., 'PsaGradedCard')
 * @returns {string} - Abbreviated type (e.g., 'psa')
 * @throws {Error} - If className is invalid
 */
export function toAbbreviated(className) {
    const mapping = ITEM_TYPE_MAPPINGS[className];
    if (!mapping) {
        throw new Error(`Invalid item class name: ${className}. Must be one of: ${VALID_CLASS_NAMES.join(', ')}`);
    }
    return mapping.abbreviated;
}

/**
 * Convert abbreviated type to full class name
 * @param {string} abbreviated - Abbreviated type (e.g., 'psa')
 * @returns {string} - Full class name (e.g., 'PsaGradedCard')
 * @throws {Error} - If abbreviated type is invalid
 */
export function toClassName(abbreviated) {
    const className = ABBREVIATED_TO_CLASS[abbreviated];
    if (!className) {
        throw new Error(`Invalid abbreviated type: ${abbreviated}. Must be one of: ${VALID_ABBREVIATED_TYPES.join(', ')}`);
    }
    return className;
}

/**
 * Get display name for item type
 * @param {string} type - Class name or abbreviated type
 * @returns {string} - Display name
 */
export function getDisplayName(type) {
    // Try as class name first
    const mapping = ITEM_TYPE_MAPPINGS[type];
    if (mapping) {
        return mapping.displayName;
    }

    // Try as abbreviated type
    const className = ABBREVIATED_TO_CLASS[type];
    if (className) {
        return ITEM_TYPE_MAPPINGS[className].displayName;
    }

    throw new Error(`Invalid item type: ${type}`);
}


/**
 * Validate if a type is a valid class name
 * @param {string} type - Type to validate
 * @returns {boolean} - True if valid class name
 */
export function isValidClassName(type) {
    return VALID_CLASS_NAMES.includes(type);
}

/**
 * Validate if a type is a valid abbreviated type
 * @param {string} type - Type to validate
 * @returns {boolean} - True if valid abbreviated type
 */
export function isValidAbbreviated(type) {
    return VALID_ABBREVIATED_TYPES.includes(type);
}

/**
 * Validate if a type is valid (either class name or abbreviated)
 * @param {string} type - Type to validate
 * @returns {boolean} - True if valid
 */
export function isValidType(type) {
    return isValidClassName(type) || isValidAbbreviated(type);
}


/**
 * Get populate configuration for entity type
 * @param {string} entityName - Entity class name
 * @returns {Object|string|null} - Populate configuration
 */
export function getPopulateConfig(entityName) {
    const mapping = ITEM_TYPE_MAPPINGS[entityName];
    return mapping ? mapping.populate : null;
}

/**
 * Get filterable fields for entity type
 * @param {string} entityName - Entity class name
 * @returns {Array} - Array of filterable field names
 */
export function getFilterableFields(entityName) {
    const mapping = ITEM_TYPE_MAPPINGS[entityName];
    const commonFields = ['sold', 'dateAdded'];
    return mapping ? [...commonFields, ...mapping.filterableFields] : commonFields;
}


/**
 * Get plural name for entity
 * @param {string} entityName - Entity class name
 * @returns {string} - Plural name (e.g., 'psaGradedCards')
 */
export function getPluralName(entityName) {
    const mapping = ITEM_TYPE_MAPPINGS[entityName];
    return mapping ? mapping.pluralName : `${entityName.toLowerCase()}s`;
}

/**
 * Apply entity-specific filters based on query parameters
 * @param {string} entityName - Entity class name
 * @param {Object} query - Query parameters
 * @param {Object} filters - Existing filters object to extend
 */
export function applyEntitySpecificFilters(entityName, query, filters) {
    switch (entityName) {
        case 'PsaGradedCard':
            if (query.minGrade) filters.grade = { $gte: parseInt(query.minGrade, 10) };
            if (query.maxGrade) filters.grade = { ...filters.grade, $lte: parseInt(query.maxGrade, 10) };
            break;
        case 'RawCard':
            if (query.conditions && Array.isArray(query.conditions)) {
                filters.condition = { $in: query.conditions };
            }
            break;
        case 'SealedProduct':
            if (query.minPrice) filters.myPrice = { $gte: parseFloat(query.minPrice) };
            if (query.maxPrice) filters.myPrice = { ...filters.myPrice, $lte: parseFloat(query.maxPrice) };
            if (query.categories && Array.isArray(query.categories)) {
                filters.category = { $in: query.categories };
            }
            break;
    }
}