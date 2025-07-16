const SealedProduct = require('../models/SealedProduct');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const mongoose = require('mongoose');

/**
 * Validates that the provided sealed product data contains required fields
 * For sealed products, reference data comes from CardMarketReferenceProduct
 * User-specific fields are: myPrice, images
 * Reference fields are: category, setName, name
 */
const validateCreateData = (data) => {
  console.log('=== SEALED PRODUCT VALIDATION START ===');
  console.log('Data to validate:', JSON.stringify(data, null, 2));

  const { category, setName, name, myPrice } = data;

  if (!category || !setName || !name || !myPrice) {
    throw new Error('category, setName, name, and myPrice are required');
  }

  console.log('Basic validation passed');
  console.log('=== SEALED PRODUCT VALIDATION END ===');

  return true;
};

/**
 * Validates that the reference data for sealed products matches exactly with database
 * This ensures users cannot manually modify reference data
 */
const validateSealedProductReferenceData = async (referenceData) => {
  console.log('=== SEALED PRODUCT REFERENCE DATA VALIDATION START ===');
  console.log('Reference data to validate:', JSON.stringify(referenceData, null, 2));

  const { category, setName, name } = referenceData;

  if (!category || !setName || !name) {
    throw new Error('category, setName, and name are required for reference data validation');
  }

  try {
    // Find the CardMarket reference product
    const refProduct = await CardMarketReferenceProduct.findOne({
      category,
      setName,
      name,
    });

    if (!refProduct) {
      throw new Error(`Sealed product not found in reference database: ${name} from ${setName} (${category}). This product may not exist in the reference database or the details don't match exactly.`);
    }

    console.log('Reference product found:', refProduct._id);

    // Validate that ALL provided reference data matches exactly
    const validationErrors = [];

    if (refProduct.category !== category) {
      validationErrors.push(`Category mismatch: expected "${refProduct.category}", got "${category}"`);
    }

    if (refProduct.setName !== setName) {
      validationErrors.push(`Set name mismatch: expected "${refProduct.setName}", got "${setName}"`);
    }

    if (refProduct.name !== name) {
      validationErrors.push(`Product name mismatch: expected "${refProduct.name}", got "${name}"`);
    }

    if (validationErrors.length > 0) {
      throw new Error(`Reference data validation failed: ${validationErrors.join(', ')}`);
    }

    console.log('Reference data validation passed successfully');
    console.log('=== SEALED PRODUCT REFERENCE DATA VALIDATION END ===');

    return {
      isValid: true,
      productId: refProduct._id,
      referenceProduct: refProduct,
      validatedData: {
        category: refProduct.category,
        setName: refProduct.setName,
        name: refProduct.name,
      },
    };
  } catch (error) {
    console.error('=== SEALED PRODUCT REFERENCE DATA VALIDATION ERROR ===');
    console.error('Error:', error.message);
    console.error('=== SEALED PRODUCT REFERENCE DATA VALIDATION ERROR END ===');
    throw error;
  }
};

/**
 * Creates a new sealed product using the validation system
 */
const createSealedProduct = async (data) => {
  console.log('=== SEALED PRODUCT CREATION START ===');
  console.log('Data received:', JSON.stringify(data, null, 2));

  // Validate basic data structure
  validateCreateData(data);

  // Extract reference data and user-specific data
  const { category, setName, name, myPrice, images } = data;

  const referenceData = { category, setName, name };
  const userSpecificData = { myPrice, images: images || [] };

  // Validate reference data matches database exactly
  const validationResult = await validateSealedProductReferenceData(referenceData);
  const { productId } = validationResult;
  const refProduct = validationResult.referenceProduct;

  // Create the sealed product with validated data
  const sealedProductData = {
    productId,
    category: refProduct.category,
    setName: refProduct.setName,
    name: refProduct.name,
    myPrice: userSpecificData.myPrice,
    images: userSpecificData.images,
    availability: refProduct.available || 1,
    cardMarketPrice: refProduct ? parseFloat(refProduct.price.replace(/[€]/g, '').replace(',', '.')) : 0,
    priceHistory: [{
      price: userSpecificData.myPrice,
      dateUpdated: new Date(),
    }],
  };

  console.log('Creating sealed product with data:', JSON.stringify(sealedProductData, null, 2));

  const sealedProduct = new SealedProduct(sealedProductData);

  await sealedProduct.save();

  // Populate the reference product data
  await sealedProduct.populate('productId');

  console.log('Sealed product created successfully:', sealedProduct._id);
  console.log('=== SEALED PRODUCT CREATION END ===');

  return sealedProduct;
};

/**
 * Updates a sealed product
 */
const updateSealedProduct = async (id, data) => {
  console.log('=== SEALED PRODUCT UPDATE START ===');
  console.log('ID:', id);
  console.log('Data:', JSON.stringify(data, null, 2));

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }

  const sealedProduct = await SealedProduct.findById(id);

  if (!sealedProduct) {
    throw new Error('Sealed product not found');
  }

  const { myPrice, ...otherUpdates } = data;

  // If price is being updated, add to price history
  if (myPrice !== undefined) {
    const currentPrice = sealedProduct.myPrice.toString
      ? parseFloat(sealedProduct.myPrice.toString())
      : parseFloat(sealedProduct.myPrice);
    const newPrice = parseFloat(myPrice);

    if (newPrice !== currentPrice) {
      sealedProduct.priceHistory.push({
        price: myPrice,
        dateUpdated: new Date(),
      });
    }
  }

  // Update fields
  Object.keys(otherUpdates).forEach((key) => {
    sealedProduct[key] = otherUpdates[key];
  });

  if (myPrice) {
    sealedProduct.myPrice = myPrice;
  }

  await sealedProduct.save();

  // Populate the reference product data
  await sealedProduct.populate('productId');

  console.log('Sealed product updated successfully');
  console.log('=== SEALED PRODUCT UPDATE END ===');

  return sealedProduct;
};

/**
 * Deletes a sealed product
 */
const deleteSealedProduct = async (id) => {
  console.log('=== SEALED PRODUCT DELETE START ===');
  console.log('ID:', id);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }

  const sealedProduct = await SealedProduct.findByIdAndDelete(id);

  if (!sealedProduct) {
    throw new Error('Sealed product not found');
  }

  console.log('Sealed product deleted successfully');
  console.log('=== SEALED PRODUCT DELETE END ===');

  return sealedProduct;
};

module.exports = {
  createSealedProduct,
  updateSealedProduct,
  deleteSealedProduct,
  validateSealedProductReferenceData,
  validateCreateData,
};
