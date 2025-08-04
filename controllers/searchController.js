const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const searchService = require('../services/searchService');

/**
 * Search Controller
 * 
 * Replaces UnifiedSearchController with practical search functionality.
 * 
 * Before: 681 lines in SearchFactory + 687 lines in CardSearchStrategy + 595 lines in ProductSearchStrategy + 680 lines in SetSearchStrategy + controller
 * After: ~100 lines total
 */

/**
 * Unified search across multiple types
 */
const search = asyncHandler(async (req, res) => {
  const { query, types, limit, page, sort, filters } = req.query;

  // Validate query
  if (!query || typeof query !== 'string') {
    throw new ValidationError('Query parameter is required and must be a string');
  }

  // Parse types (default to all if not specified)
  const searchTypes = types ? types.split(',').map(t => t.trim()) : ['cards', 'products', 'sets', 'setProducts'];

  // Parse options
  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined,
    filters: filters ? JSON.parse(filters) : {}
  };

  const results = await searchService.unifiedSearch(query, searchTypes, options);

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query,
      types: searchTypes,
      totalTypes: Object.keys(results).length
    }
  });
});

/**
 * Search suggestions across multiple types
 */
const suggest = asyncHandler(async (req, res) => {
  const { query, types, limit } = req.query;

  if (!query || typeof query !== 'string') {
    throw new ValidationError('Query parameter is required and must be a string');
  }

  const searchTypes = types ? types.split(',').map(t => t.trim()) : ['cards'];
  const suggestionLimit = limit ? parseInt(limit, 10) : 5;

  const results = {};

  // Get suggestions for each type
  for (const type of searchTypes) {
    results[type] = await searchService.getSuggestions(query, type, { limit: suggestionLimit });
  }

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query,
      types: searchTypes
    }
  });
});

/**
 * Search cards
 */
const searchCards = asyncHandler(async (req, res) => {
  const { query, setId, setName, year, cardNumber, variety, limit, page, sort } = req.query;

  let searchQuery = query;
  const hasFilters = setId || setName || year || cardNumber || variety;
  
  if (!query || typeof query !== 'string' || query.trim() === '') {
    if (!hasFilters) {
      throw new ValidationError('Query parameter is required when no filters are provided');
    }
    searchQuery = '*';
  }

  // Build filters
  const filters = {};

  if (setId) filters.setId = setId;
  if (cardNumber) filters.cardNumber = cardNumber;
  if (variety) filters.variety = new RegExp(variety, 'i');

  // Add set name filter by looking up set ID
  if (setName || year) {
    const Set = require('../models/Set');
    const setQuery = {};

    if (setName) setQuery.setName = new RegExp(setName, 'i');
    if (year) setQuery.year = parseInt(year, 10);
    
    const sets = await Set.find(setQuery, '_id');

    if (sets.length > 0) {
      filters.setId = { $in: sets.map(s => s._id) };
    } else {
        // Parse options first before using
      const options = {
        limit: limit ? parseInt(limit, 10) : 20,
        page: page ? parseInt(page, 10) : 1,
        sort: sort ? JSON.parse(sort) : undefined
      };

      // No matching sets found
      return res.status(200).json({
        success: true,
        data: {
          cards: [],
          total: 0,
          currentPage: options.page,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
          count: 0,
          limit: options.limit,
        },
        meta: {
          query,
          filters: { setName, year },
          totalResults: 0,
          pagination: {
            page: options.page,
            limit: options.limit,
            total: 0,
            pages: 0
          }
        }
      });
    }
  }

  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  const results = await searchService.searchCards(searchQuery, filters, options);

  res.status(200).json({
    success: true,
    data: {
      cards: results,
      total: results.length,
      currentPage: options.page,
      totalPages: Math.ceil(results.length / options.limit),
      hasNextPage: options.page < Math.ceil(results.length / options.limit),
      hasPrevPage: options.page > 1,
      count: results.length,
      limit: options.limit
    },
    meta: {
      query,
      filters,
      totalResults: results.length,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: results.length,
        pages: Math.ceil(results.length / options.limit)
      }
    }
  });
});

/**
 * Search products - HIERARCHICAL SEARCH IMPLEMENTATION
 * Supports the frontend's hierarchical search requirements:
 * 1. Set selected first -> Show only products from that set (uses '*' query) 
 * 2. Product selected first -> Return product with set info
 * 3. Auto-trigger when set selected and product field focused
 */
const searchProducts = asyncHandler(async (req, res) => {
  const { query, category, setName, minPrice, maxPrice, availableOnly, limit, page, sort } = req.query;

  let searchQuery = query;
  const hasFilters = category || setName || minPrice || maxPrice || availableOnly;
  
  // HIERARCHICAL SEARCH: Allow empty query when filters exist (set selected first)
  if (!query || typeof query !== 'string' || query.trim() === '') {
    if (!hasFilters) {
      throw new ValidationError('Query parameter is required when no filters are provided');
    }
    // Use '*' to show all products when filtering by set/category
    searchQuery = '*';
    console.log('[HIERARCHICAL] Using wildcard query with filters:', { setName, category });
  }

  // Parse options first (needed for early returns)
  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  // Build filters for hierarchical search (SetProduct → Product)
  const filters = {};
  if (category) filters.category = category;
  
  // Handle setName by looking up SetProduct and using its ID
  if (setName) {
    const SetProduct = require('../models/SetProduct');
    const setProduct = await SetProduct.findOne({ 
      setProductName: new RegExp(`^${setName}$`, 'i') 
    });
    if (setProduct) {
      filters.setProductId = setProduct._id;
    } else {
      // No matching set found - return empty results
      return res.status(200).json({
        success: true,
        data: {
          products: [],
          total: 0,
          currentPage: options.page,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
          count: 0,
          limit: options.limit
        },
        meta: {
          query: searchQuery,
          filters: { setName },
          totalResults: 0,
          message: 'No products found for the specified set'
        }
      });
    }
  }
  
  if (minPrice || maxPrice) {
    filters.price = {};
    if (minPrice) filters.price.$gte = parseFloat(minPrice);
    if (maxPrice) filters.price.$lte = parseFloat(maxPrice);
  }
  if (availableOnly === 'true') filters.available = { $gt: 0 };

  console.log('[HIERARCHICAL SEARCH] Products:', { query: searchQuery, filters, options });

  // Use searchService for all searches (supports both FlexSearch and MongoDB)
  const results = await searchService.searchProducts(searchQuery, filters, options);

  res.status(200).json({
    success: true,
    data: {
      products: results.results || results, // Handle both paginated and simple array responses
      total: results.total || results.length,
      currentPage: results.page || options.page,
      totalPages: results.totalPages || Math.ceil((results.total || results.length) / options.limit),
      hasNextPage: (results.page || options.page) < (results.totalPages || Math.ceil((results.total || results.length) / options.limit)),
      hasPrevPage: (results.page || options.page) > 1,
      count: results.count || results.length,
      limit: options.limit
    },
    meta: {
      query: searchQuery,
      filters,
      totalResults: results.total || results.length,
      pagination: {
        page: results.page || options.page,
        limit: options.limit,
        total: results.total || results.length,
        pages: results.totalPages || Math.ceil((results.total || results.length) / options.limit)
      }
    }
  });
});

/**
 * Search sets - HIERARCHICAL SEARCH IMPLEMENTATION
 * Supports the frontend's hierarchical search requirements:
 * 1. Set search for card hierarchical filtering
 * 2. Auto-trigger when showing all sets (uses '*' query)
 * 3. Wildcard support for empty queries with filters
 */
const searchSets = asyncHandler(async (req, res) => {
  const { query, year, minYear, maxYear, minPsaPopulation, minCardCount, limit, page, sort } = req.query;

  let searchQuery = query;
  const hasFilters = year || minYear || maxYear || minPsaPopulation || minCardCount;
  
  // HIERARCHICAL SEARCH: Allow empty query when filters exist (auto-trigger support)
  if (!query || typeof query !== 'string' || query.trim() === '') {
    if (!hasFilters) {
      throw new ValidationError('Query parameter is required when no filters are provided');
    }
    // Use '*' to show all sets when filtering
    searchQuery = '*';
    console.log('[HIERARCHICAL] Using wildcard query with filters for sets:', { year, minYear, maxYear });
  }

  // Build filters
  const filters = {};

  if (year) filters.year = parseInt(year, 10);
  if (minYear || maxYear) {
    filters.year = {};
    if (minYear) filters.year.$gte = parseInt(minYear, 10);
    if (maxYear) filters.year.$lte = parseInt(maxYear, 10);
  }
  if (minPsaPopulation) filters['total_grades.total_graded'] = { $gte: parseInt(minPsaPopulation, 10) };
  if (minCardCount) filters.totalCardsInSet = { $gte: parseInt(minCardCount, 10) };

  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  const results = await searchService.searchSets(query, filters, options);

  res.status(200).json({
    success: true,
    data: {
      sets: results,
      total: results.length,
      currentPage: options.page,
      totalPages: Math.ceil(results.length / options.limit),
      hasNextPage: options.page < Math.ceil(results.length / options.limit),
      hasPrevPage: options.page > 1,
      count: results.length,
      limit: options.limit
    },
    meta: {
      query,
      filters,
      totalResults: results.length,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: results.length,
        pages: Math.ceil(results.length / options.limit)
      }
    }
  });
});

/**
 * Get available search types
 */
const getSearchTypes = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      types: ['cards', 'products', 'sets', 'setProducts'],
      description: {
        cards: 'Pokemon cards with set information',
        products: 'Products (SetProduct → Product hierarchy)',
        sets: 'Pokemon card sets',
        setProducts: 'Set products (top-level product categories)'
      }
    }
  });
});

/**
 * Get search statistics
 */
const getSearchStats = asyncHandler(async (req, res) => {
  const Card = require('../models/Card');
  const Set = require('../models/Set');
  const Product = require('../models/Product');
  const SetProduct = require('../models/SetProduct');

  const [cardCount, setCount, productCount, setProductCount] = await Promise.all([
    Card.countDocuments(),
    Set.countDocuments(),
    Product.countDocuments(),
    SetProduct.countDocuments()
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalCards: cardCount,
      totalSets: setCount,
      totalProducts: productCount,
      totalSetProducts: setProductCount,
      searchTypes: ['cards', 'products', 'sets', 'setProducts']
    }
  });
});

module.exports = {
  search,
  suggest,
  searchCards,
  searchProducts,
  searchSets,
  getSearchTypes,
  getSearchStats
};