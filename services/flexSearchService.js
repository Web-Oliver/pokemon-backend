/**
 * FlexSearch Service - PROPER SEARCH FRAMEWORK
 * 
 * Replaces the broken custom search with FlexSearch - a fast, flexible search library
 * that actually works for partial matching, fuzzy search, and instant results.
 */

const FlexSearch = require('flexsearch');
const Card = require('../models/Card');
const Set = require('../models/Set');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');

class FlexSearchService {
  constructor() {
    // Initialize FlexSearch indexes with optimized configuration
    this.cardIndex = new FlexSearch.Document({
      id: "_id",
      index: [
        {
          field: "cardName",
          tokenize: "forward",
          resolution: 9
        },
        {
          field: "baseName", 
          tokenize: "forward",
          resolution: 9
        },
        {
          field: "pokemonNumber",
          tokenize: "strict"
        },
        {
          field: "variety",
          tokenize: "forward"
        },
        {
          field: "setName", // From populated setId
          tokenize: "forward"
        }
      ]
    });

    this.productIndex = new FlexSearch.Document({
      id: "_id",
      index: [
        {
          field: "name",
          tokenize: "forward",
          resolution: 9
        },
        {
          field: "category",
          tokenize: "forward"
        },
        {
          field: "setName",
          tokenize: "forward"
        }
      ]
    });

    this.setIndex = new FlexSearch.Document({
      id: "_id", 
      index: [
        {
          field: "setName",
          tokenize: "forward",
          resolution: 9
        }
      ]
    });

    // Track if indexes are initialized
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Initialize FlexSearch indexes with database data
   */
  async initializeIndexes() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    console.log('[FLEXSEARCH] Initializing search indexes...');
    const startTime = Date.now();

    try {
      // Index all cards with populated set data
      const cards = await Card.find({}).populate('setId').lean();
      console.log(`[FLEXSEARCH] Indexing ${cards.length} cards...`);
      
      cards.forEach(card => {
        this.cardIndex.add({
          _id: card._id.toString(),
          cardName: card.cardName || '',
          baseName: card.baseName || '',
          pokemonNumber: card.pokemonNumber || '',
          variety: card.variety || '',
          setName: card.setId?.setName || ''
        });
      });

      // Index all products
      const products = await CardMarketReferenceProduct.find({}).lean();
      console.log(`[FLEXSEARCH] Indexing ${products.length} products...`);
      
      products.forEach(product => {
        this.productIndex.add({
          _id: product._id.toString(),
          name: product.name || '',
          category: product.category || '',
          setName: product.setName || ''
        });
      });

      // Index all sets
      const sets = await Set.find({}).lean();
      console.log(`[FLEXSEARCH] Indexing ${sets.length} sets...`);
      
      sets.forEach(set => {
        this.setIndex.add({
          _id: set._id.toString(),
          setName: set.setName || ''
        });
      });

      this.initialized = true;
      const duration = Date.now() - startTime;
      console.log(`[FLEXSEARCH] Initialization completed in ${duration}ms`);
      
    } catch (error) {
      console.error('[FLEXSEARCH] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Search cards using FlexSearch - FAST partial matching
   */
  async searchCards(query, filters = {}, options = {}) {
    await this.initializeIndexes();

    const { limit = 50 } = options;
    
    if (!query || !query.trim()) {
      return [];
    }

    // FlexSearch with partial matching - finds "booster" in "booster box"
    const searchResults = this.cardIndex.search(query.trim(), {
      limit: limit * 2, // Get more results to filter
      enrich: true
    });

    // Extract document IDs from FlexSearch results
    const cardIds = [];
    searchResults.forEach(result => {
      result.result.forEach(id => {
        if (!cardIds.includes(id)) {
          cardIds.push(id);
        }
      });
    });

    if (cardIds.length === 0) {
      return [];
    }

    // Fetch actual card documents from database
    const cards = await Card.find({
      _id: { $in: cardIds },
      ...filters
    })
    .populate('setId')
    .lean()
    .limit(limit);

    // Map results maintaining search relevance order
    const orderedResults = [];
    cardIds.forEach(id => {
      const card = cards.find(c => c._id.toString() === id);
      if (card && orderedResults.length < limit) {
        // Add set display name
        card.setDisplayName = card.setId?.setName || 'Unknown Set';
        card.fallbackSetName = !card.setId?.setName;
        orderedResults.push(card);
      }
    });

    console.log(`[FLEXSEARCH] Cards search "${query}" returned ${orderedResults.length} results`);
    return orderedResults;
  }

  /**
   * Search products using FlexSearch - FAST partial matching
   */
  async searchProducts(query, filters = {}, options = {}) {
    await this.initializeIndexes();

    const { limit = 50 } = options;
    
    if (!query || !query.trim()) {
      return [];
    }

    // FlexSearch with partial matching
    const searchResults = this.productIndex.search(query.trim(), {
      limit: limit * 2,
      enrich: true
    });

    // Extract document IDs
    const productIds = [];
    searchResults.forEach(result => {
      result.result.forEach(id => {
        if (!productIds.includes(id)) {
          productIds.push(id);
        }
      });
    });

    if (productIds.length === 0) {
      return [];
    }

    // Fetch actual product documents
    const products = await CardMarketReferenceProduct.find({
      _id: { $in: productIds },
      ...filters
    })
    .lean()
    .limit(limit);

    // Order results by search relevance
    const orderedResults = [];
    productIds.forEach(id => {
      const product = products.find(p => p._id.toString() === id);
      if (product && orderedResults.length < limit) {
        orderedResults.push(product);
      }
    });

    console.log(`[FLEXSEARCH] Products search "${query}" returned ${orderedResults.length} results`);
    return orderedResults;
  }

  /**
   * Search sets using FlexSearch
   */
  async searchSets(query, filters = {}, options = {}) {
    await this.initializeIndexes();

    const { limit = 50 } = options;
    
    if (!query || !query.trim()) {
      return [];
    }

    // FlexSearch with partial matching
    const searchResults = this.setIndex.search(query.trim(), {
      limit: limit * 2,
      enrich: true
    });

    // Extract document IDs
    const setIds = [];
    searchResults.forEach(result => {
      result.result.forEach(id => {
        if (!setIds.includes(id)) {
          setIds.push(id);
        }
      });
    });

    if (setIds.length === 0) {
      return [];
    }

    // Fetch actual set documents
    const sets = await Set.find({
      _id: { $in: setIds },
      ...filters
    })
    .lean()
    .limit(limit);

    // Order results by search relevance
    const orderedResults = [];
    setIds.forEach(id => {
      const set = sets.find(s => s._id.toString() === id);
      if (set && orderedResults.length < limit) {
        orderedResults.push(set);
      }
    });

    console.log(`[FLEXSEARCH] Sets search "${query}" returned ${orderedResults.length} results`);
    return orderedResults;
  }

  /**
   * Unified search across all models
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
            setName: card.setDisplayName,
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

  /**
   * Re-initialize indexes (for data updates)
   */
  async reinitializeIndexes() {
    this.initialized = false;
    this.initPromise = null;
    
    // Clear existing indexes
    this.cardIndex = new FlexSearch.Document({
      id: "_id",
      index: ["cardName", "baseName", "pokemonNumber", "variety", "setName"]
    });
    
    this.productIndex = new FlexSearch.Document({
      id: "_id", 
      index: ["name", "category", "setName"]
    });
    
    this.setIndex = new FlexSearch.Document({
      id: "_id",
      index: ["setName"]
    });

    return this.initializeIndexes();
  }
}

module.exports = new FlexSearchService();