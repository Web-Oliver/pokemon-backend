import { asyncHandler, ValidationError } from '@/Presentation/Middleware/errorHandler.js';
import mongoose from 'mongoose';
/**
 * Related Items Controller
 *
 * Handles relationship-based search and recommendations
 * Single Responsibility: Manages related item discovery and recommendations
 */

/**
 * Get related cards in the same set
 * Implements bidirectional card relationships
 */
const getRelatedCards = asyncHandler(async (req, res) => {
  const { cardId } = req.params;
  const { limit = 10 } = req.query;

  if (!cardId) {
    throw new ValidationError('Card ID is required');
  }

  const Card = (await import('@/Domain/Entities/Card.js')).default;
  const Set = (await import('@/Domain/Entities/Set.js')).default;
  // 1. Get the card with its set information
  const card = await Card.findById(cardId).populate('setId', 'setName year totalCardsInSet');

  if (!card) {
    return res.status(404).json({
      success: false,
      message: 'Card not found'
    });
  }

  // 2. Find all other cards in the same set
  const relatedCards = await Card.find({
    setId: card.setId._id,
    _id: { $ne: cardId } // Exclude the original card
  })
  .populate('setId', 'setName year')
  .limit(parseInt(limit, 10))
  .select('cardName cardNumber rarity imageUrl price sold dateAdded setId')
  .sort({ cardNumber: 1 }); // Sort by card number for logical ordering

  res.status(200).json({
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
  });
});

/**
 * Get related products by category or set
 */
const getRelatedProducts = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { limit = 10, type = 'set' } = req.query;

  if (!productId) {
    throw new ValidationError('Product ID is required');
  }

  const Product = (await import('@/Domain/Entities/Product.js')).default;
  // Get the original product
  const product = await Product.findById(productId)
    .populate('setProductId', 'name category');

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
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
    const SetProduct = (await import('@/Domain/Entities/SetProduct.js')).default;
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

  res.status(200).json({
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
  });
});

/**
 * Get recommended items based on user preferences or similar characteristics
 */
const getRecommendations = asyncHandler(async (req, res) => {
  const { itemId, itemType = 'card', limit = 10 } = req.query;

  if (!itemId) {
    throw new ValidationError('Item ID is required for recommendations');
  }

  let recommendations = [];
  const recommendationLimit = parseInt(limit, 10);

  if (itemType === 'card') {
    const Card = (await import('@/Domain/Entities/Card.js')).default;
    // Get the base card
    const baseCard = await Card.findById(itemId).populate('setId');

    if (!baseCard) {
      throw new ValidationError('Card not found');
    }

    // Strategy: Find cards from similar sets (same year, similar rarity)
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
          rarity: baseCard.rarity
        }
      },
      {
        $sample: { size: recommendationLimit }
      },
      {
        $project: {
          cardName: 1,
          cardNumber: 1,
          rarity: 1,
          price: 1,
          imageUrl: 1,
          setId: 1
        }
      }
    ]);

    recommendations = similarCards;
  }

  res.status(200).json({
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
  });
});

/**
 * Get trending or popular items
 */
const getTrending = asyncHandler(async (req, res) => {
  const { type = 'cards', period = 'week', limit = 20 } = req.query;

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
    const Card = (await import('@/Domain/Entities/Card.js')).default;
    // Strategy: Most recently added cards with high prices (indicating demand)
    trendingItems = await Card.find({
      dateAdded: { $gte: startDate },
      price: { $exists: true, $gt: 0 }
    })
    .populate('setId', 'setName year')
    .sort({ price: -1, dateAdded: -1 })
    .limit(trendingLimit)
    .select('cardName cardNumber rarity price imageUrl setId dateAdded');
  } else if (type === 'products') {
    const Product = (await import('@/Domain/Entities/Product.js')).default;
    trendingItems = await Product.find({
      dateAdded: { $gte: startDate },
      price: { $exists: true, $gt: 0 }
    })
    .populate('setProductId', 'name category')
    .sort({ price: -1, dateAdded: -1 })
    .limit(trendingLimit)
    .select('name price available imageUrl setProductId dateAdded');
  }

  res.status(200).json({
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
  });
});

export {
  getRelatedCards,
  getRelatedProducts,
  getRecommendations,
  getTrending
};
export default getRelatedCards;;
