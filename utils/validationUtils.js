/**
 * Validation Utilities
 * 
 * Essential validation functions used by controllers.
 * Recreated to provide only the functions actually being used.
 */

const mongoose = require('mongoose');
const { ValidationError } = require('../middleware/errorHandler');

/**
 * Validate pagination parameters
 */
function validatePagination(page = 1, limit = 50, maxLimit = 100) {
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ValidationError('Page must be a positive integer');
  }

  if (isNaN(limitNum) || limitNum < 1) {
    throw new ValidationError('Limit must be a positive integer');
  }

  if (limitNum > maxLimit) {
    throw new ValidationError(`Limit cannot exceed ${maxLimit}`);
  }

  return { pageNum, limitNum };
}

/**
 * Validate year values
 */
function validateYear(year) {
  const yearNum = parseInt(year, 10);
  const currentYear = new Date().getFullYear();

  if (isNaN(yearNum)) {
    throw new ValidationError('Year must be a valid number');
  }

  if (yearNum < 1900 || yearNum > currentYear + 10) {
    throw new ValidationError(`Year must be between 1900 and ${currentYear + 10}`);
  }

  return yearNum;
}

/**
 * Validate MongoDB ObjectId
 */
function validateObjectId(id, fieldName = 'ID') {
  if (!id) {
    throw new ValidationError(`${fieldName} is required`);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError(`${fieldName} must be a valid ObjectId`);
  }
}

/**
 * Validate unique_set_id for new migration data
 */
function validateUniqueSetId(uniqueSetId) {
  if (uniqueSetId === null || uniqueSetId === undefined) {
    throw new ValidationError('unique_set_id is required');
  }

  const id = parseInt(uniqueSetId, 10);
  
  if (isNaN(id)) {
    throw new ValidationError('unique_set_id must be a valid number');
  }

  if (id <= 0) {
    throw new ValidationError('unique_set_id must be a positive number');
  }

  return id;
}

/**
 * Validate unique_pokemon_id for new migration data
 */
function validateUniquePokemonId(uniquePokemonId) {
  if (uniquePokemonId === null || uniquePokemonId === undefined) {
    throw new ValidationError('unique_pokemon_id is required');
  }

  const id = parseInt(uniquePokemonId, 10);
  
  if (isNaN(id)) {
    throw new ValidationError('unique_pokemon_id must be a valid number');
  }

  if (id <= 0) {
    throw new ValidationError('unique_pokemon_id must be a positive number');
  }

  return id;
}

/**
 * Validate total_grades structure for sets
 */
function validateTotalGrades(totalGrades) {
  if (!totalGrades || typeof totalGrades !== 'object') {
    throw new ValidationError('total_grades must be an object');
  }

  const requiredGrades = ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 
                         'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'total_graded'];
  
  // Validate all required grade fields exist and are numbers
  for (const grade of requiredGrades) {
    if (totalGrades[grade] === undefined || totalGrades[grade] === null) {
      throw new ValidationError(`total_grades.${grade} is required`);
    }
    
    const gradeValue = parseInt(totalGrades[grade], 10);
    if (isNaN(gradeValue) || gradeValue < 0) {
      throw new ValidationError(`total_grades.${grade} must be a non-negative number`);
    }
  }

  // Validate that total_graded equals sum of all individual grades
  const gradeSum = (totalGrades.grade_1 || 0) +
                   (totalGrades.grade_2 || 0) +
                   (totalGrades.grade_3 || 0) +
                   (totalGrades.grade_4 || 0) +
                   (totalGrades.grade_5 || 0) +
                   (totalGrades.grade_6 || 0) +
                   (totalGrades.grade_7 || 0) +
                   (totalGrades.grade_8 || 0) +
                   (totalGrades.grade_9 || 0) +
                   (totalGrades.grade_10 || 0);

  if (totalGrades.total_graded !== gradeSum) {
    throw new ValidationError('total_grades.total_graded must equal sum of all individual grade levels');
  }
}

/**
 * Validate grades structure for cards
 */
function validateGrades(grades) {
  if (!grades || typeof grades !== 'object') {
    throw new ValidationError('grades must be an object');
  }

  const requiredGrades = ['grade_1', 'grade_2', 'grade_3', 'grade_4', 'grade_5', 
                         'grade_6', 'grade_7', 'grade_8', 'grade_9', 'grade_10', 'grade_total'];
  
  // Validate all required grade fields exist and are numbers
  for (const grade of requiredGrades) {
    if (grades[grade] === undefined || grades[grade] === null) {
      throw new ValidationError(`grades.${grade} is required`);
    }
    
    const gradeValue = parseInt(grades[grade], 10);
    if (isNaN(gradeValue) || gradeValue < 0) {
      throw new ValidationError(`grades.${grade} must be a non-negative number`);
    }
  }

  // Validate that grade_total equals sum of all individual grades
  const gradeSum = (grades.grade_1 || 0) +
                   (grades.grade_2 || 0) +
                   (grades.grade_3 || 0) +
                   (grades.grade_4 || 0) +
                   (grades.grade_5 || 0) +
                   (grades.grade_6 || 0) +
                   (grades.grade_7 || 0) +
                   (grades.grade_8 || 0) +
                   (grades.grade_9 || 0) +
                   (grades.grade_10 || 0);

  if (grades.grade_total !== gradeSum) {
    throw new ValidationError('grades.grade_total must equal sum of all individual grade levels');
  }
}

module.exports = {
  validatePagination,
  validateYear,
  validateObjectId,
  validateUniqueSetId,
  validateUniquePokemonId,
  validateTotalGrades,
  validateGrades
};