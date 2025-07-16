const SealedProduct = require('../models/SealedProduct');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const mongoose = require('mongoose');
const { NotFoundError, ValidationError } = require('../middleware/errorHandler');

/**
 * Fetch item by ID and category
 */
async function fetchItemById(itemId, itemCategory) {
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new ValidationError(`Invalid itemId format: ${itemId}`);
  }

  if (!['SealedProduct', 'PsaGradedCard', 'RawCard'].includes(itemCategory)) {
    throw new ValidationError(`Invalid itemCategory: ${itemCategory}`);
  }

  let fetchedItem = null;

  switch (itemCategory) {
  case 'SealedProduct':
    fetchedItem = await SealedProduct.findById(itemId);
    break;
  case 'PsaGradedCard':
    fetchedItem = await PsaGradedCard.findById(itemId).populate({
      path: 'cardId',
      populate: {
        path: 'setId',
      },
    });
    break;
  case 'RawCard':
    fetchedItem = await RawCard.findById(itemId).populate({
      path: 'cardId',
      populate: {
        path: 'setId',
      },
    });
    break;
  default:
    throw new ValidationError(`Unknown itemCategory: ${itemCategory}`);
  }

  if (!fetchedItem) {
    throw new NotFoundError(`Item not found: ${itemCategory} with ID ${itemId}`);
  }

  return fetchedItem;
}

module.exports = {
  fetchItemById,
};
