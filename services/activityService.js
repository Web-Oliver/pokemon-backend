/**
 * Activity Service
 * 
 * Practical activity tracking for collection operations.
 * Replaces 773-line over-engineered activity system with essential functionality.
 */

const { Activity, ACTIVITY_TYPES, ACTIVITY_PRIORITIES } = require('../models/Activity');

class ActivityService {
  /**
   * Convert price to number
   */
  static convertPrice(price) {
    if (!price) return null;
    if (typeof price === 'number') return price;
    if (price.$numberDecimal) return parseFloat(price.$numberDecimal);
    if (price.toString) return parseFloat(price.toString());
    return null;
  }

  /**
   * Create activity record
   */
  static async createActivity(activityData) {
    try {
      return await Activity.create(activityData);
    } catch (error) {
      console.error('[ACTIVITY SERVICE] Error creating activity:', error);
      return null;
    }
  }

  /**
   * Log card addition
   */
  static async logCardAdded(cardData, cardType) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';
    const setName = cardData.setName || cardData.cardId?.setId?.setName || 'Unknown Set';

    let title = `Added ${cardName}`;
    let description = `${setName} - Added to collection`;

    if (cardType === 'psa' && cardData.grade) {
      title = `Added PSA ${cardData.grade} ${cardName}`;
    } else if (cardType === 'raw' && cardData.condition) {
      description = `${setName} - ${cardData.condition} condition`;
    } else if (cardType === 'sealed' && cardData.category) {
      description = `${setName} - ${cardData.category} product`;
    }

    return this.createActivity({
      type: ACTIVITY_TYPES.CARD_ADDED,
      title,
      description,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: {
        cardName,
        setName,
        grade: cardData.grade,
        condition: cardData.condition,
        category: cardData.category,
        price: this.convertPrice(cardData.myPrice)
      }
    });
  }

  /**
   * Log card update
   */
  static async logCardUpdated(cardData, cardType, changes) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';
    const setName = cardData.setName || cardData.cardId?.setId?.setName || 'Unknown Set';

    return this.createActivity({
      type: ACTIVITY_TYPES.CARD_UPDATED,
      title: `Updated ${cardName}`,
      description: `${setName} - Collection item updated`,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: { cardName, setName, changes }
    });
  }

  /**
   * Log card deletion
   */
  static async logCardDeleted(cardData, cardType) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';
    const setName = cardData.setName || cardData.cardId?.setId?.setName || 'Unknown Set';

    return this.createActivity({
      type: ACTIVITY_TYPES.CARD_DELETED,
      title: `Removed ${cardName}`,
      description: `${setName} - Card removed from collection`,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: { cardName, setName }
    });
  }

  /**
   * Log price update
   */
  static async logPriceUpdate(cardData, cardType, oldPrice, newPrice) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';
    const priceChange = newPrice - oldPrice;
    const isIncrease = priceChange > 0;

    return this.createActivity({
      type: ACTIVITY_TYPES.PRICE_UPDATE,
      title: `Price ${isIncrease ? 'increased' : 'decreased'} for ${cardName}`,
      description: `Price changed from ${oldPrice} to ${newPrice}`,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: { cardName, oldPrice, newPrice, priceChange }
    });
  }

  /**
   * Log auction creation
   */
  static async logAuctionCreated(auctionData) {
    return this.createActivity({
      type: ACTIVITY_TYPES.AUCTION_CREATED,
      title: 'Created new auction',
      description: `Added ${auctionData.items?.length || 0} items`,
      entityType: 'auction',
      entityId: auctionData._id,
      metadata: {
        itemCount: auctionData.items?.length || 0,
        title: auctionData.topText
      }
    });
  }

  /**
   * Log sale completion
   */
  static async logSaleCompleted(cardData, cardType, saleDetails) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';

    return this.createActivity({
      type: ACTIVITY_TYPES.SALE_COMPLETED,
      title: `${cardName} sold`,
      description: `Sold via ${saleDetails.source || 'Direct Sale'}`,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: {
        cardName,
        salePrice: this.convertPrice(saleDetails.actualSoldPrice),
        source: saleDetails.source
      }
    });
  }

  /**
   * Get activities with filters
   */
  static async getActivities(options = {}) {
    const { limit = 50, offset = 0, type, entityType, entityId } = options;
    const query = {};

    if (type) query.type = type;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;

    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const total = await Activity.countDocuments(query);

    return {
      activities,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  /**
   * Get activity statistics
   */
  static async getActivityStats() {
    const total = await Activity.countDocuments();
    const recent = await Activity.findOne().sort({ timestamp: -1 }).lean();

    return {
      total,
      lastActivity: recent?.timestamp
    };
  }
}

module.exports = ActivityService;
