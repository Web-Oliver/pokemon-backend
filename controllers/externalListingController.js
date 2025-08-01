const itemFetcher = require('../services/itemFetcher');
const facebookFormatter = require('../services/facebookPostFormatter');
const dbaFormatter = require('../services/dbaFormatter');
const mongoose = require('mongoose');
const { asyncHandler, ValidationError } = require('../middleware/errorHandler');

/**
 * Generate Facebook auction post text
 * POST /api/generate-facebook-post
 * Body: {
 *   items: [{ itemId, itemCategory }],
 *   topText: string,
 *   bottomText: string
 * }
 */
const generateFacebookPost = asyncHandler(async (req, res) => {
  const { items, topText, bottomText } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('Items array is required and must not be empty');
  }

  if (!topText || !bottomText) {
    throw new ValidationError('Both topText and bottomText are required');
  }

  // Validate and fetch all items
  const fetchedItems = [];

  // First validate the format synchronously
  for (const item of items) {
    if (!item.itemId || typeof item.itemId !== 'string' || !/^[a-f\d]{24}$/i.test(item.itemId)) {
      throw new ValidationError(`Invalid itemId format: ${item.itemId}`);
    }

    if (!['SealedProduct', 'PsaGradedCard', 'RawCard'].includes(item.itemCategory)) {
      throw new ValidationError(`Invalid itemCategory: ${item.itemCategory}`);
    }
  }

  // Then fetch items asynchronously
  const fetchPromises = items.map(async (item) => {
    const fetchedItem = await itemFetcher.fetchItemById(item.itemId, item.itemCategory);

    return {
      data: fetchedItem,
      category: item.itemCategory,
    };
  });

  const fetchResults = await Promise.all(fetchPromises);

  fetchedItems.push(
    ...fetchResults.map((result) => ({
      data: result.data,
      category: result.category,
    })),
  );

  // Group items by category
  const groupedItems = {
    sealedProducts: [],
    psaGradedCards: [],
    rawCards: [],
  };

  fetchedItems.forEach(({ data, category }) => {
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

  const facebookPost = facebookFormatter.buildFacebookPost(groupedItems, topText, bottomText);

  res.status(200).json({
    status: 'success',
    data: {
      facebookPost,
      itemCount: fetchedItems.length,
    },
  });
});

/**
 * Generate Facebook text file for collection items
 * POST /api/collection/facebook-text-file
 * Body: { itemIds: string[] }
 */
const getCollectionFacebookTextFile = asyncHandler(async (req, res) => {
  const { itemIds } = req.body;

  if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
    throw new ValidationError('itemIds array is required and must not be empty');
  }

  // Get all collection items (PSA, Raw, Sealed) from the provided IDs
  const PsaGradedCard = require('../models/PsaGradedCard');
  const RawCard = require('../models/RawCard');
  const SealedProduct = require('../models/SealedProduct');

  const fetchedItems = [];

  // Try to find each ID in all three collections
  for (const itemId of itemIds) {
    if (!/^[a-f\d]{24}$/i.test(itemId)) {
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

  // Group items by category
  const groupedItems = {
    sealedProducts: [],
    psaGradedCards: [],
    rawCards: [],
  };

  fetchedItems.forEach(({ data, category }) => {
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
        console.warn(`Unknown category: ${category}`);
    }
  });

  // Generate Facebook post with default texts
  const topText = 'Collection Items for Sale';
  const bottomText = 'Contact me for more details!';
  const facebookPost = facebookFormatter.buildFacebookPost(groupedItems, topText, bottomText);

  // Return as plain text for file download
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="facebook-post.txt"');
  res.send(facebookPost);
});

/**
 * Generate DBA listing title
 * POST /api/generate-dba-title
 * Body: { itemId, itemCategory }
 */
const generateDbaTitle = asyncHandler(async (req, res) => {
  const { itemId, itemCategory } = req.body;

  if (!itemId || !itemCategory) {
    throw new ValidationError('Both itemId and itemCategory are required');
  }

  const fetchedItem = await itemFetcher.fetchItemById(itemId, itemCategory);
  const dbaTitle = dbaFormatter.generateDbaTitle(fetchedItem, itemCategory);

  res.status(200).json({
    status: 'success',
    data: {
      dbaTitle,
    },
  });
});

module.exports = {
  generateFacebookPost,
  getCollectionFacebookTextFile,
  generateDbaTitle,
};
