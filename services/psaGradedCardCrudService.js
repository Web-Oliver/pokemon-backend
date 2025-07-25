const PsaGradedCard = require('../models/PsaGradedCard');
const Card = require('../models/Card');
const Set = require('../models/Set');
const mongoose = require('mongoose');
const { validateReferenceData, validateUserSpecificFields } = require('./referenceDataValidator');
const ImageManager = require('./shared/imageManager');
const ValidatorFactory = require('../utils/ValidatorFactory');
const Logger = require('../utils/Logger');

const validateCreateData = (data) => {
  const { cardName, setName, grade, myPrice } = data;

  Logger.service('PsaGradedCard', 'validateCreateData', 'Starting validation', {
    cardName,
    setName,
    grade,
    myPrice,
  });

  // Use ValidatorFactory for consistent validation
  ValidatorFactory.required(cardName, 'Card name');
  ValidatorFactory.required(setName, 'Set name');
  ValidatorFactory.number(grade, 'Grade', { min: 1, max: 10, integer: true, required: true });
  ValidatorFactory.price(myPrice, 'Price');

  Logger.service('PsaGradedCard', 'validateCreateData', 'Validation completed successfully');
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
      Logger.service('PsaGradedCard', 'findOrCreateCard', 'New set created', { setId: set._id, setName });
    } else {
      Logger.service('PsaGradedCard', 'findOrCreateCard', 'Existing set found', { setId: set._id, setName });
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
      Logger.service('PsaGradedCard', 'findOrCreateCard', 'New card created', { cardId: card._id, cardName });
    } else {
      Logger.service('PsaGradedCard', 'findOrCreateCard', 'Existing card found', { cardId: card._id, cardName });
      if (psaTotalGraded && card.psaTotalGradedForCard !== psaTotalGraded) {
        Logger.database('UPDATE', 'cards', { 
          cardId: card._id, 
          oldTotal: card.psaTotalGradedForCard, 
          newTotal: psaTotalGraded 
        });
        // Update existing card with new PSA total if it's different
        card.psaTotalGradedForCard = psaTotalGraded;
        await card.save();
        Logger.service('PsaGradedCard', 'findOrCreateCard', 'Card updated with new PSA total');
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

    if (error.errors) {
      Logger.error('PsaGradedCard', 'Mongoose validation errors in findOrCreateCard', error.errors);
    }

    throw error;
  }
};

const createPsaGradedCard = async (data) => {
  const startTime = Date.now();
  
  try {
    Logger.operationStart('PSA_CARD', 'CREATE', {
      cardName: data.cardName,
      setName: data.setName,
      grade: data.grade,
      price: data.myPrice
    });

    validateCreateData(data);
    Logger.service('PsaGradedCard', 'createPsaGradedCard', 'Basic validation passed');

    // Validate user-specific fields
    validateUserSpecificFields(data, 'psa');
    Logger.service('PsaGradedCard', 'createPsaGradedCard', 'User-specific fields validation passed');

    const { cardName, setName, pokemonNumber, variety, baseName, year, grade, myPrice, images, psaTotalGraded } = data;

    Logger.service('PsaGradedCard', 'createPsaGradedCard', 'Extracted fields', {
      cardName,
      setName,
      pokemonNumber,
      variety,
      baseName,
      year,
      grade,
      myPrice,
      imageCount: images ? images.length : 0,
      psaTotalGraded,
    });

    // Validate that the reference card exists in the database
    // This ensures users can only select real cards from the dropdown
    const referenceData = {
      cardName,
      setName,
      pokemonNumber,
      variety,
      baseName,
      year,
      psaTotalGraded,
    };
    const validation = await validateReferenceData(referenceData);

    Logger.service('PsaGradedCard', 'createPsaGradedCard', 'Reference card validation passed', { 
      cardId: validation.cardId 
    });

    // Create collection item that references the validated card
    const psaGradedCardData = {
      cardId: validation.cardId,
      grade,
      myPrice,
      images: images || [],
      priceHistory: [
        {
          price: myPrice,
          dateUpdated: new Date(),
        },
      ],
    };

    Logger.database('CREATE', 'psagradedcards', {
      cardId: psaGradedCardData.cardId,
      grade: psaGradedCardData.grade,
      price: psaGradedCardData.myPrice
    });

    const psaGradedCard = new PsaGradedCard(psaGradedCardData);

    await psaGradedCard.save();
    Logger.service('PsaGradedCard', 'createPsaGradedCard', 'PSA collection item saved successfully', {
      psaCardId: psaGradedCard._id
    });

    await psaGradedCard.populate({
      path: 'cardId',
      populate: {
        path: 'setId',
        model: 'Set',
      },
    });
    Logger.service('PsaGradedCard', 'createPsaGradedCard', 'Reference card data populated successfully');

    const duration = Date.now() - startTime;
    Logger.performance('PSA Card Creation', duration, {
      cardName: data.cardName,
      grade: data.grade,
      price: data.myPrice
    });
    
    Logger.operationSuccess('PSA_CARD', 'CREATE', {
      psaCardId: psaGradedCard._id,
      cardName: data.cardName,
      grade: data.grade,
      duration: `${duration}ms`
    });
    
    return psaGradedCard;
  } catch (error) {
    const duration = Date.now() - startTime;
    Logger.operationError('PSA_CARD', 'CREATE', error, {
      cardName: data.cardName,
      setName: data.setName,
      grade: data.grade,
      duration: `${duration}ms`
    });

    if (error.errors) {
      Logger.error('PsaGradedCard', 'Mongoose validation errors in createPsaGradedCard', error.errors);
    }

    throw error;
  }
};

const updatePsaGradedCard = async (id, updateData) => {
  const startTime = Date.now();
  
  Logger.operationStart('PSA_CARD', 'UPDATE', {
    psaCardId: id,
    updateFields: Object.keys(updateData)
  });

  ValidatorFactory.objectId(id, 'PSA graded card ID');

  const existingCard = await PsaGradedCard.findById(id);

  if (!existingCard) {
    throw new Error('PSA graded card not found');
  }

  Logger.service('PsaGradedCard', 'updatePsaGradedCard', 'Existing card found', {
    psaCardId: id,
    currentPrice: existingCard.myPrice,
    priceHistoryLength: existingCard.priceHistory?.length || 0,
    imageCount: existingCard.images?.length || 0
  });

  // Extract price, images, and history handling from the update data
  const { myPrice, priceHistory, images, ...otherData } = updateData;
  const dataToUpdate = { ...otherData };

  // Handle image updates and cleanup
  if (images !== undefined) {
    Logger.service('PsaGradedCard', 'updatePsaGradedCard', 'Image update detected', {
      oldImageCount: existingCard.images?.length || 0,
      newImageCount: images?.length || 0
    });

    const oldImages = existingCard.images || [];
    const newImages = images || [];

    // Find images that were removed (in old but not in new)
    const removedImages = oldImages.filter((oldImg) => !newImages.includes(oldImg));

    if (removedImages.length > 0) {
      Logger.service('PsaGradedCard', 'updatePsaGradedCard', 'Cleaning up removed images', {
        removedCount: removedImages.length
      });
      // Delete removed images from filesystem (async, don't wait)
      ImageManager.deleteImageFiles(removedImages).catch((error) => {
        Logger.error('PsaGradedCard', 'Error during image cleanup', error);
      });
    }

    dataToUpdate.images = newImages;
  }

  // Handle price and price history updates
  if (priceHistory && Array.isArray(priceHistory)) {
    Logger.service('PsaGradedCard', 'updatePsaGradedCard', 'Frontend sent complete price history', {
      historyEntries: priceHistory.length
    });
    // Frontend is managing price history - use their complete array
    dataToUpdate.priceHistory = priceHistory;

    // Set myPrice to the most recent price from history
    if (priceHistory.length > 0) {
      const latestEntry = priceHistory[priceHistory.length - 1];
      const latestPrice = latestEntry.price;
      
      Logger.service('PsaGradedCard', 'updatePsaGradedCard', 'Setting price from latest history entry', {
        latestPrice,
        priceType: typeof latestPrice
      });

      // Let MongoDB handle the Decimal128 conversion by using the raw value
      dataToUpdate.myPrice = latestPrice;
    }
  } else if (myPrice !== undefined) {
    Logger.service('PsaGradedCard', 'updatePsaGradedCard', 'Only myPrice provided, adding to existing history', {
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

  Logger.database('UPDATE', 'psagradedcards', {
    psaCardId: id,
    updateFields: Object.keys(dataToUpdate)
  });

  const updatedCard = await PsaGradedCard.findByIdAndUpdate(id, dataToUpdate, {
    new: true,
    runValidators: true,
  }).populate({
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set',
    },
  });

  if (!updatedCard) {
    throw new Error('PSA graded card not found');
  }

  const duration = Date.now() - startTime;
  Logger.performance('PSA Card Update', duration, {
    psaCardId: id,
    updateFields: Object.keys(updateData)
  });

  Logger.operationSuccess('PSA_CARD', 'UPDATE', {
    psaCardId: id,
    newPrice: updatedCard.myPrice,
    priceHistoryLength: updatedCard.priceHistory?.length || 0,
    duration: `${duration}ms`
  });

  return updatedCard;
};

const deletePsaGradedCard = async (id) => {
  const startTime = Date.now();
  
  Logger.operationStart('PSA_CARD', 'DELETE', { psaCardId: id });
  
  ValidatorFactory.objectId(id, 'PSA graded card ID');

  const deletedCard = await PsaGradedCard.findByIdAndDelete(id);

  if (!deletedCard) {
    throw new Error('PSA graded card not found');
  }

  const duration = Date.now() - startTime;
  Logger.performance('PSA Card Deletion', duration, { psaCardId: id });
  
  Logger.operationSuccess('PSA_CARD', 'DELETE', {
    psaCardId: id,
    duration: `${duration}ms`
  });

  return deletedCard;
};

module.exports = {
  validateCreateData,
  createPsaGradedCard,
  updatePsaGradedCard,
  deletePsaGradedCard,
};
