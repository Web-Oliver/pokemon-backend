const Card = require('../models/Card');
const Set = require('../models/Set');
const mongoose = require('mongoose');
const Logger = require('../utils/Logger');
const ValidatorFactory = require('../utils/ValidatorFactory');

/**
 * Validates that the provided reference data matches exactly with the database
 * This ensures that users cannot manually modify reference data and must use
 * the autocomplete dropdown to select valid cards
 *
 * Reference data includes: cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded
 * User-specific data like condition, grade, myPrice, images should NOT be in reference data
 */
const validateReferenceData = async (referenceData) => {
  Logger.operationStart('REFERENCE_DATA_VALIDATOR', 'VALIDATE_REFERENCE_DATA', { 
    dataKeys: Object.keys(referenceData) 
  });

  const { cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded } = referenceData;

  try {
    // Validate required reference fields using ValidatorFactory
    ValidatorFactory.string(cardName, 'cardName', { required: true });
    ValidatorFactory.string(setName, 'setName', { required: true });

    // Validate optional fields if provided
    if (pokemonNumber !== undefined && pokemonNumber !== '') {
      ValidatorFactory.string(pokemonNumber, 'pokemonNumber');
    }
    if (variety !== undefined && variety !== '') {
      ValidatorFactory.string(variety, 'variety');
    }
    if (baseName !== undefined && baseName !== '') {
      ValidatorFactory.string(baseName, 'baseName');
    }
    if (year !== undefined) {
      ValidatorFactory.number(parseInt(year, 10), 'year', { integer: true, min: 1900, max: 2100 });
    }
    if (psaTotalGraded !== undefined) {
      ValidatorFactory.number(parseInt(psaTotalGraded, 10), 'psaTotalGraded', { integer: true, min: 0 });
    }

    // Validate that reference data doesn't contain user-specific fields
    const userSpecificFields = ['condition', 'grade', 'myPrice', 'images'];
    const invalidFields = Object.keys(referenceData).filter((field) => userSpecificFields.includes(field));

    if (invalidFields.length > 0) {
      const error = new Error(`Reference data should not contain user-specific fields: ${invalidFields.join(', ')}`);

      Logger.operationError('REFERENCE_DATA_VALIDATOR', 'VALIDATE_REFERENCE_DATA', error, { invalidFields });
      throw error;
    }

    Logger.service('ReferenceDataValidator', 'validateReferenceData', 
      'Basic validation passed', { cardName, setName });

    // First, find the set by name and year
    Logger.service('ReferenceDataValidator', 'validateReferenceData', 
      'Looking up set', { setName, year });
    
    const setQuery = { setName };

    if (year) {
      const yearValue = parseInt(year, 10);

      ValidatorFactory.number(yearValue, 'year', { integer: true, min: 1900, max: 2100 });
      setQuery.year = yearValue;
    }

    Logger.database('QUERY', 'Set', { operation: 'findOne', query: setQuery });
    let set = await Set.findOne(setQuery);

    if (!set) {
      Logger.service('ReferenceDataValidator', 'validateReferenceData', 
        'Set not found with exact query, trying without year', { setName });
      
      // Try without year constraint if set with year was not found
      Logger.database('QUERY', 'Set', { operation: 'findOne', query: { setName } });
      set = await Set.findOne({ setName });
      
      if (set) {
        Logger.service('ReferenceDataValidator', 'validateReferenceData', 
          'Found set without year constraint', { setId: set._id, setName: set.setName, year: set.year });
      } else {
        const error = new Error(`Set not found: ${setName}${year ? ` (${year})` : ''}`);

        Logger.operationError('REFERENCE_DATA_VALIDATOR', 'VALIDATE_REFERENCE_DATA', error, { setName, year });
        throw error;
      }
    }
    
    Logger.service('ReferenceDataValidator', 'validateReferenceData', 
      'Set found', { setId: set._id, setName: set.setName, year: set.year });

    // Then, find the card by name and set
    Logger.service('ReferenceDataValidator', 'validateReferenceData', 
      'Looking up card', { cardName, setId: set._id });
    
    const cardQuery = {
      cardName,
      setId: set._id,
    };

    // Add optional fields to query if provided with validation
    if (pokemonNumber !== undefined && pokemonNumber !== '') {
      ValidatorFactory.string(pokemonNumber, 'pokemonNumber');
      cardQuery.pokemonNumber = pokemonNumber;
    }
    if (variety !== undefined && variety !== '') {
      ValidatorFactory.string(variety, 'variety');
      cardQuery.variety = variety;
    }
    if (baseName !== undefined && baseName !== '') {
      ValidatorFactory.string(baseName, 'baseName');
      cardQuery.baseName = baseName;
    }

    Logger.database('QUERY', 'Card', { operation: 'findOne', query: cardQuery });
    const card = await Card.findOne(cardQuery);

    if (!card) {
      const error = new Error(
        `Card not found: ${cardName} in set ${setName}. This card may not exist in the reference database or the details don't match exactly.`,
      );

      Logger.operationError('REFERENCE_DATA_VALIDATOR', 'VALIDATE_REFERENCE_DATA', error, { 
        cardQuery, 
        setName 
      });
      throw error;
    }

    Logger.service('ReferenceDataValidator', 'validateReferenceData', 
      'Card found', { cardId: card._id, cardName: card.cardName });

    // Validate that ALL provided reference data matches exactly
    Logger.service('ReferenceDataValidator', 'validateReferenceData', 
      'Starting exact match validation', { cardId: card._id, setId: set._id });
    
    const validationErrors = [];

    // Use ValidatorFactory's string validation for exact matches
    try {
      if (card.cardName !== cardName) {
        validationErrors.push(`Card name mismatch: expected "${card.cardName}", got "${cardName}"`);
      }

      if (card.setId.toString() !== set._id.toString()) {
        validationErrors.push('Set ID mismatch');
      }

      if (pokemonNumber !== undefined && card.pokemonNumber !== pokemonNumber) {
        validationErrors.push(`Pokemon number mismatch: expected "${card.pokemonNumber}", got "${pokemonNumber}"`);
      }

      if (variety !== undefined && card.variety !== variety) {
        validationErrors.push(`Variety mismatch: expected "${card.variety}", got "${variety}"`);
      }

      if (baseName !== undefined && card.baseName !== baseName) {
        validationErrors.push(`Base name mismatch: expected "${card.baseName}", got "${baseName}"`);
      }

      if (year !== undefined && set.year !== parseInt(year, 10)) {
        validationErrors.push(`Year mismatch: expected ${set.year}, got ${year}`);
      }

      if (psaTotalGraded !== undefined && card.psaTotalGradedForCard !== parseInt(psaTotalGraded, 10)) {
        validationErrors.push(`PSA total graded mismatch: expected ${card.psaTotalGradedForCard}, got ${psaTotalGraded}`);
      }

      if (validationErrors.length > 0) {
        const error = new Error(`Reference data validation failed: ${validationErrors.join(', ')}`);

        Logger.operationError('REFERENCE_DATA_VALIDATOR', 'VALIDATE_REFERENCE_DATA', error, { 
          validationErrors,
          expected: { cardName: card.cardName, setName: set.setName },
          received: { cardName, setName }
        });
        throw error;
      }

      Logger.operationSuccess('REFERENCE_DATA_VALIDATOR', 'VALIDATE_REFERENCE_DATA', { 
        cardId: card._id,
        setId: set._id,
        cardName: card.cardName,
        setName: set.setName 
      });

      return {
        isValid: true,
        cardId: card._id,
        setId: set._id,
        validatedData: {
          cardName: card.cardName,
          setName: set.setName,
          pokemonNumber: card.pokemonNumber,
          variety: card.variety,
          baseName: card.baseName,
          year: set.year,
          psaTotalGraded: card.psaTotalGradedForCard,
        },
      };
    } catch (validationError) {
      Logger.operationError('REFERENCE_DATA_VALIDATOR', 'VALIDATE_REFERENCE_DATA', validationError, { 
        cardName, 
        setName 
      });
      throw validationError;
    }
  } catch (error) {
    Logger.operationError('REFERENCE_DATA_VALIDATOR', 'VALIDATE_REFERENCE_DATA', error, { 
      referenceData 
    });
    throw error;
  }
};

/**
 * Validates that the request contains both reference data and user-specific fields
 *
 * Reference data (comes from dropdown selection, read-only):
 * - cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded
 *
 * User-specific fields (user can modify):
 * - myPrice, images (both types)
 * - grade (PSA cards only)
 * - condition (Raw cards only)
 */
const validateUserSpecificFields = (data, itemType) => {
  Logger.operationStart('REFERENCE_DATA_VALIDATOR', 'VALIDATE_USER_SPECIFIC_FIELDS', { 
    itemType,
    dataKeys: Object.keys(data) 
  });

  try {
    // Validate itemType using ValidatorFactory
    ValidatorFactory.enum(itemType, ['psa', 'raw'], 'itemType', true);

    const referenceFields = ['cardName', 'setName', 'pokemonNumber', 'variety', 'baseName', 'year', 'psaTotalGraded'];
    const userSpecificFields = ['myPrice', 'images', 'dateAdded', 'sold', 'priceHistory', 'cardId', 'setId'];

    // Add type-specific user fields
    if (itemType === 'psa') {
      userSpecificFields.push('grade');
    } else if (itemType === 'raw') {
      userSpecificFields.push('condition');
    }

    Logger.service('ReferenceDataValidator', 'validateUserSpecificFields', 
      'Field definitions prepared', { 
        itemType,
        referenceFieldsCount: referenceFields.length,
        userSpecificFieldsCount: userSpecificFields.length 
      });

    // Validate specific fields if present
    if (data.myPrice !== undefined) {
      ValidatorFactory.price(data.myPrice, 'myPrice');
    }
    if (data.images !== undefined) {
      ValidatorFactory.imageArray(data.images, 'images');
    }
    if (data.cardId !== undefined) {
      ValidatorFactory.objectId(data.cardId, 'cardId');
    }
    if (data.setId !== undefined) {
      ValidatorFactory.objectId(data.setId, 'setId');
    }
    if (itemType === 'psa' && data.grade !== undefined) {
      ValidatorFactory.number(data.grade, 'grade', { integer: true, min: 1, max: 10 });
    }
    if (itemType === 'raw' && data.condition !== undefined) {
      const validConditions = ['mint', 'near_mint', 'excellent', 'good', 'light_played', 'played', 'poor'];

      ValidatorFactory.enum(data.condition, validConditions, 'condition', true);
    }

    // Check if any unexpected fields are present
    const allExpectedFields = [...referenceFields, ...userSpecificFields];
    const unexpectedFields = Object.keys(data).filter((field) => !allExpectedFields.includes(field));

    if (unexpectedFields.length > 0) {
      const error = new Error(`Unexpected fields in request: ${unexpectedFields.join(', ')}`);

      Logger.operationError('REFERENCE_DATA_VALIDATOR', 'VALIDATE_USER_SPECIFIC_FIELDS', error, { 
        unexpectedFields,
        expectedFields: allExpectedFields 
      });
      throw error;
    }

    Logger.operationSuccess('REFERENCE_DATA_VALIDATOR', 'VALIDATE_USER_SPECIFIC_FIELDS', { 
      itemType,
      validatedFieldsCount: Object.keys(data).length 
    });

    return true;
  } catch (error) {
    Logger.operationError('REFERENCE_DATA_VALIDATOR', 'VALIDATE_USER_SPECIFIC_FIELDS', error, { 
      data: Object.keys(data),
      itemType 
    });
    throw error;
  }
};

module.exports = {
  validateReferenceData,
  validateUserSpecificFields,
};
