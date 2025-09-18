import { asyncHandler, NotFoundError, ValidationError } from '@/system/middleware/CentralizedErrorHandler.js';
import mongoose from 'mongoose';
import BaseController from '@/system/middleware/BaseController.js';
import Logger from '@/system/logging/Logger.js';

/**
 * Related Items Controller
 *
 * Handles relationship-based search and recommendations using BaseController pattern
 * Single Responsibility: Manages related item discovery and recommendations
 *
 * Features:
 * - Related cards in the same set
 * - Related products by category or set
 * - AI-powered recommendations
 * - Trending/popular items analysis
 */
class RelatedItemsController extends BaseController {
    /**
     * Get related cards in the same set
     * Implements bidirectional card relationships
     */
    getRelatedCards = asyncHandler(async (req, res) => {
        const operation = 'getRelatedCards';
        const context = { req, res, operation };
        const { cardId } = req.params;
        const { limit = 10 } = req.query;

        Logger.operationStart('RelatedItem', 'GET RELATED CARDS', {
            'Card ID': cardId,
            'Limit': limit
        });

        try {
            // Execute before operation hooks
            await this.executeHooks('beforeOperation', operation, { cardId, limit }, context);

            if (!cardId) {
                throw new ValidationError('Card ID is required');
            }

            const Card = (await import('@/pokemon/cards/Card.js')).default;

            // 1. Get the card with its set information
            const card = await Card.findById(cardId).populate('setId', 'setName year totalCardsInSet');

            if (!card) {
                throw new NotFoundError('Card not found');
            }

            // 2. Find all other cards in the same set
            const relatedCards = await Card.find({
                setId: card.setId._id,
                _id: { $ne: cardId } // Exclude the original card
            })
                .populate('setId', 'setName year')
                .limit(parseInt(limit, 10))
                .select('cardName cardNumber imageUrl price sold dateAdded setId')
                .sort({ cardNumber: 1 }); // Sort by card number for logical ordering

            const result = {
                success: true,
                data: {
                    card: {
                        _id: card._id,
                        cardName: card.cardName,
                        setName: card.setId.setName,
                        year: card.setId.year,
                        totalCardsInSet: card.setId.totalCardsInSet
                    },
                    relatedCards,
                    meta: {
                        totalRelated: relatedCards.length,
                        setName: card.setId.setName,
                        setYear: card.setId.year,
                        limit: parseInt(limit, 10)
                    }
                }
            };

            // Execute after operation hooks
            await this.executeHooks('afterOperation', operation, result, context);

            Logger.operationSuccess('RelatedItem', 'GET RELATED CARDS', {
                'Related cards found': relatedCards.length,
                'Set name': card.setId.setName
            });

            // Execute before response hooks
            const responseData = await this.executeHooks('beforeResponse', operation, result, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            await this.executeHooks('onError', operation, error, context);

            Logger.operationError('RelatedItem', 'GET RELATED CARDS', error, {
                'Card ID': cardId
            });
            throw error;
        }
    });
    /**
     * Get related products by category or set
     */
    getRelatedProducts = asyncHandler(async (req, res) => {
        const operation = 'getRelatedProducts';
        const context = { req, res, operation };
        const { productId } = req.params;
        const { limit = 10, type = 'set' } = req.query;

        Logger.operationStart('RelatedItem', 'GET RELATED PRODUCTS', {
            'Product ID': productId,
            'Type': type,
            'Limit': limit
        });

        try {
            // Execute before operation hooks
            await this.executeHooks('beforeOperation', operation, { productId, limit, type }, context);

            if (!productId) {
                throw new ValidationError('Product ID is required');
            }

            const Product = (await import('@/pokemon/products/Product.js')).default;

            // Get the original product
            const product = await Product.findById(productId)
                .populate('setProductId', 'name category');

            if (!product) {
                throw new NotFoundError('Product not found');
            }

            let relatedProducts = [];
            let relationshipType = type;

            if (type === 'set' && product.setProductId) {
                // Find products from the same set
                relatedProducts = await Product.find({
                    setProductId: product.setProductId._id,
                    _id: { $ne: productId }
                })
                    .populate('setProductId', 'name category')
                    .limit(parseInt(limit, 10))
                    .select('name price available imageUrl setProductId')
                    .sort({ name: 1 });
            } else if (type === 'category' && product.setProductId?.category) {
                // Find products in the same category
                const SetProduct = (await import('@/pokemon/products/SetProduct.js')).default;
                const categorySetProducts = await SetProduct.find({
                    category: product.setProductId.category
                }).select('_id');

                const setProductIds = categorySetProducts.map(sp => sp._id);

                relatedProducts = await Product.find({
                    setProductId: { $in: setProductIds },
                    _id: { $ne: productId }
                })
                    .populate('setProductId', 'name category')
                    .limit(parseInt(limit, 10))
                    .select('name price available imageUrl setProductId')
                    .sort({ name: 1 });

                relationshipType = 'category';
            }

            const result = {
                success: true,
                data: {
                    product: {
                        _id: product._id,
                        name: product.name,
                        setName: product.setProductId?.name,
                        category: product.setProductId?.category
                    },
                    relatedProducts,
                    meta: {
                        totalRelated: relatedProducts.length,
                        relationshipType,
                        limit: parseInt(limit, 10)
                    }
                }
            };

            // Execute after operation hooks
            await this.executeHooks('afterOperation', operation, result, context);

            Logger.operationSuccess('RelatedItem', 'GET RELATED PRODUCTS', {
                'Related products found': relatedProducts.length,
                'Relationship type': relationshipType
            });

            // Execute before response hooks
            const responseData = await this.executeHooks('beforeResponse', operation, result, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            await this.executeHooks('onError', operation, error, context);

            Logger.operationError('RelatedItem', 'GET RELATED PRODUCTS', error, {
                'Product ID': productId,
                'Type': type
            });
            throw error;
        }
    });
    /**
     * Get recommended items based on user preferences or similar characteristics
     */
    getRecommendations = asyncHandler(async (req, res) => {
        const operation = 'getRecommendations';
        const context = { req, res, operation };
        const { itemId, itemType = 'card', limit = 10 } = req.query;

        Logger.operationStart('RelatedItem', 'GET RECOMMENDATIONS', {
            'Item ID': itemId,
            'Item Type': itemType,
            'Limit': limit
        });

        try {
            // Execute before operation hooks
            await this.executeHooks('beforeOperation', operation, { itemId, itemType, limit }, context);

            if (!itemId) {
                throw new ValidationError('Item ID is required for recommendations');
            }

            let recommendations = [];
            const recommendationLimit = parseInt(limit, 10);

            if (itemType === 'card') {
                const Card = (await import('@/pokemon/cards/Card.js')).default;

                // Get the base card
                const baseCard = await Card.findById(itemId).populate('setId');

                if (!baseCard) {
                    throw new ValidationError('Card not found');
                }

                // Strategy: Find cards from similar sets (same year)
                const similarCards = await Card.aggregate([
                    {
                        $lookup: {
                            from: 'sets',
                            localField: 'setId',
                            foreignField: '_id',
                            as: 'set'
                        }
                    },
                    {
                        $match: {
                            _id: { $ne: new mongoose.Types.ObjectId(itemId) },
                            'set.year': baseCard.setId.year,
                            variety: baseCard.variety
                        }
                    },
                    {
                        $sample: { size: recommendationLimit }
                    },
                    {
                        $project: {
                            cardName: 1,
                            cardNumber: 1,
                            variety: 1,
                            price: 1,
                            imageUrl: 1,
                            setId: 1
                        }
                    }
                ]);

                recommendations = similarCards;
            }

            const result = {
                success: true,
                data: {
                    recommendations,
                    meta: {
                        itemId,
                        itemType,
                        totalRecommendations: recommendations.length,
                        strategy: 'similarity-based',
                        limit: recommendationLimit
                    }
                }
            };

            // Execute after operation hooks
            await this.executeHooks('afterOperation', operation, result, context);

            Logger.operationSuccess('RelatedItem', 'GET RECOMMENDATIONS', {
                'Recommendations found': recommendations.length,
                'Item type': itemType,
                'Strategy': 'similarity-based'
            });

            // Execute before response hooks
            const responseData = await this.executeHooks('beforeResponse', operation, result, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            await this.executeHooks('onError', operation, error, context);

            Logger.operationError('RelatedItem', 'GET RECOMMENDATIONS', error, {
                'Item ID': itemId,
                'Item Type': itemType
            });
            throw error;
        }
    });
    /**
     * Get trending or popular items
     */
    getTrending = asyncHandler(async (req, res) => {
        const operation = 'getTrending';
        const context = { req, res, operation };
        const { type = 'cards', period = 'week', limit = 20 } = req.query;

        Logger.operationStart('RelatedItem', 'GET TRENDING', {
            'Type': type,
            'Period': period,
            'Limit': limit
        });

        try {
            // Execute before operation hooks
            await this.executeHooks('beforeOperation', operation, { type, period, limit }, context);

            const trendingLimit = parseInt(limit, 10);
            const now = new Date();
            let startDate;

            // Calculate date range based on period
            switch (period) {
                case 'day':
                    startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            }

            let trendingItems = [];

            if (type === 'cards') {
                const Card = (await import('@/pokemon/cards/Card.js')).default;

                // Strategy: Most recently added cards with high prices (indicating demand)
                trendingItems = await Card.find({
                    dateAdded: { $gte: startDate },
                    price: { $exists: true, $gt: 0 }
                })
                    .populate('setId', 'setName year')
                    .sort({ price: -1, dateAdded: -1 })
                    .limit(trendingLimit)
                    .select('cardName cardNumber price imageUrl setId dateAdded');
            } else if (type === 'products') {
                const Product = (await import('@/pokemon/products/Product.js')).default;

                trendingItems = await Product.find({
                    dateAdded: { $gte: startDate },
                    price: { $exists: true, $gt: 0 }
                })
                    .populate('setProductId', 'name category')
                    .sort({ price: -1, dateAdded: -1 })
                    .limit(trendingLimit)
                    .select('name price available imageUrl setProductId dateAdded');
            }

            const result = {
                success: true,
                data: {
                    trending: trendingItems,
                    meta: {
                        type,
                        period,
                        totalTrending: trendingItems.length,
                        dateRange: {
                            from: startDate,
                            to: now
                        },
                        limit: trendingLimit
                    }
                }
            };

            // Execute after operation hooks
            await this.executeHooks('afterOperation', operation, result, context);

            Logger.operationSuccess('RelatedItem', 'GET TRENDING', {
                'Trending items found': trendingItems.length,
                'Type': type,
                'Period': period
            });

            // Execute before response hooks
            const responseData = await this.executeHooks('beforeResponse', operation, result, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            await this.executeHooks('onError', operation, error, context);

            Logger.operationError('RelatedItem', 'GET TRENDING', error, {
                'Type': type,
                'Period': period
            });
            throw error;
        }
    });
    // Get controller metrics
    getControllerMetrics = asyncHandler(async (req, res) => {
        const metrics = this.getMetrics();

        res.status(200).json({
            success: true,
            data: metrics
        });
    });

    constructor() {
        super('cardService', {
            entityName: 'RelatedItem',
            pluralName: 'relatedItems',
            includeMarkAsSold: false,
            enableCaching: true,
            enableMetrics: true,
            filterableFields: ['setId', 'category', 'type']
        });
    }
}

// Lazy loading pattern - controller instance created only when needed
let relatedItemsController = null;

// Lazy controller getter
const getController = () => {
    if (!relatedItemsController) {
        relatedItemsController = new RelatedItemsController();
    }
    return relatedItemsController;
};

// Export individual methods with lazy loading
export const getRelatedCards = (...args) => getController().getRelatedCards(...args);
export const getRelatedProducts = (...args) => getController().getRelatedProducts(...args);
export const getRecommendations = (...args) => getController().getRecommendations(...args);
export const getTrending = (...args) => getController().getTrending(...args);
export const getControllerMetrics = (...args) => getController().getControllerMetrics(...args);

// Export aliases for different naming conventions
export const getRelatedCardsById = getRelatedCards;
export const getRelatedProductsById = getRelatedProducts;
export const getItemRecommendations = getRecommendations;
export const getTrendingItems = getTrending;
export const getRelatedItemsMetrics = getControllerMetrics;

// Export the controller instance accessor as default
export default () => getController();
