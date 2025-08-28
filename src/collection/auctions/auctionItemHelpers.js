import SealedProduct from '@/collection/items/SealedProduct.js';
import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import RawCard from '@/collection/items/RawCard.js';
import { NotFoundError, ValidationError } from '@/system/errors/ErrorTypes.js';
import { fetchSingleItem } from '@/collection/items/ItemBatchFetcher.js';
import { toAbbreviated, isValidClassName } from '@/system/constants/ItemTypeMapper.js';
// Helper function to populate auction items
const populateAuctionItems = async (auction) => {
  const populatedItems = [];

  // Process items in batches to prevent database connection exhaustion and stack overflow
  const BATCH_SIZE = 5;
  const results = [];

  for (let i = 0; i < auction.items.length; i += BATCH_SIZE) {
    const batch = auction.items.slice(i, i + BATCH_SIZE);

    const itemPromises = batch.map(async (item) => {
      try {
        let populatedItem = null;

        switch (item.itemCategory) {
          case 'SealedProduct':
            populatedItem = await SealedProduct.findById(item.itemId).lean(); // Use lean queries to prevent transform issues
            break;
          case 'PsaGradedCard':
            populatedItem = await PsaGradedCard.findById(item.itemId)
              .populate({
                path: 'cardId',
                populate: {
                  path: 'setId',
                  options: { lean: true } // Prevent further population and transform issues
                },
                options: { lean: true }
              })
              .lean(); // Use lean queries to prevent circular reference issues
            break;
          case 'RawCard':
            populatedItem = await RawCard.findById(item.itemId)
              .populate({
                path: 'cardId',
                populate: {
                  path: 'setId',
                  options: { lean: true } // Prevent further population and transform issues
                },
                options: { lean: true }
              })
              .lean(); // Use lean queries to prevent circular reference issues
            break;
          default:
            console.error(`Unknown itemCategory: ${item.itemCategory}`);
            throw new Error(`Unknown itemCategory: ${item.itemCategory}`);
        }

        if (populatedItem) {
          return {
            itemCategory: item.itemCategory,
            itemData: populatedItem
          };
        }

        return null;
      } catch (error) {
        console.error(`Error populating item ${item.itemId}:`, error);
        return null; // Return null instead of crashing the entire operation
      }
    });

    const batchResults = await Promise.all(itemPromises);

    results.push(...batchResults);
  }

  populatedItems.push(...results.filter(Boolean));

  return {
    ...auction.toObject(),
    items: populatedItems
  };
};

// Helper function to validate auction items
const validateAuctionItems = async (items) => {
  if (!Array.isArray(items)) {
    return;
  }

  // First validate the format synchronously
  for (const item of items) {
    if (!item.itemId || typeof item.itemId !== 'string' || !(/^[a-f\d]{24}$/i).test(item.itemId)) {
      throw new ValidationError('Invalid itemId format in items array');
    }

    if (!isValidClassName(item.itemCategory)) {
      throw new ValidationError('Invalid itemCategory. Must be one of: SealedProduct, PsaGradedCard, RawCard');
    }
  }

  // Then validate existence and availability asynchronously in batches to prevent resource exhaustion
  const BATCH_SIZE = 5; // Process 5 items at a time to prevent stack overflow

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    const validationPromises = batch.map(async (item) => {
      try {
        // Use centralized item fetching with ItemBatchFetcher
        const abbreviatedType = toAbbreviated(item.itemCategory);
        const collectionItem = await fetchSingleItem(item.itemId, abbreviatedType, { lean: true });

        if (!collectionItem) {
          throw new NotFoundError(`${item.itemCategory} with ID ${item.itemId} not found in your collection`);
        }

        if (collectionItem.sold) {
          throw new ValidationError(`Cannot add sold items to auctions. Item ${item.itemId} is already sold.`);
        }
      } catch (error) {
        console.error(`Error validating item ${item.itemId}:`, error);
        throw error; // Re-throw to stop validation process
      }
    });

    await Promise.all(validationPromises);
  }
};

// validateAndFindItem function removed - replaced with ItemBatchFetcher.fetchSingleItem
// This eliminates duplicate validation logic across the codebase

// Helper function to calculate total value of auction items
const calculateAuctionTotalValue = async (auction) => {
  let totalValue = 0;

  for (const item of auction.items) {
    try {
      // Use centralized item fetching with ItemBatchFetcher
      const abbreviatedType = toAbbreviated(item.itemCategory);
      const collectionItem = await fetchSingleItem(item.itemId, abbreviatedType, { lean: false });

      if (collectionItem && collectionItem.myPrice) {
        // Handle Decimal128 conversion
        const price =
          typeof collectionItem.myPrice === 'number'
            ? collectionItem.myPrice
            : parseFloat(collectionItem.myPrice.toString());

        if (!isNaN(price)) {
          totalValue += price;
        }
      }
    } catch (error) {
      console.error(`Error calculating price for item ${item.itemId}:`, error);
    }
  }

  return totalValue;
};

export {
  populateAuctionItems,
  validateAuctionItems,
  calculateAuctionTotalValue
};
export default populateAuctionItems; ;
