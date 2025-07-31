const SealedProduct = require('../../models/SealedProduct');
const PsaGradedCard = require('../../models/PsaGradedCard');
const RawCard = require('../../models/RawCard');
const mongoose = require('mongoose');
const { NotFoundError, ValidationError } = require('../../middleware/errorHandler');

// Helper function to populate auction items
const populateAuctionItems = async (auction) => {
  const populatedItems = [];

  const itemPromises = auction.items.map(async (item) => {
    try {
      let populatedItem = null;

      switch (item.itemCategory) {
        case 'SealedProduct':
          populatedItem = await SealedProduct.findById(item.itemId);
          break;
        case 'PsaGradedCard':
          populatedItem = await PsaGradedCard.findById(item.itemId).populate({
            path: 'cardId',
            populate: { path: 'setId' },
          });
          break;
        case 'RawCard':
          populatedItem = await RawCard.findById(item.itemId).populate({
            path: 'cardId',
            populate: { path: 'setId' },
          });
          break;
        default:
          console.error(`Unknown itemCategory: ${item.itemCategory}`);
          throw new Error(`Unknown itemCategory: ${item.itemCategory}`);
      }

      if (populatedItem) {
        return {
          itemCategory: item.itemCategory,
          itemData: populatedItem,
        };
      }

      return null;
    } catch (error) {
      console.error(`Error populating item ${item.itemId}:`, error);
      return null;
    }
  });

  const results = await Promise.all(itemPromises);

  populatedItems.push(...results.filter(Boolean));

  return {
    ...auction.toObject(),
    items: populatedItems,
  };
};

// Helper function to validate auction items
const validateAuctionItems = async (items) => {
  if (!Array.isArray(items)) {
    return;
  }

  // First validate the format synchronously
  for (const item of items) {
    if (!item.itemId || typeof item.itemId !== 'string' || !/^[a-f\d]{24}$/i.test(item.itemId)) {
      throw new ValidationError('Invalid itemId format in items array');
    }

    if (!['SealedProduct', 'PsaGradedCard', 'RawCard'].includes(item.itemCategory)) {
      throw new ValidationError('Invalid itemCategory. Must be one of: SealedProduct, PsaGradedCard, RawCard');
    }
  }

  // Then validate existence and availability asynchronously
  const validationPromises = items.map(async (item) => {
    let collectionItem = null;

    switch (item.itemCategory) {
      case 'SealedProduct':
        collectionItem = await SealedProduct.findById(item.itemId);
        break;
      case 'PsaGradedCard':
        collectionItem = await PsaGradedCard.findById(item.itemId);
        break;
      case 'RawCard':
        collectionItem = await RawCard.findById(item.itemId);
        break;
      default:
        throw new Error(`Unknown itemCategory: ${item.itemCategory}`);
    }

    if (!collectionItem) {
      throw new NotFoundError(`${item.itemCategory} with ID ${item.itemId} not found in your collection`);
    }

    if (collectionItem.sold) {
      throw new ValidationError(`Cannot add sold items to auctions. Item ${item.itemId} is already sold.`);
    }
  });

  await Promise.all(validationPromises);
};

// Helper function to validate and find a single item
const validateAndFindItem = async (itemId, itemCategory) => {
  if (!itemId || typeof itemId !== 'string' || !/^[a-f\d]{24}$/i.test(itemId)) {
    throw new ValidationError('Invalid itemId format');
  }

  if (!['SealedProduct', 'PsaGradedCard', 'RawCard'].includes(itemCategory)) {
    throw new ValidationError('Invalid itemCategory. Must be one of: SealedProduct, PsaGradedCard, RawCard');
  }

  let collectionItem = null;

  switch (itemCategory) {
    case 'SealedProduct':
      collectionItem = await SealedProduct.findById(itemId);
      break;
    case 'PsaGradedCard':
      collectionItem = await PsaGradedCard.findById(itemId);
      break;
    case 'RawCard':
      collectionItem = await RawCard.findById(itemId);
      break;
    default:
      throw new Error(`Unknown itemCategory: ${itemCategory}`);
  }

  if (!collectionItem) {
    throw new NotFoundError(`${itemCategory} with ID ${itemId} not found in your collection`);
  }

  if (collectionItem.sold) {
    throw new ValidationError('Cannot add sold items to auctions');
  }

  return collectionItem;
};

// Helper function to calculate total value of auction items
const calculateAuctionTotalValue = async (auction) => {
  let totalValue = 0;

  for (const item of auction.items) {
    try {
      let collectionItem = null;

      switch (item.itemCategory) {
        case 'SealedProduct':
          collectionItem = await SealedProduct.findById(item.itemId);
          break;
        case 'PsaGradedCard':
          collectionItem = await PsaGradedCard.findById(item.itemId);
          break;
        case 'RawCard':
          collectionItem = await RawCard.findById(item.itemId);
          break;
        default:
          console.error(`Unknown itemCategory: ${item.itemCategory}`);
          throw new Error(`Unknown itemCategory: ${item.itemCategory}`);
      }

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

module.exports = {
  populateAuctionItems,
  validateAuctionItems,
  validateAndFindItem,
  calculateAuctionTotalValue,
};
