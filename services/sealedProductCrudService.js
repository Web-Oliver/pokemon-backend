const SealedProduct = require('../models/SealedProduct');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const mongoose = require('mongoose');
const Logger = require('../utils/Logger');
const ValidatorFactory = require('../utils/ValidatorFactory');
const { getEntityConfig, getValidationRules } = require('../config/entityConfigurations');

/**
 * Validates that the provided sealed product data contains required fields
 * For sealed products, reference data comes from CardMarketReferenceProduct
 * User-specific fields are: myPrice, images
 * Reference fields are: category, setName, name
 */
const validateCreateData = (data) => {
  Logger.operationStart('SEALED_PRODUCT', 'VALIDATE_CREATE_DATA', { dataKeys: Object.keys(data) });

  const { category, setName, name, myPrice } = data;
  const entityConfig = getEntityConfig('sealedProduct');
  const validationRules = getValidationRules('sealedProduct');

  // Validate required fields using entity configuration
  const requiredFields = entityConfig?.requiredFields || ['category', 'setName', 'name', 'myPrice'];

  requiredFields.forEach(field => {
    if (!data[field]) {
      Logger.operationError('SEALED_PRODUCT', 'VALIDATE_CREATE_DATA', 
        new Error(`${field} is required`), { field });
      throw new Error(`${field} is required`);
    }
  });

  // Validate myPrice using ValidatorFactory
  if (myPrice !== undefined) {
    ValidatorFactory.price(myPrice, 'myPrice');
  }

  // Validate category using ValidatorFactory enum validation
  if (category && validationRules?.category) {
    ValidatorFactory.enum(category, validationRules.category.choices, 'category', true);
  }

  // Validate string fields
  ValidatorFactory.string(setName, 'setName', { required: true });
  ValidatorFactory.string(name, 'name', { required: true });

  Logger.operationSuccess('SEALED_PRODUCT', 'VALIDATE_CREATE_DATA', { validated: true });
  return true;
};

/**
 * Validates that the reference data for sealed products matches exactly with database
 * This ensures users cannot manually modify reference data
 */
const validateSealedProductReferenceData = async (referenceData) => {
  Logger.operationStart('SEALED_PRODUCT', 'VALIDATE_REFERENCE_DATA', { referenceData });

  const { category, setName, name } = referenceData;

  // Validate required reference fields
  ValidatorFactory.string(category, 'category', { required: true });
  ValidatorFactory.string(setName, 'setName', { required: true });
  ValidatorFactory.string(name, 'name', { required: true });

  try {
    Logger.database('QUERY', 'CardMarketReferenceProduct', { 
      operation: 'findOne', 
      criteria: { category, setName, name } 
    });

    // Find the CardMarket reference product
    const refProduct = await CardMarketReferenceProduct.findOne({
      category,
      setName,
      name,
    });

    if (!refProduct) {
      const error = new Error(
        `Sealed product not found in reference database: ${name} from ${setName} (${category}). This product may not exist in the reference database or the details don't match exactly.`,
      );

      Logger.operationError('SEALED_PRODUCT', 'VALIDATE_REFERENCE_DATA', error, { 
        searchCriteria: { category, setName, name } 
      });
      throw error;
    }

    Logger.service('SealedProductCrudService', 'validateSealedProductReferenceData', 
      'Reference product found', { productId: refProduct._id });

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
      const error = new Error(`Reference data validation failed: ${validationErrors.join(', ')}`);

      Logger.operationError('SEALED_PRODUCT', 'VALIDATE_REFERENCE_DATA', error, { validationErrors });
      throw error;
    }

    Logger.operationSuccess('SEALED_PRODUCT', 'VALIDATE_REFERENCE_DATA', { 
      productId: refProduct._id,
      validated: true 
    });

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
    Logger.operationError('SEALED_PRODUCT', 'VALIDATE_REFERENCE_DATA', error, { referenceData });
    throw error;
  }
};

/**
 * Creates a new sealed product using the validation system
 */
const createSealedProduct = async (data) => {
  Logger.operationStart('SEALED_PRODUCT', 'CREATE', { dataKeys: Object.keys(data) });

  try {
    // Validate basic data structure
    validateCreateData(data);

    // Extract reference data and user-specific data
    const { category, setName, name, myPrice, images } = data;

    // Validate images if provided
    if (images) {
      ValidatorFactory.imageArray(images, 'images');
    }

    const referenceData = { category, setName, name };
    const userSpecificData = { myPrice, images: images || [] };

    Logger.service('SealedProductCrudService', 'createSealedProduct', 
      'Validating reference data', { referenceData });

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
      priceHistory: [
        {
          price: userSpecificData.myPrice,
          dateUpdated: new Date(),
        },
      ],
    };

    Logger.service('SealedProductCrudService', 'createSealedProduct', 
      'Creating sealed product', { productId, category, setName, name });

    const sealedProduct = new SealedProduct(sealedProductData);

    Logger.database('CREATE', 'SealedProduct', { operation: 'save', productId });
    await sealedProduct.save();

    // Populate the reference product data
    const entityConfig = getEntityConfig('sealedProduct');
    const populateConfig = entityConfig?.defaultPopulate;

    if (populateConfig) {
      await sealedProduct.populate(populateConfig);
    } else {
      await sealedProduct.populate('productId');
    }

    Logger.operationSuccess('SEALED_PRODUCT', 'CREATE', { 
      sealedProductId: sealedProduct._id,
      productId,
      name: sealedProduct.name 
    });

    return sealedProduct;
  } catch (error) {
    Logger.operationError('SEALED_PRODUCT', 'CREATE', error, { data });
    throw error;
  }
};

/**
 * Updates a sealed product
 */
const updateSealedProduct = async (id, data) => {
  Logger.operationStart('SEALED_PRODUCT', 'UPDATE', { id, dataKeys: Object.keys(data) });

  try {
    // Validate ObjectId using ValidatorFactory
    ValidatorFactory.objectId(id, 'sealedProduct ID');

    Logger.database('QUERY', 'SealedProduct', { operation: 'findById', id });
    const sealedProduct = await SealedProduct.findById(id);

    if (!sealedProduct) {
      const error = new Error('Sealed product not found');

      Logger.operationError('SEALED_PRODUCT', 'UPDATE', error, { id });
      throw error;
    }

    const { myPrice, priceHistory, images, ...otherUpdates } = data;

    // Validate images if provided
    if (images) {
      ValidatorFactory.imageArray(images, 'images');
    }

    // Handle price and price history updates (matching PSA/Raw card pattern)
    if (priceHistory && Array.isArray(priceHistory)) {
      Logger.service('SealedProductCrudService', 'updateSealedProduct', 
        'Frontend sent complete priceHistory', { historyLength: priceHistory.length });
      
      // Validate each price in history
      priceHistory.forEach((entry, index) => {
        if (entry.price !== undefined) {
          ValidatorFactory.price(entry.price, `priceHistory[${index}].price`);
        }
      });

      // Frontend is managing price history - use their complete array
      sealedProduct.priceHistory = priceHistory;

      // Set myPrice to the most recent price from history
      if (priceHistory.length > 0) {
        const latestPrice = priceHistory[priceHistory.length - 1].price;

        sealedProduct.myPrice = latestPrice;
        Logger.service('SealedProductCrudService', 'updateSealedProduct', 
          'Using latest price from history', { latestPrice });
      }
    } else if (myPrice !== undefined) {
      Logger.service('SealedProductCrudService', 'updateSealedProduct', 
        'Only myPrice provided, adding to existing history');
      
      // Validate new price
      ValidatorFactory.price(myPrice, 'myPrice');

      // Only myPrice provided - add to existing history
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
      sealedProduct.myPrice = myPrice;
    }

    // Update other fields
    Object.keys(otherUpdates).forEach((key) => {
      sealedProduct[key] = otherUpdates[key];
    });

    Logger.database('UPDATE', 'SealedProduct', { operation: 'save', id });
    await sealedProduct.save();

    // Populate the reference product data using entity configuration
    const entityConfig = getEntityConfig('sealedProduct');
    const populateConfig = entityConfig?.defaultPopulate;

    if (populateConfig) {
      await sealedProduct.populate(populateConfig);
    } else {
      await sealedProduct.populate('productId');
    }

    Logger.operationSuccess('SEALED_PRODUCT', 'UPDATE', { 
      id: sealedProduct._id,
      name: sealedProduct.name 
    });

    return sealedProduct;
  } catch (error) {
    Logger.operationError('SEALED_PRODUCT', 'UPDATE', error, { id, data });
    throw error;
  }
};

/**
 * Deletes a sealed product
 */
const deleteSealedProduct = async (id) => {
  Logger.operationStart('SEALED_PRODUCT', 'DELETE', { id });

  try {
    // Validate ObjectId using ValidatorFactory
    ValidatorFactory.objectId(id, 'sealedProduct ID');

    Logger.database('DELETE', 'SealedProduct', { operation: 'findByIdAndDelete', id });
    const sealedProduct = await SealedProduct.findByIdAndDelete(id);

    if (!sealedProduct) {
      const error = new Error('Sealed product not found');

      Logger.operationError('SEALED_PRODUCT', 'DELETE', error, { id });
      throw error;
    }

    Logger.operationSuccess('SEALED_PRODUCT', 'DELETE', { 
      id: sealedProduct._id,
      name: sealedProduct.name 
    });

    return sealedProduct;
  } catch (error) {
    Logger.operationError('SEALED_PRODUCT', 'DELETE', error, { id });
    throw error;
  }
};

module.exports = {
  createSealedProduct,
  updateSealedProduct,
  deleteSealedProduct,
  validateSealedProductReferenceData,
  validateCreateData,
};
