import { API_CATEGORIES, API_ENDPOINTS, SYSTEM_INFO } from '@/system/constants/EndpointsConfig.js';

/**
 * Service for handling system status information
 */

/**
 * StatusService - Completely Standalone
 *
 * Provides static API information and basic system metrics.
 * No database connections, no BaseService inheritance, no external dependencies.
 * Pure static information service.
 */
export default class StatusService {
    constructor() {
        console.log('[DEBUG] StatusService instantiated - standalone service');
        // No dependencies - completely standalone
    }

    /**
     * Get complete API endpoint information
     * @returns {Promise<Object>} Complete API endpoint data
     */
    async getApiInformation() {
        try {
            return {
                system: SYSTEM_INFO,
                endpoints: API_ENDPOINTS,
                categories: API_CATEGORIES,
                summary: {
                    totalEndpoints: this.countTotalEndpoints(),
                    totalCategories: Object.keys(API_ENDPOINTS).length,
                    totalFeatures: SYSTEM_INFO.features.length
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ERROR] Failed to get API information', error);
            throw new Error('API information retrieval failed');
        }
    }


    /**
     * Get endpoints by category
     * @param {string} category - Category name
     * @returns {Promise<Object>} Category endpoint data
     */
    async getEndpointsByCategory(category) {
        try {
            if (!API_ENDPOINTS[category]) {
                throw new Error(`Category '${category}' not found`);
            }

            return {
                category: category,
                endpoints: API_ENDPOINTS[category],
                endpointCount: Object.keys(API_ENDPOINTS[category]).length,
                description: this.getCategoryDescription(category),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ERROR] Failed to get endpoints by category', error);
            throw error;
        }
    }

    /**
     * Get available categories
     * @returns {Promise<Object>} Available categories data
     */
    async getCategories() {
        try {
            const categories = {};
            Object.keys(API_ENDPOINTS).forEach(category => {
                categories[category] = {
                    name: category,
                    endpointCount: Object.keys(API_ENDPOINTS[category]).length,
                    description: this.getCategoryDescription(category)
                };
            });

            return {
                categories: categories,
                totalCategories: Object.keys(categories).length,
                organizationalGroups: API_CATEGORIES,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ERROR] Failed to get categories', error);
            throw new Error('Categories retrieval failed');
        }
    }

    /**
     * Get API summary statistics
     * @returns {Promise<Object>} API summary data
     */
    async getApiSummary() {
        try {
            const endpointStats = {};
            Object.keys(API_ENDPOINTS).forEach(category => {
                endpointStats[category] = Object.keys(API_ENDPOINTS[category]).length;
            });

            return {
                totalEndpoints: this.countTotalEndpoints(),
                totalCategories: Object.keys(API_ENDPOINTS).length,
                endpointsByCategory: endpointStats,
                features: SYSTEM_INFO.features,
                architecture: SYSTEM_INFO.architecture,
                system: {
                    name: SYSTEM_INFO.name,
                    version: SYSTEM_INFO.version,
                    description: SYSTEM_INFO.description
                },
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('[ERROR] Failed to get API summary', error);
            throw new Error('API summary retrieval failed');
        }
    }

    /**
     * Helper method to count total endpoints
     * @private
     */
    countTotalEndpoints() {
        let total = 0;
        Object.values(API_ENDPOINTS).forEach(categoryEndpoints => {
            total += Object.keys(categoryEndpoints).length;
        });
        return total;
    }

    /**
     * Helper method to get category description
     * @private
     */
    getCategoryDescription(category) {
        const descriptions = {
            status: 'System status and health monitoring endpoints',
            search: 'Multi-engine search capabilities across all entities',
            cards: 'Pokemon card data management and retrieval',
            sets: 'Pokemon set information and card relationships',
            products: 'Pokemon product catalog and management',
            setProducts: 'Set-specific product information and statistics',
            collection: 'Personal collection management and exports',
            activities: 'Activity tracking and history management',
            icr: 'Image Character Recognition and OCR processing',
            auctions: 'Auction management and item tracking',
            sales: 'Sales data and analytics',
            marketplace: 'External marketplace integrations (DBA, Facebook)',
            uploads: 'File upload and image processing',
            workflow: 'Business process and workflow management',
            management: 'System administration and cache management'
        };
        return descriptions[category] || 'API endpoint category';
    }

    /**
     * Helper method to format uptime
     * @private
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m ${secs}s`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}