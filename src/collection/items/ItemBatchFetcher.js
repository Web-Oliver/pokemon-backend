/**
 * Item Batch Fetcher Utility
 *
 * Single Responsibility: Centralized item fetching for multiple item types
 * Eliminates duplicate batch fetching logic across controllers
 * Follows DRY principle by providing reusable item fetching functions
 * Supports PSA cards, raw cards, and sealed products
 */

import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import RawCard from '@/collection/items/RawCard.js';
import SealedProduct from '@/collection/items/SealedProduct.js';
/**
 * Valid item types supported by the batch fetcher
 */
const VALID_ITEM_TYPES = ['psa', 'raw', 'sealed'];

/**
 * Item type to model mapping
 */
const ITEM_MODELS = {
  psa: PsaGradedCard,
  raw: RawCard,
  sealed: SealedProduct
};

/**
 * Item type to population field mapping
 */
const POPULATION_FIELDS = {
  psa: 'cardId',
  raw: 'cardId',
  sealed: 'productId'
};

/**
 * Batch fetch items by type and IDs
 * Groups selections by type and performs optimized batch queries
 *
 * @param {Array} selections - Array of selection objects with itemId and itemType
 * @param {Object} options - Fetch options
 * @param {boolean} options.populate - Whether to populate reference fields (default: true)
 * @param {boolean} options.lean - Whether to return lean objects (default: true)
 * @param {Array} options.select - Fields to select (optional)
 * @returns {Object} Object with items grouped by type and lookup map
 */
async function batchFetchItems(selections, options = {}) {
  const { populate = true, lean = true, select } = options;

  // Group selections by item type for efficient batch querying
  const groupedSelections = groupSelectionsByType(selections);

  // Build batch queries for each item type
  const batchQueries = Object.entries(groupedSelections).map(([itemType, typeSelections]) => {
    if (typeSelections.length === 0) return Promise.resolve([]);

    const Model = ITEM_MODELS[itemType];
    const itemIds = typeSelections.map(s => s.itemId);

    let query = Model.find({ _id: { $in: itemIds } });

    // Apply population if requested
    if (populate && POPULATION_FIELDS[itemType]) {
      query = query.populate(POPULATION_FIELDS[itemType]);
    }

    // Apply field selection if provided
    if (select && select.length > 0) {
      query = query.select(select.join(' '));
    }

    // Apply lean if requested
    if (lean) {
      query = query.lean();
    }

    return query.exec();
  });

  // Execute all batch queries in parallel
  const [psaItems, rawItems, sealedItems] = await Promise.all(batchQueries);

  // Create items object grouped by type
  const items = {
    psa: psaItems || [],
    raw: rawItems || [],
    sealed: sealedItems || []
  };

  // Create lookup map for O(1) item retrieval
  const itemsMap = createItemsLookupMap(items);

  return {
    items,
    itemsMap,
    stats: {
      totalFetched: psaItems.length + rawItems.length + sealedItems.length,
      byType: {
        psa: psaItems.length,
        raw: rawItems.length,
        sealed: sealedItems.length
      }
    }
  };
}

/**
 * Batch validate item existence for multiple items
 * Optimizes existence checks using batch queries instead of individual queries
 *
 * @param {Array} items - Array of items with itemId and itemType
 * @returns {Object} Object with validation results and existing items
 */
async function batchValidateItemExistence(items) {
  // Group items by type for batch validation
  const groupedItems = groupItemsByType(items);

  const validationQueries = Object.entries(groupedItems).map(async ([itemType, typeItems]) => {
    if (typeItems.length === 0) return { itemType, existingItems: [] };

    const Model = ITEM_MODELS[itemType];
    const itemIds = typeItems.map(item => item.itemId);

    const existingItems = await Model.find(
      { _id: { $in: itemIds } },
      { _id: 1 } // Only fetch IDs for existence check
    ).lean().exec();

    return {
      itemType,
      existingItems: existingItems.map(item => item._id.toString())
    };
  });

  // Execute all validation queries in parallel
  const validationResults = await Promise.all(validationQueries);

  // Create lookup set for fast existence checking
  const existingItemsSet = new Set();
  const existingItemsByType = {};

  validationResults.forEach(({ itemType, existingItems }) => {
    existingItemsByType[itemType] = existingItems;
    existingItems.forEach(itemId => existingItemsSet.add(`${itemType}:${itemId}`));
  });

  // Validate each item and collect results
  const validationErrors = [];
  const validItems = [];

  items.forEach(item => {
    const { itemId, itemType } = item;
    const itemKey = `${itemType}:${itemId}`;

    if (!VALID_ITEM_TYPES.includes(itemType)) {
      validationErrors.push({
        itemId,
        itemType,
        error: `itemType must be one of: ${VALID_ITEM_TYPES.join(', ')}`
      });
      return;
    }

    if (!existingItemsSet.has(itemKey)) {
      validationErrors.push({
        itemId,
        itemType,
        error: 'Item not found in collection'
      });
      return;
    }

    validItems.push(item);
  });

  return {
    validItems,
    validationErrors,
    existingItemsByType,
    stats: {
      totalValidated: items.length,
      validCount: validItems.length,
      errorCount: validationErrors.length
    }
  };
}

/**
 * Fetch single item by ID and type with validation
 *
 * @param {string} itemId - Item ID to fetch
 * @param {string} itemType - Item type (psa, raw, sealed)
 * @param {Object} options - Fetch options
 * @returns {Object} Item data or null if not found
 */
async function fetchSingleItem(itemId, itemType, options = {}) {
  const { populate = true, lean = true, select } = options;

  if (!VALID_ITEM_TYPES.includes(itemType)) {
    throw new Error(`Invalid item type: ${itemType}. Must be one of: ${VALID_ITEM_TYPES.join(', ')}`);
  }

  const Model = ITEM_MODELS[itemType];

  let query = Model.findById(itemId);

  if (populate && POPULATION_FIELDS[itemType]) {
    query = query.populate(POPULATION_FIELDS[itemType]);
  }

  if (select && select.length > 0) {
    query = query.select(select.join(' '));
  }

  if (lean) {
    query = query.lean();
  }

  return await query.exec();
}

/**
 * Check if item exists by ID and type
 * Optimized for existence checking only
 *
 * @param {string} itemId - Item ID to check
 * @param {string} itemType - Item type (psa, raw, sealed)
 * @returns {boolean} True if item exists, false otherwise
 */
async function itemExists(itemId, itemType) {
  if (!VALID_ITEM_TYPES.includes(itemType)) {
    return false;
  }

  const Model = ITEM_MODELS[itemType];
  const item = await Model.findById(itemId).select('_id').lean().exec();

  return Boolean(item);
}

/**
 * Group selections by item type for batch processing
 *
 * @private
 * @param {Array} selections - Array of selections with itemType
 * @returns {Object} Selections grouped by itemType
 */
function groupSelectionsByType(selections) {
  return selections.reduce((groups, selection) => {
    const { itemType } = selection;

    if (!groups[itemType]) {
      groups[itemType] = [];
    }
    groups[itemType].push(selection);
    return groups;
  }, { psa: [], raw: [], sealed: [] });
}

/**
 * Group items by item type for batch processing
 *
 * @private
 * @param {Array} items - Array of items with itemType
 * @returns {Object} Items grouped by itemType
 */
function groupItemsByType(items) {
  return items.reduce((groups, item) => {
    const { itemType } = item;

    if (!groups[itemType]) {
      groups[itemType] = [];
    }
    groups[itemType].push(item);
    return groups;
  }, { psa: [], raw: [], sealed: [] });
}

/**
 * Create lookup map for O(1) item retrieval
 *
 * @private
 * @param {Object} items - Items grouped by type
 * @returns {Object} Lookup map with items indexed by type and ID
 */
function createItemsLookupMap(items) {
  const itemsMap = {};

  Object.entries(items).forEach(([itemType, typeItems]) => {
    itemsMap[itemType] = typeItems.reduce((map, item) => {
      map[item._id.toString()] = item;
      return map;
    }, {});
  });

  return itemsMap;
}

/**
 * Transform items with computed fields commonly used in responses
 * Standardizes item transformation across controllers
 *
 * @param {Array} items - Items to transform
 * @param {Object} computedFields - Additional computed fields to add
 * @returns {Array} Transformed items with computed fields
 */
function transformItemsWithComputedFields(items, computedFields = {}) {
  return items.map(item => {
    const transformed = {
      ...item,
      _id: item._id?.toString(),
      id: item._id?.toString(),
      cardId: item.cardId?._id?.toString(),
      productId: item.productId?._id?.toString()
    };

    // Apply any additional computed fields
    Object.entries(computedFields).forEach(([key, value]) => {
      if (typeof value === 'function') {
        transformed[key] = value(item);
      } else {
        transformed[key] = value;
      }
    });

    return transformed;
  });
}

export {
  batchFetchItems,
  batchValidateItemExistence,
  fetchSingleItem,
  itemExists,
  transformItemsWithComputedFields,
  groupSelectionsByType,
  groupItemsByType,
  VALID_ITEM_TYPES,
  ITEM_MODELS,
  POPULATION_FIELDS
};
export default batchFetchItems;
