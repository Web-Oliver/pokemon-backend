const SealedProduct = require('../models/SealedProduct');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const sealedProductCrudService = require('../services/sealedProductCrudService');
const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');

const getAllSealedProducts = asyncHandler(async (req, res) => {
  const { category, setName, name, sold } = req.query;
  const query = {};

  if (category) {
    query.category = category;
  }
  if (setName) {
    query.setName = new RegExp(setName, 'i');
  }
  if (name) {
    query.name = new RegExp(name, 'i');
  }
  if (sold !== undefined) {
    query.sold = sold === 'true';
  }

  const sealedProducts = await SealedProduct.find(query).populate('productId');

  res.status(200).json({
    success: true,
    count: sealedProducts.length,
    data: sealedProducts,
  });
});

const getSealedProductById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const sealedProduct = await SealedProduct.findById(req.params.id).populate('productId');

  if (!sealedProduct) {
    throw new NotFoundError('Sealed product not found');
  }

  res.status(200).json({
    success: true,
    data: sealedProduct,
  });
});

const createSealedProduct = asyncHandler(async (req, res) => {
  try {
    console.log('=== SEALED PRODUCT CREATION START ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const sealedProduct = await sealedProductCrudService.createSealedProduct(req.body);

    console.log('Sealed product created successfully:', sealedProduct._id);
    console.log('=== SEALED PRODUCT CREATION END ===');

    res.status(201).json({
      success: true,
      data: sealedProduct,
    });
  } catch (error) {
    console.error('=== SEALED PRODUCT CREATION ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Request body that caused error:', JSON.stringify(req.body, null, 2));
    console.error('=== SEALED PRODUCT CREATION ERROR END ===');

    if (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('not found')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

const updateSealedProduct = asyncHandler(async (req, res) => {
  try {
    const updatedProduct = await sealedProductCrudService.updateSealedProduct(req.params.id, req.body);

    res.status(200).json({
      success: true,
      data: updatedProduct,
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

const deleteSealedProduct = asyncHandler(async (req, res) => {
  try {
    await sealedProductCrudService.deleteSealedProduct(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Sealed product deleted successfully',
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

  const sealedProduct = await SealedProduct.findById(req.params.id);

  if (!sealedProduct) {
    throw new NotFoundError('Sealed product not found');
  }

  sealedProduct.sold = true;
  sealedProduct.saleDetails = {
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

  await sealedProduct.save();
  res.status(200).json({
    success: true,
    data: sealedProduct,
  });
});

module.exports = {
  getAllSealedProducts,
  getSealedProductById,
  createSealedProduct,
  updateSealedProduct,
  deleteSealedProduct,
  markAsSold,
};
