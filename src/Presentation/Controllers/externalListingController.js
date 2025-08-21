import itemFetcher from '@/Application/Services/Core/itemFetcher.js';
import facebookFormatter from '@/Application/UseCases/Facebook/facebookPostFormatter.js';
import dbaFormatter from '@/Application/Services/Data/dbaFormatter.js';
import FacebookPostService from '@/Application/UseCases/Facebook/FacebookPostService.js';
import mongoose from 'mongoose';
import { asyncHandler, ValidationError   } from '@/Infrastructure/Utilities/errorHandler.js';
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

  // Use FacebookPostService to handle the entire workflow
  const facebookPostService = new FacebookPostService();
  const result = await facebookPostService.generateFacebookPost(items, topText, bottomText);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Generate Facebook text file for collection items
 * POST /api/collection/facebook-text-file
 * Body: { itemIds: string[] }
 */
const getCollectionFacebookTextFile = asyncHandler(async (req, res) => {
  const { itemIds } = req.body;

  // Use FacebookPostService to handle the entire workflow
  const facebookPostService = new FacebookPostService();
  const facebookPost = await facebookPostService.generateCollectionFacebookTextFile(itemIds);

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

export {
  generateFacebookPost,
  getCollectionFacebookTextFile,
  generateDbaTitle
};
export default generateFacebookPost;;
