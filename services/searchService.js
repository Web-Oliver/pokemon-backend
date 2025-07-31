/**
 * Search Service
 * 
 * Replaces the massively over-engineered 4,773-line search architecture
 * with a practical search implementation following DRY principles.
 * 
 * Before: 4,773 lines across 8 files with massive duplication
 * After: ~150 lines with unified search logic
 */

const Card = require('../models/Card');
const Set = require('../models/Set');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');

/**
 * Unified search service with common patterns
 */
class SearchService {
  /**
   * Builds a text search query for any model
   * @param {string} query - Search query
   * @param {Array} searchFields - Fields to search in
   * @returns {Object} MongoDB text search query
   */
  buildTextSearchQuery(query, searchFields) {
    if (!query || !query.trim()) {
      return {};
    }

    const searchTerms = query.trim().split(/\s+/);
    const searchQuery = {
      $or: []
    };

    // Add regex search for each field
    searchFields.forEach(field => {
      searchTerms.forEach(term => {
        searchQuery.$or.push({
          [field]: { $regex: term, $options: 'i' }
        });
      });
    });

    return searchQuery;
  }

  /**
   * Generic search method for any model
   * @param {Model} Model - Mongoose model to search
   * @param {string} query - Search query
   * @param {Array} searchFields - Fields to search in
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options (limit, page, sort)
   * @returns {Promise<Array>} Search results
   */
  async search(Model, query, searchFields, filters = {}, options = {}) {
    const { 
      limit = 50, 
      page = 1, 
      sort = { _id: 1 },
      populate = null
    } = options;

    // Build search query
    const searchQuery = this.buildTextSearchQuery(query, searchFields);
    
    // Combine with filters
    const finalQuery = {
      ...searchQuery,
      ...filters
    };

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    let queryBuilder = Model.find(finalQuery)
      .sort(sort)
      .limit(limit)
      .skip(skip);

    // Add population if specified
    if (populate) {
      queryBuilder = queryBuilder.populate(populate);
    }

    return await queryBuilder.exec();
  }

  /**
   * Search cards with set information
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Card search results
   */
  async searchCards(query, filters = {}, options = {}) {
    const searchFields = ['cardName', 'baseName', 'pokemonNumber', 'variety'];
    const defaultSort = { psaTotalGradedForCard: -1, _id: 1 };
    
    const results = await this.search(
      Card, 
      query, 
      searchFields, 
      filters, 
      { 
        ...options, 
        sort: options.sort || defaultSort,
        populate: 'setId'
      }
    );

    // Ensure each result has a unique identifier and handle missing set data
    return results.map((card, index) => {
      const cardObj = card.toObject ? card.toObject() : card;
      
      // Add fallback for missing set data with unique identifier
      if (!cardObj.setId || !cardObj.setId.setName) {
        cardObj.setDisplayName = `Unknown Set (${cardObj._id})`;
        cardObj.fallbackSetName = true;
      } else {
        cardObj.setDisplayName = cardObj.setId.setName;
        cardObj.fallbackSetName = false;
      }
      
      
      return cardObj;
    });
  }

  /**
   * Search card market products
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Product search results
   */
  async searchProducts(query, filters = {}, options = {}) {
    const searchFields = ['name', 'setName', 'category'];
    const defaultSort = { available: -1, price: 1, _id: 1 };
    
    return await this.search(
      CardMarketReferenceProduct, 
      query, 
      searchFields, 
      filters, 
      { 
        ...options, 
        sort: options.sort || defaultSort
      }
    );
  }

  /**
   * Search sets
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Set search results
   */
  async searchSets(query, filters = {}, options = {}) {
    const searchFields = ['setName'];
    const defaultSort = { year: -1, totalPsaPopulation: -1, _id: 1 };
    
    return await this.search(
      Set, 
      query, 
      searchFields, 
      filters, 
      { 
        ...options, 
        sort: options.sort || defaultSort
      }
    );
  }

  /**
   * Unified search across all models
   * @param {string} query - Search query
   * @param {Array} types - Types to search ['cards', 'products', 'sets']
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Unified search results
   */
  async unifiedSearch(query, types = ['cards', 'products', 'sets'], options = {}) {
    const results = {};
    const { limit = 20 } = options;

    // Search each type in parallel
    const searchPromises = [];

    if (types.includes('cards')) {
      searchPromises.push(
        this.searchCards(query, {}, { limit }).then(data => ({ cards: data }))
      );
    }

    if (types.includes('products')) {
      searchPromises.push(
        this.searchProducts(query, {}, { limit }).then(data => ({ products: data }))
      );
    }

    if (types.includes('sets')) {
      searchPromises.push(
        this.searchSets(query, {}, { limit }).then(data => ({ sets: data }))
      );
    }

    // Wait for all searches to complete
    const searchResults = await Promise.all(searchPromises);
    
    // Merge results
    searchResults.forEach(result => {
      Object.assign(results, result);
    });

    return results;
  }

  /**
   * Get search suggestions (formatted for autocomplete)
   * @param {string} query - Search query
   * @param {string} type - Type to get suggestions for
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Formatted suggestions
   */
  async getSuggestions(query, type = 'cards', options = {}) {
    const { limit = 10 } = options;
    let results = [];

    switch (type) {
      case 'cards':
        const cards = await this.searchCards(query, {}, { limit });

        results = cards.map(card => ({
          id: card._id,
          text: card.cardName,
          secondaryText: card.baseName !== card.cardName ? card.baseName : null,
          metadata: {
            pokemonNumber: card.pokemonNumber,
            variety: card.variety,
            setName: card.setDisplayName || card.setId?.setName || 'Unknown Set',
            year: card.setId?.year,
            fallbackSetName: card.fallbackSetName || false
          }
        }));
        break;

      case 'products':
        const products = await this.searchProducts(query, {}, { limit });

        results = products.map(product => ({
          id: product._id,
          text: product.name,
          secondaryText: product.setName,
          metadata: {
            category: product.category,
            price: product.price,
            available: product.available
          }
        }));
        break;

      case 'sets':
        const sets = await this.searchSets(query, {}, { limit });

        results = sets.map(set => ({
          id: set._id,
          text: set.setName,
          secondaryText: set.year ? `${set.year}` : null,
          metadata: {
            year: set.year,
            totalCards: set.totalCardsInSet,
            totalPsaPopulation: set.totalPsaPopulation
          }
        }));
        break;
    }

    return results;
  }
}

module.exports = new SearchService();