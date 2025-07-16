const Card = require('../models/Card');
const Set = require('../models/Set');
const mongoose = require('mongoose');

/**
 * Validates that the provided reference data matches exactly with the database
 * This ensures that users cannot manually modify reference data and must use
 * the autocomplete dropdown to select valid cards
 *
 * Reference data includes: cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded
 * User-specific data like condition, grade, myPrice, images should NOT be in reference data
 */
const validateReferenceData = async (referenceData) => {
  console.log('=== REFERENCE DATA VALIDATION START ===');
  console.log('Reference data to validate:', JSON.stringify(referenceData, null, 2));

  const { cardName, setName, pokemonNumber, variety, baseName, year, psaTotalGraded } = referenceData;

  // Check if all required reference fields are provided
  if (!cardName || !setName) {
    throw new Error('cardName and setName are required for reference data validation');
  }

  // Validate that reference data doesn't contain user-specific fields
  const userSpecificFields = ['condition', 'grade', 'myPrice', 'images'];
  const invalidFields = Object.keys(referenceData).filter((field) => userSpecificFields.includes(field));

  if (invalidFields.length > 0) {
    throw new Error(`Reference data should not contain user-specific fields: ${invalidFields.join(', ')}`);
  }

  try {
    // First, find the set by name and year
    console.log('Looking up set:', setName, 'with year:', year);
    const setQuery = { setName };

    if (year) {
      setQuery.year = parseInt(year, 10);
    }

    console.log('Set query:', JSON.stringify(setQuery, null, 2));
    const set = await Set.findOne(setQuery);

    if (!set) {
      console.log('Set not found with exact query, trying without year...');
      // Try without year constraint if set with year was not found
      set = await Set.findOne({ setName });
      if (set) {
        console.log('Found set without year constraint:', set._id, set.setName, set.year);
        console.log('Using set:', set._id);
      } else {
        throw new Error(`Set not found: ${setName}${year ? ` (${year})` : ''}`);
      }
    }
    console.log('Set found:', set._id, set.setName, set.year);

    // Then, find the card by name and set
    console.log('Looking up card:', cardName, 'in set:', set._id);
    const cardQuery = {
      cardName,
      setId: set._id,
    };

    // Add optional fields to query if provided
    if (pokemonNumber !== undefined && pokemonNumber !== '') {
      cardQuery.pokemonNumber = pokemonNumber;
    }
    if (variety !== undefined && variety !== '') {
      cardQuery.variety = variety;
    }
    if (baseName !== undefined && baseName !== '') {
      cardQuery.baseName = baseName;
    }

    const card = await Card.findOne(cardQuery);

    if (!card) {
      console.log('Card not found with query:', JSON.stringify(cardQuery, null, 2));
      throw new Error(
        `Card not found: ${cardName} in set ${setName}. This card may not exist in the reference database or the details don't match exactly.`,
      );
    }

    console.log('Card found:', card._id);

    // Validate that ALL provided reference data matches exactly
    const validationErrors = [];

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
      throw new Error(`Reference data validation failed: ${validationErrors.join(', ')}`);
    }

    console.log('Reference data validation passed successfully');
    console.log('=== REFERENCE DATA VALIDATION END ===');

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
  } catch (error) {
    console.error('=== REFERENCE DATA VALIDATION ERROR ===');
    console.error('Error:', error.message);
    console.error('=== REFERENCE DATA VALIDATION ERROR END ===');
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
  console.log('=== USER SPECIFIC FIELDS VALIDATION START ===');
  console.log('Data to validate:', JSON.stringify(data, null, 2));
  console.log('Item type:', itemType);

  const referenceFields = ['cardName', 'setName', 'pokemonNumber', 'variety', 'baseName', 'year', 'psaTotalGraded'];

  const userSpecificFields = ['myPrice', 'images', 'dateAdded', 'sold', 'priceHistory', 'cardId', 'setId'];

  // Add type-specific user fields
  if (itemType === 'psa') {
    userSpecificFields.push('grade');
  } else if (itemType === 'raw') {
    userSpecificFields.push('condition');
  }

  // Check if any unexpected fields are present
  const allExpectedFields = [...referenceFields, ...userSpecificFields];
  const unexpectedFields = Object.keys(data).filter((field) => !allExpectedFields.includes(field));

  if (unexpectedFields.length > 0) {
    console.log('Unexpected fields found:', unexpectedFields);
    throw new Error(`Unexpected fields in request: ${unexpectedFields.join(', ')}`);
  }

  console.log('User specific fields validation passed');
  console.log('=== USER SPECIFIC FIELDS VALIDATION END ===');

  return true;
};

module.exports = {
  validateReferenceData,
  validateUserSpecificFields,
};
