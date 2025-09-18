/**
 * Activity Transform Service
 *
 * Single Responsibility: Handle data transformation and formatting for activities
 * Extracted from Activity model to separate transformation logic from data model
 */

import ActivityTimelineService from './ActivityTimelineService.js';
import ActivityColorService from './ActivityColorService.js';

class ActivityTransformService {
    /**
     * Transform activity document for JSON output
     * Used in toJSON schema transform
     * @param {Object} doc - Original mongoose document
     * @param {Object} ret - Return object to transform
     * @returns {Object} Transformed object with enhanced properties
     */
    static transformForJSON(doc, ret) {
        // Add dynamic relative time
        ret = ActivityTimelineService.transformWithRelativeTime(doc, ret);

        // Add color classes if not already present
        if (!ret.colorClasses && ret.metadata?.color) {
            ret.colorClasses = ActivityColorService.getColorClasses(ret.metadata.color);
        }

        return ret;
    }

    /**
     * Create search vector for full-text search optimization
     * @param {Object} activityData - Activity document data
     * @returns {string} Searchable text vector
     */
    static createSearchVector(activityData) {
        return [
            activityData.title,
            activityData.description,
            activityData.details,
            activityData.metadata?.cardName,
            activityData.metadata?.setName,
            ...(activityData.metadata?.tags || []),
            ...(activityData.metadata?.badges || [])
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
    }

    /**
     * Transform activity for API response
     * @param {Object} activity - Raw activity document
     * @param {Object} options - Transform options
     * @returns {Object} API-ready activity object
     */
    static transformForAPI(activity, options = {}) {
        const { includeMetadata = true, includeVirtuals = true } = options;

        const transformed = {
            id: activity._id || activity.id,
            type: activity.type,
            title: activity.title,
            description: activity.description,
            priority: activity.priority,
            status: activity.status,
            timestamp: activity.timestamp,
            entityType: activity.entityType,
            entityId: activity.entityId
        };

        // Add optional fields
        if (activity.details) {
            transformed.details = activity.details;
        }

        if (includeMetadata && activity.metadata) {
            transformed.metadata = activity.metadata;
        }

        if (includeVirtuals) {
            // Add computed properties
            transformed.relativeTime = ActivityTimelineService.calculateRelativeTime(activity.timestamp);
            transformed.formattedTimestamp = ActivityTimelineService.calculateFormattedTimestamp(activity.timestamp);

            // Add styling information
            const styling = ActivityColorService.getActivityStyling(activity);

            transformed.colorClasses = styling.colorClasses;
            transformed.iconClass = styling.iconClass;
        }

        return transformed;
    }

    /**
     * Transform multiple activities for API response
     * @param {Array} activities - Array of activity documents
     * @param {Object} options - Transform options
     * @returns {Array} Array of transformed activities
     */
    static transformMultipleForAPI(activities, options = {}) {
        return activities.map(activity => this.transformForAPI(activity, options));
    }

    /**
     * Transform activity for display (legacy compatibility)
     * @param {Object} activity - Activity document
     * @returns {Object} Display-ready activity object
     */
    static transformForDisplay(activity) {
        const styling = ActivityColorService.getActivityStyling(activity);

        return {
            id: activity._id || activity.id,
            type: activity.type,
            title: activity.title,
            description: activity.description,
            details: activity.details,
            priority: activity.priority,
            status: activity.status,
            timestamp: activity.timestamp,
            entityType: activity.entityType,
            entityId: activity.entityId,
            metadata: activity.metadata,

            // Computed display properties
            relativeTime: ActivityTimelineService.calculateRelativeTime(activity.timestamp),
            formattedTimestamp: ActivityTimelineService.calculateFormattedTimestamp(activity.timestamp),
            colorClasses: styling.colorClasses,
            iconClass: styling.iconClass,
            badgeClasses: styling.badgeClasses,

            // Formatted dates
            formattedDate: new Date(activity.timestamp).toLocaleDateString(),
            formattedTime: new Date(activity.timestamp).toLocaleTimeString()
        };
    }

    /**
     * Transform activity metadata for specific entity types
     * @param {string} entityType - Type of entity (psa_card, raw_card, etc.)
     * @param {Object} metadata - Raw metadata object
     * @returns {Object} Transformed metadata
     */
    static transformMetadataByEntityType(entityType, metadata) {
        const transformed = { ...metadata };

        switch (entityType) {
            case 'psa_card':
                if (transformed.grade) {
                    transformed.displayGrade = `PSA ${transformed.grade}`;
                }
                break;

            case 'raw_card':
                if (transformed.condition) {
                    transformed.displayCondition = transformed.condition.toUpperCase();
                }
                break;

            case 'sealed_product':
                if (transformed.category) {
                    transformed.displayCategory = transformed.category
                        .split('_')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                }
                break;

            case 'auction':
                if (transformed.itemCount) {
                    transformed.displayItemCount = `${transformed.itemCount} item${metadata.itemCount > 1 ? 's' : ''}`;
                }
                break;
        }

        // Format prices if present
        if (transformed.previousPrice) {
            transformed.formattedPreviousPrice = this.formatPrice(transformed.previousPrice);
        }
        if (transformed.newPrice) {
            transformed.formattedNewPrice = this.formatPrice(transformed.newPrice);
        }
        if (transformed.salePrice) {
            transformed.formattedSalePrice = this.formatPrice(transformed.salePrice);
        }
        if (transformed.priceChange) {
            transformed.formattedPriceChange = this.formatPriceChange(transformed.priceChange);
        }

        return transformed;
    }

    /**
     * Format price for display
     * @param {number|string|Object} price - Price value
     * @returns {string} Formatted price string
     */
    static formatPrice(price) {
        if (!price) return '$0.00';

        let numPrice = price;

        if (typeof price === 'object' && price.$numberDecimal) {
            numPrice = parseFloat(price.$numberDecimal);
        } else if (typeof price === 'string') {
            numPrice = parseFloat(price);
        }

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(numPrice);
    }

    /**
     * Format price change for display
     * @param {number} priceChange - Price change amount
     * @returns {string} Formatted price change with sign
     */
    static formatPriceChange(priceChange) {
        const formatted = this.formatPrice(Math.abs(priceChange));

        return priceChange >= 0 ? `+${formatted}` : `-${formatted}`;
    }

    /**
     * Group activities for timeline display
     * @param {Array} activities - Array of activity documents
     * @param {string} groupBy - Grouping method (date, type, entity)
     * @returns {Object} Grouped activities
     */
    static groupActivities(activities, groupBy = 'date') {
        const groups = {};

        activities.forEach(activity => {
            let groupKey;

            switch (groupBy) {
                case 'date':
                    groupKey = new Date(activity.timestamp).toDateString();
                    break;
                case 'type':
                    groupKey = activity.type;
                    break;
                case 'entity':
                    groupKey = activity.entityType || 'unknown';
                    break;
                case 'priority':
                    groupKey = activity.priority || 'medium';
                    break;
                default:
                    groupKey = 'all';
            }

            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }

            groups[groupKey].push(this.transformForDisplay(activity));
        });

        return groups;
    }

    /**
     * Extract summary information from activities
     * @param {Array} activities - Array of activity documents
     * @returns {Object} Activity summary statistics
     */
    static extractSummary(activities) {
        const summary = {
            total: activities.length,
            byType: {},
            byPriority: {},
            byStatus: {},
            byEntityType: {},
            dateRange: null,
            mostRecentActivity: null,
            oldestActivity: null
        };

        if (activities.length === 0) {
            return summary;
        }

        // Sort activities by timestamp for range calculation
        const sortedActivities = [...activities].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        summary.oldestActivity = sortedActivities[0].timestamp;
        summary.mostRecentActivity = sortedActivities[sortedActivities.length - 1].timestamp;

        // Calculate date range
        const range = new Date(summary.mostRecentActivity) - new Date(summary.oldestActivity);

        summary.dateRange = Math.ceil(range / (1000 * 60 * 60 * 24)); // days

        // Count by categories
        activities.forEach(activity => {
            // By type
            summary.byType[activity.type] = (summary.byType[activity.type] || 0) + 1;

            // By priority
            summary.byPriority[activity.priority] = (summary.byPriority[activity.priority] || 0) + 1;

            // By status
            summary.byStatus[activity.status] = (summary.byStatus[activity.status] || 0) + 1;

            // By entity type
            if (activity.entityType) {
                summary.byEntityType[activity.entityType] = (summary.byEntityType[activity.entityType] || 0) + 1;
            }
        });

        return summary;
    }
}

export default ActivityTransformService;
