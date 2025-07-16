const Auction = require('../../models/Auction');
const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../../middleware/errorHandler');
const { populateAuctionItems, validateAuctionItems } = require('./auctionItemHelpers');

const getAllAuctions = asyncHandler(async (req, res) => {
  const { isActive } = req.query;
  const query = {};

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  const auctions = await Auction.find(query).sort({ createdAt: -1 });

  res.status(200).json(auctions);
});

const getAuctionById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    throw new NotFoundError('Auction not found');
  }

  // Populate auction items with their respective data
  const populatedAuction = await populateAuctionItems(auction);

  res.status(200).json(populatedAuction);
});

const createAuction = asyncHandler(async (req, res) => {
  const { topText, bottomText, auctionDate, status, generatedFacebookPost, isActive, items, totalValue } = req.body;

  // Validate required fields
  if (!topText || !bottomText) {
    throw new ValidationError('Missing required fields: topText and bottomText are required');
  }

  // Validate items if provided
  if (items && Array.isArray(items)) {
    await validateAuctionItems(items);
  }

  const auction = new Auction({
    topText,
    bottomText,
    auctionDate: auctionDate ? new Date(auctionDate) : null,
    status: status || 'draft',
    generatedFacebookPost: generatedFacebookPost || '',
    isActive: isActive !== undefined ? isActive : true,
    items: items || [],
    totalValue: totalValue || 0,
  });

  const savedAuction = await auction.save();

  res.status(201).json(savedAuction);
});

const updateAuction = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const { topText, bottomText, auctionDate, status, generatedFacebookPost, isActive, items, totalValue, soldValue } =
    req.body;

  const updateData = {};

  if (topText !== undefined) {
    updateData.topText = topText;
  }
  if (bottomText !== undefined) {
    updateData.bottomText = bottomText;
  }
  if (auctionDate !== undefined) {
    updateData.auctionDate = auctionDate ? new Date(auctionDate) : null;
  }
  if (status !== undefined) {
    updateData.status = status;
  }
  if (generatedFacebookPost !== undefined) {
    updateData.generatedFacebookPost = generatedFacebookPost;
  }
  if (isActive !== undefined) {
    updateData.isActive = isActive;
  }
  if (totalValue !== undefined) {
    updateData.totalValue = totalValue;
  }
  if (soldValue !== undefined) {
    updateData.soldValue = soldValue;
  }

  if (items !== undefined) {
    // Validate items if provided
    if (Array.isArray(items)) {
      await validateAuctionItems(items);
    }
    updateData.items = items;
  }

  const updatedAuction = await Auction.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

  if (!updatedAuction) {
    throw new NotFoundError('Auction not found');
  }

  res.status(200).json(updatedAuction);
});

const deleteAuction = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const deletedAuction = await Auction.findByIdAndDelete(req.params.id);

  if (!deletedAuction) {
    throw new NotFoundError('Auction not found');
  }

  res.status(200).json({
    status: 'success',
    message: 'Auction deleted successfully',
  });
});

module.exports = {
  getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
};
