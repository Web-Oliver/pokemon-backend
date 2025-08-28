import Auction from '@/collection/auctions/Auction.js';
import { asyncHandler } from '@/system/middleware/CentralizedErrorHandler.js';
import { NotFoundError, ValidationError } from '@/system/errors/ErrorTypes.js';
import { calculateAuctionTotalValue } from './auctionItemHelpers.js';
import { fetchSingleItem } from '@/collection/items/ItemBatchFetcher.js';
import { toAbbreviated, isValidClassName } from '@/system/constants/ItemTypeMapper.js';
import Logger from '@/system/logging/Logger.js';
import ValidatorFactory from '@/system/validation/ValidatorFactory.js';
const addItemToAuction = asyncHandler(async (req, res) => {
  Logger.operationStart('ADD_ITEM_TO_AUCTION', 'Adding item to auction', {
    auctionId: req.params.id,
    itemId: req.body.itemId,
    itemCategory: req.body.itemCategory
  });

  try {
    ValidatorFactory.validateObjectId(req.params.id, 'Auction ID');
  } catch (error) {
    Logger.operationError('INVALID_AUCTION_ID', 'Invalid auction ID for adding item', error, { auctionId: req.params.id });
    throw error;
  }

  const { itemId, itemCategory } = req.body;

  if (!itemId || !itemCategory) {
    const error = new ValidationError('Both itemId and itemCategory are required');

    Logger.operationError('MISSING_ITEM_DATA', 'Missing required item data for auction', error, {
      providedFields: Object.keys(req.body)
    });
    throw error;
  }

  // Validate item type and find the item
  if (!isValidClassName(itemCategory)) {
    const error = new ValidationError('Invalid itemCategory. Must be one of: SealedProduct, PsaGradedCard, RawCard');
    Logger.operationError('INVALID_ITEM_CATEGORY', 'Invalid item category for auction', error, { itemCategory });
    throw error;
  }

  const abbreviatedType = toAbbreviated(itemCategory);
  const collectionItem = await fetchSingleItem(itemId, abbreviatedType, { lean: false });

  if (!collectionItem) {
    const error = new NotFoundError(`${itemCategory} with ID ${itemId} not found in your collection`);
    Logger.operationError('ITEM_NOT_FOUND', 'Item not found for auction', error, { itemId, itemCategory });
    throw error;
  }

  if (collectionItem.sold) {
    const error = new ValidationError('Cannot add sold items to auctions');
    Logger.operationError('SOLD_ITEM_AUCTION', 'Attempted to add sold item to auction', error, { itemId, itemCategory });
    throw error;
  }

  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    const error = new NotFoundError('Auction not found');

    Logger.operationError('AUCTION_NOT_FOUND', 'Auction not found for adding item', error, { auctionId: req.params.id });
    throw error;
  }

  // Check if item already exists in auction
  const existingItem = auction.items.find(
    (item) => item.itemId.toString() === itemId && item.itemCategory === itemCategory
  );

  if (existingItem) {
    const error = new ValidationError('Item already exists in this auction');

    Logger.operationError('DUPLICATE_AUCTION_ITEM', 'Item already exists in auction', error, {
      auctionId: req.params.id,
      itemId,
      itemCategory
    });
    throw error;
  }

  auction.items.push({ itemId, itemCategory });

  // Recalculate total value after adding item
  const previousTotalValue = auction.totalValue;

  auction.totalValue = await calculateAuctionTotalValue(auction);

  const updatedAuction = await auction.save();

  Logger.operationSuccess('ADD_ITEM_TO_AUCTION', 'Successfully added item to auction', {
    auctionId: req.params.id,
    itemId,
    itemCategory,
    newItemCount: updatedAuction.items.length,
    previousTotalValue,
    newTotalValue: updatedAuction.totalValue
  });
  res.status(200).json(updatedAuction);
});

const removeItemFromAuction = asyncHandler(async (req, res) => {
  Logger.operationStart('REMOVE_ITEM_FROM_AUCTION', 'Removing item from auction', {
    auctionId: req.params.id,
    itemId: req.body.itemId,
    itemCategory: req.body.itemCategory
  });

  try {
    ValidatorFactory.validateObjectId(req.params.id, 'Auction ID');
  } catch (error) {
    Logger.operationError('INVALID_AUCTION_ID', 'Invalid auction ID for removing item', error, { auctionId: req.params.id });
    throw error;
  }

  const { itemId, itemCategory } = req.body;

  if (!itemId || !itemCategory) {
    const error = new ValidationError('Both itemId and itemCategory are required');

    Logger.operationError('MISSING_ITEM_DATA', 'Missing required item data for removal', error, {
      providedFields: Object.keys(req.body)
    });
    throw error;
  }

  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    const error = new NotFoundError('Auction not found');

    Logger.operationError('AUCTION_NOT_FOUND', 'Auction not found for removing item', error, { auctionId: req.params.id });
    throw error;
  }

  const itemIndex = auction.items.findIndex(
    (item) => item.itemId.toString() === itemId && item.itemCategory === itemCategory
  );

  if (itemIndex === -1) {
    const error = new NotFoundError('Item not found in this auction');

    Logger.operationError('AUCTION_ITEM_NOT_FOUND', 'Item not found in auction for removal', error, {
      auctionId: req.params.id,
      itemId,
      itemCategory
    });
    throw error;
  }

  const removedItem = auction.items[itemIndex];

  auction.items.splice(itemIndex, 1);

  // Recalculate total value after removing item
  const previousTotalValue = auction.totalValue;

  auction.totalValue = await calculateAuctionTotalValue(auction);

  // Also recalculate sold value in case the removed item was sold
  const previousSoldValue = auction.soldValue;

  auction.soldValue = auction.items
    .filter((item) => item.sold)
    .reduce((total, item) => total + (item.soldPrice || 0), 0);

  const updatedAuction = await auction.save();

  Logger.operationSuccess('REMOVE_ITEM_FROM_AUCTION', 'Successfully removed item from auction', {
    auctionId: req.params.id,
    itemId,
    itemCategory,
    newItemCount: updatedAuction.items.length,
    wasItemSold: removedItem.sold || false,
    previousTotalValue,
    newTotalValue: updatedAuction.totalValue,
    previousSoldValue,
    newSoldValue: updatedAuction.soldValue
  });
  res.status(200).json(updatedAuction);
});

const markItemAsSold = asyncHandler(async (req, res) => {
  Logger.operationStart('MARK_AUCTION_ITEM_SOLD', 'Marking auction item as sold', {
    auctionId: req.params.id,
    itemId: req.body.itemId,
    itemCategory: req.body.itemCategory,
    soldPrice: req.body.soldPrice
  });

  try {
    ValidatorFactory.validateObjectId(req.params.id, 'Auction ID');
  } catch (error) {
    Logger.operationError('INVALID_AUCTION_ID', 'Invalid auction ID for marking item sold', error, { auctionId: req.params.id });
    throw error;
  }

  const { itemId, itemCategory, soldPrice } = req.body;

  if (!itemId || !itemCategory || soldPrice === undefined || soldPrice === null) {
    const error = new ValidationError('itemId, itemCategory, and soldPrice are required');

    Logger.operationError('MISSING_SALE_DATA', 'Missing required sale data for marking item sold', error, {
      providedFields: Object.keys(req.body),
      requiredFields: ['itemId', 'itemCategory', 'soldPrice']
    });
    throw error;
  }

  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    const error = new NotFoundError('Auction not found');

    Logger.operationError('AUCTION_NOT_FOUND', 'Auction not found for marking item sold', error, { auctionId: req.params.id });
    throw error;
  }

  const itemIndex = auction.items.findIndex(
    (item) => item.itemId.toString() === itemId && item.itemCategory === itemCategory
  );

  if (itemIndex === -1) {
    const error = new NotFoundError('Item not found in this auction');

    Logger.operationError('AUCTION_ITEM_NOT_FOUND', 'Item not found in auction for sale marking', error, {
      auctionId: req.params.id,
      itemId,
      itemCategory
    });
    throw error;
  }

  const wasAlreadySold = auction.items[itemIndex].sold;
  const previousSoldValue = auction.soldValue;
  const previousStatus = auction.status;

  // Update the item as sold
  auction.items[itemIndex].sold = true;
  auction.items[itemIndex].soldPrice = soldPrice;
  auction.items[itemIndex].soldDate = new Date();

  // Calculate total sold value
  auction.soldValue = auction.items
    .filter((item) => item.sold)
    .reduce((total, item) => total + (item.soldPrice || 0), 0);

  // Check if all items are sold and update auction status
  const allItemsSold = auction.items.every((item) => item.sold);
  const statusChanged = !allItemsSold ? false : auction.status !== 'sold';

  if (allItemsSold) {
    auction.status = 'sold';
  }

  const updatedAuction = await auction.save();

  Logger.operationSuccess('MARK_AUCTION_ITEM_SOLD', 'Successfully marked auction item as sold', {
    auctionId: req.params.id,
    itemId,
    itemCategory,
    soldPrice,
    wasAlreadySold,
    previousSoldValue,
    newSoldValue: updatedAuction.soldValue,
    allItemsSold,
    statusChanged,
    previousStatus,
    newStatus: updatedAuction.status
  });
  res.status(200).json(updatedAuction);
});

export {
  addItemToAuction,
  removeItemFromAuction,
  markItemAsSold
};
export default addItemToAuction; ;
