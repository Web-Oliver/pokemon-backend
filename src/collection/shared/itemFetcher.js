import SealedProduct from '@/collection/items/SealedProduct.js';
import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import RawCard from '@/collection/items/RawCard.js';
import mongoose from 'mongoose';
import { NotFoundError, ValidationError } from '@/system/middleware/errorHandler.js';
/**
 * Fetch item by ID and category
 */
async function fetchItemById(itemId, itemCategory) {
  // Use consistent ObjectId validation matching ValidatorFactory and BaseRepository
  if (!itemId || typeof itemId !== 'string' || !(/^[a-f\d]{24}$/i).test(itemId)) {
    throw new ValidationError(`Invalid itemId format: ${itemId}`);
  }

  if (!['SealedProduct', 'PsaGradedCard', 'RawCard'].includes(itemCategory)) {
    throw new ValidationError(`Invalid itemCategory: ${itemCategory}`);
  }

  let fetchedItem = null;

  switch (itemCategory) {
    case 'SealedProduct':
      fetchedItem = await SealedProduct.findById(itemId).populate({
        path: 'productId',
        populate: {
          path: 'setProductId'
        }
      });
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

export {
  fetchItemById
};
export default fetchItemById; ;
