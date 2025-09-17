import facebookFormatter from '@/marketplace/facebook/facebookPostFormatter.js';

/**
 * Facebook Post Builder Service
 * Single Responsibility: Build and format Facebook posts from fetched items
 */
class FacebookPostBuilder {
    /**
     * Group fetched items by category
     * @param {Array} fetchedItems - Array of items with data and category
     * @returns {Object} Grouped items by category
     */
    groupItemsByCategory(fetchedItems) {
        const groupedItems = {
            sealedProducts: [],
            psaGradedCards: [],
            rawCards: []
        };

        fetchedItems.forEach(({data, category}) => {
            const formattedItem = facebookFormatter.formatItemForFacebook(data, category);

            switch (category) {
                case 'SealedProduct':
                    groupedItems.sealedProducts.push(formattedItem);
                    break;
                case 'PsaGradedCard':
                    groupedItems.psaGradedCards.push(formattedItem);
                    break;
                case 'RawCard':
                    groupedItems.rawCards.push(formattedItem);
                    break;
                default:
                    throw new Error(`Unknown category: ${category}`);
            }
        });

        return groupedItems;
    }

    /**
     * Build complete Facebook post
     * @param {Array} fetchedItems - Array of items with data and category
     * @param {string} topText - Top text for the post
     * @param {string} bottomText - Bottom text for the post
     * @returns {string} Complete Facebook post text
     */
    buildPost(fetchedItems, topText, bottomText) {
        const groupedItems = this.groupItemsByCategory(fetchedItems);

        return facebookFormatter.buildFacebookPost(groupedItems, topText, bottomText);
    }

    /**
     * Build Facebook post with default texts for collection items
     * @param {Array} fetchedItems - Array of items with data and category
     * @returns {string} Complete Facebook post text
     */
    buildCollectionPost(fetchedItems) {
        const topText = 'Collection Items for Sale';
        const bottomText = 'Contact me for more details!';

        return this.buildPost(fetchedItems, topText, bottomText);
    }
}

export default FacebookPostBuilder;
