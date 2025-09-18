/**
 * Activity Timeline Service
 *
 * Single Responsibility: Handle all timeline-related calculations for activities
 * Extracted from Activity model to separate time formatting logic from data model
 */

class ActivityTimelineService {
    /**
     * Calculate relative time from timestamp
     * @param {Date} timestamp - Activity timestamp
     * @returns {string} Human-readable relative time
     */
    static calculateRelativeTime(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);

        if (minutes < 1) {
            return 'just now';
        } else if (minutes < 60) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (hours < 24) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (days < 7) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (weeks < 4) {
            return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        } else if (months < 12) {
            return `${months} month${months > 1 ? 's' : ''} ago`;
        }
        return new Date(timestamp).toLocaleDateString();

    }

    /**
     * Calculate formatted timestamp for display
     * @param {Date} timestamp - Activity timestamp
     * @returns {string} Formatted timestamp
     */
    static calculateFormattedTimestamp(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) {
            return 'just now';
        }
        if (minutes < 60) {
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        if (hours < 24) {
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        if (days < 7) {
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
        if (days < 30) {
            return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
        }
        return timestamp.toLocaleDateString();
    }

    /**
     * Transform activity data with dynamic relative time
     * Used in toJSON transform for consistent time formatting
     * @param {Object} activityDoc - Activity document
     * @param {Object} ret - Return object from toJSON
     * @returns {Object} Transformed object with updated relativeTime
     */
    static transformWithRelativeTime(activityDoc, ret) {
        ret.relativeTime = this.calculateRelativeTime(ret.timestamp);
        return ret;
    }

    /**
     * Get date range query for filtering activities
     * @param {string} dateRange - Range type (today, week, month, quarter, all)
     * @returns {Object|null} MongoDB date query or null for 'all'
     */
    static getDateRangeQuery(dateRange) {
        if (!dateRange || dateRange === 'all') {
            return null;
        }

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
            default:
                return null;
        }

        return startDate ? { $gte: startDate } : null;
    }

    /**
     * Get timeline statistics for different time periods
     * @returns {Object} Timeline bounds for common periods
     */
    static getTimelineBounds() {
        const now = new Date();

        return {
            today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            weekAgo: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            monthAgo: new Date(now.getFullYear(), now.getMonth(), 1),
            quarterAgo: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1),
            yearAgo: new Date(now.getFullYear(), 0, 1)
        };
    }

    /**
     * Group activities by time periods
     * @param {Array} activities - Array of activity documents
     * @returns {Object} Activities grouped by time period
     */
    static groupByTimePeriod(activities) {
        const bounds = this.getTimelineBounds();
        const groups = {
            today: [],
            thisWeek: [],
            thisMonth: [],
            older: []
        };

        activities.forEach(activity => {
            const activityTime = new Date(activity.timestamp);

            if (activityTime >= bounds.today) {
                groups.today.push(activity);
            } else if (activityTime >= bounds.weekAgo) {
                groups.thisWeek.push(activity);
            } else if (activityTime >= bounds.monthAgo) {
                groups.thisMonth.push(activity);
            } else {
                groups.older.push(activity);
            }
        });

        return groups;
    }
}

export default ActivityTimelineService;
