const mongoose = require('mongoose');
const PsaGradedCard = require('../models/PsaGradedCard');
const psaQueryService = require('../services/psaGradedCardQueryService');
const psaCrudService = require('../services/psaGradedCardCrudService');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');

const getAllPsaGradedCards = asyncHandler(async (req, res) => {
  const { grade, setName, cardName, sold } = req.query;

  try {
    const filteredCards = await psaQueryService.findAllPsaGradedCards({ grade, setName, cardName, sold });

    res.status(200).json({ success: true, data: filteredCards });
  } catch (error) {
    if (error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

const getPsaGradedCardById = asyncHandler(async (req, res) => {
  try {
    const psaGradedCard = await psaQueryService.findPsaGradedCardById(req.params.id);

    res.status(200).json({ success: true, data: psaGradedCard });
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

const createPsaGradedCard = asyncHandler(async (req, res) => {
  try {
    console.log('=== PSA GRADED CARD CREATION START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', req.headers);
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);

    const psaGradedCard = await psaCrudService.createPsaGradedCard(req.body);

    console.log('PSA graded card created successfully:', psaGradedCard);
    console.log('=== PSA GRADED CARD CREATION END ===');

    res.status(201).json({ success: true, data: psaGradedCard });
  } catch (error) {
    console.error('=== PSA GRADED CARD CREATION ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);
    console.error('Request body that caused error:', JSON.stringify(req.body, null, 2));

    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }

    if (error.keyPattern) {
      console.error('Duplicate key pattern:', error.keyPattern);
    }

    if (error.keyValue) {
      console.error('Duplicate key value:', error.keyValue);
    }

    console.error('=== PSA GRADED CARD CREATION ERROR END ===');

    if (error.message.includes('required') || error.message.includes('Invalid')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

const updatePsaGradedCard = asyncHandler(async (req, res) => {
  try {
    const updatedCard = await psaCrudService.updatePsaGradedCard(req.params.id, req.body);

    res.status(200).json({ success: true, data: updatedCard });
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

const deletePsaGradedCard = asyncHandler(async (req, res) => {
  try {
    await psaCrudService.deletePsaGradedCard(req.params.id);
    res.status(200).json({ success: true, message: 'PSA graded card deleted successfully' });
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
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const {
    paymentMethod,
    actualSoldPrice,
    deliveryMethod,
    source,
    buyerFullName,
    buyerAddress,
    buyerPhoneNumber,
    buyerEmail,
    trackingNumber,
  } = req.body;

  const psaGradedCard = await PsaGradedCard.findById(req.params.id);

  if (!psaGradedCard) {
    throw new NotFoundError('PSA graded card not found');
  }

  psaGradedCard.sold = true;
  psaGradedCard.saleDetails = {
    paymentMethod,
    actualSoldPrice,
    deliveryMethod,
    source,
    dateSold: new Date(),
    buyerFullName,
    buyerAddress,
    buyerPhoneNumber,
    buyerEmail,
    trackingNumber,
  };

  await psaGradedCard.save();

  // Populate the response
  await psaGradedCard.populate({
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set',
    },
  });

  res.status(200).json({ success: true, data: psaGradedCard });
});

module.exports = {
  getAllPsaGradedCards,
  getPsaGradedCardById,
  createPsaGradedCard,
  updatePsaGradedCard,
  deletePsaGradedCard,
  markAsSold,
};
