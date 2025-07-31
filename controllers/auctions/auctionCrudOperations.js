const Auction = require('../../models/Auction');
const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../../middleware/errorHandler');
const { populateAuctionItems, validateAuctionItems } = require('./auctionItemHelpers');
const Logger = require('../../utils/Logger');
const { getEntityConfig, getFilterableFields, getValidationRules } = require('../../config/entityConfigurations');

const getAllAuctions = asyncHandler(async (req, res) => {
  Logger.operationStart('GET_ALL_AUCTIONS', 'Fetching all auctions', { query: req.query });
  
  const entityConfig = getEntityConfig('auction');
  const filterableFields = getFilterableFields('auction');
  const { isActive } = req.query;
  const query = {};

  // Apply filterable fields from entity configuration
  filterableFields.forEach(field => {
    if (req.query[field] !== undefined) {
      if (field === 'isActive') {
        query[field] = req.query[field] === 'true';
      } else {
        query[field] = req.query[field];
      }
    }
  });

  // Use entity configuration for default sort
  const auctions = await Auction.find(query).sort(entityConfig.defaultSort);

  Logger.operationSuccess('GET_ALL_AUCTIONS', 'Successfully fetched auctions', {
    count: auctions.length,
    appliedFilters: Object.keys(query)
  });
  res.status(200).json(auctions);
});

const getAuctionById = asyncHandler(async (req, res) => {
  Logger.operationStart('GET_AUCTION_BY_ID', 'Fetching auction by ID', { auctionId: req.params.id });
  
  if (!req.params.id || typeof req.params.id !== 'string' || !/^[a-f\d]{24}$/i.test(req.params.id)) {
    Logger.operationError('INVALID_AUCTION_ID', 'Invalid auction ID format', new ValidationError('Invalid ObjectId format'), { auctionId: req.params.id });
    throw new ValidationError('Invalid ObjectId format');
  }

  const auction = await Auction.findById(req.params.id);

  if (!auction) {
    Logger.operationError('AUCTION_NOT_FOUND', 'Auction not found in database', new NotFoundError('Auction not found'), { auctionId: req.params.id });
    throw new NotFoundError('Auction not found');
  }

  // Populate auction items with their respective data
  const populatedAuction = await populateAuctionItems(auction);

  Logger.operationSuccess('GET_AUCTION_BY_ID', 'Successfully fetched auction', {
    auctionId: req.params.id,
    itemCount: populatedAuction.items?.length || 0,
    status: populatedAuction.status
  });
  res.status(200).json(populatedAuction);
});

const createAuction = asyncHandler(async (req, res) => {
  Logger.operationStart('CREATE_AUCTION', 'Creating new auction', { body: req.body });
  
  const { topText, bottomText, auctionDate, status, generatedFacebookPost, isActive, items, totalValue } = req.body;
  const entityConfig = getEntityConfig('auction');
  const validationRules = getValidationRules('auction');

  // Validate required fields using entity configuration
  const {requiredFields} = entityConfig;

  if (!topText || !bottomText) {
    const error = new ValidationError('Missing required fields: topText and bottomText are required');

    Logger.operationError('AUCTION_VALIDATION_FAILED', 'Required fields missing for auction creation', error, {
      providedFields: Object.keys(req.body),
      requiredFields: ['topText', 'bottomText']
    });
    throw error;
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

  Logger.operationSuccess('CREATE_AUCTION', 'Successfully created auction', {
    auctionId: savedAuction._id,
    status: savedAuction.status,
    itemCount: savedAuction.items?.length || 0,
    totalValue: savedAuction.totalValue
  });
  res.status(201).json(savedAuction);
});

const updateAuction = asyncHandler(async (req, res) => {
  Logger.operationStart('UPDATE_AUCTION', 'Updating auction', { auctionId: req.params.id, updates: Object.keys(req.body) });
  
  if (!req.params.id || typeof req.params.id !== 'string' || !/^[a-f\d]{24}$/i.test(req.params.id)) {
    const error = new ValidationError('Invalid ObjectId format');

    Logger.operationError('INVALID_AUCTION_ID', 'Invalid auction ID format for update', error, { auctionId: req.params.id });
    throw error;
  }

  const { topText, bottomText, auctionDate, status, generatedFacebookPost, isActive, items, totalValue, soldValue } =
    req.body;
  const entityConfig = getEntityConfig('auction');

  const updateData = {};

  // Build update data object
  if (topText !== undefined) updateData.topText = topText;
  if (bottomText !== undefined) updateData.bottomText = bottomText;
  if (auctionDate !== undefined) updateData.auctionDate = auctionDate ? new Date(auctionDate) : null;
  if (status !== undefined) updateData.status = status;
  if (generatedFacebookPost !== undefined) updateData.generatedFacebookPost = generatedFacebookPost;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (totalValue !== undefined) updateData.totalValue = totalValue;
  if (soldValue !== undefined) updateData.soldValue = soldValue;

  if (items !== undefined) {
    // Validate items if provided
    if (Array.isArray(items)) {
      await validateAuctionItems(items);
    }
    updateData.items = items;
  }

  const updatedAuction = await Auction.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

  if (!updatedAuction) {
    const error = new NotFoundError('Auction not found');

    Logger.operationError('AUCTION_UPDATE_NOT_FOUND', 'Auction not found for update', error, { auctionId: req.params.id });
    throw error;
  }

  Logger.operationSuccess('UPDATE_AUCTION', 'Successfully updated auction', {
    auctionId: req.params.id,
    updatedFields: Object.keys(updateData),
    status: updatedAuction.status,
    itemCount: updatedAuction.items?.length || 0
  });
  res.status(200).json(updatedAuction);
});

const deleteAuction = asyncHandler(async (req, res) => {
  Logger.operationStart('DELETE_AUCTION', 'Deleting auction', { auctionId: req.params.id });
  
  if (!req.params.id || typeof req.params.id !== 'string' || !/^[a-f\d]{24}$/i.test(req.params.id)) {
    const error = new ValidationError('Invalid ObjectId format');

    Logger.operationError('INVALID_AUCTION_ID', 'Invalid auction ID format for deletion', error, { auctionId: req.params.id });
    throw error;
  }

  const deletedAuction = await Auction.findByIdAndDelete(req.params.id);

  if (!deletedAuction) {
    const error = new NotFoundError('Auction not found');

    Logger.operationError('AUCTION_DELETE_NOT_FOUND', 'Auction not found for deletion', error, { auctionId: req.params.id });
    throw error;
  }

  Logger.operationSuccess('DELETE_AUCTION', 'Successfully deleted auction', {
    auctionId: req.params.id,
    deletedStatus: deletedAuction.status,
    itemCount: deletedAuction.items?.length || 0
  });
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
