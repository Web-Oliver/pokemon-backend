/**
 * Modern Entity Search Controller
 *
 * Refactored to use BaseController pattern and SearchService for:
 * - Consistent architecture across all controllers
 * - Unified response formats
 * - Built-in caching, metrics, and plugin support
 * - Service layer abstraction (no more direct service instantiation)
 * - SOLID principles compliance
 */

import BaseController from '@/system/middleware/BaseController.js';
import { asyncHandler, ValidationError } from '@/system/middleware/CentralizedErrorHandler.js';
import Logger from '@/system/logging/Logger.js';
import SearchService from '@/search/services/SearchService.js';

/**
 * Enhanced Entity Search Controller using BaseController pattern
 * Provides consistent architecture and service layer abstraction
 */
class EntitySearchController extends BaseController {
  constructor() {
    super('SearchService', {
      entityName: 'Search',
      pluralName: 'searches',
      enableCaching: true,
      enableMetrics: true,
      enablePlugins: true,
      // Custom configuration for entity search
      defaultLimit: 20,
      filterableFields: ['query', 'setName', 'year', 'minPrice', 'maxPrice', 'sold', 'availableOnly']
    });

    // SearchService will be available as this.service via BaseController DI
    // Add entity-search-specific plugins
    this.addEntitySearchPlugins();
  }

  /**
   * Add entity-search-specific plugins
   */
  addEntitySearchPlugins() {
    // Search optimization plugin
    this.addPlugin('searchOptimization', {
      beforeOperation: (operation, data, context) => {
        if (context.req.query.q || context.req.query.query) {
          context.useAdvancedSearch = true;
          context.searchQuery = context.req.query.q || context.req.query.query;
        }
      }
    });

    // Hierarchical search plugin
    this.addPlugin('hierarchicalSearch', {
      beforeOperation: (operation, data, context) => {
        const { req } = context;
        if (req.query.setName || req.query.setProductId || req.query.year) {
          context.useHierarchicalFiltering = true;
          Logger.debug('EntitySearchController', 'Hierarchical filtering enabled', {
            setName: req.query.setName,
            setProductId: req.query.setProductId,
            year: req.query.year
          });
        }
      }
    });

    // Response enhancement plugin
    this.addPlugin('responseEnhancement', {
      beforeResponse: (operation, data, context) => {
        if (data && data.data) {
          // Add enhanced metadata for search responses
          data.meta = data.meta || {};
          data.meta.entityType = 'EntitySearch';
          data.meta.operation = operation;
          data.meta.searchType = this.getSearchTypeFromOperation(operation);
          if (context.searchQuery) {
            data.meta.searchQuery = context.searchQuery;
          }
        }
        return data;
      }
    });
  }

  /**
   * Helper method to determine search type from operation
   */
  getSearchTypeFromOperation(operation) {
    if (operation.includes('Cards')) return 'cards';
    if (operation.includes('Products')) return 'products';
    if (operation.includes('Sets')) return 'sets';
    if (operation.includes('SetProducts')) return 'setProducts';
    return 'entity';
  }

  /**
   * Search cards with hierarchical filtering
   * Supports Set → Card hierarchy with advanced filtering
   */
  searchCards = asyncHandler(async (req, res) => {
    const operation = 'searchCards';
    const context = { req, res, operation };

    const {
      query,
      setName,
      year,
      cardNumber,
      variety,
      minPrice,
      maxPrice,
      sold,
      limit,
      page,
      sort,
      populate,
      exclude
    } = req.query;

    Logger.operationStart('EntitySearch', 'SEARCH CARDS', {
      query,
      filters: { setName, year, cardNumber, variety, minPrice, maxPrice, sold, exclude }
    });

    try {
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, req.query, context);

      // HIERARCHICAL SEARCH: Allow empty queries when filtering by set/year
      let searchQuery = query;

      if (!query || typeof query !== 'string' || query.trim() === '') {
        if (setName || year) {
          // Empty query with filters is valid for "all cards in set" functionality
          searchQuery = '*';
        } else {
          // Truly empty search - return empty results with helpful message
          const emptyResult = {
            success: true,
            data: {
              cards: [],
              total: 0,
              currentPage: parseInt(page, 10) || 1,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
              count: 0,
              limit: parseInt(limit, 10) || 20,
            },
            meta: {
              query: '',
              filters: { setName, year },
              totalResults: 0,
              searchType: 'cards'
            }
          };

          const responseData = await this.executeHooks('beforeResponse', operation, emptyResult, context);
          Logger.operationSuccess('EntitySearch', 'SEARCH CARDS', { result: 'empty_query_no_filters' });
          return res.status(200).json(responseData);
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
      if (cardNumber) filters.cardNumber = cardNumber;
      if (variety) filters.variety = variety;
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

      let results = await this.service.searchCards(searchQuery, filters, options);

      // AUTO-POPULATION: Add Set information if requested
      if (populate && populate.includes('setId') && results.length > 0) {
        const Set = (await import('@/pokemon/sets/Set.js')).default;
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

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, results, context);

      Logger.operationSuccess('EntitySearch', 'SEARCH CARDS', {
        found: results.total || results.length,
        searchUsed: Boolean(searchQuery)
      });

      let responseData = {
        success: true,
        data: results,
        meta: {
          query: searchQuery,
          filters: { setName, year, cardNumber, variety, minPrice, maxPrice, sold, exclude },
          totalResults: results.total || results.length,
          searchType: 'cards'
        }
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);
      Logger.operationError('EntitySearch', 'SEARCH CARDS', error, {
        query, filters: { setName, year, cardNumber, variety, minPrice, maxPrice, sold, exclude }
      });
      throw error;
    }
  });

  /**
   * Search products with set-based filtering
   * Supports SetProduct → Product hierarchy
   */
  searchProducts = asyncHandler(async (req, res) => {
    const operation = 'searchProducts';
    const context = { req, res, operation };

    const {
      query,
      setName,
      setProductId, // FIXED: Add setProductId parameter for hierarchical search
      minPrice,
      maxPrice,
      availableOnly,
      limit,
      page,
      sort,
      populate,
      exclude
    } = req.query;

    Logger.operationStart('EntitySearch', 'SEARCH PRODUCTS', {
      query,
      filters: { setName, setProductId, minPrice, maxPrice, availableOnly, exclude }
    });

    try {
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, req.query, context);

      let searchQuery = query;

      if (!query || typeof query !== 'string' || query.trim() === '') {
        searchQuery = ''; // FIXED: Use empty string instead of '*' to avoid regex errors
      }

      const options = {
        limit: limit ? parseInt(limit, 10) : 20,
        page: page ? parseInt(page, 10) : 1,
        sort: sort ? JSON.parse(sort) : undefined
      };

      // Build filters object
      const filters = {};

      // FIXED: Handle hierarchical filtering - SetProduct -> Product (primary method)
      if (setProductId) {
        try {
          const mongoose = (await import('mongoose')).default;
          filters.setProductId = new mongoose.Types.ObjectId(setProductId);
          Logger.debug('EntitySearch', 'Filtering products by setProductId', { setProductId });
        } catch (error) {
          Logger.error('EntitySearch', 'Invalid setProductId', { setProductId, error });
          // Invalid setProductId - return empty results
          const errorResult = {
            success: true,
            data: [],
            meta: {
              query: searchQuery,
              filters: { setProductId },
              totalResults: 0,
              message: 'Invalid setProductId format',
              searchType: 'products'
            }
          };

          const responseData = await this.executeHooks('beforeResponse', operation, errorResult, context);
          Logger.operationSuccess('EntitySearch', 'SEARCH PRODUCTS', { result: 'invalid_setProductId' });
          return res.status(200).json(responseData);
        }
      }

      // Handle set-based filtering for products (legacy/alternative method)
      if (setName) {
        const Set = (await import('@/pokemon/sets/Set.js')).default;
        const matchingSet = await Set.findOne({ setName }).select('_id');

        if (matchingSet) {
          filters.setId = matchingSet._id;
        } else {
          // No matching set found - return empty results
          const emptyResult = {
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
              message: 'No products found for the specified set',
              searchType: 'products'
            }
          };

          const responseData = await this.executeHooks('beforeResponse', operation, emptyResult, context);
          Logger.operationSuccess('EntitySearch', 'SEARCH PRODUCTS', { result: 'no_matching_set' });
          return res.status(200).json(responseData);
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

      Logger.debug('EntitySearch', 'Products search parameters', {
        searchQuery, filters, options, populate
      });

      // Use searchService with population support
      let results = await this.service.searchProducts(searchQuery, filters, options);

      // AUTO-POPULATION: Add SetProduct information if requested
      if (populate && populate.includes('setProductId') && results.length > 0) {
        const SetProduct = (await import('@/pokemon/products/SetProduct.js')).default;
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

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, results, context);

      Logger.operationSuccess('EntitySearch', 'SEARCH PRODUCTS', {
        found: results.total || results.length,
        searchUsed: Boolean(searchQuery)
      });

      let responseData = {
        success: true,
        data: results,
        meta: {
          query: searchQuery,
          filters: { setName, setProductId, minPrice, maxPrice, availableOnly, exclude },
          totalResults: results.total || results.length,
          searchType: 'products'
        }
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);
      Logger.operationError('EntitySearch', 'SEARCH PRODUCTS', error, {
        query, filters: { setName, setProductId, minPrice, maxPrice, availableOnly, exclude }
      });
      throw error;
    }
  });

  /**
   * Search sets with filtering
   */
  searchSets = asyncHandler(async (req, res) => {
    const operation = 'searchSets';
    const context = { req, res, operation };

    const { query, year, limit, page, sort } = req.query;

    Logger.operationStart('EntitySearch', 'SEARCH SETS', {
      query,
      filters: { year }
    });

    try {
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, req.query, context);

      let searchQuery = query;

      if (!query || typeof query !== 'string' || query.trim() === '') {
        searchQuery = ''; // FIXED: Use empty string instead of '*' to avoid regex errors
      }

      const options = {
        limit: limit ? parseInt(limit, 10) : 20,
        page: page ? parseInt(page, 10) : 1,
        sort: sort ? JSON.parse(sort) : undefined
      };

      const filters = {};

      if (year) filters.year = parseInt(year, 10);

      const results = await this.service.searchSets(searchQuery, filters, options);

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, results, context);

      Logger.operationSuccess('EntitySearch', 'SEARCH SETS', {
        found: results.total || results.length,
        searchUsed: Boolean(searchQuery)
      });

      let responseData = {
        success: true,
        data: results,
        meta: {
          query: searchQuery,
          filters: { year },
          totalResults: results.total || results.length,
          searchType: 'sets'
        }
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);
      Logger.operationError('EntitySearch', 'SEARCH SETS', error, {
        query, filters: { year }
      });
      throw error;
    }
  });

  /**
   * Search set products (hierarchical parent for products)
   * FIXED: Now properly searches SetProduct collection instead of Product collection
   */
  searchSetProducts = asyncHandler(async (req, res) => {
    const operation = 'searchSetProducts';
    const context = { req, res, operation };

    const { query, limit, page, sort } = req.query;

    Logger.operationStart('EntitySearch', 'SEARCH SET PRODUCTS', {
      query
    });

    try {
      // Execute before operation hooks
      await this.executeHooks('beforeOperation', operation, req.query, context);

      let searchQuery = query;

      if (!query || typeof query !== 'string' || query.trim() === '') {
        searchQuery = ''; // FIXED: Use empty string instead of '*' to avoid regex errors
      }

      const options = {
        limit: limit ? parseInt(limit, 10) : 10,
        page: page ? parseInt(page, 10) : 1,
        sort: sort ? JSON.parse(sort) : { setProductName: 1 }
      };

      Logger.debug('EntitySearch', 'SetProducts search parameters', {
        searchQuery, options
      });

      const results = await this.service.searchSetProducts(searchQuery, {}, options);

      // Execute after operation hooks
      await this.executeHooks('afterOperation', operation, results, context);

      Logger.operationSuccess('EntitySearch', 'SEARCH SET PRODUCTS', {
        found: results.total || results.length,
        searchUsed: Boolean(searchQuery)
      });

      let responseData = {
        success: true,
        data: results,
        meta: {
          query: searchQuery,
          totalResults: results.total || results.length,
          searchType: 'setProducts'
        }
      };

      // Execute before response hooks
      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

      res.status(200).json(responseData);
    } catch (error) {
      // Execute error hooks
      await this.executeHooks('onError', operation, error, context);
      Logger.operationError('EntitySearch', 'SEARCH SET PRODUCTS', error, {
        query
      });
      throw error;
    }
  });
}

// Lazy loading pattern - controller instance created only when needed
let entitySearchController = null;

// Get controller instance - lazy loading pattern
const getController = () => {
  if (!entitySearchController) {
    entitySearchController = new EntitySearchController();
  }
  return entitySearchController;
};

// Export controller methods for route binding - lazy loading
const searchCards = (req, res) => getController().searchCards(req, res);
const searchProducts = (req, res) => getController().searchProducts(req, res);
const searchSets = (req, res) => getController().searchSets(req, res);
const searchSetProducts = (req, res) => getController().searchSetProducts(req, res);

// Export individual methods for route compatibility
export {
  searchCards,
  searchProducts,
  searchSets,
  searchSetProducts
};

// Export controller instance for advanced usage - lazy loading accessor pattern
export const getEntitySearchController = getController;

// Default export for backward compatibility
export default searchCards;
