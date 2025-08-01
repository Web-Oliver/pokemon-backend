const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const searchService = require('../services/searchService');
const ValidationUtils = require('../utils/validationUtils');

/**
 * CardMarket Reference Products Controller
 */
const getAllCardMarketRefProducts = asyncHandler(async (req, res) => {
  const { name, setName, category, page, limit, q, search, available } = req.query;
  
  // Handle search query (support both 'q' and 'search' for compatibility)
  const searchQuery = q || search || name || setName;
  
  if (searchQuery) {
    // Build filters
    const filters = {};
    
    if (category) filters.category = category;
    if (available === 'true') filters.available = { $gt: 0 };
    
    const { pageNum: searchPageNum, limitNum: searchLimitNum } =
      ValidationUtils.validatePagination(page || 1, limit || 50, 100);
    const searchOptions = {
      limit: searchLimitNum,
      page: searchPageNum
    };
    
    const { results, total, page, totalPages } = await searchService.searchProducts(searchQuery, filters, searchOptions);
    
    return res.status(200).json({
      success: true,
      status: 'success',
      data: {
        products: results,
        total,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        count: results.length,
        limit: searchLimitNum,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        duration: '0ms',
        query: searchQuery,
        filters,
        pagination: {
          page: searchPageNum,
          limit: searchLimitNum,
          total: results.length,
          pages: Math.ceil(results.length / searchLimitNum)
        }
      }
    });
  }

  // Fallback to standard filtering if no search query
  const query = {};

  if (category) query.category = category;
  if (available === 'true') query.available = { $gt: 0 };

  const { pageNum, limitNum } = ValidationUtils.validatePagination(page || 1, limit || 20, 100);
  const skip = (pageNum - 1) * limitNum;

  const [products, totalProducts] = await Promise.all([
    CardMarketReferenceProduct.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ available: -1, price: 1, _id: 1 })
      .lean(),
    CardMarketReferenceProduct.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalProducts / limitNum);

  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      products,
      total: totalProducts,
      currentPage: pageNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      count: products.length,
      limit: limitNum
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      duration: '0ms',
      filters: query,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: products.length,
        pages: totalPages
      }
    }
  });
});

const getCardMarketRefProductById = asyncHandler(async (req, res) => {
  ValidationUtils.validateObjectId(req.params.id, 'Product ID');

  const product = await CardMarketReferenceProduct.findById(req.params.id);

  if (!product) {
    throw new NotFoundError('CardMarket reference product not found');
  }

  res.status(200).json({ 
    success: true, 
    status: 'success',
    data: product,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      duration: '0ms'
    }
  });
});

const getCardMarketRefProductSetNames = asyncHandler(async (req, res) => {
  const { q, search } = req.query;
  const searchQuery = q || search;

  if (searchQuery) {
    // Search products by set name and extract unique set names
    const searchResults = await searchService.searchProducts(searchQuery, {}, { limit: 100 });
    const products = Array.isArray(searchResults) ? searchResults : searchResults.results || [];
    const uniqueSetNames = [...new Set(products.map(p => p.setName))].sort();

    return res.status(200).json({
      success: true,
      status: 'success',
      data: uniqueSetNames,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        duration: '0ms',
        totalResults: uniqueSetNames.length,
        query: searchQuery
      },
    });
  }

  // Fallback to simple aggregation
  const setNames = await CardMarketReferenceProduct.distinct('setName');
  const sortedSetNames = setNames.sort();

  res.status(200).json({
    success: true,
    status: 'success',
    data: sortedSetNames,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      duration: '0ms',
      count: sortedSetNames.length
    },
  });
});

module.exports = {
  getAllCardMarketRefProducts,
  getCardMarketRefProductById,
  getCardMarketRefProductSetNames,
};