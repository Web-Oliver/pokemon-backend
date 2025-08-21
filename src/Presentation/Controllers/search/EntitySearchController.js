import { asyncHandler, ValidationError } from '@/Infrastructure/Utilities/errorHandler.js';
import SearchService from '@/Application/UseCases/Search/SearchService.js';
const searchService = new SearchService();
/**
 * Entity Search Controller
 *
 * Handles domain-specific search for individual entity types (Cards, Products, Sets)
 * Single Responsibility: Manages single-entity search with domain-aware filtering
 */

/**
 * Search cards with hierarchical filtering
 * Supports Set → Card hierarchy with advanced filtering
 */
const searchCards = asyncHandler(async (req, res) => {
  const {
    query,
    setName,
    year,
    minPrice,
    maxPrice,
    sold,
    limit,
    page,
    sort,
    populate,
    exclude
  } = req.query;

  // HIERARCHICAL SEARCH: Allow empty queries when filtering by set/year
  let searchQuery = query;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    if (setName || year) {
      // Empty query with filters is valid for "all cards in set" functionality
      searchQuery = '*';
    } else {
      // Truly empty search - return empty results with helpful message
      return res.status(200).json({
        success: true,
        data: {
          cards: [],
          total: 0,
          currentPage: options?.page || 1,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
          count: 0,
          limit: options?.limit || 20,
        },
        meta: {
          query: '',
          filters: { setName, year },
          totalResults: 0,
          pagination: {
            page: options?.page || 1,
            limit: options?.limit || 20,
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

  // Build filters object
  const filters = {};

  if (setName) filters.setName = setName;
  if (year) filters.year = parseInt(year, 10);
  if (minPrice || maxPrice) {
    filters.price = {};
    if (minPrice) filters.price.$gte = parseFloat(minPrice);
    if (maxPrice) filters.price.$lte = parseFloat(maxPrice);
  }
  if (sold) filters.sold = sold === 'true';

  // EXCLUDE support for "related items" queries
  if (exclude) {
    try {
      const mongoose = (await import('mongoose')).default;
      filters._id = { $ne: new mongoose.Types.ObjectId(exclude) };
    } catch (error) {
      // Invalid exclude ID, ignore
    }
  }

  let results = await searchService.searchCards(searchQuery, filters, options);

  // AUTO-POPULATION: Add Set information if requested
  if (populate && populate.includes('setId') && results.length > 0) {
    const Set = (await import('@/Domain/Entities/Set.js')).default;
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
    data: results,
    meta: {
      query: searchQuery,
      filters: { setName, year, minPrice, maxPrice, sold, exclude },
      totalResults: results.total || results.length
    }
  });
});

/**
 * Search products with set-based filtering
 * Supports SetProduct → Product hierarchy
 */
const searchProducts = asyncHandler(async (req, res) => {
  const {
    query,
    setName,
    minPrice,
    maxPrice,
    availableOnly,
    limit,
    page,
    sort,
    populate,
    exclude
  } = req.query;

  let searchQuery = query;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    searchQuery = '*';
  }

  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  // Build filters object
  const filters = {};

  // Handle set-based filtering for products
  if (setName) {
    const Set = (await import('@/Domain/Entities/Set.js')).default;
    const matchingSet = await Set.findOne({ setName }).select('_id');

    if (matchingSet) {
      filters.setId = matchingSet._id;
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
      const mongoose = (await import('mongoose')).default;
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
    const SetProduct = (await import('@/Domain/Entities/SetProduct.js')).default;
    const populatedResults = await Promise.all(results.map(async (product) => {
      if (product.setProductId && !product.setProductId.name) {
        const setProduct = await SetProduct.findById(product.setProductId).select('name description');

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
    data: results,
    meta: {
      query: searchQuery,
      filters: { setName, minPrice, maxPrice, availableOnly, exclude },
      totalResults: results.total || results.length
    }
  });
});

/**
 * Search sets with filtering
 */
const searchSets = asyncHandler(async (req, res) => {
  const { query, year, limit, page, sort } = req.query;

  let searchQuery = query;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    searchQuery = '*';
  }

  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined
  };

  const filters = {};

  if (year) filters.year = parseInt(year, 10);

  const results = await searchService.searchSets(searchQuery, filters, options);

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query: searchQuery,
      filters: { year },
      totalResults: results.total || results.length
    }
  });
});

export {
  searchCards,
  searchProducts,
  searchSets
};
export default searchCards;;
