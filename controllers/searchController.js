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
  const { query, types, type, domain, limit, page, sort, filters } = req.query;

  // Allow empty queries for unified search (consistent with individual search endpoints)
  let searchQuery = query;
  if (!query || typeof query !== 'string' || query.trim() === '') {
    searchQuery = '*'; // Use wildcard for "show all" functionality
  }

  // DOMAIN-AWARE SEARCH: Respect domain boundaries
  let searchTypes;
  
  if (domain) {
    // HIERARCHICAL SEARCH: Domain-specific search types
    const domainMap = {
      'cards': ['cards', 'sets'],         // Card Domain: Set → Card hierarchy
      'products': ['products', 'setProducts'], // Product Domain: SetProduct → Product hierarchy
      'card-domain': ['cards', 'sets'],   // Alias for clarity
      'product-domain': ['products', 'setProducts'] // Alias for clarity
    };
    
    searchTypes = domainMap[domain] || domainMap['cards']; // Default to card domain
    console.log(`[DOMAIN SEARCH] Using domain "${domain}" with types:`, searchTypes);
  } else if (type) {
    // Frontend sends specific type - map to correct domain-specific search
    const typeMap = {
      'sets': ['sets'],           // Card Domain: Set entities only
      'cards': ['cards'],         // Card Domain: Card entities only  
      'products': ['products'],   // Product Domain: Product entities only
      'set-products': ['setProducts'], // Product Domain: SetProduct entities only
      'all': ['cards', 'products', 'sets', 'setProducts'] // All domains (fallback)
    };
    
    searchTypes = typeMap[type] || [type]; // Use mapping or fallback to raw type
  } else if (types) {
    // Legacy support for comma-separated types
    searchTypes = types.split(',').map(t => t.trim());
  } else {
    // CHANGED: Default to card domain only (was mixing both domains)
    searchTypes = ['cards', 'sets']; // Card domain only
    console.log('[DOMAIN SEARCH] No domain specified, defaulting to card domain');
  }

  // Parse options
  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined,
    filters: filters ? JSON.parse(filters) : {}
  };

  const results = await searchService.unifiedSearch(searchQuery, searchTypes, options);

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query: searchQuery,
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

  // Require query for suggestions (suggestions need something to search for)
  if (!query || typeof query !== 'string' || query.trim() === '') {
    throw new ValidationError('Query parameter is required and must be a string for suggestions');
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
 * Search cards - ENHANCED HIERARCHICAL SEARCH IMPLEMENTATION
 * Supports bidirectional relationships:
 * 1. Set selected first -> Show cards from that set (filtered by setId)
 * 2. Card selected first -> Return card with Set info (populate setId)
 * 3. Related cards lookup -> Find other cards in same set
 */
const searchCards = asyncHandler(async (req, res) => {
  const { 
    query, 
    setId, // Direct ObjectId filtering
    setName, 
    year, 
    cardNumber, 
    variety, 
    populate, // Auto-population support
    exclude, // For related cards queries
    limit, 
    page, 
    sort 
  } = req.query;

  let searchQuery = query;
  const hasFilters = setId || setName || year || cardNumber || variety;
  
  if (!query || typeof query !== 'string' || query.trim() === '') {
    if (!hasFilters) {
      throw new ValidationError('Query parameter is required when no filters are provided');
    }
    searchQuery = '*';
  }

  // Build filters for hierarchical search
  const filters = {};

  // HIERARCHICAL SEARCH: Direct ObjectId filtering (preferred method)
  if (setId) {
    try {
      const mongoose = require('mongoose');
      filters.setId = new mongoose.Types.ObjectId(setId);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid setId format',
        error: error.message
      });
    }
  }
  
  if (cardNumber) filters.cardNumber = cardNumber;
  if (variety) filters.variety = new RegExp(variety, 'i');
  
  // EXCLUDE support for "related cards" queries
  if (exclude) {
    try {
      const mongoose = require('mongoose');
      filters._id = { $ne: new mongoose.Types.ObjectId(exclude) };
    } catch (error) {
      // Invalid exclude ID, ignore
    }
  }

  // Fallback: Add set name filter by looking up set ID
  if ((setName || year) && !setId) {
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

  let results = await searchService.searchCards(searchQuery, filters, options);
  
  // AUTO-POPULATION: Add Set information if requested
  if (populate && populate.includes('setId') && results.length > 0) {
    const Set = require('../models/Set');
    const Card = require('../models/Card');
    
    // If results are plain objects, we need to populate manually
    const populatedResults = await Promise.all(results.map(async (card) => {
      if (card.setId && !card.setId.setName) {
        const set = await Set.findById(card.setId).select('setName year totalCardsInSet');
        return {
          ...card,
          setId: set || card.setId
        };
      }
      return card;
    }));
    
    results = populatedResults;
  }

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
      searchType: 'cards',
      hierarchicalSearch: {
        setId: setId || null,
        setName: setName || null,
        populated: populate || null,
        excluded: exclude || null
      },
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
 * Search Set Products (top-level categories like "Elite Trainer Box")
 * Part of hierarchical search: SetProduct → Product relationship
 */
const searchSetProducts = asyncHandler(async (req, res) => {
  const { query, limit, page, sort } = req.query;

  let searchQuery = query;
  
  // Allow empty query for "show all" functionality
  if (!query || typeof query !== 'string' || query.trim() === '') {
    searchQuery = '*';
  }

  const options = {
    limit: limit ? parseInt(limit, 10) : 10, // Smaller limit for set products
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  const results = await searchService.searchSetProducts(searchQuery, {}, options);

  res.status(200).json({
    success: true,
    data: {
      setProducts: results,
      total: results.length,
      currentPage: options.page,
      totalPages: Math.ceil(results.length / options.limit),
      hasNextPage: options.page < Math.ceil(results.length / options.limit),
      hasPrevPage: options.page > 1,
      count: results.length,
      limit: options.limit
    },
    meta: {
      query: searchQuery,
      totalResults: results.length,
      searchType: 'setProducts',
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
 * Search products - ENHANCED HIERARCHICAL SEARCH IMPLEMENTATION
 * Supports the frontend's hierarchical search requirements:
 * 1. SetProduct selected first -> Show only products from that SetProduct (filtered by setProductId)
 * 2. Product selected first -> Return product with SetProduct info (populate setProductId)
 * 3. Bidirectional relationships using MongoDB ObjectId references
 * 4. Auto-population support for reverse lookups
 */
const searchProducts = asyncHandler(async (req, res) => {
  const { 
    query, 
    category, 
    setName, 
    setProductId, // Direct ObjectId filtering
    minPrice, 
    maxPrice, 
    availableOnly, 
    populate, // Auto-population support
    exclude, // For related items queries
    limit, 
    page, 
    sort 
  } = req.query;

  let searchQuery = query;
  const hasFilters = category || setName || minPrice || maxPrice || availableOnly;
  
  // HIERARCHICAL SEARCH: Allow empty query for initial load (like sets) and when filters exist
  if (!query || typeof query !== 'string' || query.trim() === '') {
    // Use '*' to show all products (either when filtering or for initial load)
    searchQuery = '*';
    if (hasFilters) {
      console.log('[HIERARCHICAL] Using wildcard query with filters:', { setName, category });
    } else {
      console.log('[INITIAL LOAD] Using wildcard query to show all products');
    }
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
  
  // HIERARCHICAL SEARCH: Direct ObjectId filtering (preferred method)
  if (setProductId) {
    try {
      const mongoose = require('mongoose');
      filters.setProductId = new mongoose.Types.ObjectId(setProductId);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: 'Invalid setProductId format',
        error: error.message
      });
    }
  }
  // Fallback: Handle setName by looking up SetProduct and using its ID
  else if (setName) {
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
  
  // EXCLUDE support for "related items" queries
  if (exclude) {
    try {
      const mongoose = require('mongoose');
      filters._id = { $ne: new mongoose.Types.ObjectId(exclude) };
    } catch (error) {
      // Invalid exclude ID, ignore
    }
  }

  console.log('[HIERARCHICAL SEARCH] Products:', { query: searchQuery, filters, options, populate });

  // Use searchService with population support
  let results = await searchService.searchProducts(searchQuery, filters, options);
  
  // AUTO-POPULATION: Add SetProduct information if requested
  if (populate && populate.includes('setProductId') && results.length > 0) {
    const SetProduct = require('../models/SetProduct');
    const Product = require('../models/Product');
    
    // If results are plain objects, we need to populate manually
    const populatedResults = await Promise.all(results.map(async (product) => {
      if (product.setProductId && !product.setProductId.setProductName) {
        const setProduct = await SetProduct.findById(product.setProductId).select('setProductName');
        return {
          ...product,
          setProductId: setProduct || product.setProductId
        };
      }
      return product;
    }));
    
    results = populatedResults;
  }

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
      searchType: 'products',
      hierarchicalSearch: {
        setProductId: setProductId || null,
        setName: setName || null,
        populated: populate || null,
        excluded: exclude || null
      },
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
  // ALSO: Allow empty query for initial "show all" functionality
  if (!query || typeof query !== 'string' || query.trim() === '') {
    // Use '*' to show all sets (either when filtering or for initial load)
    searchQuery = '*';
    if (hasFilters) {
      console.log('[HIERARCHICAL] Using wildcard query with filters for sets:', { year, minYear, maxYear });
    } else {
      console.log('[INITIAL LOAD] Using wildcard query to show all sets');
    }
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

  const results = await searchService.searchSets(searchQuery, filters, options);

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

/**
 * Get related cards in the same set
 * Implements bidirectional card relationships
 */
const getRelatedCards = asyncHandler(async (req, res) => {
  const { cardId } = req.params;
  const { limit = 10 } = req.query;

  if (!cardId) {
    return res.status(400).json({
      success: false,
      message: 'Card ID is required'
    });
  }

  try {
    const mongoose = require('mongoose');
    const Card = require('../models/Card');
    const Set = require('../models/Set');
    
    // 1. Get the card with its set information
    const card = await Card.findById(cardId).populate('setId', 'setName year totalCardsInSet');
    
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Card not found'
      });
    }
    
    // 2. Find all other cards in the same set
    const relatedCards = await Card.find({ 
      setId: card.setId._id,
      _id: { $ne: cardId } // Exclude the original card
    })
    .populate('setId', 'setName year')
    .limit(parseInt(limit, 10));
    
    res.status(200).json({
      success: true,
      data: {
        selectedCard: card,
        relatedCards: relatedCards,
        setInfo: card.setId,
        totalRelated: relatedCards.length
      },
      meta: {
        searchType: 'relatedCards',
        setId: card.setId._id,
        setName: card.setId.setName,
        limit: parseInt(limit, 10)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error finding related cards',
      error: error.message
    });
  }
});

/**
 * Get related products in the same set product category
 * Implements bidirectional product relationships
 */
const getRelatedProducts = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { limit = 10 } = req.query;

  if (!productId) {
    return res.status(400).json({
      success: false,
      message: 'Product ID is required'
    });
  }

  try {
    const mongoose = require('mongoose');
    const Product = require('../models/Product');
    const SetProduct = require('../models/SetProduct');
    
    // 1. Get the product with its set product information
    const product = await Product.findById(productId).populate('setProductId', 'setProductName');
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // 2. Find all other products in the same set product category
    const relatedProducts = await Product.find({ 
      setProductId: product.setProductId._id,
      _id: { $ne: productId } // Exclude the original product
    })
    .populate('setProductId', 'setProductName')
    .limit(parseInt(limit, 10));
    
    res.status(200).json({
      success: true,
      data: {
        selectedProduct: product,
        relatedProducts: relatedProducts,
        setProductInfo: product.setProductId,
        totalRelated: relatedProducts.length
      },
      meta: {
        searchType: 'relatedProducts',
        setProductId: product.setProductId._id,
        setProductName: product.setProductId.setProductName,
        limit: parseInt(limit, 10)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error finding related products',
      error: error.message
    });
  }
});

module.exports = {
  search,
  suggest,
  searchCards,
  searchProducts,
  searchSets,
  searchSetProducts,
  getRelatedCards,
  getRelatedProducts,
  getSearchTypes,
  getSearchStats
};