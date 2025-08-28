/**
 * Entity Configurations
 *
 * Centralized configuration for all entity types to eliminate DRY violations.
 * Contains populate patterns, filter definitions, and default settings.
 *
 * Following SOLID principles:
 * - Single Responsibility: Manages all entity configuration
 * - Open/Closed: Extensible for new entity types
 * - DRY: Eliminates duplicate configuration across repositories and controllers
 */

/**
 * Common populate configurations used across entities
 */
const POPULATE_PATTERNS = {
  // Card with set information (for PSA and Raw cards)
  CARD_WITH_SET: {
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set'
    }
  },

  // Product reference (for sealed products)
  PRODUCT_REFERENCE: {
    path: 'productId'
  },

  // Set information only
  SET_ONLY: {
    path: 'setId',
    model: 'Set'
  }
};

/**
 * Common filter configurations
 */
const FILTER_PATTERNS = {
  // Standard filters for collection items
  COLLECTION_ITEM: ['sold', 'dateAdded', 'myPrice'],

  // Card-specific filters
  CARD: ['sold', 'dateAdded', 'myPrice', 'grade', 'condition'],

  // Product-specific filters
  PRODUCT: ['sold', 'dateAdded', 'myPrice', 'category', 'availability'],

  // Search-specific filters
  SEARCH: ['searchTerm', 'searchType', 'limit', 'page']
};

/**
 * Default sort configurations
 */
const SORT_PATTERNS = {
  DATE_DESC: { dateAdded: -1 },
  DATE_ASC: { dateAdded: 1 },
  PRICE_DESC: { myPrice: -1 },
  PRICE_ASC: { myPrice: 1 },
  NAME_ASC: { cardName: 1 },
  SET_NAME_ASC: { setName: 1 }
};

/**
 * Entity-specific configurations
 */
const ENTITY_CONFIGS = {
  // PSA Graded Cards
  psaGradedCard: {
    entityName: 'PsaGradedCard',
    pluralName: 'psaGradedCards',
    collectionName: 'psagradedcards',

    // Repository configuration
    defaultPopulate: POPULATE_PATTERNS.CARD_WITH_SET,
    defaultSort: SORT_PATTERNS.DATE_DESC,

    // Controller configuration
    includeMarkAsSold: true,

    // Filterable fields
    filterableFields: FILTER_PATTERNS.CARD,

    // Search configuration
    searchFields: ['cardName', 'setName', 'grade'],
    searchWeights: {
      cardName: 3,
      setName: 2,
      grade: 1
    },

    // Validation rules
    requiredFields: ['cardId', 'grade'],
    validationRules: {
      grade: { type: 'number', min: 1, max: 10, integer: true },
      myPrice: { type: 'number', min: 0 }
    }
  },

  // Raw Cards
  rawCard: {
    entityName: 'RawCard',
    pluralName: 'rawCards',
    collectionName: 'rawcards',

    // Repository configuration
    defaultPopulate: POPULATE_PATTERNS.CARD_WITH_SET,
    defaultSort: SORT_PATTERNS.DATE_DESC,

    // Controller configuration
    includeMarkAsSold: true,

    // Filterable fields
    filterableFields: FILTER_PATTERNS.CARD,

    // Search configuration
    searchFields: ['cardName', 'setName', 'condition'],
    searchWeights: {
      cardName: 3,
      setName: 2,
      condition: 1
    },

    // Validation rules
    requiredFields: ['cardId', 'condition'],
    validationRules: {
      condition: {
        type: 'enum',
        choices: ['mint', 'near_mint', 'excellent', 'good', 'light_played', 'played', 'poor']
      },
      myPrice: { type: 'number', min: 0 }
    }
  },

  // Sealed Products
  sealedProduct: {
    entityName: 'SealedProduct',
    pluralName: 'sealedProducts',
    collectionName: 'sealedproducts',

    // Repository configuration
    defaultPopulate: POPULATE_PATTERNS.PRODUCT_REFERENCE,
    defaultSort: SORT_PATTERNS.DATE_DESC,

    // Controller configuration
    includeMarkAsSold: true,

    // Filterable fields
    filterableFields: FILTER_PATTERNS.PRODUCT,

    // Search configuration
    searchFields: ['name', 'setName', 'category'],
    searchWeights: {
      name: 3,
      setName: 2,
      category: 1
    },

    // Validation rules
    requiredFields: ['productId'],
    validationRules: {
      category: {
        type: 'enum',
        choices: ['Booster-Boxes', 'Elite-Trainer-Boxes', 'Collection-Boxes', 'Theme-Decks', 'Other']
      },
      myPrice: { type: 'number', min: 0 }
    }
  },

  // Cards (reference data)
  card: {
    entityName: 'Card',
    pluralName: 'cards',
    collectionName: 'cards',

    // Repository configuration
    defaultPopulate: POPULATE_PATTERNS.SET_ONLY,
    defaultSort: SORT_PATTERNS.NAME_ASC,

    // Controller configuration
    includeMarkAsSold: false,

    // Filterable fields
    filterableFields: ['cardName', 'setName', 'cardNumber', 'variety', 'uniquePokemonId', 'uniqueSetId'],

    // Search configuration
    searchFields: ['cardName', 'cardNumber', 'variety'],
    searchWeights: {
      cardName: 3,
      cardNumber: 2,
      variety: 1
    },

    // Validation rules
    requiredFields: ['setId', 'cardName', 'cardNumber', 'uniquePokemonId', 'uniqueSetId'],
    validationRules: {
      cardNumber: { type: 'string', required: true },
      uniquePokemonId: { type: 'number', min: 1, integer: true, required: true },
      uniqueSetId: { type: 'number', min: 1, integer: true, required: true }
    }
  },

  // Sets (reference data)
  set: {
    entityName: 'Set',
    pluralName: 'sets',
    collectionName: 'sets',

    // Repository configuration
    defaultPopulate: null,
    defaultSort: SORT_PATTERNS.SET_NAME_ASC,

    // Controller configuration
    includeMarkAsSold: false,

    // Filterable fields
    filterableFields: ['setName', 'year'],

    // Search configuration
    searchFields: ['setName'],
    searchWeights: {
      setName: 1
    },

    // Validation rules
    requiredFields: ['setName'],
    validationRules: {
      year: { type: 'number', min: 1996, max: 2030, integer: true },
      totalCardsInSet: { type: 'number', min: 1, integer: true }
    }
  },

  // Auctions
  auction: {
    entityName: 'Auction',
    pluralName: 'auctions',
    collectionName: 'auctions',

    // Repository configuration
    defaultPopulate: null,
    defaultSort: { auctionDate: -1 },

    // Controller configuration
    includeMarkAsSold: false,

    // Filterable fields
    filterableFields: ['status', 'auctionDate', 'isActive'],

    // Search configuration
    searchFields: ['topText', 'bottomText'],
    searchWeights: {
      topText: 2,
      bottomText: 1
    },

    // Validation rules
    requiredFields: ['auctionDate'],
    validationRules: {
      status: {
        type: 'enum',
        choices: ['draft', 'active', 'sold', 'expired']
      },
      totalValue: { type: 'number', min: 0 },
      soldValue: { type: 'number', min: 0 }
    }
  }
};

/**
 * Gets configuration for a specific entity type
 * @param {string} entityType - Entity type key
 * @returns {Object|null} - Entity configuration or null if not found
 */
function getEntityConfig(entityType) {
  // Try exact match first
  if (ENTITY_CONFIGS[entityType]) {
    return ENTITY_CONFIGS[entityType];
  }

  // Try lowercase match
  const normalizedType = entityType.toLowerCase();

  if (ENTITY_CONFIGS[normalizedType]) {
    return ENTITY_CONFIGS[normalizedType];
  }

  // Try finding by entityName match (case insensitive)
  const matchingConfig = Object.values(ENTITY_CONFIGS).find(config =>
    config.entityName.toLowerCase() === entityType.toLowerCase()
  );

  return matchingConfig || null;
}

/**
 * Gets populate configuration for a specific entity type
 * @param {string} entityType - Entity type key
 * @returns {Object|null} - Populate configuration or null
 */
function getPopulateConfig(entityType) {
  const config = getEntityConfig(entityType);

  return config ? config.defaultPopulate : null;
}

/**
 * Gets filterable fields for a specific entity type
 * @param {string} entityType - Entity type key
 * @returns {Array} - Array of filterable field names
 */
function getFilterableFields(entityType) {
  const config = getEntityConfig(entityType);

  return config ? config.filterableFields : [];
}

/**
 * Gets search configuration for a specific entity type
 * @param {string} entityType - Entity type key
 * @returns {Object} - Search configuration with fields and weights
 */
function getSearchConfig(entityType) {
  const config = getEntityConfig(entityType);

  if (!config) {
    return { fields: [], weights: {} };
  }

  return {
    fields: config.searchFields || [],
    weights: config.searchWeights || {}
  };
}

/**
 * Gets validation rules for a specific entity type
 * @param {string} entityType - Entity type key
 * @returns {Object} - Validation rules configuration
 */
function getValidationRules(entityType) {
  const config = getEntityConfig(entityType);

  if (!config) {
    return { required: [], rules: {} };
  }

  return {
    required: config.requiredFields || [],
    rules: config.validationRules || {}
  };
}

/**
 * Gets default sort configuration for a specific entity type
 * @param {string} entityType - Entity type key
 * @returns {Object} - Sort configuration
 */
function getSortConfig(entityType) {
  const config = getEntityConfig(entityType);

  return config ? config.defaultSort : SORT_PATTERNS.DATE_DESC;
}

/**
 * Lists all available entity types
 * @returns {Array} - Array of entity type keys
 */
function getAvailableEntityTypes() {
  return Object.keys(ENTITY_CONFIGS);
}

/**
 * Validates that an entity type is supported
 * @param {string} entityType - Entity type to validate
 * @returns {boolean} - True if entity type is supported
 */
function isValidEntityType(entityType) {
  return Boolean(getEntityConfig(entityType));
}

export {
  ENTITY_CONFIGS,
  POPULATE_PATTERNS,
  FILTER_PATTERNS,
  SORT_PATTERNS,
  getEntityConfig,
  getPopulateConfig,
  getFilterableFields,
  getSearchConfig,
  getValidationRules,
  getSortConfig,
  getAvailableEntityTypes,
  isValidEntityType
};
export default ENTITY_CONFIGS;
