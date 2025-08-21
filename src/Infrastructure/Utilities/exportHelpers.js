/**
 * Export Helpers
 *
 * Consolidated utilities for export operations to eliminate controller duplication
 */

import PsaGradedCard from '@/Domain/Entities/PsaGradedCard.js';
import RawCard from '@/Domain/Entities/RawCard.js';
import SealedProduct from '@/Domain/Entities/SealedProduct.js';
import { ValidationError   } from '@/Application/Common/ErrorTypes.js';
/**
 * Model configuration for different collection types
 */
const COLLECTION_CONFIGS = {
  'psa-cards': {
    model: PsaGradedCard,
    populateField: 'cardId',
    mapFunction: (card) => ({
      id: card._id,
      images: card.images || [],
      cardName: card.cardId?.cardName || card.cardName || 'Unknown Card',
      grade: card.grade,
      cardNumber: card.cardId?.cardNumber || '',
      variety: card.cardId?.variety || 'Standard',
      uniquePokemonId: card.cardId?.uniquePokemonId,
      uniqueSetId: card.cardId?.uniqueSetId,
    }),
    notFoundMessage: 'No PSA cards found'
  },
  'raw-cards': {
    model: RawCard,
    populateField: 'cardId',
    mapFunction: (card) => ({
      id: card._id,
      images: card.images || [],
      cardName: card.cardId?.cardName || card.cardName || 'Unknown Card',
      condition: card.condition,
      cardNumber: card.cardId?.cardNumber || '',
      variety: card.cardId?.variety || 'Standard',
      uniquePokemonId: card.cardId?.uniquePokemonId,
      uniqueSetId: card.cardId?.uniqueSetId,
    }),
    notFoundMessage: 'No raw cards found'
  },
  'sealed-products': {
    model: SealedProduct,
    populateField: null, // No population needed
    mapFunction: (product) => ({
      id: product._id,
      images: product.images || [],
      name: product.name || 'Unknown Product',
      category: product.category,
      setName: product.setName,
    }),
    notFoundMessage: 'No sealed products found'
  }
};

/**
 * Generic function to zip images for any collection type
 * @param {string} collectionType - Type of collection ('psa-cards', 'raw-cards', 'sealed-products')
 * @param {string} ids - Comma-separated list of IDs (optional)
 * @returns {Object} Response data with collection items
 */
const zipCollectionImages = async (collectionType, ids) => {
  const config = COLLECTION_CONFIGS[collectionType];

  if (!config) {
    throw new ValidationError(`Invalid collection type: ${collectionType}`);
  }

  const query = {};

  // Parse IDs if provided
  if (ids) {
    const itemIds = ids.split(',').filter((id) => id.trim());

    query._id = { $in: itemIds };
  }

  // Build query with optional population
  let queryBuilder = config.model.find(query);

  if (config.populateField) {
    queryBuilder = queryBuilder.populate(config.populateField);
  }

  const items = await queryBuilder;

  if (items.length === 0) {
    throw new ValidationError(config.notFoundMessage);
  }

  // Map items using the specific mapping function
  return {
    status: 'success',
    data: items.map(config.mapFunction),
  };
};

/**
 * Parse and validate ID list from query string
 * @param {string} ids - Comma-separated list of IDs
 * @returns {Array} Array of valid IDs
 */
const parseIdList = (ids) => {
  if (!ids) return null;
  return ids.split(',').filter((id) => id.trim());
};

export {
  zipCollectionImages,
  parseIdList,
  COLLECTION_CONFIGS
};
export default zipCollectionImages;;
