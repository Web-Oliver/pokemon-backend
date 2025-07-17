const RawCard = require('../models/RawCard');
const Card = require('../models/Card');
const Set = require('../models/Set');
const mongoose = require('mongoose');
const { validateReferenceData, validateUserSpecificFields } = require('./referenceDataValidator');
const ImageManager = require('./shared/imageManager');

const validateCreateData = (data) => {
  const { cardName, setName, myPrice, condition } = data;

  if (!cardName || !setName || !myPrice || !condition) {
    throw new Error('cardName, setName, myPrice, and condition are required');
  }
};

const findOrCreateCard = async (cardData) => {
  const { cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded } = cardData;

  // First try to find or create the set
  let set = await Set.findOne({ setName });

  if (!set) {
    set = new Set({
      setName,
      year: year || new Date().getFullYear(),
      totalCards: 0,
    });
    await set.save();
  }

  // Then try to find or create the card
  let card = await Card.findOne({
    cardName,
    setId: set._id,
  });

  if (!card) {
    card = new Card({
      cardName,
      setId: set._id,
      pokemonNumber: pokemonNumber || '',
      variety: variety || '',
      baseName: baseName || cardName,
      psaTotalGradedForCard: psaTotalGraded || 0, // Use reference data if available
    });
    await card.save();
  } else if (psaTotalGraded && card.psaTotalGradedForCard !== psaTotalGraded) {
    // Update existing card with new PSA total if it's different
    card.psaTotalGradedForCard = psaTotalGraded;
    await card.save();
  }

  return card._id;
};

const createRawCard = async (data) => {
  try {
    console.log('=== RAW CARD SERVICE START ===');
    console.log('Input data:', JSON.stringify(data, null, 2));

    validateCreateData(data);
    console.log('Basic validation passed');

    // Validate user-specific fields
    validateUserSpecificFields(data, 'raw');
    console.log('User-specific fields validation passed');

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

    console.log('Reference data validation passed');

    const { cardName, setName, pokemonNumber, variety, baseName, year, myPrice, condition, images, psaTotalGraded } =
      data;

    // Use the validated card ID from reference data validation
    const { cardId } = validationResult;

    console.log('Using validated card ID:', cardId);

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

    const rawCard = new RawCard(rawCardData);

    await rawCard.save();

    await rawCard.populate({
      path: 'cardId',
      populate: {
        path: 'setId',
        model: 'Set',
      },
    });

    console.log('Raw card created successfully');
    console.log('=== RAW CARD SERVICE END ===');
    return rawCard;
  } catch (error) {
    console.error('=== RAW CARD SERVICE ERROR ===');
    console.error('Error in createRawCard:', error);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('=== RAW CARD SERVICE ERROR END ===');
    throw error;
  }
};

const updateRawCard = async (id, updateData) => {
  console.log('[RAW UPDATE] ===== UPDATE STARTED =====');
  console.log('[RAW UPDATE] ID:', id);
  console.log('[RAW UPDATE] updateData:', JSON.stringify(updateData, null, 2));

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }

  const existingCard = await RawCard.findById(id);

  if (!existingCard) {
    throw new Error('Raw card not found');
  }

  console.log('[RAW UPDATE] Existing card found, current price:', existingCard.myPrice);
  console.log('[RAW UPDATE] Existing priceHistory length:', existingCard.priceHistory?.length || 0);
  console.log('[RAW UPDATE] Existing images:', existingCard.images?.length || 0);

  // Extract price, images, and history handling from the update data
  const { myPrice, priceHistory, images, ...otherData } = updateData;
  const dataToUpdate = { ...otherData };

  // Handle image updates and cleanup
  if (images !== undefined) {
    console.log('[RAW UPDATE] Image update detected');
    console.log('[RAW UPDATE] Old images:', existingCard.images?.length || 0);
    console.log('[RAW UPDATE] New images:', images?.length || 0);

    const oldImages = existingCard.images || [];
    const newImages = images || [];

    // Find images that were removed (in old but not in new)
    const removedImages = oldImages.filter((oldImg) => !newImages.includes(oldImg));

    if (removedImages.length > 0) {
      console.log('[RAW UPDATE] Images to delete:', removedImages);
      // Delete removed images from filesystem (async, don't wait)
      ImageManager.deleteImageFiles(removedImages).catch((error) => {
        console.error('[RAW UPDATE] Error during image cleanup:', error);
      });
    }

    dataToUpdate.images = newImages;
  }

  // Handle price and price history updates
  if (priceHistory && Array.isArray(priceHistory)) {
    console.log('[RAW UPDATE] Frontend sent priceHistory:', priceHistory.length, 'entries');
    // Frontend is managing price history - use their complete array
    dataToUpdate.priceHistory = priceHistory;

    // Set myPrice to the most recent price from history
    if (priceHistory.length > 0) {
      const latestEntry = priceHistory[priceHistory.length - 1];
      const latestPrice = latestEntry.price;
      
      console.log('[RAW UPDATE] Latest price history entry:', JSON.stringify(latestEntry, null, 2));
      console.log('[RAW UPDATE] Latest price value:', latestPrice, 'Type:', typeof latestPrice);

      // Let MongoDB handle the Decimal128 conversion by using the raw value
      dataToUpdate.myPrice = latestPrice;
      console.log('[RAW UPDATE] Set dataToUpdate.myPrice to:', latestPrice, 'Type:', typeof latestPrice);
    }
  } else if (myPrice !== undefined) {
    console.log('[RAW UPDATE] Only myPrice provided, adding to existing history');
    // Only myPrice provided - add to existing history
    dataToUpdate.myPrice = myPrice;
    dataToUpdate.$push = {
      priceHistory: {
        price: myPrice,
        dateUpdated: new Date(),
      },
    };
  }

  console.log('[RAW UPDATE] Final dataToUpdate:', JSON.stringify(dataToUpdate, null, 2));

  const updatedCard = await RawCard.findByIdAndUpdate(id, dataToUpdate, {
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
    throw new Error('Raw card not found');
  }

  console.log('[RAW UPDATE] Update successful, new price:', updatedCard.myPrice);
  console.log('[RAW UPDATE] New priceHistory length:', updatedCard.priceHistory?.length || 0);
  console.log('[RAW UPDATE] ===== UPDATE COMPLETED =====');

  return updatedCard;
};

const deleteRawCard = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }

  const deletedCard = await RawCard.findByIdAndDelete(id);

  if (!deletedCard) {
    throw new Error('Raw card not found');
  }

  return deletedCard;
};

module.exports = {
  validateCreateData,
  createRawCard,
  updateRawCard,
  deleteRawCard,
};
