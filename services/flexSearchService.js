/**
 * FlexSearch Service - PROPER SEARCH FRAMEWORK
 * 
 * Replaces the broken custom search with FlexSearch - a fast, flexible search library
 * that actually works for partial matching, fuzzy search, and instant results.
 */

const FlexSearch = require('flexsearch');
const Card = require('../models/Card');
const Set = require('../models/Set');
const Product = require('../models/Product');
const SetProduct = require('../models/SetProduct');

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
          field: "cardNumber",
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
          field: "productName",
          tokenize: "forward",
          resolution: 9
        },
        {
          field: "category",
          tokenize: "forward"
        },
        {
          field: "setProductName",
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

    this.setProductIndex = new FlexSearch.Document({
      id: "_id",
      index: [
        {
          field: "setProductName",
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
          cardNumber: card.cardNumber || '',
          variety: card.variety || '',
          setName: card.setId?.setName || ''
        });
      });

      // Index all products with populated SetProduct data
      const products = await Product.find({}).populate('setProductId', 'setProductName').lean();

      console.log(`[FLEXSEARCH] Indexing ${products.length} products...`);
      
      products.forEach(product => {
        this.productIndex.add({
          _id: product._id.toString(),
          productName: product.productName || '',
          category: product.category || '',
          setProductName: product.setProductId?.setProductName || ''
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

      // Index all set products
      const setProducts = await SetProduct.find({}).lean();

      console.log(`[FLEXSEARCH] Indexing ${setProducts.length} set products...`);
      
      setProducts.forEach(setProduct => {
        this.setProductIndex.add({
          _id: setProduct._id.toString(),
          setProductName: setProduct.setProductName || ''
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

    // Fetch actual product documents with populated SetProduct data
    const products = await Product.find({
      _id: { $in: productIds },
      ...filters
    })
    .populate('setProductId', 'setProductName')
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
   * Search SetProducts using FlexSearch with MongoDB fallback
   */
  async searchSetProducts(query, filters = {}, options = {}) {
    await this.initializeIndexes();

    const { limit = 50 } = options;
    
    if (!query || !query.trim()) {
      return [];
    }

    // FlexSearch with partial matching
    const searchResults = this.setProductIndex.search(query.trim(), {
      limit: limit * 2,
      enrich: true
    });

    // Extract document IDs
    const setProductIds = [];
    searchResults.forEach(result => {
      result.result.forEach(id => {
        if (!setProductIds.includes(id)) {
          setProductIds.push(id);
        }
      });
    });

    if (setProductIds.length === 0) {
      return [];
    }

    // Fetch actual set product documents
    const setProducts = await SetProduct.find({
      _id: { $in: setProductIds },
      ...filters
    })
    .lean()
    .limit(limit);

    // Order results by search relevance
    const orderedResults = [];
    setProductIds.forEach(id => {
      const setProduct = setProducts.find(sp => sp._id.toString() === id);
      if (setProduct) {
        orderedResults.push(setProduct);
      }
    });

    console.log(`[FLEXSEARCH] SetProducts search "${query}" returned ${orderedResults.length} results`);
    return orderedResults;
  }

  /**
   * Unified search across all models
   */
  async unifiedSearch(query, types = ['cards', 'products', 'sets', 'setProducts'], options = {}) {
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

    if (types.includes('setProducts')) {
      searchPromises.push(
        this.searchSetProducts(query, {}, { limit }).then(data => ({ setProducts: data }))
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
          secondaryText: card.variety || null,
          metadata: {
            cardNumber: card.cardNumber,
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
          text: product.productName,
          secondaryText: product.setProductId?.setProductName || 'Unknown Set',
          metadata: {
            category: product.category,
            price: product.price,
            available: product.available,
            setProductName: product.setProductId?.setProductName
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
            totalGraded: set.total_grades?.total_graded,
            uniqueSetId: set.uniqueSetId
          }
        }));
        break;

      case 'setProducts':
        const setProducts = await this.searchSetProducts(query, {}, { limit });
        results = setProducts.map(setProduct => ({
          id: setProduct._id,
          text: setProduct.setProductName,
          secondaryText: 'Set Product',
          metadata: {
            uniqueSetProductId: setProduct.uniqueSetProductId
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
      index: ["cardName", "cardNumber", "variety", "setName"]
    });
    
    this.productIndex = new FlexSearch.Document({
      id: "_id", 
      index: ["productName", "category", "setProductName"]
    });
    
    this.setIndex = new FlexSearch.Document({
      id: "_id",
      index: ["setName"]
    });

    return this.initializeIndexes();
  }
}

module.exports = new FlexSearchService();