const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const Fuse = require('fuse.js');
const { SearchUtility } = require('../services/searchService');

const getAllCardMarketRefProducts = asyncHandler(async (req, res) => {
  const { name, setName, category, page, limit, q, search, available } = req.query;
  const query = {};

  // Handle search query (support both 'q' and 'search' for compatibility)
  const searchQuery = q || search;
  if (searchQuery) {
    // Use advanced SearchUtility for better fuzzy matching
    const fuzzyPatterns = SearchUtility.createMongoRegexPatterns(searchQuery);
    const nameConditions = [
      { $text: { $search: searchQuery } }, // Text search
      { name: { $regex: searchQuery, $options: 'i' } }, // Basic regex for backward compatibility
      { setName: { $regex: searchQuery, $options: 'i' } } // Set name search
    ];
    
    // Add fuzzy pattern matches for better partial matching
    fuzzyPatterns.forEach(pattern => {
      nameConditions.push(
        { name: pattern },
        { setName: pattern }
      );
    });
    
    query.$or = nameConditions;
  }

  // Original filtering logic (maintain backward compatibility)
  if (name && !searchQuery) {
    // Only apply if no search query is provided to avoid conflicts
    const fuzzyPatterns = SearchUtility.createMongoRegexPatterns(name);
    const nameConditions = [
      { name: { $regex: name, $options: 'i' } } // Basic regex for backward compatibility
    ];
    
    // Add fuzzy pattern matches
    fuzzyPatterns.forEach(pattern => {
      nameConditions.push({ name: pattern });
    });
    
    query.$or = nameConditions;
  }
  if (setName && !searchQuery) {
    // Only apply if no search query is provided to avoid conflicts
    const fuzzyPatterns = SearchUtility.createMongoRegexPatterns(setName);
    const setNameConditions = [
      { setName: { $regex: setName, $options: 'i' } } // Basic regex for backward compatibility
    ];
    
    // Add fuzzy pattern matches
    fuzzyPatterns.forEach(pattern => {
      setNameConditions.push({ setName: pattern });
    });
    
    // If we already have an $or condition, combine them
    if (query.$or) {
      query.$and = [
        { $or: query.$or },
        { $or: setNameConditions }
      ];
      delete query.$or;
    } else {
      query.$or = setNameConditions;
    }
  }
  if (category) {
    query.category = category;
  }
  if (available !== undefined) {
    // Support filtering by availability (available > 0)
    if (available === 'true') {
      query.available = { $gt: 0 };
    }
  }

  // Pagination parameters
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 0; // 0 means no limit (backward compatibility)
  const skip = limitNum > 0 ? (pageNum - 1) * limitNum : 0;

  // Use aggregation pipeline for better scoring and fuzzy matching
  const pipeline = [];

  // Add match stage
  if (Object.keys(query).length > 0) {
    pipeline.push({ $match: query });
  }

  // Add scoring stage if we have a search query
  if (searchQuery || name || setName) {
    const originalQuery = searchQuery || name || setName;
    const normalizedQuery = SearchUtility.normalizeQuery(originalQuery);
    
    pipeline.push({
      $addFields: {
        textScore: { $ifNull: [{ $meta: 'textScore' }, 0] },
        fuzzyScore: {
          $add: [
            // Exact match bonuses
            {
              $cond: {
                if: { $eq: [{ $toLower: '$name' }, originalQuery.toLowerCase()] },
                then: 50,
                else: 0
              }
            },
            // Starts with bonuses
            {
              $cond: {
                if: { $eq: [{ $indexOfCP: [{ $toLower: '$name' }, originalQuery.toLowerCase()] }, 0] },
                then: 30,
                else: 0
              }
            },
            // Contains bonuses with normalized matching
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$name' }, regex: normalizedQuery, options: 'i' } },
                then: 20,
                else: 0
              }
            },
            // Set name bonuses
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$setName' }, regex: normalizedQuery, options: 'i' } },
                then: 15,
                else: 0
              }
            }
          ]
        }
      }
    });

    // Add combined scoring
    pipeline.push({
      $addFields: {
        combinedScore: {
          $add: [
            { $ifNull: ['$textScore', 0] },
            { $ifNull: ['$fuzzyScore', 0] },
            // Availability bonus
            {
              $cond: {
                if: { $gt: ['$available', 0] },
                then: { $multiply: ['$available', 2] },
                else: 0
              }
            }
          ]
        }
      }
    });

    // Sort by combined score
    pipeline.push({
      $sort: {
        combinedScore: -1,
        name: 1
      }
    });
  } else {
    // Default sorting when no search query
    pipeline.push({
      $sort: {
        name: 1
      }
    });
  }

  // If no pagination requested (no limit), return old format for backward compatibility
  if (limitNum === 0) {
    const products = await CardMarketReferenceProduct.aggregate(pipeline);
    return res.status(200).json(products);
  }

  // Pagination requested - get total count first
  const totalPipeline = [...pipeline];
  totalPipeline.push({ $count: 'total' });
  const totalResult = await CardMarketReferenceProduct.aggregate(totalPipeline);
  const totalProducts = totalResult[0]?.total || 0;

  // Add pagination to main pipeline
  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limitNum });

  const products = await CardMarketReferenceProduct.aggregate(pipeline);

  const totalPages = Math.ceil(totalProducts / limitNum);
  const hasNextPage = pageNum < totalPages;
  const hasPrevPage = pageNum > 1;

  // Return paginated response format
  res.status(200).json({
    products,
    total: totalProducts,
    currentPage: pageNum,
    totalPages,
    hasNextPage,
    hasPrevPage,
  });
});

const getCardMarketRefProductById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const product = await CardMarketReferenceProduct.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('CardMarket reference product not found');
  }

  res.status(200).json(product);
});


module.exports = {
  getAllCardMarketRefProducts,
  getCardMarketRefProductById,
};
