import BaseRepository from '@/system/database/BaseRepository.js';

/**
 * Collection Repository Factory
 *
 * Creates repository instances for collection models with shared configuration
 */
class CollectionRepository extends BaseRepository {
    constructor(Model, entityType, options = {}) {
        const config = {
            entityName: entityType,
            defaultSort: {dateAdded: -1},
            ...options
        };

        // Add default populate for card-based collections
        if (entityType === 'PsaGradedCard' || entityType === 'RawCard') {
            config.defaultPopulate = {
                path: 'cardId',
                populate: {
                    path: 'setId',
                    model: 'Set'
                }
            };
        }

        // Add specific populate for sealed products
        if (entityType === 'SealedProduct') {
            config.defaultPopulate = 'productId';
            config.defaultSort = {available: -1, price: 1};
        }

        super(Model, config);
        this.entityType = entityType;
    }

    /**
     * Find sold items
     */
    async findSold(options = {}) {
        return await this.find({sold: true}, options);
    }

    /**
     * Find unsold items
     */
    async findUnsold(options = {}) {
        return await this.find({sold: {$ne: true}}, options);
    }

    /**
     * Search items by text (card name, set name, etc.)
     */
    async searchByText(searchTerm, options = {}) {
        let searchFields = [];

        switch (this.entityType) {
            case 'PsaGradedCard':
            case 'RawCard':
                searchFields = ['cardId.cardName', 'cardId.variety', 'cardId.cardNumber'];
                break;
            case 'SealedProduct':
                searchFields = ['name', 'category', 'setName'];
                break;
            default:
                searchFields = [];
        }

        const searchQuery = {
            $or: searchFields.map(field => ({
                [field]: {$regex: searchTerm, $options: 'i'}
            }))
        };

        return await this.find(searchQuery, options);
    }

    /**
     * Find by category (Sealed products only)
     */
    async findByCategory(category, options = {}) {
        if (this.entityType !== 'SealedProduct') {
            throw new Error('Category filtering only available for sealed products');
        }
        return await this.find({category}, options);
    }
}

export default CollectionRepository;
