import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import RawCard from '@/collection/items/RawCard.js';
import SealedProduct from '@/collection/items/SealedProduct.js';
import { fetchSingleItem } from '@/collection/items/ItemBatchFetcher.js';
import { ValidationError } from '@/system/errors/ErrorTypes.js';

/**
 * Facebook Item Fetcher Service
 * Single Responsibility: Fetch and prepare items for Facebook post generation
 */
class FacebookItemFetcher {
    constructor(validator) {
        this.validator = validator;
    }

    /**
     * Fetch items by ID and category for Facebook post
     * @param {Array} items - Array of {itemId, itemCategory} objects
     * @returns {Promise<Array>} Array of fetched items with data and category
     */
    async fetchItemsWithCategory(items) {
        // Validate items first
        this.validator.validateItems(items);

        const fetchPromises = items.map(async (item) => {
            // Map old itemCategory format to new itemType format
            const itemTypeMap = {
                'SealedProduct': 'sealed',
                'PsaGradedCard': 'psa',
                'RawCard': 'raw'
            };
            const itemType = itemTypeMap[item.itemCategory];
            if (!itemType) {
                throw new ValidationError(`Invalid itemCategory: ${item.itemCategory}`);
            }

            const fetchedItem = await fetchSingleItem(item.itemId, itemType);

            return {
                data: fetchedItem,
                category: item.itemCategory
            };
        });

        const fetchResults = await Promise.all(fetchPromises);

        return fetchResults.map((result) => ({
            data: result.data,
            category: result.category
        }));
    }

    /**
     * Fetch collection items by IDs (auto-detect category)
     * @param {Array} itemIds - Array of item IDs
     * @returns {Promise<Array>} Array of fetched items with data and category
     */
    async fetchCollectionItems(itemIds) {
        // Validate item IDs first
        this.validator.validateItemIds(itemIds);

        const fetchedItems = [];

        // Try to find each ID in all three collections
        for (const itemId of itemIds) {
            if (!this.validator.isValidItemIdFormat(itemId)) {
                console.warn(`Invalid itemId format: ${itemId}`);
                continue;
            }

            try {
                // Try PSA cards first
                let item = await PsaGradedCard.findById(itemId).populate({
                    path: 'cardId',
                    populate: { path: 'setId', model: 'Set' }
                });

                if (item) {
                    fetchedItems.push({ data: item, category: 'PsaGradedCard' });
                    continue;
                }

                // Try Raw cards
                item = await RawCard.findById(itemId).populate({
                    path: 'cardId',
                    populate: { path: 'setId', model: 'Set' }
                });

                if (item) {
                    fetchedItems.push({ data: item, category: 'RawCard' });
                    continue;
                }

                // Try Sealed products
                item = await SealedProduct.findById(itemId);

                if (item) {
                    fetchedItems.push({ data: item, category: 'SealedProduct' });
                    continue;
                }

                console.warn(`Item not found in any collection: ${itemId}`);
            } catch (error) {
                console.error(`Error fetching item ${itemId}:`, error);
            }
        }

        if (fetchedItems.length === 0) {
            throw new ValidationError('No valid items found for the provided IDs');
        }

        return fetchedItems;
    }
}

export default FacebookItemFetcher;
