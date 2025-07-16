const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const SealedProduct = require('../models/SealedProduct');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const path = require('path');
const fs = require('fs');

/**
 * ZIP PSA Card images
 * GET /api/export/zip/psa-cards?ids=id1,id2,id3 (optional - if no ids, zip all)
 */
const zipPsaCardImages = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  
  let query = {};
  if (ids) {
    const cardIds = ids.split(',').filter(id => id.trim());
    query._id = { $in: cardIds };
  }
  
  const psaCards = await PsaGradedCard.find(query).populate('cardId');
  
  if (psaCards.length === 0) {
    throw new ValidationError('No PSA cards found');
  }
  
  // Send JSON response with card data for frontend ZIP generation
  res.status(200).json({
    status: 'success',
    data: psaCards.map(card => ({
      id: card._id,
      images: card.images || [],
      cardName: card.cardId?.cardName || card.cardName || 'Unknown Card',
      baseName: card.cardId?.baseName || '',
      grade: card.grade,
      pokemonNumber: card.cardId?.pokemonNumber || '',
      variety: card.cardId?.variety || 'Standard'
    }))
  });
});

/**
 * ZIP Raw Card images
 * GET /api/export/zip/raw-cards?ids=id1,id2,id3 (optional - if no ids, zip all)
 */
const zipRawCardImages = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  
  let query = {};
  if (ids) {
    const cardIds = ids.split(',').filter(id => id.trim());
    query._id = { $in: cardIds };
  }
  
  const rawCards = await RawCard.find(query).populate('cardId');
  
  if (rawCards.length === 0) {
    throw new ValidationError('No raw cards found');
  }
  
  // Send JSON response with card data for frontend ZIP generation
  res.status(200).json({
    status: 'success',
    data: rawCards.map(card => ({
      id: card._id,
      images: card.images || [],
      cardName: card.cardId?.cardName || card.cardName || 'Unknown Card',
      baseName: card.cardId?.baseName || '',
      condition: card.condition,
      pokemonNumber: card.cardId?.pokemonNumber || '',
      variety: card.cardId?.variety || 'Standard'
    }))
  });
});

/**
 * ZIP Sealed Product images
 * GET /api/export/zip/sealed-products?ids=id1,id2,id3 (optional - if no ids, zip all)
 */
const zipSealedProductImages = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  
  let query = {};
  if (ids) {
    const productIds = ids.split(',').filter(id => id.trim());
    query._id = { $in: productIds };
  }
  
  const sealedProducts = await SealedProduct.find(query);
  
  if (sealedProducts.length === 0) {
    throw new ValidationError('No sealed products found');
  }
  
  // Send JSON response with product data for frontend ZIP generation
  res.status(200).json({
    status: 'success',
    data: sealedProducts.map(product => ({
      id: product._id,
      images: product.images || [],
      name: product.name || 'Unknown Product',
      category: product.category,
      setName: product.setName
    }))
  });
});

module.exports = {
  zipPsaCardImages,
  zipRawCardImages,
  zipSealedProductImages,
};