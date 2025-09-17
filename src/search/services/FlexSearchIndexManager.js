/**
 * FlexSearch Index Manager Service
 *
 * Single Responsibility: FlexSearch index initialization and management
 * Handles creation, configuration, and population of FlexSearch indexes
 * Extracted from SearchService to follow SRP and improve maintainability
 */

import Card from '@/pokemon/cards/Card.js';
import PokemonSet from '@/pokemon/sets/Set.js';
import Product from '@/pokemon/products/Product.js';
import FlexSearch from 'flexsearch';
import Logger from '@/system/logging/Logger.js';

class FlexSearchIndexManager {
    constructor() {
        this.cardIndex = null;
        this.productIndex = null;
        this.setIndex = null;
        this.initialized = false;
        this.initPromise = null;
    }

    /**
     * Get or create card index with optimized configuration
     */
    getCardIndex() {
        if (!this.cardIndex) {
            this.cardIndex = new FlexSearch.Document({
                id: '_id',
                index: [
                    {
                        field: 'cardName',
                        tokenize: 'forward',
                        resolution: 9,
                        minlength: 1,
                        optimize: true,
                        fastupdate: false
                    },
                    {
                        field: 'cardNumber',
                        tokenize: 'strict',
                        minlength: 1
                    },
                    {
                        field: 'variety',
                        tokenize: 'forward',
                        minlength: 1,
                        optimize: true
                    },
                    {
                        field: 'setName',
                        tokenize: 'forward',
                        minlength: 1,
                        optimize: true
                    }
                ]
            });
        }
        return this.cardIndex;
    }

    /**
     * Get or create product index with optimized configuration
     */
    getProductIndex() {
        if (!this.productIndex) {
            this.productIndex = new FlexSearch.Document({
                id: '_id',
                index: [
                    {
                        field: 'productName',
                        tokenize: 'forward',
                        resolution: 9,
                        minlength: 1,
                        optimize: true,
                        fastupdate: false
                    },
                    {
                        field: 'category',
                        tokenize: 'forward',
                        minlength: 1,
                        optimize: true
                    },
                    {
                        field: 'setProductName',
                        tokenize: 'forward',
                        minlength: 1,
                        optimize: true
                    }
                ]
            });
        }
        return this.productIndex;
    }

    /**
     * Get or create set index with optimized configuration
     */
    getSetIndex() {
        if (!this.setIndex) {
            this.setIndex = new FlexSearch.Document({
                id: '_id',
                index: [{
                    field: 'setName',
                    tokenize: 'forward',
                    resolution: 9,
                    minlength: 1,
                    optimize: true,
                    fastupdate: false
                }]
            });
        }
        return this.setIndex;
    }

    /**
     * Initialize all FlexSearch indexes with database data
     */
    async initializeIndexes() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this._doInitialize();
        return this.initPromise;
    }

    /**
     * Force re-initialization of indexes (useful for testing or data updates)
     */
    async reinitializeIndexes() {
        this.initialized = false;
        this.initPromise = null;
        this.cardIndex = null;
        this.productIndex = null;
        this.setIndex = null;

        return this.initializeIndexes();
    }

    /**
     * Internal initialization method
     * @private
     */
    async _doInitialize() {
        Logger.operationStart('FLEXSEARCH_INIT', 'Initializing FlexSearch indexes');
        const startTime = Date.now();

        try {
            // Initialize indexes
            const cardIndex = this.getCardIndex();
            const productIndex = this.getProductIndex();
            const setIndex = this.getSetIndex();

            // Index all cards with populated set data
            const cards = await Card.find({}).populate('setId').lean();

            Logger.operationStart('FLEXSEARCH_CARDS', `Indexing ${cards.length} cards`);

            cards.forEach(card => {
                cardIndex.add({
                    _id: card._id.toString(),
                    cardName: card.cardName || '',
                    cardNumber: card.cardNumber || '',
                    variety: card.variety || '',
                    setName: card.setId?.setName || ''
                });
            });

            // Index all products with populated SetProduct data
            const products = await Product.find({}).populate('setProductId', 'setProductName').lean();

            Logger.operationStart('FLEXSEARCH_PRODUCTS', `Indexing ${products.length} products`);

            products.forEach(product => {
                productIndex.add({
                    _id: product._id.toString(),
                    productName: product.productName || '',
                    category: product.category || '',
                    setProductName: product.setProductId?.setProductName || ''
                });
            });

            // Index all sets
            const sets = await PokemonSet.find({}).lean();

            Logger.operationStart('FLEXSEARCH_SETS', `Indexing ${sets.length} sets`);

            sets.forEach(set => {
                setIndex.add({
                    _id: set._id.toString(),
                    setName: set.setName || ''
                });
            });

            const initTime = Date.now() - startTime;

            this.initialized = true;

            Logger.operationSuccess('FLEXSEARCH_INIT', 'FlexSearch indexes initialized successfully', {
                cardsIndexed: cards.length,
                productsIndexed: products.length,
                setsIndexed: sets.length,
                initializationTime: `${initTime}ms`,
                totalDocuments: cards.length + products.length + sets.length
            });

        } catch (error) {
            Logger.operationError('FLEXSEARCH_INIT', 'Failed to initialize FlexSearch indexes', error);
            this.initialized = false;
            this.initPromise = null;
            throw error;
        }
    }

    /**
     * Add a single card to the card index
     */
    addCardToIndex(card) {
        if (!this.initialized) return;

        const cardIndex = this.getCardIndex();

        cardIndex.add({
            _id: card._id.toString(),
            cardName: card.cardName || '',
            cardNumber: card.cardNumber || '',
            variety: card.variety || '',
            setName: card.setName || card.setId?.setName || ''
        });
    }

    /**
     * Add a single product to the product index
     */
    addProductToIndex(product) {
        if (!this.initialized) return;

        const productIndex = this.getProductIndex();

        productIndex.add({
            _id: product._id.toString(),
            productName: product.productName || '',
            category: product.category || '',
            setProductName: product.setProductName || product.setProductId?.setProductName || ''
        });
    }

    /**
     * Add a single set to the set index
     */
    addSetToIndex(set) {
        if (!this.initialized) return;

        const setIndex = this.getSetIndex();

        setIndex.add({
            _id: set._id.toString(),
            setName: set.setName || ''
        });
    }

    /**
     * Remove item from card index
     */
    removeFromCardIndex(cardId) {
        if (!this.initialized) return;

        const cardIndex = this.getCardIndex();

        cardIndex.remove(cardId.toString());
    }

    /**
     * Remove item from product index
     */
    removeFromProductIndex(productId) {
        if (!this.initialized) return;

        const productIndex = this.getProductIndex();

        productIndex.remove(productId.toString());
    }

    /**
     * Remove item from set index
     */
    removeFromSetIndex(setId) {
        if (!this.initialized) return;

        const setIndex = this.getSetIndex();

        setIndex.remove(setId.toString());
    }

    /**
     * Get initialization status
     */
    isInitialized() {
        return this.initialized;
    }

    /**
     * Get index statistics
     */
    getIndexStats() {
        if (!this.initialized) {
            return {initialized: false, stats: null};
        }

        return {
            initialized: true,
            stats: {
                cardIndexExists: Boolean(this.cardIndex),
                productIndexExists: Boolean(this.productIndex),
                setIndexExists: Boolean(this.setIndex)
            }
        };
    }

    /**
     * Search across FlexSearch indexes
     * @param {string} entityType - Type of entity to search ('card', 'product', 'set')
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {Array} Array of matching document IDs
     */
    async search(entityType, query, options = {}) {
        if (!this.initialized) {
            await this.initializeIndexes();
        }

        if (!query || !query.trim()) {
            return [];
        }

        const {limit = 10} = options;

        try {
            let index;
            switch (entityType.toLowerCase()) {
                case 'card':
                    index = this.getCardIndex();
                    break;
                case 'product':
                    index = this.getProductIndex();
                    break;
                case 'set':
                    index = this.getSetIndex();
                    break;
                default:
                    Logger.error('FLEXSEARCH_SEARCH', `Unknown entity type: ${entityType}`);
                    return [];
            }

            if (!index) {
                Logger.error('FLEXSEARCH_SEARCH', `No index found for entity type: ${entityType}`);
                return [];
            }

            // Perform the search using FlexSearch
            const results = index.search(query.trim(), {limit});

            // FlexSearch returns results in format: [{ field: "fieldName", result: ["id1", "id2", ...] }, ...]
            // We need to extract all unique IDs from all fields
            const allIds = new Set();

            if (Array.isArray(results)) {
                results.forEach(fieldResult => {
                    if (fieldResult && Array.isArray(fieldResult.result)) {
                        fieldResult.result.forEach(id => allIds.add(id));
                    }
                });
            }

            const uniqueIds = Array.from(allIds).slice(0, limit);

            Logger.debug('FLEXSEARCH_SEARCH', `Found ${uniqueIds.length} results for "${query}" in ${entityType}`, {
                entityType,
                query,
                resultCount: uniqueIds.length,
                totalMatches: allIds.size
            });

            return uniqueIds;

        } catch (error) {
            Logger.error('FLEXSEARCH_SEARCH', `Search failed for ${entityType}`, {
                entityType,
                query,
                error: error.message,
                stack: error.stack
            });
            return [];
        }
    }
}

// Export singleton instance
export default new FlexSearchIndexManager();
