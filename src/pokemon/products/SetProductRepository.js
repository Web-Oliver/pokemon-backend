import SearchableRepository from '@/system/database/SearchableRepository.js';
import SetProduct from '@/pokemon/products/SetProduct.js';

/**
 * SetProduct Repository
 *
 * Specialized repository for SetProduct model operations.
 * Extends SearchableRepository with unified search functionality.
 * Handles product expansion/set data (like "Prismatic Evolutions").
 *
 * REFACTORED: Now uses unified search abstraction, enabling advanced search patterns.
 */
class SetProductRepository extends SearchableRepository {
    /**
     * Creates a new SetProduct repository instance
     */
    constructor() {
        super(SetProduct, {
            entityType: 'setProducts', // Use search configuration key
            defaultSort: { setProductName: 1 }
        });
    }

    /**
     * Finds set by product name
     * @param {string} setProductName - Set product name to search
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} - Set product or null
     */
    async findBySetProductName(setProductName, options = {}) {
        try {
            return await this.findOne(
                {
                    setProductName: new RegExp(`^${setProductName}$`, 'i')
                },
                options
            );
        } catch (error) {
            throw error;
        }
    }

    /**
     * Finds set by unique set product ID
     * @param {number} uniqueSetProductId - Unique set product ID
     * @param {Object} options - Query options
     * @returns {Promise<Object|null>} - Set product or null
     */
    async findByUniqueSetProductId(uniqueSetProductId, options = {}) {
        try {
            return await this.findOne(
                {
                    uniqueSetProductId
                },
                options
            );
        } catch (error) {
            throw error;
        }
    }

    // search method now inherited from SearchableRepository
    // Eliminates duplicated regex search logic
    // All original functionality preserved through search configuration

    // getSuggestions method now inherited from SearchableRepository
    // Eliminates duplicated suggestion formatting logic
    // All original functionality preserved through search configuration
}

export default SetProductRepository;
