const Auction = require('../../models/Auction');
const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../../middleware/errorHandler');
const { validateAndFindItem, calculateAuctionTotalValue } = require('./auctionItemHelpers');

const addItemToAuction = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const { itemId, itemCategory } = req.body;

  if (!itemId || !itemCategory) {
    throw new ValidationError('Both itemId and itemCategory are required');
  }

  // Validate and find the item
  await validateAndFindItem(itemId, itemCategory);

  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    throw new NotFoundError('Auction not found');
  }

  // Check if item already exists in auction
  const existingItem = auction.items.find((item) =>
    item.itemId.toString() === itemId && item.itemCategory === itemCategory);

  if (existingItem) {
    throw new ValidationError('Item already exists in this auction');
  }

  auction.items.push({ itemId, itemCategory });

  // Recalculate total value after adding item
  auction.totalValue = await calculateAuctionTotalValue(auction);

  const updatedAuction = await auction.save();

  res.status(200).json(updatedAuction);
});

const removeItemFromAuction = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const { itemId, itemCategory } = req.body;

  if (!itemId || !itemCategory) {
    throw new ValidationError('Both itemId and itemCategory are required');
  }

  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    throw new NotFoundError('Auction not found');
  }

  const itemIndex = auction.items.findIndex((item) =>
    item.itemId.toString() === itemId && item.itemCategory === itemCategory);

  if (itemIndex === -1) {
    throw new NotFoundError('Item not found in this auction');
  }

  auction.items.splice(itemIndex, 1);

  // Recalculate total value after removing item
  auction.totalValue = await calculateAuctionTotalValue(auction);

  // Also recalculate sold value in case the removed item was sold
  auction.soldValue = auction.items
    .filter((item) => item.sold)
    .reduce((total, item) => total + (item.soldPrice || 0), 0);

  const updatedAuction = await auction.save();

  res.status(200).json(updatedAuction);
});

const markItemAsSold = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const { itemId, itemCategory, soldPrice } = req.body;

  if (!itemId || !itemCategory || soldPrice === undefined || soldPrice === null) {
    throw new ValidationError('itemId, itemCategory, and soldPrice are required');
  }

  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    throw new NotFoundError('Auction not found');
  }

  const itemIndex = auction.items.findIndex((item) =>
    item.itemId.toString() === itemId && item.itemCategory === itemCategory);

  if (itemIndex === -1) {
    throw new NotFoundError('Item not found in this auction');
  }

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

  if (allItemsSold) {
    auction.status = 'sold';
  }

  const updatedAuction = await auction.save();

  res.status(200).json(updatedAuction);
});

module.exports = {
  addItemToAuction,
  removeItemFromAuction,
  markItemAsSold,
};
