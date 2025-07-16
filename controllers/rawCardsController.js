const mongoose = require('mongoose');
const RawCard = require('../models/RawCard');
const rawCardQueryService = require('../services/rawCardQueryService');
const rawCardCrudService = require('../services/rawCardCrudService');
const SaleService = require('../services/shared/saleService');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');

const getAllRawCards = asyncHandler(async (req, res) => {
  const { setName, cardName, sold } = req.query;

  try {
    const filteredCards = await rawCardQueryService.findAllRawCards({ setName, cardName, sold });

    res.status(200).json({
      success: true,
      count: filteredCards.length,
      data: filteredCards,
    });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

const getRawCardById = asyncHandler(async (req, res) => {
  try {
    const rawCard = await rawCardQueryService.findRawCardById(req.params.id);

    res.status(200).json({
      success: true,
      data: rawCard,
    });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    if (error.message.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
});

const createRawCard = asyncHandler(async (req, res) => {
  try {
    console.log('=== RAW CARD CREATION START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const rawCard = await rawCardCrudService.createRawCard(req.body);

    console.log('Raw card created successfully:', rawCard);
    console.log('=== RAW CARD CREATION END ===');

    res.status(201).json({ success: true, data: rawCard });
  } catch (error) {
    console.error('=== RAW CARD CREATION ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body that caused error:', JSON.stringify(req.body, null, 2));
    console.error('=== RAW CARD CREATION ERROR END ===');

    if (error.message.includes('required') || error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

const updateRawCard = asyncHandler(async (req, res) => {
  try {
    const updatedCard = await rawCardCrudService.updateRawCard(req.params.id, req.body);

    res.status(200).json({
      success: true,
      data: updatedCard,
    });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    if (error.message.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
});

const deleteRawCard = asyncHandler(async (req, res) => {
  try {
    await rawCardCrudService.deleteRawCard(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Raw card deleted successfully',
    });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    if (error.message.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
});

const markAsSold = asyncHandler(async (req, res) => {
  // Validate sale details
  SaleService.validateSaleDetails(req.body);
  
  // Mark card as sold using centralized service
  const rawCard = await SaleService.markCardAsSold(RawCard, req.params.id, req.body);

  res.status(200).json({
    success: true,
    data: rawCard,
  });
});

module.exports = {
  getAllRawCards,
  getRawCardById,
  createRawCard,
  updateRawCard,
  deleteRawCard,
  markAsSold,
};
