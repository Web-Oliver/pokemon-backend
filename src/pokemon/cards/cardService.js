import Card from '@/pokemon/cards/Card.js';
import Set from '@/pokemon/sets/Set.js';
import {ValidationError} from '@/system/errors/ErrorTypes.js';
import Logger from '@/system/logging/Logger.js';

/**
 * Shared Card Service
 * Consolidates duplicate card and set creation logic used across collection services
 */
class CardService {
    /**
     * Find or create a card with associated set
     * @param {Object} cardData - Card data object
     * @returns {Promise<Object>} - Created or found card
     */
    static async findOrCreateCard(cardData) {
        const startTime = Date.now();

        try {
            Logger.info('CardService', `Finding or creating card: ${cardData.cardName} from ${cardData.setName}`);

            // Step 1: Find or create the set
            const set = await this.findOrCreateSet(cardData.setName, cardData.year);

            // Step 2: Find existing card
            const existingCard = await Card.findOne({
                setId: set._id,
                cardName: cardData.cardName,
                cardNumber: cardData.cardNumber || 'N/A',
                variety: cardData.variety || ''
            });

            if (existingCard) {
                Logger.info('CardService', `Found existing card: ${existingCard._id}`);
                return existingCard;
            }

            // Step 3: Create new card
            const newCard = new Card({
                setId: set._id,
                cardName: cardData.cardName,
                cardNumber: cardData.cardNumber || 'N/A',
                variety: cardData.variety || '',
                uniquePokemonId: cardData.uniquePokemonId || Math.floor(Math.random() * 1000000),
                uniqueSetId: cardData.uniqueSetId || set.uniqueSetId || Math.floor(Math.random() * 1000000),
                grades: {
                    grade_1: 0, grade_2: 0, grade_3: 0, grade_4: 0, grade_5: 0,
                    grade_6: 0, grade_7: 0, grade_8: 0, grade_9: 0, grade_10: 0,
                    grade_total: 0
                }
            });

            const savedCard = await newCard.save();

            Logger.info('CardService', `Created new card: ${savedCard._id} in ${Date.now() - startTime}ms`);
            return savedCard;

        } catch (error) {
            Logger.error('CardService', `Error in findOrCreateCard: ${error.message}`, {
                cardData,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Find or create a set by name
     * @param {string} setName - Set name
     * @param {number} year - Set year (optional)
     * @returns {Promise<Object>} - Created or found set
     */
    static async findOrCreateSet(setName, year) {
        try {
            // Find existing set
            const existingSet = await Set.findOne({setName});

            if (existingSet) {
                return existingSet;
            }

            // Create new set
            const newSet = new Set({
                setName,
                year: year || new Date().getFullYear(),
                setUrl: `https://example.com/sets/${setName.toLowerCase().replace(/\s+/g, '-')}`,
                totalCardsInSet: 0,
                uniqueSetId: Date.now(), // Temporary unique ID for new sets
                total_grades: {
                    grade_1: 0, grade_2: 0, grade_3: 0, grade_4: 0, grade_5: 0,
                    grade_6: 0, grade_7: 0, grade_8: 0, grade_9: 0, grade_10: 0,
                    total_graded: 0
                }
            });

            const savedSet = await newSet.save();

            Logger.info('CardService', `Created new set: ${savedSet.setName}`);

            return savedSet;

        } catch (error) {
            Logger.error('CardService', `Error in findOrCreateSet: ${error.message}`, {setName, year});
            throw error;
        }
    }

    /**
     * Update item with price history tracking
     * @param {Object} model - Mongoose model
     * @param {string} id - Item ID
     * @param {Object} updateData - Update data
     * @param {string} entityType - Entity type for logging
     * @returns {Promise<Object>} - Updated item
     */
    static async updateWithPriceHistory(model, id, updateData, entityType) {
        const startTime = Date.now();

        try {
            const existingItem = await model.findById(id);

            if (!existingItem) {
                throw new ValidationError(`${entityType} not found`);
            }

            // Handle price history
            if (updateData.myPrice && parseFloat(updateData.myPrice) !== parseFloat(existingItem.myPrice)) {
                const priceHistoryEntry = {
                    price: existingItem.myPrice,
                    date: new Date(),
                    source: 'manual_update',
                    notes: 'Previous price before update'
                };

                updateData.priceHistory = existingItem.priceHistory || [];
                updateData.priceHistory.push(priceHistoryEntry);
            }

            // Handle image cleanup
            if (updateData.images && existingItem.images) {
                const imagesToDelete = existingItem.images.filter(img => !updateData.images.includes(img));

                if (imagesToDelete.length > 0) {
                    Logger.info('CardService', `Images to cleanup: ${imagesToDelete.join(', ')}`);
                    // Implement image cleanup logic here if needed
                }
            }

            const updatedItem = await model.findByIdAndUpdate(id, updateData, {new: true});

            Logger.info('CardService', `Updated ${entityType}: ${id} in ${Date.now() - startTime}ms`);
            return updatedItem;

        } catch (error) {
            Logger.error('CardService', `Error updating ${entityType}: ${error.message}`, {
                id,
                entityType,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    /**
     * Generic validation for collection items
     * @param {Object} data - Data to validate
     * @param {Object} requiredFields - Required fields configuration
     * @throws {ValidationError} - If validation fails
     */
    static validateCollectionItemData(data, requiredFields) {
        const errors = [];

        // Check required fields
        Object.entries(requiredFields).forEach(([field, config]) => {
            if (!data[field]) {
                errors.push(`${field} is required`);
            } else if (config.type && typeof data[field] !== config.type) {
                errors.push(`${field} must be of type ${config.type}`);
            }
        });

        // Validate price
        if (data.myPrice !== undefined) {
            const price = parseFloat(data.myPrice);

            if (isNaN(price) || price < 0) {
                errors.push('myPrice must be a valid positive number');
            }
        }

        // Validate images array
        if (data.images && !Array.isArray(data.images)) {
            errors.push('images must be an array');
        }

        if (errors.length > 0) {
            throw new ValidationError(`Validation failed: ${errors.join(', ')}`);
        }
    }
}

export default CardService;
