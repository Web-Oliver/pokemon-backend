/**
 * Activity Helpers Utility
 *
 * Single Responsibility: Static utility methods for activity operations
 * Extracted from Activity model to separate business logic from data model
 */

import ActivityTimelineService from '@/collection/activities/ActivityTimelineService.js';
class ActivityHelpers {
  /**
   * Create a new activity record
   * @param {Object} Activity - Activity model reference
   * @param {Object} activityData - Activity data to create
   * @returns {Promise<Object>} Created activity document
   */
  static async createActivity(Activity, activityData) {
    const activity = new Activity(activityData);

    await activity.save();
    return activity;
  }

  /**
   * Get recent activities with filtering
   * @param {Object} Activity - Activity model reference
   * @param {number} limit - Number of results to return
   * @param {Object} filters - Additional filters to apply
   * @returns {Promise<Array>} Array of recent activities
   */
  static async getRecentActivities(Activity, limit = 50, filters = {}) {
    const query = { status: 'active', ...filters };

    return Activity.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Get activities within a time range
   * @param {Object} Activity - Activity model reference
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @param {Object} filters - Additional filters to apply
   * @returns {Promise<Array>} Array of activities in time range
   */
  static async getActivitiesByTimeRange(Activity, startDate, endDate, filters = {}) {
    const query = {
      timestamp: { $gte: startDate, $lte: endDate },
      status: 'active',
      ...filters
    };

    return Activity.find(query)
      .sort({ timestamp: -1 })
      .lean();
  }

  /**
   * Get activities for a specific entity
   * @param {Object} Activity - Activity model reference
   * @param {string} entityType - Type of entity
   * @param {string} entityId - ID of entity
   * @returns {Promise<Array>} Array of activities for entity
   */
  static async getActivitiesByEntity(Activity, entityType, entityId) {
    return Activity.find({
      entityType,
      entityId,
      status: 'active'
    })
      .sort({ timestamp: -1 })
      .lean();
  }

  /**
   * Search activities with full-text search
   * @param {Object} Activity - Activity model reference
   * @param {string} searchTerm - Search term to match
   * @param {Object} filters - Additional filters to apply
   * @returns {Promise<Array>} Array of matching activities
   */
  static async searchActivities(Activity, searchTerm, filters = {}) {
    const query = {
      $and: [
        {
          $or: [
            { title: { $regex: searchTerm, $options: 'i' } },
            { description: { $regex: searchTerm, $options: 'i' } },
            { details: { $regex: searchTerm, $options: 'i' } },
            { searchVector: { $regex: searchTerm, $options: 'i' } }
          ]
        },
        { status: 'active' },
        filters
      ]
    };

    return Activity.find(query)
      .sort({ timestamp: -1 })
      .lean();
  }

  /**
   * Get activities with advanced filtering and pagination
   * @param {Object} Activity - Activity model reference
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Paginated activity results
   */
  static async getActivitiesWithPagination(Activity, options = {}) {
    const {
      limit = 50,
      offset = 0,
      type,
      entityType,
      entityId,
      priority,
      dateRange,
      search,
      status = 'active'
    } = options;

    const query = { status };

    // Apply filters
    if (type) query.type = type;
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (priority) query.priority = priority;

    // Date range filter
    if (dateRange && dateRange !== 'all') {
      const dateQuery = ActivityTimelineService.getDateRangeQuery(dateRange);

      if (dateQuery) {
        query.timestamp = dateQuery;
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

    const [activities, total] = await Promise.all([
      Activity.find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      Activity.countDocuments(query)
    ]);

    return {
      activities,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  /**
   * Get activity statistics for different time periods
   * @param {Object} Activity - Activity model reference
   * @returns {Promise<Object>} Activity statistics
   */
  static async getActivityStatistics(Activity) {
    const bounds = ActivityTimelineService.getTimelineBounds();

    const [total, todayCount, weekCount, monthCount, recent] = await Promise.all([
      Activity.countDocuments({ status: 'active' }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: bounds.today } }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: bounds.weekAgo } }),
      Activity.countDocuments({ status: 'active', timestamp: { $gte: bounds.monthAgo } }),
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
   * Mark activity as read
   * @param {Object} activity - Activity document instance
   * @returns {Promise<Object>} Updated activity
   */
  static async markActivityAsRead(activity) {
    activity.isRead = true;
    activity.readAt = new Date();
    return activity.save();
  }

  /**
   * Archive activity (soft delete)
   * @param {Object} activity - Activity document instance
   * @returns {Promise<Object>} Updated activity
   */
  static async archiveActivity(activity) {
    activity.isArchived = true;
    activity.status = 'archived';
    activity.archivedAt = new Date();
    return activity.save();
  }

  /**
   * Validate activity data before creation
   * @param {Object} activityData - Activity data to validate
   * @param {Object} constants - Activity constants (TYPES, PRIORITIES, STATUS)
   * @returns {Object} Validation result
   */
  static validateActivityData(activityData, constants) {
    const errors = [];

    // Required fields
    if (!activityData.type) {
      errors.push('Activity type is required');
    } else if (!Object.values(constants.ACTIVITY_TYPES).includes(activityData.type)) {
      errors.push('Invalid activity type');
    }

    if (!activityData.title || activityData.title.trim().length === 0) {
      errors.push('Activity title is required');
    } else if (activityData.title.length > 200) {
      errors.push('Activity title must be 200 characters or less');
    }

    if (!activityData.description || activityData.description.trim().length === 0) {
      errors.push('Activity description is required');
    } else if (activityData.description.length > 500) {
      errors.push('Activity description must be 500 characters or less');
    }

    // Optional field validations
    if (activityData.details && activityData.details.length > 1000) {
      errors.push('Activity details must be 1000 characters or less');
    }

    if (activityData.priority && !Object.values(constants.ACTIVITY_PRIORITIES).includes(activityData.priority)) {
      errors.push('Invalid activity priority');
    }

    if (activityData.status && !Object.values(constants.ACTIVITY_STATUS).includes(activityData.status)) {
      errors.push('Invalid activity status');
    }

    if (activityData.entityType) {
      const validEntityTypes = ['psa_card', 'raw_card', 'sealed_product', 'auction', 'collection', 'system'];

      if (!validEntityTypes.includes(activityData.entityType)) {
        errors.push('Invalid entity type');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get entity display name from activity
   * @param {Object} activity - Activity document
   * @returns {string} Display name for entity
   */
  static getEntityDisplayName(activity) {
    if (activity.metadata?.cardName) {
      return activity.metadata.cardName;
    }

    if (activity.metadata?.auctionTitle) {
      return activity.metadata.auctionTitle;
    }

    return activity.entityType || 'Unknown Item';
  }

  /**
   * Get activity type display label
   * @param {string} activityType - Activity type constant
   * @returns {string} Human-readable activity type
   */
  static getActivityTypeLabel(activityType) {
    const labelMap = {
      card_added: 'Card Added',
      card_updated: 'Card Updated',
      card_deleted: 'Card Deleted',
      price_update: 'Price Update',
      auction_created: 'Auction Created',
      auction_updated: 'Auction Updated',
      auction_deleted: 'Auction Deleted',
      auction_item_added: 'Item Added to Auction',
      auction_item_removed: 'Item Removed from Auction',
      sale_completed: 'Sale Completed',
      sale_updated: 'Sale Updated',
      milestone: 'Milestone Reached',
      collection_stats: 'Collection Statistics',
      system: 'System Activity'
    };

    return labelMap[activityType] || activityType;
  }

  /**
   * Build activity query from filters
   * @param {Object} filters - Filter parameters
   * @returns {Object} MongoDB query object
   */
  static buildActivityQuery(filters = {}) {
    const query = {};

    // Status filter (default to active)
    query.status = filters.status || 'active';

    // Type filters
    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.entityType) {
      query.entityType = filters.entityType;
    }

    if (filters.entityId) {
      query.entityId = filters.entityId;
    }

    if (filters.priority) {
      query.priority = filters.priority;
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const dateQuery = ActivityTimelineService.getDateRangeQuery(filters.dateRange);

      if (dateQuery) {
        query.timestamp = dateQuery;
      }
    }

    // Custom date range
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }

    // Search terms
    if (filters.search) {
      query.$or = [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { details: { $regex: filters.search, $options: 'i' } },
        { searchVector: { $regex: filters.search, $options: 'i' } }
      ];
    }

    // Read status
    if (typeof filters.isRead === 'boolean') {
      query.isRead = filters.isRead;
    }

    return query;
  }
}

export default ActivityHelpers;
