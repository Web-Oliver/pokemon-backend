const RawCard = require('../models/RawCard');
const Card = require('../models/Card');
const Set = require('../models/Set');
const mongoose = require('mongoose');
const { validateReferenceData, validateUserSpecificFields } = require('./referenceDataValidator');
const ImageManager = require('./shared/imageManager');
const ValidatorFactory = require('../utils/ValidatorFactory');
const Logger = require('../utils/Logger');

const validateCreateData = (data) => {
  const { cardName, setName, myPrice, condition } = data;

  Logger.service('RawCard', 'validateCreateData', 'Starting validation', {
    cardName,
    setName,
    myPrice,
    condition,
  });

  // Use ValidatorFactory for consistent validation
  ValidatorFactory.required(cardName, 'Card name');
  ValidatorFactory.required(setName, 'Set name');
  ValidatorFactory.price(myPrice, 'Price');
  ValidatorFactory.enum(condition, ['mint', 'near_mint', 'excellent', 'good', 'light_played', 'played', 'poor'], 'Condition');

  Logger.service('RawCard', 'validateCreateData', 'Validation completed successfully');
};

const findOrCreateCard = async (cardData) => {
  const startTime = Date.now();
  
  try {
    Logger.operationStart('CARD', 'FIND_OR_CREATE', {
      cardName: cardData.cardName,
      setName: cardData.setName
    });

    const { cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded } = cardData;

    Logger.database('FIND', 'sets', { setName });
    // First try to find or create the set
    let set = await Set.findOne({ setName });

    if (!set) {
      Logger.database('CREATE', 'sets', { setName, year: year || new Date().getFullYear() });
      set = new Set({
        setName,
        year: year || new Date().getFullYear(),
        totalCards: 0,
      });
      await set.save();
      Logger.service('RawCard', 'findOrCreateCard', 'New set created', { setId: set._id, setName });
    } else {
      Logger.service('RawCard', 'findOrCreateCard', 'Existing set found', { setId: set._id, setName });
    }

    Logger.database('FIND', 'cards', { cardName, setId: set._id });
    // Then try to find or create the card
    let card = await Card.findOne({
      cardName,
      setId: set._id,
    });

    if (!card) {
      const newCardData = {
        cardName,
        setId: set._id,
        pokemonNumber: pokemonNumber || '',
        variety: variety || '',
        baseName: baseName || cardName,
        psaTotalGradedForCard: psaTotalGraded || 0, // Use reference data if available
      };

      Logger.database('CREATE', 'cards', newCardData);
      card = new Card(newCardData);
      await card.save();
      Logger.service('RawCard', 'findOrCreateCard', 'New card created', { cardId: card._id, cardName });
    } else {
      Logger.service('RawCard', 'findOrCreateCard', 'Existing card found', { cardId: card._id, cardName });
      if (psaTotalGraded && card.psaTotalGradedForCard !== psaTotalGraded) {
        Logger.database('UPDATE', 'cards', { 
          cardId: card._id, 
          oldTotal: card.psaTotalGradedForCard, 
          newTotal: psaTotalGraded 
        });
        // Update existing card with new PSA total if it's different
        card.psaTotalGradedForCard = psaTotalGraded;
        await card.save();
        Logger.service('RawCard', 'findOrCreateCard', 'Card updated with new PSA total');
      }
    }

    const duration = Date.now() - startTime;

    Logger.performance('Find or Create Card', duration, {
      cardName: cardData.cardName,
      setName: cardData.setName
    });
    
    Logger.operationSuccess('CARD', 'FIND_OR_CREATE', {
      cardId: card._id,
      cardName: cardData.cardName,
      duration: `${duration}ms`
    });

    return card._id;
  } catch (error) {
    const duration = Date.now() - startTime;

    Logger.operationError('CARD', 'FIND_OR_CREATE', error, {
      cardName: cardData.cardName,
      setName: cardData.setName,
      duration: `${duration}ms`
    });
    throw error;
  }
};

const createRawCard = async (data) => {
  const startTime = Date.now();
  
  try {
    Logger.operationStart('RAW_CARD', 'CREATE', {
      cardName: data.cardName,
      setName: data.setName,
      condition: data.condition,
      price: data.myPrice
    });

    validateCreateData(data);
    Logger.service('RawCard', 'createRawCard', 'Basic validation passed');

    // Validate user-specific fields
    validateUserSpecificFields(data, 'raw');
    Logger.service('RawCard', 'createRawCard', 'User-specific fields validation passed');

    // Validate reference data consistency
    const referenceData = {
      cardName: data.cardName,
      setName: data.setName,
      pokemonNumber: data.pokemonNumber,
      variety: data.variety,
      baseName: data.baseName,
      year: data.year,
      psaTotalGraded: data.psaTotalGraded,
    };

    const validationResult = await validateReferenceData(referenceData);

    Logger.service('RawCard', 'createRawCard', 'Reference data validation passed', { 
      cardId: validationResult.cardId 
    });

    const { cardName, setName, pokemonNumber, variety, baseName, year, myPrice, condition, images, psaTotalGraded } =
      data;

    // Use the validated card ID from reference data validation
    const { cardId } = validationResult;

    Logger.service('RawCard', 'createRawCard', 'Using validated card ID', { cardId });

    const rawCardData = {
      cardId,
      condition,
      myPrice,
      images: images || [],
      priceHistory: [
        {
          price: myPrice,
          dateUpdated: new Date(),
        },
      ],
    };

    Logger.database('CREATE', 'rawcards', {
      cardId: rawCardData.cardId,
      condition: rawCardData.condition,
      price: rawCardData.myPrice
    });

    const rawCard = new RawCard(rawCardData);

    await rawCard.save();
    Logger.service('RawCard', 'createRawCard', 'Raw card saved successfully', {
      rawCardId: rawCard._id
    });

    await rawCard.populate({
      path: 'cardId',
      populate: {
        path: 'setId',
        model: 'Set',
      },
    });
    Logger.service('RawCard', 'createRawCard', 'Reference card data populated successfully');

    const duration = Date.now() - startTime;

    Logger.performance('Raw Card Creation', duration, {
      cardName: data.cardName,
      condition: data.condition,
      price: data.myPrice
    });
    
    Logger.operationSuccess('RAW_CARD', 'CREATE', {
      rawCardId: rawCard._id,
      cardName: data.cardName,
      condition: data.condition,
      duration: `${duration}ms`
    });
    
    return rawCard;
  } catch (error) {
    const duration = Date.now() - startTime;

    Logger.operationError('RAW_CARD', 'CREATE', error, {
      cardName: data.cardName,
      setName: data.setName,
      condition: data.condition,
      duration: `${duration}ms`
    });

    if (error.errors) {
      Logger.error('RawCard', 'Mongoose validation errors in createRawCard', error.errors);
    }

    throw error;
  }
};

const updateRawCard = async (id, updateData) => {
  const startTime = Date.now();
  
  Logger.operationStart('RAW_CARD', 'UPDATE', {
    rawCardId: id,
    updateFields: Object.keys(updateData)
  });

  ValidatorFactory.objectId(id, 'Raw card ID');

  const existingCard = await RawCard.findById(id);

  if (!existingCard) {
    throw new Error('Raw card not found');
  }

  Logger.service('RawCard', 'updateRawCard', 'Existing card found', {
    rawCardId: id,
    currentPrice: existingCard.myPrice,
    priceHistoryLength: existingCard.priceHistory?.length || 0,
    imageCount: existingCard.images?.length || 0
  });

  // Extract price, images, and history handling from the update data
  const { myPrice, priceHistory, images, ...otherData } = updateData;
  const dataToUpdate = { ...otherData };

  // Handle image updates and cleanup
  if (images !== undefined) {
    Logger.service('RawCard', 'updateRawCard', 'Image update detected', {
      oldImageCount: existingCard.images?.length || 0,
      newImageCount: images?.length || 0
    });

    const oldImages = existingCard.images || [];
    const newImages = images || [];

    // Find images that were removed (in old but not in new)
    const removedImages = oldImages.filter((oldImg) => !newImages.includes(oldImg));

    if (removedImages.length > 0) {
      Logger.service('RawCard', 'updateRawCard', 'Cleaning up removed images', {
        removedCount: removedImages.length
      });
      // Delete removed images from filesystem (async, don't wait)
      ImageManager.deleteImageFiles(removedImages).catch((error) => {
        Logger.error('RawCard', 'Error during image cleanup', error);
      });
    }

    dataToUpdate.images = newImages;
  }

  // Handle price and price history updates
  if (priceHistory && Array.isArray(priceHistory)) {
    Logger.service('RawCard', 'updateRawCard', 'Frontend sent complete price history', {
      historyEntries: priceHistory.length
    });
    // Frontend is managing price history - use their complete array
    dataToUpdate.priceHistory = priceHistory;

    // Set myPrice to the most recent price from history
    if (priceHistory.length > 0) {
      const latestEntry = priceHistory[priceHistory.length - 1];
      const latestPrice = latestEntry.price;
      
      Logger.service('RawCard', 'updateRawCard', 'Processing latest price from history', {
        latestPrice,
        priceType: typeof latestPrice
      });

      // Ensure proper numeric conversion for Decimal128
      let priceValue;

      if (typeof latestPrice === 'number') {
        priceValue = latestPrice;
      } else if (latestPrice && typeof latestPrice.toString === 'function') {
        priceValue = parseFloat(latestPrice.toString());
      } else {
        priceValue = parseFloat(String(latestPrice));
      }
      
      Logger.service('RawCard', 'updateRawCard', 'Converted price value', {
        convertedPrice: priceValue,
        convertedType: typeof priceValue
      });
      dataToUpdate.myPrice = priceValue;
    }
  } else if (myPrice !== undefined) {
    Logger.service('RawCard', 'updateRawCard', 'Only myPrice provided, adding to existing history', {
      newPrice: myPrice
    });
    // Only myPrice provided - add to existing history
    dataToUpdate.myPrice = myPrice;
    dataToUpdate.$push = {
      priceHistory: {
        price: myPrice,
        dateUpdated: new Date(),
      },
    };
  }

  Logger.database('UPDATE', 'rawcards', {
    rawCardId: id,
    updateFields: Object.keys(dataToUpdate)
  });

  // Get the existing card first
  const cardToUpdate = await RawCard.findById(id);

  if (!cardToUpdate) {
    throw new Error('Raw card not found');
  }

  // Apply updates directly to the document (like sealed product service)
  Object.keys(dataToUpdate).forEach((key) => {
    if (key !== '$push') {
      cardToUpdate[key] = dataToUpdate[key];
    }
  });

  // Handle $push operations separately
  if (dataToUpdate.$push) {
    Object.keys(dataToUpdate.$push).forEach((arrayField) => {
      cardToUpdate[arrayField].push(dataToUpdate.$push[arrayField]);
    });
  }

  // Save the document
  const updatedCard = await cardToUpdate.save();

  // Populate after save
  await updatedCard.populate({
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set',
    },
  });

  const duration = Date.now() - startTime;

  Logger.performance('Raw Card Update', duration, {
    rawCardId: id,
    updateFields: Object.keys(updateData)
  });

  Logger.operationSuccess('RAW_CARD', 'UPDATE', {
    rawCardId: id,
    newPrice: updatedCard.myPrice,
    priceHistoryLength: updatedCard.priceHistory?.length || 0,
    duration: `${duration}ms`
  });

  return updatedCard;
};

const deleteRawCard = async (id) => {
  const startTime = Date.now();
  
  Logger.operationStart('RAW_CARD', 'DELETE', { rawCardId: id });
  
  ValidatorFactory.objectId(id, 'Raw card ID');

  const deletedCard = await RawCard.findByIdAndDelete(id);

  if (!deletedCard) {
    throw new Error('Raw card not found');
  }

  const duration = Date.now() - startTime;

  Logger.performance('Raw Card Deletion', duration, { rawCardId: id });
  
  Logger.operationSuccess('RAW_CARD', 'DELETE', {
    rawCardId: id,
    duration: `${duration}ms`
  });

  return deletedCard;
};

module.exports = {
  validateCreateData,
  createRawCard,
  updateRawCard,
  deleteRawCard,
};
