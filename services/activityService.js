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
   * Get activities with comprehensive filters
   */
  static async getActivities(options = {}) {
    const { 
      limit = 50, 
      offset = 0, 
      type, 
      entityType, 
      entityId, 
      priority, 
      dateRange, 
      search 
    } = options;
    
    const query = { status: 'active' };

    // Type filter
    if (type) query.type = type;
    
    // Entity filters
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    
    // Priority filter
    if (priority) query.priority = priority;

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const now = new Date();
      let startDate;

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          break;
      }

      if (startDate) {
        query.timestamp = { $gte: startDate };
      }
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { details: { $regex: search, $options: 'i' } },
        { 'metadata.cardName': { $regex: search, $options: 'i' } },
        { 'metadata.setName': { $regex: search, $options: 'i' } }
      ];
    }

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
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    const [total, todayCount, weekCount, monthCount, recent] = await Promise.all([
      Activity.countDocuments({ status: 'active' }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: today } }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: weekAgo } }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: monthAgo } }),
      Activity.findOne({ status: 'active' }).sort({ timestamp: -1 }).lean()
    ]);

    return {
      total,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      lastActivity: recent?.timestamp
    };
  }

  /**
   * Archive old activities
   */
  static async archiveOldActivities(daysOld = 90) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    return await Activity.updateMany(
      { 
        timestamp: { $lt: cutoffDate },
        status: 'active'
      },
      { 
        status: 'archived',
        isArchived: true,
        archivedAt: new Date()
      }
    );
  }

  /**
   * Generate historical activities for existing collection items
   */
  static async generateHistoricalActivities() {
    console.log('[ACTIVITY SERVICE] Starting historical activity generation...');
    
    try {
      const PsaGradedCard = require('../models/PsaGradedCard');
      const RawCard = require('../models/RawCard');
      const SealedProduct = require('../models/SealedProduct');
      const Auction = require('../models/Auction');

      let totalGenerated = 0;

      // Generate PSA card activities
      const psaCards = await PsaGradedCard.find().populate({
        path: 'cardId',
        populate: { path: 'setId' }
      }).lean();
      
      for (const card of psaCards) {
        await this.logCardAdded(card, 'psa');
        totalGenerated++;
      }

      // Generate Raw card activities
      const rawCards = await RawCard.find().populate({
        path: 'cardId',
        populate: { path: 'setId' }
      }).lean();
      
      for (const card of rawCards) {
        await this.logCardAdded(card, 'raw');
        totalGenerated++;
      }

      // Generate Sealed product activities
      const sealedProducts = await SealedProduct.find().populate('productId').lean();
      
      for (const product of sealedProducts) {
        await this.logCardAdded(product, 'sealed');
        totalGenerated++;
      }

      // Generate Auction activities
      const auctions = await Auction.find().lean();
      
      for (const auction of auctions) {
        await this.logAuctionCreated(auction);
        totalGenerated++;
      }

      console.log(`[ACTIVITY SERVICE] Generated ${totalGenerated} historical activities`);
      return totalGenerated;

    } catch (error) {
      console.error('[ACTIVITY SERVICE] Error generating historical activities:', error);
      throw error;
    }
  }
}

module.exports = ActivityService;
