/**
 * Activity Color Service
 *
 * Single Responsibility: Manage color schemes and visual styling for activities
 * Extracted from Activity model to separate UI concerns from data model
 */

class ActivityColorService {
    /**
     * Get color classes for activity based on metadata color
     * @param {string} color - Color name from activity metadata
     * @returns {Object} Color classes for different UI elements
     */
    static getColorClasses(color = 'indigo') {
        const colorMap = {
            emerald: {
                bg: 'from-emerald-500 to-teal-600',
                badge: 'bg-emerald-100 text-emerald-800',
                dot: 'bg-emerald-400'
            },
            amber: {
                bg: 'from-amber-500 to-orange-600',
                badge: 'bg-amber-100 text-amber-800',
                dot: 'bg-amber-400'
            },
            purple: {
                bg: 'from-purple-500 to-violet-600',
                badge: 'bg-purple-100 text-purple-800',
                dot: 'bg-purple-400'
            },
            indigo: {
                bg: 'from-indigo-500 to-blue-600',
                badge: 'bg-indigo-100 text-indigo-800',
                dot: 'bg-indigo-400'
            },
            red: {
                bg: 'from-red-500 to-rose-600',
                badge: 'bg-red-100 text-red-800',
                dot: 'bg-red-400'
            }
        };

        return colorMap[color] || colorMap.indigo;
    }

    /**
     * Get color classes for activity type
     * @param {string} activityType - Activity type constant
     * @returns {Object} Color classes based on activity type
     */
    static getColorClassesByType(activityType) {
        const typeColorMap = {
            card_added: 'emerald',
            card_updated: 'amber',
            card_deleted: 'red',
            price_update: 'purple',
            auction_created: 'indigo',
            auction_updated: 'amber',
            auction_deleted: 'red',
            auction_item_added: 'emerald',
            auction_item_removed: 'red',
            sale_completed: 'emerald',
            sale_updated: 'amber',
            milestone: 'purple',
            collection_stats: 'indigo',
            system: 'indigo'
        };

        const color = typeColorMap[activityType] || 'indigo';

        return this.getColorClasses(color);
    }

    /**
     * Get color classes for priority level
     * @param {string} priority - Priority level (low, medium, high, critical)
     * @returns {Object} Color classes based on priority
     */
    static getColorClassesByPriority(priority) {
        const priorityColorMap = {
            low: 'indigo',
            medium: 'amber',
            high: 'purple',
            critical: 'red'
        };

        const color = priorityColorMap[priority] || 'indigo';

        return this.getColorClasses(color);
    }

    /**
     * Get icon class for activity type
     * @param {string} activityType - Activity type constant
     * @returns {string} CSS icon class
     */
    static getIconClass(activityType) {
        const iconMap = {
            card_added: 'fas fa-plus-circle',
            card_updated: 'fas fa-edit',
            card_deleted: 'fas fa-trash-alt',
            price_update: 'fas fa-tag',
            auction_created: 'fas fa-gavel',
            auction_updated: 'fas fa-edit',
            auction_deleted: 'fas fa-trash-alt',
            auction_item_added: 'fas fa-plus',
            auction_item_removed: 'fas fa-minus',
            sale_completed: 'fas fa-shopping-cart',
            sale_updated: 'fas fa-edit',
            milestone: 'fas fa-trophy',
            collection_stats: 'fas fa-chart-bar',
            system: 'fas fa-cog'
        };

        return iconMap[activityType] || 'fas fa-info-circle';
    }

    /**
     * Get badge style for activity status
     * @param {string} status - Activity status (active, archived, hidden)
     * @returns {Object} Badge styling classes
     */
    static getBadgeClasses(status) {
        const statusBadgeMap = {
            active: {
                bg: 'bg-green-100',
                text: 'text-green-800',
                border: 'border-green-200'
            },
            archived: {
                bg: 'bg-gray-100',
                text: 'text-gray-800',
                border: 'border-gray-200'
            },
            hidden: {
                bg: 'bg-yellow-100',
                text: 'text-yellow-800',
                border: 'border-yellow-200'
            }
        };

        return statusBadgeMap[status] || statusBadgeMap.active;
    }

    /**
     * Get comprehensive styling for activity
     * @param {Object} activity - Activity document
     * @returns {Object} Complete styling information
     */
    static getActivityStyling(activity) {
        const metadataColor = activity.metadata?.color;
        const activityType = activity.type;
        const { priority } = activity;
        const { status } = activity;

        return {
            // Primary color classes (priority: metadata > type > priority)
            colorClasses: metadataColor
                ? this.getColorClasses(metadataColor)
                : this.getColorClassesByType(activityType),

            // Alternative color schemes
            typeColors: this.getColorClassesByType(activityType),
            priorityColors: this.getColorClassesByPriority(priority),

            // UI elements
            iconClass: this.getIconClass(activityType),
            badgeClasses: this.getBadgeClasses(status),

            // Utility
            primaryColor: metadataColor || this.getTypeColor(activityType)
        };
    }

    /**
     * Get primary color name for activity type
     * @param {string} activityType - Activity type constant
     * @returns {string} Color name
     */
    static getTypeColor(activityType) {
        const typeColorMap = {
            card_added: 'emerald',
            card_updated: 'amber',
            card_deleted: 'red',
            price_update: 'purple',
            auction_created: 'indigo',
            auction_updated: 'amber',
            auction_deleted: 'red',
            auction_item_added: 'emerald',
            auction_item_removed: 'red',
            sale_completed: 'emerald',
            sale_updated: 'amber',
            milestone: 'purple',
            collection_stats: 'indigo',
            system: 'indigo'
        };

        return typeColorMap[activityType] || 'indigo';
    }

    /**
     * Get all available colors for activity customization
     * @returns {Array} Available color options
     */
    static getAvailableColors() {
        return [
            { name: 'emerald', label: 'Emerald', preview: 'bg-emerald-500' },
            { name: 'amber', label: 'Amber', preview: 'bg-amber-500' },
            { name: 'purple', label: 'Purple', preview: 'bg-purple-500' },
            { name: 'indigo', label: 'Indigo', preview: 'bg-indigo-500' },
            { name: 'red', label: 'Red', preview: 'bg-red-500' }
        ];
    }

    /**
     * Validate color name
     * @param {string} color - Color name to validate
     * @returns {boolean} Whether color is valid
     */
    static isValidColor(color) {
        const validColors = ['emerald', 'amber', 'purple', 'indigo', 'red'];

        return validColors.includes(color);
    }
}

export default ActivityColorService;
