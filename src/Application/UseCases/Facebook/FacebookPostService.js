import FacebookPostValidator from './facebook/FacebookPostValidator.js';
import FacebookItemFetcher from './facebook/FacebookItemFetcher.js';
import FacebookPostBuilder from './facebook/FacebookPostBuilder.js';
/**
 * Facebook Post Service - Main Coordinator
 * Single Responsibility: Orchestrate Facebook post generation workflow
 *
 * This service coordinates the entire Facebook post generation process
 * by delegating specific responsibilities to specialized services.
 */
class FacebookPostService {
  constructor() {
    this.validator = new FacebookPostValidator();
    this.itemFetcher = new FacebookItemFetcher(this.validator);
    this.postBuilder = new FacebookPostBuilder();
  }

  /**
   * Generate Facebook post from items with custom text
   * @param {Array} items - Array of {itemId, itemCategory} objects
   * @param {string} topText - Top text for the post
   * @param {string} bottomText - Bottom text for the post
   * @returns {Promise<Object>} Object containing facebookPost and itemCount
   */
  async generateFacebookPost(items, topText, bottomText) {
    // Validate input data
    this.validator.validateTexts(topText, bottomText);

    // Fetch all items
    const fetchedItems = await this.itemFetcher.fetchItemsWithCategory(items);

    // Build Facebook post
    const facebookPost = this.postBuilder.buildPost(fetchedItems, topText, bottomText);

    return {
      facebookPost,
      itemCount: fetchedItems.length,
    };
  }

  /**
   * Generate Facebook text file for collection items
   * @param {Array} itemIds - Array of item IDs
   * @returns {Promise<string>} Facebook post text content
   */
  async generateCollectionFacebookTextFile(itemIds) {
    // Fetch collection items (auto-detect categories)
    const fetchedItems = await this.itemFetcher.fetchCollectionItems(itemIds);

    // Build Facebook post with default texts
    return this.postBuilder.buildCollectionPost(fetchedItems);
  }
}

export default FacebookPostService;
