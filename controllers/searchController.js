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
  const searchTypes = types ? types.split(',').map(t => t.trim()) : ['cards', 'products', 'sets'];

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
  const { query, setId, setName, year, pokemonNumber, variety, limit, page, sort } = req.query;

  if (!query || typeof query !== 'string') {
    throw new ValidationError('Query parameter is required and must be a string');
  }

  // Build filters
  const filters = {};

  if (setId) filters.setId = setId;
  if (pokemonNumber) filters.pokemonNumber = pokemonNumber;
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
      // No matching sets found
      return res.status(200).json({
        success: true,
        data: [],
        meta: { query, filters: { setName, year }, totalResults: 0 }
      });
    }
  }

  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  const results = await searchService.searchCards(query, filters, options);

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query,
      filters,
      totalResults: results.length
    }
  });
});

/**
 * Search products
 */
const searchProducts = asyncHandler(async (req, res) => {
  const { query, category, setName, minPrice, maxPrice, availableOnly, limit, page, sort } = req.query;

  if (!query || typeof query !== 'string') {
    throw new ValidationError('Query parameter is required and must be a string');
  }

  // Build filters
  const filters = {};

  if (category) filters.category = category;
  if (setName) filters.setName = new RegExp(setName, 'i');
  if (minPrice || maxPrice) {
    filters.price = {};
    if (minPrice) filters.price.$gte = parseFloat(minPrice);
    if (maxPrice) filters.price.$lte = parseFloat(maxPrice);
  }
  if (availableOnly === 'true') filters.available = { $gt: 0 };

  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  const results = await searchService.searchProducts(query, filters, options);

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query,
      filters,
      totalResults: results.length
    }
  });
});

/**
 * Search sets
 */
const searchSets = asyncHandler(async (req, res) => {
  const { query, year, minYear, maxYear, minPsaPopulation, minCardCount, limit, page, sort } = req.query;

  if (!query || typeof query !== 'string') {
    throw new ValidationError('Query parameter is required and must be a string');
  }

  // Build filters
  const filters = {};

  if (year) filters.year = parseInt(year, 10);
  if (minYear || maxYear) {
    filters.year = {};
    if (minYear) filters.year.$gte = parseInt(minYear, 10);
    if (maxYear) filters.year.$lte = parseInt(maxYear, 10);
  }
  if (minPsaPopulation) filters.totalPsaPopulation = { $gte: parseInt(minPsaPopulation, 10) };
  if (minCardCount) filters.totalCardsInSet = { $gte: parseInt(minCardCount, 10) };

  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  const results = await searchService.searchSets(query, filters, options);

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query,
      filters,
      totalResults: results.length
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
      types: ['cards', 'products', 'sets'],
      description: {
        cards: 'Pokemon cards with set information',
        products: 'CardMarket reference products',
        sets: 'Pokemon card sets'
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
  const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');

  const [cardCount, setCount, productCount] = await Promise.all([
    Card.countDocuments(),
    Set.countDocuments(),
    CardMarketReferenceProduct.countDocuments()
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalCards: cardCount,
      totalSets: setCount,
      totalProducts: productCount,
      searchTypes: ['cards', 'products', 'sets']
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