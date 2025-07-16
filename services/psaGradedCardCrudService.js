const PsaGradedCard = require('../models/PsaGradedCard');
const Card = require('../models/Card');
const Set = require('../models/Set');
const mongoose = require('mongoose');
const { validateReferenceData, validateUserSpecificFields } = require('./referenceDataValidator');
const ImageManager = require('./shared/imageManager');


const validateCreateData = (data) => {
  const { cardName, setName, grade, myPrice } = data;

  console.log('Validating PSA graded card data:', { cardName, setName, grade, myPrice });

  if (!cardName || !setName || !grade || !myPrice) {
    throw new Error('cardName, setName, grade, and myPrice are required');
  }
};

const findOrCreateCard = async (cardData) => {
  try {
    console.log('=== FIND OR CREATE CARD START ===');
    console.log('Card data input:', JSON.stringify(cardData, null, 2));

    const { cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded } = cardData;

    console.log('Searching for existing set:', setName);
    // First try to find or create the set
    let set = await Set.findOne({ setName });

    if (!set) {
      console.log('Set not found, creating new set...');
      set = new Set({
        setName,
        year: year || new Date().getFullYear(),
        totalCards: 0,
      });
      await set.save();
      console.log('New set created:', set._id);
    } else {
      console.log('Existing set found:', set._id);
    }

    console.log('Searching for existing card:', cardName, 'in set:', set._id);
    // Then try to find or create the card
    let card = await Card.findOne({
      cardName,
      setId: set._id,
    });

    if (!card) {
      console.log('Card not found, creating new card...');
      const newCardData = {
        cardName,
        setId: set._id,
        pokemonNumber: pokemonNumber || '',
        variety: variety || '',
        baseName: baseName || cardName,
        psaTotalGradedForCard: psaTotalGraded || 0, // Use reference data if available
      };

      console.log('New card data:', JSON.stringify(newCardData, null, 2));

      card = new Card(newCardData);
      await card.save();
      console.log('New card created:', card._id);
    } else {
      console.log('Existing card found:', card._id);
      if (psaTotalGraded && card.psaTotalGradedForCard !== psaTotalGraded) {
        console.log('Updating PSA total graded from', card.psaTotalGradedForCard, 'to', psaTotalGraded);
        // Update existing card with new PSA total if it's different
        card.psaTotalGradedForCard = psaTotalGraded;
        await card.save();
        console.log('Card updated with new PSA total');
      }
    }

    console.log('=== FIND OR CREATE CARD END ===');
    return card._id;
  } catch (error) {
    console.error('=== FIND OR CREATE CARD ERROR ===');
    console.error('Error in findOrCreateCard:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    if (error.errors) {
      console.error('Mongoose validation errors:', error.errors);
    }

    console.error('=== FIND OR CREATE CARD ERROR END ===');
    throw error;
  }
};

const createPsaGradedCard = async (data) => {
  try {
    console.log('=== PSA GRADED CARD COLLECTION ITEM CREATION START ===');
    console.log('Input data:', JSON.stringify(data, null, 2));

    validateCreateData(data);
    console.log('Basic validation passed');

    // Validate user-specific fields
    validateUserSpecificFields(data, 'psa');
    console.log('User-specific fields validation passed');

    const { cardName, setName, pokemonNumber, variety, baseName, year, grade, myPrice, images, psaTotalGraded } = data;

    console.log('Extracted fields:', {
      cardName,
      setName,
      pokemonNumber,
      variety,
      baseName,
      year,
      grade,
      myPrice,
      images: images ? images.length : 0,
      psaTotalGraded,
    });

    // Validate that the reference card exists in the database
    // This ensures users can only select real cards from the dropdown
    const referenceData = { cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded };
    const validation = await validateReferenceData(referenceData);

    console.log('Reference card validation passed, using card ID:', validation.cardId);

    // Create collection item that references the validated card
    const psaGradedCardData = {
      cardId: validation.cardId,
      grade,
      myPrice,
      images: images || [],
      priceHistory: [{
        price: myPrice,
        dateUpdated: new Date(),
      }],
    };

    console.log('PSA collection item data to save:', JSON.stringify(psaGradedCardData, null, 2));

    const psaGradedCard = new PsaGradedCard(psaGradedCardData);

    console.log('Saving PSA collection item...');
    await psaGradedCard.save();
    console.log('PSA collection item saved successfully');

    console.log('Populating reference card data...');
    await psaGradedCard.populate({
      path: 'cardId',
      populate: {
        path: 'setId',
        model: 'Set',
      },
    });
    console.log('Reference card data populated successfully');

    console.log('=== PSA GRADED CARD COLLECTION ITEM CREATION END ===');
    return psaGradedCard;
  } catch (error) {
    console.error('=== PSA GRADED CARD COLLECTION ITEM CREATION ERROR ===');
    console.error('Error in createPsaGradedCard:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);

    if (error.errors) {
      console.error('Mongoose validation errors:', error.errors);
    }

    console.error('=== PSA GRADED CARD COLLECTION ITEM CREATION ERROR END ===');
    throw error;
  }
};

const updatePsaGradedCard = async (id, updateData) => {
  console.log('[PSA UPDATE] ===== UPDATE STARTED =====');
  console.log('[PSA UPDATE] ID:', id);
  console.log('[PSA UPDATE] updateData:', JSON.stringify(updateData, null, 2));

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }

  const existingCard = await PsaGradedCard.findById(id);

  if (!existingCard) {
    throw new Error('PSA graded card not found');
  }

  console.log('[PSA UPDATE] Existing card found, current price:', existingCard.myPrice);
  console.log('[PSA UPDATE] Existing priceHistory length:', existingCard.priceHistory?.length || 0);
  console.log('[PSA UPDATE] Existing images:', existingCard.images?.length || 0);

  // Extract price, images, and history handling from the update data
  const { myPrice, priceHistory, images, ...otherData } = updateData;
  const dataToUpdate = { ...otherData };

  // Handle image updates and cleanup
  if (images !== undefined) {
    console.log('[PSA UPDATE] Image update detected');
    console.log('[PSA UPDATE] Old images:', existingCard.images?.length || 0);
    console.log('[PSA UPDATE] New images:', images?.length || 0);

    const oldImages = existingCard.images || [];
    const newImages = images || [];

    // Find images that were removed (in old but not in new)
    const removedImages = oldImages.filter((oldImg) => !newImages.includes(oldImg));

    if (removedImages.length > 0) {
      console.log('[PSA UPDATE] Images to delete:', removedImages);
      // Delete removed images from filesystem (async, don't wait)
      ImageManager.deleteImageFiles(removedImages).catch((error) => {
        console.error('[PSA UPDATE] Error during image cleanup:', error);
      });
    }

    dataToUpdate.images = newImages;
  }

  // Handle price and price history updates
  if (priceHistory && Array.isArray(priceHistory)) {
    console.log('[PSA UPDATE] Frontend sent priceHistory:', priceHistory.length, 'entries');
    // Frontend is managing price history - use their complete array
    dataToUpdate.priceHistory = priceHistory;

    // Set myPrice to the most recent price from history
    if (priceHistory.length > 0) {
      const latestPrice = priceHistory[priceHistory.length - 1].price;

      dataToUpdate.myPrice = latestPrice;
      console.log('[PSA UPDATE] Using latest price from history:', latestPrice);
    }
  } else if (myPrice !== undefined) {
    console.log('[PSA UPDATE] Only myPrice provided, adding to existing history');
    // Only myPrice provided - add to existing history
    dataToUpdate.myPrice = myPrice;
    dataToUpdate.$push = {
      priceHistory: {
        price: myPrice,
        dateUpdated: new Date(),
      },
    };
  }

  console.log('[PSA UPDATE] Final dataToUpdate:', JSON.stringify(dataToUpdate, null, 2));

  const updatedCard = await PsaGradedCard.findByIdAndUpdate(
    id,
    dataToUpdate,
    { new: true, runValidators: true },
  ).populate({
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set',
    },
  });

  if (!updatedCard) {
    throw new Error('PSA graded card not found');
  }

  console.log('[PSA UPDATE] Update successful, new price:', updatedCard.myPrice);
  console.log('[PSA UPDATE] New priceHistory length:', updatedCard.priceHistory?.length || 0);
  console.log('[PSA UPDATE] ===== UPDATE COMPLETED =====');

  return updatedCard;
};

const deletePsaGradedCard = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }

  const deletedCard = await PsaGradedCard.findByIdAndDelete(id);

  if (!deletedCard) {
    throw new Error('PSA graded card not found');
  }

  return deletedCard;
};

module.exports = {
  validateCreateData,
  createPsaGradedCard,
  updatePsaGradedCard,
  deletePsaGradedCard,
};
