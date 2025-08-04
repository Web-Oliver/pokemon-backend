/**
 * Field Mapping Utilities
 * 
 * Utilities for mapping between old and new field names during migration.
 * Handles grade field transformations and provides reverse mapping for backward compatibility.
 */

/**
 * Mapping from old Set field names to new field names
 */
const SET_FIELD_MAPPING = {
  // Keep existing fields as-is for backward compatibility
  setName: 'setName',
  year: 'year',
  setUrl: 'setUrl',
  totalCardsInSet: 'totalCardsInSet',
  totalPsaPopulation: 'total_grades.total_graded',
  
  // New migration fields (no mapping needed for these)
  unique_set_id: 'unique_set_id',
  total_grades: 'total_grades'
};

/**
 * Mapping from old Card field names to new field names
 */
const CARD_FIELD_MAPPING = {
  // Keep existing fields as-is for backward compatibility
  setId: 'setId',
  cardName: 'cardName',
  variety: 'variety',
  
  // Field updates for new schema
  pokemonNumber: 'cardNumber', // Old pokemonNumber -> new cardNumber
  baseName: 'cardName', // Old baseName merged into cardName
  
  // Grade field mappings (old -> new)
  'psaGrades.psa_1': 'grades.grade_1',
  'psaGrades.psa_2': 'grades.grade_2',
  'psaGrades.psa_3': 'grades.grade_3',
  'psaGrades.psa_4': 'grades.grade_4',
  'psaGrades.psa_5': 'grades.grade_5',
  'psaGrades.psa_6': 'grades.grade_6',
  'psaGrades.psa_7': 'grades.grade_7',
  'psaGrades.psa_8': 'grades.grade_8',
  'psaGrades.psa_9': 'grades.grade_9',
  'psaGrades.psa_10': 'grades.grade_10',
  'psaTotalGradedForCard': 'grades.grade_total',
  
  // New migration fields
  unique_pokemon_id: 'unique_pokemon_id',
  card_number: 'card_number',
  grades: 'grades'
};

/**
 * Reverse mapping from new field names to old field names
 */
const REVERSE_SET_FIELD_MAPPING = Object.entries(SET_FIELD_MAPPING)
  .reduce((acc, [oldField, newField]) => {
    acc[newField] = oldField;
    return acc;
  }, {});

const REVERSE_CARD_FIELD_MAPPING = Object.entries(CARD_FIELD_MAPPING)
  .reduce((acc, [oldField, newField]) => {
    acc[newField] = oldField;
    return acc;
  }, {});

/**
 * Map old set data to new field structure
 * @param {Object} oldSetData - Set data with old field names
 * @returns {Object} Set data with new field names
 */
function mapOldSetToNew(oldSetData) {
  if (!oldSetData || typeof oldSetData !== 'object') {
    throw new Error('Invalid set data provided');
  }

  const newSetData = {};
  
  // Map existing fields
  Object.entries(oldSetData).forEach(([oldField, value]) => {
    const newField = SET_FIELD_MAPPING[oldField];
    if (newField) {
      newSetData[newField] = value;
    } else {
      // Keep unmapped fields as-is (for flexibility)
      newSetData[oldField] = value;
    }
  });

  return newSetData;
}

/**
 * Map old card data to new field structure
 * @param {Object} oldCardData - Card data with old field names
 * @returns {Object} Card data with new field names
 */
function mapOldCardToNew(oldCardData) {
  if (!oldCardData || typeof oldCardData !== 'object') {
    throw new Error('Invalid card data provided');
  }

  const newCardData = {};
  
  // Map basic fields
  Object.entries(oldCardData).forEach(([oldField, value]) => {
    if (oldField === 'psaGrades' && value && typeof value === 'object') {
      // Transform psaGrades object to grades object
      newCardData.grades = {
        grade_1: value.psa_1 || 0,
        grade_2: value.psa_2 || 0,
        grade_3: value.psa_3 || 0,
        grade_4: value.psa_4 || 0,
        grade_5: value.psa_5 || 0,
        grade_6: value.psa_6 || 0,
        grade_7: value.psa_7 || 0,
        grade_8: value.psa_8 || 0,
        grade_9: value.psa_9 || 0,
        grade_10: value.psa_10 || 0,
        grade_total: oldCardData.psaTotalGradedForCard || 0
      };
    } else if (oldField === 'psaTotalGradedForCard') {
      // Skip this field as it's handled in psaGrades transformation
      return;
    } else if (CARD_FIELD_MAPPING[oldField]) {
      newCardData[CARD_FIELD_MAPPING[oldField]] = value;
    } else {
      // Keep unmapped fields as-is (for flexibility)
      newCardData[oldField] = value;
    }
  });

  return newCardData;
}

/**
 * Map new set data to old field structure (for backward compatibility)
 * @param {Object} newSetData - Set data with new field names
 * @returns {Object} Set data with old field names
 */
function mapNewSetToOld(newSetData) {
  if (!newSetData || typeof newSetData !== 'object') {
    throw new Error('Invalid set data provided');
  }

  const oldSetData = {};
  
  Object.entries(newSetData).forEach(([newField, value]) => {
    const oldField = REVERSE_SET_FIELD_MAPPING[newField];
    if (oldField && oldField !== newField) {
      oldSetData[oldField] = value;
    } else {
      // Keep unmapped fields as-is
      oldSetData[newField] = value;
    }
  });

  return oldSetData;
}

/**
 * Map new card data to old field structure (for backward compatibility)
 * @param {Object} newCardData - Card data with new field names
 * @returns {Object} Card data with old field names
 */
function mapNewCardToOld(newCardData) {
  if (!newCardData || typeof newCardData !== 'object') {
    throw new Error('Invalid card data provided');
  }

  const oldCardData = {};
  
  Object.entries(newCardData).forEach(([newField, value]) => {
    if (newField === 'grades' && value && typeof value === 'object') {
      // Transform grades object back to psaGrades object
      oldCardData.psaGrades = {
        psa_1: value.grade_1 || 0,
        psa_2: value.grade_2 || 0,
        psa_3: value.grade_3 || 0,
        psa_4: value.grade_4 || 0,
        psa_5: value.grade_5 || 0,
        psa_6: value.grade_6 || 0,
        psa_7: value.grade_7 || 0,
        psa_8: value.grade_8 || 0,
        psa_9: value.grade_9 || 0,
        psa_10: value.grade_10 || 0
      };
      oldCardData.psaTotalGradedForCard = value.grade_total || 0;
    } else if (REVERSE_CARD_FIELD_MAPPING[newField]) {
      const oldField = REVERSE_CARD_FIELD_MAPPING[newField];
      if (oldField !== newField) {
        oldCardData[oldField] = value;
      } else {
        oldCardData[newField] = value;
      }
    } else {
      // Keep unmapped fields as-is
      oldCardData[newField] = value;
    }
  });

  return oldCardData;
}

/**
 * Transform grade field names from old format to new format
 * @param {Object} gradeData - Grade data object
 * @param {string} direction - 'toNew' or 'toOld'
 * @returns {Object} Transformed grade data
 */
function transformGradeFields(gradeData, direction = 'toNew') {
  if (!gradeData || typeof gradeData !== 'object') {
    return {};
  }

  if (direction === 'toNew') {
    // Transform psa_X to grade_X
    const transformed = {};
    Object.entries(gradeData).forEach(([key, value]) => {
      if (key.startsWith('psa_')) {
        const gradeNumber = key.replace('psa_', '');
        transformed[`grade_${gradeNumber}`] = value;
      } else {
        transformed[key] = value;
      }
    });
    return transformed;
  } else if (direction === 'toOld') {
    // Transform grade_X to psa_X
    const transformed = {};
    Object.entries(gradeData).forEach(([key, value]) => {
      if (key.startsWith('grade_') && key !== 'grade_total') {
        const gradeNumber = key.replace('grade_', '');
        transformed[`psa_${gradeNumber}`] = value;
      } else if (key === 'grade_total') {
        // Don't map grade_total as it's handled separately
        return;
      } else {
        transformed[key] = value;
      }
    });
    return transformed;
  }

  return gradeData;
}

/**
 * Get field mapping for a specific entity type
 * @param {string} entityType - 'set' or 'card'
 * @param {string} direction - 'forward' (old->new) or 'reverse' (new->old)
 * @returns {Object} Field mapping object
 */
function getFieldMapping(entityType, direction = 'forward') {
  const entityTypeLower = entityType.toLowerCase();
  
  if (entityTypeLower === 'set') {
    return direction === 'forward' ? SET_FIELD_MAPPING : REVERSE_SET_FIELD_MAPPING;
  } else if (entityTypeLower === 'card') {
    return direction === 'forward' ? CARD_FIELD_MAPPING : REVERSE_CARD_FIELD_MAPPING;
  }
  
  throw new Error(`Unsupported entity type: ${entityType}`);
}

module.exports = {
  // Field mappings
  SET_FIELD_MAPPING,
  CARD_FIELD_MAPPING,
  REVERSE_SET_FIELD_MAPPING,
  REVERSE_CARD_FIELD_MAPPING,
  
  // Transformation functions
  mapOldSetToNew,
  mapOldCardToNew,
  mapNewSetToOld,
  mapNewCardToOld,
  transformGradeFields,
  getFieldMapping
};