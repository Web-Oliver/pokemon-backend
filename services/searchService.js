/**
 * Search Service - PROPER SEARCH WITH FLEXSEARCH
 * 
 * Uses FlexSearch for fast partial matching with MongoDB fallback
 * FlexSearch handles "booster" finding "booster box" instantly
 * 
 * Before: Broken MongoDB-only search that required full words
 * After: FlexSearch + MongoDB hybrid for comprehensive results
 */

const Card = require('../models/Card');
const Set = require('../models/Set');
const Product = require('../models/Product');
const SetProduct = require('../models/SetProduct');
const FlexSearch = require('flexsearch');

/**
 * Unified search service with FlexSearch + MongoDB hybrid
 */
class SearchService {
  constructor() {
    // Initialize FlexSearch indexes for OPTIMIZED partial matching
    this.cardIndex = new FlexSearch.Document({
      id: "_id",
      index: [
        { 
          field: "cardName", 
          tokenize: "forward", 
          resolution: 9,
          minlength: 1,
          optimize: true,
          fastupdate: false
        },
        { 
          field: "cardNumber", 
          tokenize: "strict",
          minlength: 1
        },
        { 
          field: "variety", 
          tokenize: "forward",
          minlength: 1,
          optimize: true
        },
        { 
          field: "setName", 
          tokenize: "forward",
          minlength: 1,
          optimize: true
        }
      ]
    });

    this.productIndex = new FlexSearch.Document({
      id: "_id",
      index: [
        { 
          field: "productName", 
          tokenize: "forward", 
          resolution: 9,
          minlength: 1,
          optimize: true,
          fastupdate: false
        },
        { 
          field: "category", 
          tokenize: "forward",
          minlength: 1,
          optimize: true
        },
        { 
          field: "setProductName", 
          tokenize: "forward",
          minlength: 1,
          optimize: true
        }
      ]
    });

    this.setIndex = new FlexSearch.Document({
      id: "_id",
      index: [{
        field: "setName", 
        tokenize: "forward", 
        resolution: 9,
        minlength: 1,
        optimize: true,
        fastupdate: false
      }]
    });

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
      // Index all cards
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

      this.initialized = true;
      const duration = Date.now() - startTime;

      console.log(`[FLEXSEARCH] Initialization completed in ${duration}ms`);
      
    } catch (error) {
      console.error('[FLEXSEARCH] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Builds a hybrid search query combining text search with regex for partial matching
   * @param {string} query - Search query
   * @param {Array} searchFields - Fields to search in for regex fallback
   * @returns {Object} MongoDB search query with text + regex hybrid approach
   */
  buildTextSearchQuery(query, searchFields) {
    if (!query || !query.trim()) {
      return {};
    }

    const cleanQuery = query.trim();
    
    // HYBRID APPROACH: Combine text search with regex for comprehensive results
    // Text search for exact word matches (fast, scored)
    // Regex search for partial word matches (comprehensive coverage)
    
    const textSearch = { $text: { $search: cleanQuery } };
    
    // Build regex conditions for partial matching on key fields
    const regexConditions = [];
    
    if (searchFields && searchFields.length > 0) {
      searchFields.forEach(field => {
        regexConditions.push({
          [field]: { $regex: cleanQuery, $options: 'i' }
        });
      });
    }
    
    // Return hybrid query: text search OR regex search
    if (regexConditions.length > 0) {
      return {
        $or: [
          textSearch,
          { $or: regexConditions }
        ]
      };
    }
    // Fallback to text search only
    return textSearch;
  }

  /**
   * Enhanced card number search with intelligent sorting
   * @param {string} query - Search query
   * @param {Array} results - Search results to enhance
   * @returns {Array} Enhanced and sorted results
   */
  enhanceCardNumberSearch(query, results) {
    // If searching for number, prioritize and sort intelligently
    if (/^\d+$/.test(query)) {
      return results.sort((a, b) => {
        const aNum = parseInt(a.cardNumber, 10);
        const bNum = parseInt(b.cardNumber, 10);
        
        // Numeric cards first (1, 2, 3...), then alphanumeric (012/P, SP1...)
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        if (!isNaN(aNum)) return -1;  // Numeric before alphanumeric
        if (!isNaN(bNum)) return 1;
        return a.cardNumber.localeCompare(b.cardNumber);
      });
    }
    
    // For text searches, sort by text score first, then PSA population, then card number
    return results.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      if (a.grades?.grade_total !== b.grades?.grade_total) {
        return (b.grades?.grade_total || 0) - (a.grades?.grade_total || 0);
      }
      return this.compareCardNumbers(a.cardNumber, b.cardNumber);
    });
  }

  /**
   * Compare card numbers intelligently (numeric before alphanumeric)
   * @param {string} a - First card number
   * @param {string} b - Second card number
   * @returns {number} Comparison result
   */
  compareCardNumbers(a, b) {
    
    const aNum = parseInt(a, 10);
    const bNum = parseInt(b, 10);
    
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (!isNaN(aNum)) return -1;
    if (!isNaN(bNum)) return 1;
    return a.localeCompare(b);
  }

  /**
   * Generic search method using MongoDB text indexes (OPTIMIZED)
   * @param {Model} Model - Mongoose model to search
   * @param {string} query - Search query
   * @param {Array} searchFields - Fields to search in (ignored for text search)
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options (limit, page, sort)
   * @returns {Promise<Array>} Search results with text scores
   */
  async search(Model, query, searchFields, filters = {}, options = {}) {
    const { 
      limit = 50, 
      page = 1, 
      sort = { score: { $meta: 'textScore' } },
      populate = null
    } = options;

    // Build search query using text indexes
    const searchQuery = this.buildTextSearchQuery(query, searchFields);
    
    // Combine with filters
    const finalQuery = {
      ...searchQuery,
      ...filters
    };

    // Calculate pagination
    const skip = (page - 1) * limit;

    // For text search queries, include text score
    const projection = searchQuery.$text ? { score: { $meta: 'textScore' } } : {};

    // Execute query with text score sorting
    let queryBuilder = Model.find(finalQuery, projection)
      .sort(searchQuery.$text ? { score: { $meta: 'textScore' } } : sort)
      .limit(limit)
      .skip(skip)
      .lean(); // 30% faster serialization

    // Add population if specified
    if (populate) {
      queryBuilder = queryBuilder.populate(populate);
    }

    return await queryBuilder.exec();
  }

  /**
   * Search cards using FlexSearch with MongoDB fallback - FAST partial matching
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Card search results with intelligent sorting
   */
  async searchCards(query, filters = {}, options = {}) {
    const { limit = 50 } = options;
    
    // AUTO-TRIGGER FEATURE: If no query but filters exist, show filtered results
    if ((!query || !query.trim()) && Object.keys(filters).length === 0) {
      return [];
    }
    
    // Handle empty query or wildcard "*" with filters - show all matching filter criteria
    if (!query || !query.trim() || query.trim() === '*') {
      console.log(`[MONGODB DIRECT] Searching cards with filters only:`, filters);
      
      const results = await Card.find(filters)
        .populate({
          path: 'setId',
          select: 'setName year totalCardsInSet totalPsaPopulation'
        })
        .lean()
        .limit(limit)
        .sort({ 'grades.grade_total': -1, cardName: 1 });

      return results.map((card) => {
        card.setDisplayName = card.setId?.setName || 'Unknown Set';
        card.fallbackSetName = !card.setId?.setName;
        return card;
      });
    }

    try {
      // Try FlexSearch first for INSTANT partial matching
      await this.initializeIndexes();
      
      console.log(`[FLEXSEARCH] Searching cards for: "${query}" with filters:`, filters);
      
      // OPTIMIZED SEARCH: Multiple search strategies for better partial matching
      let searchResults = [];
      
      // Strategy 1: Exact phrase search
      const exactResults = this.cardIndex.search(query.trim(), {
        limit: limit * 3,
        enrich: true,
        suggest: true
      });
      
      // Strategy 2: Individual word search for partial matches
      const words = query.trim().split(/\s+/).filter(word => word.length > 0);
      const wordResults = [];

      words.forEach(word => {
        if (word.length >= 1) {
          const results = this.cardIndex.search(word, {
            limit: limit * 2,
            enrich: true,
            suggest: true
          });

          wordResults.push(...results);
        }
      });
      
      // Combine and deduplicate results
      const allResults = [...exactResults, ...wordResults];
      const seenIds = new Set();

      searchResults = allResults.filter(result => {
        // FIXED: Handle different FlexSearch result structures safely
        const resultArray = Array.isArray(result.result) ? result.result : 
                           Array.isArray(result) ? result : 
                           result.result ? [result.result] : [];
        
        if (resultArray.length === 0) return false;
        
        const hasNew = resultArray.some(id => !seenIds.has(id));
        resultArray.forEach(id => seenIds.add(id));
        return hasNew;
      });

      // Extract document IDs from FlexSearch results
      const cardIds = [];

      searchResults.forEach(result => {
        // FIXED: Handle different FlexSearch result structures safely
        const resultArray = Array.isArray(result.result) ? result.result : 
                           Array.isArray(result) ? result : 
                           result.result ? [result.result] : [];
        
        resultArray.forEach(id => {
          if (!cardIds.includes(id)) {
            cardIds.push(id);
          }
        });
      });

      if (cardIds.length > 0) {
        // SMART FILTERING: Apply both FlexSearch results AND filters
        console.log(`[FLEXSEARCH] Found ${cardIds.length} FlexSearch matches, now applying filters:`, filters);
        const cards = await Card.find({
          _id: { $in: cardIds },
          ...filters
        })
        .populate({
          path: 'setId',
          select: 'setName year totalCardsInSet totalPsaPopulation'
        })
        .lean()
        .limit(limit);

        // Order results by FlexSearch relevance
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
    } catch (error) {
      console.error('[FLEXSEARCH] Cards search failed, falling back to MongoDB:', error);
    }

    // MongoDB fallback
    console.log(`[MONGODB FALLBACK] Searching cards for: "${query}"`);
    const searchFields = ['cardName', 'cardNumber', 'variety'];
    const defaultSort = { score: { $meta: 'textScore' }, 'grades.grade_total': -1 };
    
    const results = await this.search(
      Card, 
      query, 
      searchFields, 
      filters, 
      { 
        ...options, 
        sort: options.sort || defaultSort,
        populate: {
          path: 'setId',
          select: 'setName year totalCardsInSet totalPsaPopulation'
        }
      }
    );

    return results.map((card) => {
      const cardObj = card.toObject ? card.toObject() : card;

      cardObj.setDisplayName = cardObj.setId?.setName || 'Unknown Set';
      cardObj.fallbackSetName = !cardObj.setId?.setName;
      return cardObj;
    });
  }

  /**
   * Search products using FlexSearch with MongoDB fallback - FAST partial matching
   * Supports hierarchical search:
   * 1. Set selected first -> Show only products from that set
   * 2. Product selected first -> Return product with set info
   * @param {string} query - Search query or '*' for all
   * @param {Object} filters - Additional filters including setName for hierarchical
   * @param {Object} options - Search options
   * @returns {Promise<{results: Array, total: number, page: number, totalPages: number}>} Product search results with pagination
   */
  async searchProducts(query, filters = {}, options = {}) {
    const { limit = 50 } = options;
    
    // AUTO-TRIGGER FEATURE: If no query but filters exist, show filtered results
    if ((!query || !query.trim()) && Object.keys(filters).length === 0) {
      return [];
    }
    
    // Handle empty query or wildcard "*" with filters - show all matching filter criteria
    if (!query || !query.trim() || query.trim() === '*') {
      console.log(`[MONGODB DIRECT] Searching products with filters only:`, filters);
      
      // First get total count with filters
      const totalCount = await Product.countDocuments(filters);
      
      // Then get paginated results
      const results = await Product.find(filters)
        .populate('setProductId', 'setProductName')
        .lean()
        .limit(limit)
        .sort({ available: -1, price: 1, _id: 1 });

      // Return products with pagination metadata
      return {
        results,
        total: totalCount,
        page: options.page || 1,
        totalPages: Math.ceil(totalCount / limit),
        count: results.length
      };
    }

    try {
      // Try FlexSearch first for INSTANT partial matching
      await this.initializeIndexes();
      
      console.log(`[FLEXSEARCH] Searching products for: "${query}" with filters:`, filters);
      
      // OPTIMIZED SEARCH: Multiple search strategies for better partial matching
      let searchResults = [];
      
      // Strategy 1: Exact phrase search
      const exactResults = this.productIndex.search(query.trim(), {
        limit: limit * 3,
        enrich: true,
        suggest: true
      });
      
      // Strategy 2: Individual word search for partial matches
      const words = query.trim().split(/\s+/).filter(word => word.length > 0);
      const wordResults = [];

      words.forEach(word => {
        if (word.length >= 1) {
          const results = this.productIndex.search(word, {
            limit: limit * 2,
            enrich: true,
            suggest: true
          });

          wordResults.push(...results);
        }
      });
      
      // Combine and deduplicate results
      const allResults = [...exactResults, ...wordResults];
      const seenIds = new Set();

      searchResults = allResults.filter(result => {
        // FIXED: Handle different FlexSearch result structures safely
        const resultArray = Array.isArray(result.result) ? result.result : 
                           Array.isArray(result) ? result : 
                           result.result ? [result.result] : [];
        
        if (resultArray.length === 0) return false;
        
        const hasNew = resultArray.some(id => !seenIds.has(id));
        resultArray.forEach(id => seenIds.add(id));
        return hasNew;
      });

      // Extract document IDs
      const productIds = [];

      searchResults.forEach(result => {
        // FIXED: Handle different FlexSearch result structures safely
        const resultArray = Array.isArray(result.result) ? result.result : 
                           Array.isArray(result) ? result : 
                           result.result ? [result.result] : [];
        
        resultArray.forEach(id => {
          if (!productIds.includes(id)) {
            productIds.push(id);
          }
        });
      });

      if (productIds.length > 0) {
        // Get total count first
        const totalCount = await Product.countDocuments({
          _id: { $in: productIds },
          ...filters
        });

        // SMART FILTERING: Apply both FlexSearch results AND filters
        console.log(`[FLEXSEARCH] Found ${productIds.length} FlexSearch matches, now applying filters:`, filters);
        const products = await Product.find({
          _id: { $in: productIds },
          ...filters
        })
        .populate('setProductId', 'setProductName')
        .lean()
        .limit(limit);

        // Order results by FlexSearch relevance
        const orderedResults = [];

        productIds.forEach(id => {
          const product = products.find(p => p._id.toString() === id);
          
          if (product && orderedResults.length < limit) {
            orderedResults.push(product);
          }
        });

        console.log(`[FLEXSEARCH] Products search "${query}" returned ${orderedResults.length} results`);
        
        // Return consistent format with metadata for FlexSearch results
        return {
          results: orderedResults,
          total: totalCount,
          page: options.page || 1,
          totalPages: Math.ceil(totalCount / (options.limit || 50))
        };
      }
    } catch (error) {
      console.error('[FLEXSEARCH] Products search failed, falling back to MongoDB:', error);
    }

    // MongoDB fallback
    console.log(`[MONGODB FALLBACK] Searching products for: "${query}"`);
    const searchFields = ['productName', 'category'];
    const defaultSort = { available: -1, price: 1, _id: 1 };
    
    // First get total count with filters
    const totalCount = await Product.countDocuments({
      ...this.buildTextSearchQuery(query, searchFields),
      ...filters
    });

    // Then get paginated results
    const results = await this.search(
      Product, 
      query, 
      searchFields, 
      filters, 
      { 
        ...options, 
        sort: options.sort || defaultSort,
        populate: { path: 'setProductId', select: 'setProductName' }
      }
    );

    return {
      results,
      total: totalCount,
      page: options.page || 1,
      totalPages: Math.ceil(totalCount / options.limit || 20)
    };
  }

  /**
   * Search sets using FlexSearch with MongoDB fallback
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Set search results
   */
  async searchSets(query, filters = {}, options = {}) {
    const { limit = 50 } = options;
    
    // AUTO-TRIGGER FEATURE: If no query but filters exist, show filtered results
    if ((!query || !query.trim()) && Object.keys(filters).length === 0) {
      return [];
    }
    
    // Handle empty query or wildcard "*" with filters - show all matching filter criteria
    if (!query || !query.trim() || query.trim() === '*') {
      console.log(`[MONGODB DIRECT] Searching sets with filters only:`, filters);
      
      const results = await Set.find(filters)
        .lean()
        .limit(limit)
        .sort({ year: -1, 'total_grades.total_graded': -1, _id: 1 });

      return results;
    }

    try {
      // Try FlexSearch first for INSTANT partial matching
      await this.initializeIndexes();
      
      console.log(`[FLEXSEARCH] Searching sets for: "${query}"`);
      const searchResults = this.setIndex.search(query.trim(), {
        limit: limit * 2,
        enrich: true
      });

      // Extract document IDs
      const setIds = [];

      searchResults.forEach(result => {
        // FIXED: Handle different FlexSearch result structures safely
        const resultArray = Array.isArray(result.result) ? result.result : 
                           Array.isArray(result) ? result : 
                           result.result ? [result.result] : [];
        
        resultArray.forEach(id => {
          if (!setIds.includes(id)) {
            setIds.push(id);
          }
        });
      });

      if (setIds.length > 0) {
        // Fetch actual set documents
        const sets = await Set.find({
          _id: { $in: setIds },
          ...filters
        })
        .lean()
        .limit(limit);

        // Order results by FlexSearch relevance
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
    } catch (error) {
      console.error('[FLEXSEARCH] Sets search failed, falling back to MongoDB:', error);
    }

    // MongoDB fallback
    console.log(`[MONGODB FALLBACK] Searching sets for: "${query}"`);
    const searchFields = ['setName'];
    const defaultSort = { year: -1, 'total_grades.total_graded': -1, _id: 1 };
    
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
   * Search SetProducts using direct MongoDB search
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} SetProduct search results
   */
  async searchSetProducts(query, filters = {}, options = {}) {
    const { limit = 50 } = options;
    
    // Handle empty query or wildcard "*" with filters
    if (!query || !query.trim() || query.trim() === '*') {
      console.log(`[MONGODB DIRECT] Searching setProducts with filters only:`, filters);
      
      const results = await SetProduct.find(filters)
        .lean()
        .limit(limit)
        .sort({ setProductName: 1 });

      return results;
    }

    try {
      console.log(`[MONGODB] Searching setProducts for: "${query}" with filters:`, filters);
      
      // Use MongoDB text search with regex fallback
      const searchRegex = new RegExp(query.trim(), 'i');
      
      const results = await SetProduct.find({
        setProductName: searchRegex,
        ...filters
      })
      .lean()
      .limit(limit)
      .sort({ setProductName: 1 });

      return results;
    } catch (error) {
      console.error('[SETPRODUCT SEARCH ERROR]', error);
      return [];
    }
  }

  /**
   * Unified search across all models
   * @param {string} query - Search query
   * @param {Array} types - Types to search ['cards', 'products', 'sets', 'setProducts']
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Unified search results
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
          secondaryText: card.variety || null,
          metadata: {
            cardNumber: card.cardNumber,
            variety: card.variety,
            uniquePokemonId: card.uniquePokemonId,
            uniqueSetId: card.uniqueSetId,
            setName: card.setDisplayName || card.setId?.setName || 'Unknown Set',
            year: card.setId?.year,
            fallbackSetName: card.fallbackSetName || false,
            grades: card.grades
          }
        }));
        break;

      case 'products':
        const response = await this.searchProducts(query, {}, { limit });
        const products = Array.isArray(response) ? response : response.results || [];

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
    }

    return results;
  }
}

module.exports = new SearchService();