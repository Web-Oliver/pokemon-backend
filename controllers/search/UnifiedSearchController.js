const { asyncHandler, ValidationError } = require('../../middleware/errorHandler');
const container = require('../../container');

/**
 * Unified Search Controller
 *
 * Modern search controller using the new search architecture.
 * Provides unified search functionality across all models using
 * the Strategy pattern and dependency injection.
 *
 * Following SOLID principles and replacing the old hierarchical search.
 */
class UnifiedSearchController {
  constructor() {
    this.searchFactory = container.resolve('searchFactory');
  }

  /**
   * Performs unified search across multiple types
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  search = asyncHandler(async (req, res) => {
    console.log('=== UNIFIED SEARCH START ===');

    try {
      const { query, types, limit, page, sort, filters } = req.query;

      // Validate query
      if (!query || typeof query !== 'string') {
        throw new ValidationError('Query parameter is required and must be a string');
      }

      // Parse types (default to all if not specified)
      const searchTypes = types ? types.split(',').map((t) => t.trim()) : ['cards', 'products', 'sets'];

      // Parse options
      const options = {
        limit: limit ? parseInt(limit, 10) : 20,
        page: page ? parseInt(page, 10) : 1,
        sort: sort ? JSON.parse(sort) : undefined,
        filters: filters ? JSON.parse(filters) : {},
      };

      console.log('Search parameters:', {
        query,
        types: searchTypes,
        options,
      });

      // Perform search across multiple types
      const results = await this.searchFactory.searchMultiple(query, searchTypes, options);

      // Calculate total count
      const totalCount = Object.values(results).reduce((sum, result) => sum + result.count, 0);

      console.log('Search results:', {
        totalCount,
        resultsByType: Object.entries(results).map(([type, result]) => ({
          type,
          count: result.count,
          success: result.success,
        })),
      });

      console.log('=== UNIFIED SEARCH END ===');

      res.status(200).json({
        success: true,
        query,
        totalCount,
        results,
      });
    } catch (error) {
      console.error('=== UNIFIED SEARCH ERROR ===');
      console.error('Error:', error.message);
      console.error('Query params:', req.query);
      console.error('=== UNIFIED SEARCH ERROR END ===');
      throw error;
    }
  });

  /**
   * Provides search suggestions across multiple types
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  suggest = asyncHandler(async (req, res) => {
    console.log('=== UNIFIED SUGGEST START ===');

    try {
      const { query, types, limit } = req.query;

      // Validate query
      if (!query || typeof query !== 'string') {
        throw new ValidationError('Query parameter is required and must be a string');
      }

      // Parse types (default to all if not specified)
      const searchTypes = types ? types.split(',').map((t) => t.trim()) : ['cards', 'products', 'sets'];

      // Parse options
      const options = {
        limit: limit ? parseInt(limit, 10) : 5,
      };

      console.log('Suggest parameters:', {
        query,
        types: searchTypes,
        options,
      });

      // Get suggestions across multiple types
      const suggestions = await this.searchFactory.suggestMultiple(query, searchTypes, options);

      console.log('Suggestions results:', {
        resultsByType: Object.entries(suggestions).map(([type, result]) => ({
          type,
          count: result.count,
          success: result.success,
        })),
      });

      console.log('=== UNIFIED SUGGEST END ===');

      res.status(200).json({
        success: true,
        query,
        suggestions,
      });
    } catch (error) {
      console.error('=== UNIFIED SUGGEST ERROR ===');
      console.error('Error:', error.message);
      console.error('Query params:', req.query);
      console.error('=== UNIFIED SUGGEST ERROR END ===');
      throw error;
    }
  });

  /**
   * Searches cards using the new architecture
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  searchCards = asyncHandler(async (req, res) => {
    console.log('=== CARD SEARCH START ===');

    try {
      const { query, setId, setName, year, pokemonNumber, variety, minPsaPopulation, limit, page, sort } = req.query;

      // Validate query
      if (!query || typeof query !== 'string') {
        throw new ValidationError('Query parameter is required and must be a string');
      }

      // Build filters
      const filters = {};

      if (setId) {
        filters.setId = setId;
      }
      if (setName) {
        filters.setName = setName;
      }
      if (year) {
        filters.year = parseInt(year, 10);
      }
      if (pokemonNumber) {
        filters.pokemonNumber = pokemonNumber;
      }
      if (variety) {
        filters.variety = variety;
      }
      if (minPsaPopulation) {
        filters.minPsaPopulation = parseInt(minPsaPopulation, 10);
      }

      // Parse options
      const options = {
        limit: limit ? parseInt(limit, 10) : 20,
        page: page ? parseInt(page, 10) : 1,
        sort: sort ? JSON.parse(sort) : undefined,
        filters,
      };

      console.log('Card search parameters:', { query, options });

      // Get card search strategy
      const cardStrategy = this.searchFactory.getStrategy('cards');

      // Perform search
      const results = await cardStrategy.search(query, options);

      console.log(`Found ${results.length} cards`);
      console.log('=== CARD SEARCH END ===');

      res.status(200).json({
        success: true,
        query,
        count: results.length,
        data: results,
      });
    } catch (error) {
      console.error('=== CARD SEARCH ERROR ===');
      console.error('Error:', error.message);
      console.error('Query params:', req.query);
      console.error('=== CARD SEARCH ERROR END ===');
      throw error;
    }
  });

  /**
   * Searches products using the new architecture
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  searchProducts = asyncHandler(async (req, res) => {
    console.log('=== PRODUCT SEARCH START ===');

    try {
      const { query, category, setName, minPrice, maxPrice, availableOnly, limit, page, sort } = req.query;

      // Validate query
      if (!query || typeof query !== 'string') {
        throw new ValidationError('Query parameter is required and must be a string');
      }

      // Build filters
      const filters = {};

      if (category) {
        filters.category = category;
      }
      if (setName) {
        filters.setName = setName;
      }
      if (minPrice && maxPrice) {
        filters.priceRange = {
          min: parseFloat(minPrice),
          max: parseFloat(maxPrice),
        };
      }
      if (availableOnly === 'true') {
        filters.availableOnly = true;
      }

      // Parse options
      const options = {
        limit: limit ? parseInt(limit, 10) : 20,
        page: page ? parseInt(page, 10) : 1,
        sort: sort ? JSON.parse(sort) : undefined,
        filters,
      };

      console.log('Product search parameters:', { query, options });

      // Get product search strategy
      const productStrategy = this.searchFactory.getStrategy('products');

      // Perform search
      const results = await productStrategy.search(query, options);

      console.log(`Found ${results.length} products`);
      console.log('=== PRODUCT SEARCH END ===');

      res.status(200).json({
        success: true,
        query,
        count: results.length,
        data: results,
      });
    } catch (error) {
      console.error('=== PRODUCT SEARCH ERROR ===');
      console.error('Error:', error.message);
      console.error('Query params:', req.query);
      console.error('=== PRODUCT SEARCH ERROR END ===');
      throw error;
    }
  });

  /**
   * Searches sets using the new architecture
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  searchSets = asyncHandler(async (req, res) => {
    console.log('=== SET SEARCH START ===');

    try {
      const { query, year, minYear, maxYear, minPsaPopulation, minCardCount, limit, page, sort } = req.query;

      // Validate query
      if (!query || typeof query !== 'string') {
        throw new ValidationError('Query parameter is required and must be a string');
      }

      // Build filters
      const filters = {};

      if (year) {
        filters.year = parseInt(year, 10);
      }
      if (minYear && maxYear) {
        filters.yearRange = {
          start: parseInt(minYear, 10),
          end: parseInt(maxYear, 10),
        };
      }
      if (minPsaPopulation) {
        filters.minPsaPopulation = parseInt(minPsaPopulation, 10);
      }
      if (minCardCount) {
        filters.minCardCount = parseInt(minCardCount, 10);
      }

      // Parse options
      const options = {
        limit: limit ? parseInt(limit, 10) : 20,
        page: page ? parseInt(page, 10) : 1,
        sort: sort ? JSON.parse(sort) : undefined,
        filters,
      };

      console.log('Set search parameters:', { query, options });

      // Get set search strategy
      const setStrategy = this.searchFactory.getStrategy('sets');

      // Perform search
      const results = await setStrategy.search(query, options);

      console.log(`Found ${results.length} sets`);
      console.log('=== SET SEARCH END ===');

      res.status(200).json({
        success: true,
        query,
        count: results.length,
        data: results,
      });
    } catch (error) {
      console.error('=== SET SEARCH ERROR ===');
      console.error('Error:', error.message);
      console.error('Query params:', req.query);
      console.error('=== SET SEARCH ERROR END ===');
      throw error;
    }
  });

  /**
   * Gets available search types
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getSearchTypes = asyncHandler(async (req, res) => {
    try {
      const types = this.searchFactory.getRegisteredTypes();

      res.status(200).json({
        success: true,
        types: types.map((type) => ({
          type,
          supported: this.searchFactory.isTypeSupported(type),
          options: this.searchFactory.getSupportedOptions(type),
        })),
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * Gets search factory statistics
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  getSearchStats = asyncHandler(async (req, res) => {
    try {
      const stats = {
        registeredTypes: this.searchFactory.getRegisteredTypes(),
        cacheStats: this.searchFactory.getCacheStats(),
        containerStats: container.getStats(),
      };

      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error) {
      throw error;
    }
  });
}

// Create and export controller instance
const unifiedSearchController = new UnifiedSearchController();

module.exports = {
  search: unifiedSearchController.search,
  suggest: unifiedSearchController.suggest,
  searchCards: unifiedSearchController.searchCards,
  searchProducts: unifiedSearchController.searchProducts,
  searchSets: unifiedSearchController.searchSets,
  getSearchTypes: unifiedSearchController.getSearchTypes,
  getSearchStats: unifiedSearchController.getSearchStats,
};
