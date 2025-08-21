/**
 * Activity Presenter
 *
 * Extracts UI presentation logic from Activity model following SRP
 * Single Responsibility: Format activity data for UI presentation
 */

class ActivityPresenter {
  /**
   * Get CSS color classes for activity type
   * @param {Object} activity - Activity document
   * @returns {Object} Color classes for UI
   */
  static getColorClasses(activity) {
    if (!activity.actionType) {
      return {
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-800',
        iconColor: 'text-gray-600'
      };
    }

    const colorMap = {
      'create': {
        bgColor: 'bg-green-50',
        textColor: 'text-green-800',
        iconColor: 'text-green-600'
      },
      'update': {
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-800',
        iconColor: 'text-blue-600'
      },
      'delete': {
        bgColor: 'bg-red-50',
        textColor: 'text-red-800',
        iconColor: 'text-red-600'
      },
      'sale': {
        bgColor: 'bg-yellow-50',
        textColor: 'text-yellow-800',
        iconColor: 'text-yellow-600'
      },
      'price_update': {
        bgColor: 'bg-purple-50',
        textColor: 'text-purple-800',
        iconColor: 'text-purple-600'
      },
      'image_upload': {
        bgColor: 'bg-indigo-50',
        textColor: 'text-indigo-800',
        iconColor: 'text-indigo-600'
      }
    };

    return colorMap[activity.actionType] || colorMap.create;
  }

  /**
   * Format relative time for display
   * @param {Date|string} timestamp - Activity timestamp
   * @returns {string} Human-readable relative time
   */
  static formatRelativeTime(timestamp) {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now - activityTime;

    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
      return diffSeconds <= 5 ? 'just now' : `${diffSeconds} seconds ago`;
    } else if (diffMinutes < 60) {
      return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
    } else if (diffWeeks < 4) {
      return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
    } else if (diffMonths < 12) {
      return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
    }
      return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;

  }

  /**
   * Get icon class for activity type
   * @param {Object} activity - Activity document
   * @returns {string} Icon class name
   */
  static getIconClass(activity) {
    const iconMap = {
      'create': 'fas fa-plus-circle',
      'update': 'fas fa-edit',
      'delete': 'fas fa-trash-alt',
      'sale': 'fas fa-shopping-cart',
      'price_update': 'fas fa-tag',
      'image_upload': 'fas fa-image'
    };

    return iconMap[activity.actionType] || 'fas fa-info-circle';
  }

  /**
   * Format activity for UI display
   * @param {Object} activity - Activity document
   * @returns {Object} Formatted activity for UI
   */
  static formatForDisplay(activity) {
    return {
      id: activity._id,
      actionType: activity.actionType,
      entityType: activity.entityType,
      entityName: activity.entityName,
      entityId: activity.entityId,
      description: activity.description,
      timestamp: activity.timestamp,
      metadata: activity.metadata,

      // Presentation properties
      colorClasses: this.getColorClasses(activity),
      relativeTime: this.formatRelativeTime(activity.timestamp),
      iconClass: this.getIconClass(activity),
      formattedDate: new Date(activity.timestamp).toLocaleDateString(),
      formattedTime: new Date(activity.timestamp).toLocaleTimeString()
    };
  }

  /**
   * Format multiple activities for display
   * @param {Array} activities - Array of activity documents
   * @returns {Array} Array of formatted activities
   */
  static formatMultipleForDisplay(activities) {
    return activities.map(activity => this.formatForDisplay(activity));
  }

  /**
   * Get activity type display name
   * @param {string} actionType - Action type
   * @returns {string} Human-readable action type
   */
  static getActionTypeDisplayName(actionType) {
    const displayNames = {
      'create': 'Created',
      'update': 'Updated',
      'delete': 'Deleted',
      'sale': 'Sold',
      'price_update': 'Price Updated',
      'image_upload': 'Image Uploaded'
    };

    return displayNames[actionType] || actionType;
  }

  /**
   * Group activities by date for timeline display
   * @param {Array} activities - Array of activity documents
   * @returns {Object} Activities grouped by date
   */
  static groupByDate(activities) {
    const groups = {};

    activities.forEach(activity => {
      const date = new Date(activity.timestamp).toDateString();

      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(this.formatForDisplay(activity));
    });

    return groups;
  }

  /**
   * Get activity summary statistics
   * @param {Array} activities - Array of activity documents
   * @returns {Object} Activity statistics
   */
  static getStatistics(activities) {
    const stats = {
      total: activities.length,
      byType: {},
      byEntityType: {},
      todayCount: 0,
      weekCount: 0,
      monthCount: 0
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    activities.forEach(activity => {
      // Count by type
      stats.byType[activity.actionType] = (stats.byType[activity.actionType] || 0) + 1;

      // Count by entity type
      stats.byEntityType[activity.entityType] = (stats.byEntityType[activity.entityType] || 0) + 1;

      // Count by time period
      const activityTime = new Date(activity.timestamp);

      if (activityTime >= todayStart) stats.todayCount++;
      if (activityTime >= weekStart) stats.weekCount++;
      if (activityTime >= monthStart) stats.monthCount++;
    });

    return stats;
  }
}

export default ActivityPresenter;
