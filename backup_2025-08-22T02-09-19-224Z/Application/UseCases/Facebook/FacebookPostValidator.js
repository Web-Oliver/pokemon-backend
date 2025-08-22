import { ValidationError } from '@/Presentation/Middleware/errorHandler.js';

/**
 * Facebook Post Validator Service
 * Single Responsibility: Validate input data for Facebook post generation
 */
class FacebookPostValidator {
  /**
   * Validate items array for Facebook post generation
   * @param {Array} items - Array of items to validate
   * @throws {ValidationError} If validation fails
   */
  validateItems(items) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items array is required and must not be empty');
    }

    // Validate each item format synchronously
    for (const item of items) {
      if (!item.itemId || typeof item.itemId !== 'string' || !(/^[a-f\d]{24}$/i).test(item.itemId)) {
        throw new ValidationError(`Invalid itemId format: ${item.itemId}`);
      }

      if (!['SealedProduct', 'PsaGradedCard', 'RawCard'].includes(item.itemCategory)) {
        throw new ValidationError(`Invalid itemCategory: ${item.itemCategory}`);
      }
    }
  }

  /**
   * Validate text fields for Facebook post
   * @param {string} topText - Top text for the post
   * @param {string} bottomText - Bottom text for the post
   * @throws {ValidationError} If validation fails
   */
  validateTexts(topText, bottomText) {
    if (!topText || !bottomText) {
      throw new ValidationError('Both topText and bottomText are required');
    }
  }

  /**
   * Validate item IDs array for collection Facebook text file
   * @param {Array} itemIds - Array of item IDs to validate
   * @throws {ValidationError} If validation fails
   */
  validateItemIds(itemIds) {
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      throw new ValidationError('itemIds array is required and must not be empty');
    }
  }

  /**
   * Check if item ID has valid ObjectId format
   * @param {string} itemId - Item ID to validate
   * @returns {boolean} True if valid format, false otherwise
   */
  isValidItemIdFormat(itemId) {
    return (/^[a-f\d]{24}$/i).test(itemId);
  }
}

export default FacebookPostValidator;
