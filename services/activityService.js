/**
 * Activity Service - Context7 Premium Activity Management
 *
 * Comprehensive service for managing collection activities with Context7 patterns.
 * Provides automatic activity generation, rich data tracking, and premium features.
 *
 * Features:
 * - Auto-activity generation for all CRUD operations
 * - Rich metadata extraction and tracking
 * - Context7 timeline and analytics
 * - Premium filtering and search capabilities
 */

const { Activity, ACTIVITY_TYPES, ACTIVITY_PRIORITIES } = require('../models/Activity');
const mongoose = require('mongoose');

// Context7 Performance Optimization - Activity Batching
const activityQueue = [];
let batchTimeout = null;
const BATCH_SIZE = 10;
const BATCH_DELAY = 2000; // 2 seconds

// Context7 Activity Icon Mapping
const ACTIVITY_ICONS = {
  [ACTIVITY_TYPES.CARD_ADDED]: 'Plus',
  [ACTIVITY_TYPES.CARD_UPDATED]: 'Edit',
  [ACTIVITY_TYPES.CARD_DELETED]: 'Trash2',
  [ACTIVITY_TYPES.PRICE_UPDATE]: 'TrendingUp',
  [ACTIVITY_TYPES.AUCTION_CREATED]: 'DollarSign',
  [ACTIVITY_TYPES.AUCTION_UPDATED]: 'Edit',
  [ACTIVITY_TYPES.AUCTION_DELETED]: 'Trash2',
  [ACTIVITY_TYPES.AUCTION_ITEM_ADDED]: 'Package',
  [ACTIVITY_TYPES.AUCTION_ITEM_REMOVED]: 'Minus',
  [ACTIVITY_TYPES.SALE_COMPLETED]: 'CheckCircle',
  [ACTIVITY_TYPES.SALE_UPDATED]: 'Edit',
  [ACTIVITY_TYPES.MILESTONE]: 'Award',
  [ACTIVITY_TYPES.COLLECTION_STATS]: 'BarChart3',
  [ACTIVITY_TYPES.SYSTEM]: 'Settings',
};

// Context7 Activity Color Mapping
const ACTIVITY_COLORS = {
  [ACTIVITY_TYPES.CARD_ADDED]: 'emerald',
  [ACTIVITY_TYPES.CARD_UPDATED]: 'amber',
  [ACTIVITY_TYPES.CARD_DELETED]: 'red',
  [ACTIVITY_TYPES.PRICE_UPDATE]: 'amber',
  [ACTIVITY_TYPES.AUCTION_CREATED]: 'purple',
  [ACTIVITY_TYPES.AUCTION_UPDATED]: 'amber',
  [ACTIVITY_TYPES.AUCTION_DELETED]: 'red',
  [ACTIVITY_TYPES.AUCTION_ITEM_ADDED]: 'purple',
  [ACTIVITY_TYPES.AUCTION_ITEM_REMOVED]: 'red',
  [ACTIVITY_TYPES.SALE_COMPLETED]: 'emerald',
  [ACTIVITY_TYPES.SALE_UPDATED]: 'amber',
  [ACTIVITY_TYPES.MILESTONE]: 'indigo',
  [ACTIVITY_TYPES.COLLECTION_STATS]: 'indigo',
  [ACTIVITY_TYPES.SYSTEM]: 'indigo',
};

class ActivityService {
  // Context7 Helper - Convert Decimal128 to Number
  static convertPrice(price) {
    if (!price) {
      return null;
    }
    if (typeof price === 'number') {
      return price;
    }
    if (price.$numberDecimal) {
      return parseFloat(price.$numberDecimal);
    }
    if (price.toString) {
      return parseFloat(price.toString());
    }
    return null;
  }

  // Context7 Performance - Batch Activity Processing
  static async processBatch() {
    if (activityQueue.length === 0) {
      return;
    }

    const batch = activityQueue.splice(0, BATCH_SIZE);

    try {
      await Activity.insertMany(batch, { ordered: false });
      console.log(`[ACTIVITY SERVICE] Batch processed: ${batch.length} activities`);
    } catch (error) {
      console.error('[ACTIVITY SERVICE] Batch processing error:', error);
      // Try individual inserts for failed batch
      for (const activity of batch) {
        try {
          await Activity.create(activity);
        } catch (individualError) {
          console.error('[ACTIVITY SERVICE] Individual activity failed:', individualError);
        }
      }
    }

    // Continue processing if more items in queue
    if (activityQueue.length > 0) {
      setImmediate(() => ActivityService.processBatch());
    }
  }

  // Context7 Core Activity Creation - Optimized for Mongoose Post-Hooks
  static async createActivity(activityData) {
    try {
      const enrichedData = {
        ...activityData,
        metadata: {
          ...activityData.metadata,
          icon: ACTIVITY_ICONS[activityData.type] || 'Info',
          color: ACTIVITY_COLORS[activityData.type] || 'indigo',
        },
      };

      // For high-priority activities, create immediately
      if (activityData.priority === ACTIVITY_PRIORITIES.HIGH
          || activityData.priority === ACTIVITY_PRIORITIES.CRITICAL) {
        return await Activity.createActivity(enrichedData);
      }

      // For other activities, use batch processing for performance
      activityQueue.push(enrichedData);

      // Start batch timer if not already running
      if (!batchTimeout) {
        batchTimeout = setTimeout(() => {
          batchTimeout = null;
          ActivityService.processBatch();
        }, BATCH_DELAY);
      }

      // Process immediately if batch is full
      if (activityQueue.length >= BATCH_SIZE) {
        clearTimeout(batchTimeout);
        batchTimeout = null;
        setImmediate(() => ActivityService.processBatch());
      }

      return { queued: true, type: enrichedData.type };
    } catch (error) {
      console.error('[ACTIVITY SERVICE] Error creating activity:', error);
      // Don't throw errors from activity tracking to avoid breaking main operations
      return null;
    }
  }

  // Context7 Card Activities
  static async logCardAdded(cardData, cardType) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';
    const setName = cardData.setName || cardData.cardId?.setId?.setName || 'Unknown Set';

    let title; let description; let badges = [];

    switch (cardType) {
    case 'psa':
      title = `Added new PSA ${cardData.grade} ${cardName}`;
      description = `${setName} - Added to collection with price tracking`;
      badges = [`PSA Grade ${cardData.grade}`];
      break;
    case 'raw':
      title = `Added new ${cardName}`;
      description = `${setName} - ${cardData.condition} condition`;
      badges = [cardData.condition, 'Raw Card'];
      break;
    case 'sealed':
      title = `Added new ${cardData.name || cardName}`;
      description = `${setName} - ${cardData.category} product`;
      badges = [cardData.category];
      break;
    default:
      title = `Added new ${cardName}`;
      description = `${setName} - Added to collection`;
    }

    return this.createActivity({
      type: ACTIVITY_TYPES.CARD_ADDED,
      title,
      description,
      details: 'Card added to collection with initial price tracking',
      priority: ACTIVITY_PRIORITIES.MEDIUM,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: {
        cardName,
        setName,
        grade: cardData.grade,
        condition: cardData.condition,
        category: cardData.category,
        newPrice: ActivityService.convertPrice(cardData.myPrice),
        badges,
        tags: [cardType, 'card_added', setName.toLowerCase().replace(/\s+/g, '_')],
      },
    });
  }

  static async logCardUpdated(cardData, cardType, changes) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || cardData.name || 'Unknown Card';
    const setName = cardData.setName || cardData.cardId?.setId?.setName || 'Unknown Set';

    // Generate descriptive title and badges based on changes
    let title = `Updated ${cardName}`;
    let description = `${setName} - Collection item updated`;
    let details = '';
    const badges = [];

    if (changes.imagesAdded) {
      title = `Added ${changes.imagesAdded} image${changes.imagesAdded > 1 ? 's' : ''} to ${cardName}`;
      description = `${setName} - New images uploaded`;
      details = `${changes.imagesAdded} new image${changes.imagesAdded > 1 ? 's' : ''} added to collection item`;
      badges.push(`+${changes.imagesAdded} Image${changes.imagesAdded > 1 ? 's' : ''}`);
    } else if (changes.imagesRemoved) {
      title = `Removed ${changes.imagesRemoved} image${changes.imagesRemoved > 1 ? 's' : ''} from ${cardName}`;
      description = `${setName} - Images removed`;
      details = `${changes.imagesRemoved} image${changes.imagesRemoved > 1 ? 's' : ''} removed from collection item`;
      badges.push(`-${changes.imagesRemoved} Image${changes.imagesRemoved > 1 ? 's' : ''}`);
    } else if (changes.gradeChanged) {
      title = `Grade updated for ${cardName}`;
      description = `${setName} - PSA grade changed: ${changes.gradeChanged}`;
      details = 'PSA grading information updated';
      badges.push('Grade Updated');
    } else if (changes.conditionChanged) {
      title = `Condition updated for ${cardName}`;
      description = `${setName} - Condition changed: ${changes.conditionChanged}`;
      details = 'Card condition assessment updated';
      badges.push('Condition Updated');
    } else if (changes.categoryChanged) {
      title = `Category updated for ${cardName}`;
      description = `${setName} - Category changed: ${changes.categoryChanged}`;
      details = 'Product category classification updated';
      badges.push('Category Updated');
    } else if (changes.availabilityChanged) {
      title = `Availability updated for ${cardName}`;
      description = `${setName} - Stock changed: ${changes.availabilityChanged}`;
      details = 'Product availability tracking updated';
      badges.push('Stock Updated');
    } else {
      details = `Updated fields: ${Object.keys(changes).join(', ')}`;
      badges.push('Updated');
    }

    return this.createActivity({
      type: ACTIVITY_TYPES.CARD_UPDATED,
      title,
      description,
      details,
      priority: ACTIVITY_PRIORITIES.LOW,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: {
        cardName,
        setName,
        changes,
        badges,
        tags: [cardType, 'card_updated', setName.toLowerCase().replace(/\s+/g, '_')],
      },
    });
  }

  static async logCardDeleted(cardData, cardType) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';
    const setName = cardData.setName || cardData.cardId?.setId?.setName || 'Unknown Set';

    const title = `Removed ${cardName}`;
    const description = `${setName} - Card removed from collection`;

    return this.createActivity({
      type: ACTIVITY_TYPES.CARD_DELETED,
      title,
      description,
      details: 'Card permanently removed from collection',
      priority: ACTIVITY_PRIORITIES.MEDIUM,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: {
        cardName,
        setName,
        badges: ['Removed'],
        tags: [cardType, 'card_deleted', setName.toLowerCase().replace(/\s+/g, '_')],
      },
    });
  }

  // Context7 Price Update Activities
  static async logPriceUpdate(cardData, cardType, oldPrice, newPrice) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';
    const setName = cardData.setName || cardData.cardId?.setId?.setName || 'Unknown Set';

    const priceChange = newPrice - oldPrice;
    const priceChangePercentage = oldPrice > 0 ? (priceChange / oldPrice) * 100 : 0;
    const isIncrease = priceChange > 0;

    const title = `Price ${isIncrease ? 'increased' : 'decreased'} for ${cardName}`;
    const description = `Market price ${isIncrease ? 'increased' : 'decreased'} by ${Math.abs(priceChangePercentage).toFixed(1)}% - Updated price history`;

    const badges = [
      `${isIncrease ? '+' : ''}${priceChangePercentage.toFixed(1)}% ${isIncrease ? '↗' : '↘'}`,
    ];

    return this.createActivity({
      type: ACTIVITY_TYPES.PRICE_UPDATE,
      title,
      description,
      details: 'Price tracking updated with market movement',
      priority: Math.abs(priceChangePercentage) > 10 ? ACTIVITY_PRIORITIES.HIGH : ACTIVITY_PRIORITIES.MEDIUM,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: {
        cardName,
        setName,
        previousPrice: oldPrice,
        newPrice,
        priceChange,
        priceChangePercentage,
        badges,
        color: isIncrease ? 'emerald' : 'red',
        tags: [cardType, 'price_update', isIncrease ? 'price_increase' : 'price_decrease'],
      },
    });
  }

  // Context7 Auction Activities
  static async logAuctionCreated(auctionData) {
    const title = 'Created new auction batch';
    const description = `Added ${auctionData.items?.length || 0} items to "${auctionData.topText || 'New Auction'}" auction`;

    return this.createActivity({
      type: ACTIVITY_TYPES.AUCTION_CREATED,
      title,
      description,
      details: `Auction scheduled with ${auctionData.items?.length || 0} items`,
      priority: ACTIVITY_PRIORITIES.HIGH,
      entityType: 'auction',
      entityId: auctionData._id,
      metadata: {
        auctionTitle: auctionData.topText,
        itemCount: auctionData.items?.length || 0,
        estimatedValue: ActivityService.convertPrice(auctionData.totalValue),
        badges: [`${auctionData.items?.length || 0} Items`],
        tags: ['auction', 'auction_created', 'batch_sale'],
      },
    });
  }

  static async logAuctionUpdated(auctionData, previousState, updateData = {}) {
    // Determine what changed
    const changes = [];
    const badges = [];

    if (previousState && auctionData.status !== previousState.status) {
      changes.push(`status changed from ${previousState.status} to ${auctionData.status}`);
      badges.push(`Status: ${auctionData.status}`);
    }

    if (updateData.$set?.topText && updateData.$set.topText !== previousState?.topText) {
      changes.push('title updated');
      badges.push('Title Updated');
    }

    if (updateData.$set?.bottomText && updateData.$set.bottomText !== previousState?.bottomText) {
      changes.push('description updated');
      badges.push('Description Updated');
    }

    if (previousState && auctionData.items?.length !== previousState.items?.length) {
      const itemDiff = auctionData.items.length - previousState.items.length;

      changes.push(`${itemDiff > 0 ? 'added' : 'removed'} ${Math.abs(itemDiff)} item(s)`);
      badges.push(`${auctionData.items.length} Items`);
    }

    const title = `Updated auction "${auctionData.topText || 'Auction'}"`;
    const description = changes.length > 0
      ? `Auction modified: ${changes.join(', ')}`
      : 'Auction details updated';

    return this.createActivity({
      type: ACTIVITY_TYPES.AUCTION_UPDATED,
      title,
      description,
      details: 'Auction configuration updated',
      priority: ACTIVITY_PRIORITIES.MEDIUM,
      entityType: 'auction',
      entityId: auctionData._id,
      metadata: {
        auctionTitle: auctionData.topText,
        itemCount: auctionData.items?.length || 0,
        status: auctionData.status,
        badges: badges.length > 0 ? badges : ['Updated'],
        tags: ['auction', 'auction_updated', auctionData.status],
      },
    });
  }

  static async logAuctionDeleted(auctionData) {
    const title = `Deleted auction "${auctionData.topText || 'Auction'}"`;
    const description = `Auction batch removed with ${auctionData.items?.length || 0} items`;

    return this.createActivity({
      type: ACTIVITY_TYPES.AUCTION_DELETED,
      title,
      description,
      details: 'Auction permanently removed from system',
      priority: ACTIVITY_PRIORITIES.HIGH,
      entityType: 'auction',
      entityId: auctionData._id,
      metadata: {
        auctionTitle: auctionData.topText,
        itemCount: auctionData.items?.length || 0,
        badges: ['Deleted'],
        tags: ['auction', 'auction_deleted'],
      },
    });
  }

  static async logAuctionItemAdded(auctionData, itemData) {
    const itemName = itemData.cardName || itemData.name || 'Unknown Item';
    const title = `Added ${itemName} to auction`;
    const description = `Item added to "${auctionData.topText || 'Auction'}" batch`;

    return this.createActivity({
      type: ACTIVITY_TYPES.AUCTION_ITEM_ADDED,
      title,
      description,
      details: 'Auction inventory expanded',
      priority: ACTIVITY_PRIORITIES.LOW,
      entityType: 'auction',
      entityId: auctionData._id,
      metadata: {
        auctionTitle: auctionData.topText,
        cardName: itemName,
        badges: ['Item Added'],
        tags: ['auction', 'item_added'],
      },
    });
  }

  static async logAuctionItemRemoved(auctionData, itemData) {
    const itemName = itemData.cardName || itemData.name || 'Unknown Item';
    const title = `Removed ${itemName} from auction`;
    const description = `Item removed from "${auctionData.topText || 'Auction'}" batch`;

    return this.createActivity({
      type: ACTIVITY_TYPES.AUCTION_ITEM_REMOVED,
      title,
      description,
      details: 'Auction inventory updated',
      priority: ACTIVITY_PRIORITIES.LOW,
      entityType: 'auction',
      entityId: auctionData._id,
      metadata: {
        auctionTitle: auctionData.topText,
        cardName: itemName,
        badges: ['Item Removed'],
        tags: ['auction', 'item_removed'],
      },
    });
  }

  // Context7 Sale Activities
  static async logSaleCompleted(cardData, cardType, saleDetails) {
    const cardName = cardData.cardName || cardData.cardId?.cardName || 'Unknown Card';
    const setName = cardData.setName || cardData.cardId?.setId?.setName || 'Unknown Set';

    const title = `${cardName} sold`;
    const description = `${cardType.toUpperCase()} ${cardData.grade ? `Grade ${cardData.grade}` : cardData.condition || ''} - Sold via ${saleDetails.source || 'Direct Sale'}`;

    return this.createActivity({
      type: ACTIVITY_TYPES.SALE_COMPLETED,
      title,
      description,
      details: `Payment received via ${saleDetails.paymentMethod || 'Unknown method'}`,
      priority: ACTIVITY_PRIORITIES.HIGH,
      entityType: `${cardType}_card`,
      entityId: cardData._id,
      metadata: {
        cardName,
        setName,
        salePrice: ActivityService.convertPrice(saleDetails.actualSoldPrice),
        paymentMethod: saleDetails.paymentMethod,
        source: saleDetails.source,
        buyerName: saleDetails.buyerFullName,
        badges: ['Sold'],
        tags: [cardType, 'sale_completed', saleDetails.source?.toLowerCase().replace(/\s+/g, '_')],
      },
    });
  }

  // Context7 Milestone Activities
  static async logMilestone(milestoneType, milestoneData) {
    let title; let description; let details; let badges = [];

    switch (milestoneType) {
    case 'collection_count':
      title = 'Collection milestone reached!';
      description = `Your collection has reached ${milestoneData.count} cards`;
      details = 'Congratulations on this achievement!';
      badges = ['🎉 Milestone'];
      break;
    case 'portfolio_value':
      title = 'Portfolio value milestone!';
      description = `Total collection value exceeded ${milestoneData.value} kr.`;
      details = 'Fantastic portfolio growth!';
      badges = ['💰 Value Goal'];
      break;
    case 'grading_milestone':
      title = 'Grading milestone achieved!';
      description = `Reached ${milestoneData.count} PSA graded cards`;
      details = 'Building an impressive graded collection!';
      badges = ['⭐ Grading Goal'];
      break;
    default:
      title = 'Milestone achieved!';
      description = 'Collection goal reached';
      details = 'Keep up the great work!';
      badges = ['🎯 Achievement'];
    }

    return this.createActivity({
      type: ACTIVITY_TYPES.MILESTONE,
      title,
      description,
      details,
      priority: ACTIVITY_PRIORITIES.HIGH,
      entityType: 'collection',
      metadata: {
        milestoneType,
        milestoneValue: milestoneData.count || milestoneData.value,
        milestoneUnit: milestoneData.unit || 'items',
        badges,
        tags: ['milestone', milestoneType, 'achievement'],
      },
    });
  }

  // Context7 Query Methods
  static async getActivities(options = {}) {
    const {
      limit = 50,
      offset = 0,
      type,
      entityType,
      entityId,
      priority,
      dateRange,
      search,
    } = options;

    const query = { status: 'active' };

    // Apply filters
    if (type) {
      query.type = type;
    }
    if (entityType) {
      query.entityType = entityType;
    }
    if (entityId) {
      query.entityId = entityId;
    }
    if (priority) {
      query.priority = priority;
    }

    // Date range filtering
    if (dateRange) {
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
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      }

      if (startDate) {
        query.timestamp = { $gte: startDate };
      }
    }

    // Search functionality
    if (search) {
      return Activity.searchActivities(search, query);
    }

    // Get activities with pagination
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
      hasMore: offset + limit < total,
    };
  }

  static async getActivityStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalActivities,
      todayActivities,
      weekActivities,
      monthActivities,
      recentActivity,
    ] = await Promise.all([
      Activity.countDocuments({ status: 'active' }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: today } }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: thisWeek } }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: thisMonth } }),
      Activity.findOne({ status: 'active' }).sort({ timestamp: -1 }).lean(),
    ]);

    return {
      total: totalActivities,
      today: todayActivities,
      week: weekActivities,
      month: monthActivities,
      lastActivity: recentActivity?.timestamp,
    };
  }

  // Context7 Maintenance Methods
  static async archiveOldActivities(daysOld = 90) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    const result = await Activity.updateMany(
      {
        timestamp: { $lt: cutoffDate },
        status: 'active',
        priority: { $in: ['low', 'medium'] },
      },
      {
        status: 'archived',
        isArchived: true,
        archivedAt: new Date(),
      },
    );

    console.log(`[ACTIVITY SERVICE] Archived ${result.modifiedCount} old activities`);
    return result;
  }
}

module.exports = ActivityService;
