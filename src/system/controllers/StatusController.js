/**
 * Simple Status Controller for system health endpoints
 * Does NOT extend BaseController - standalone utility controller
 */
import { API_ENDPOINTS, API_CATEGORIES, SYSTEM_INFO } from '@/system/constants/EndpointsConfig.js';

/**
 * StatusController - Completely Standalone
 * 
 * Returns hardcoded API endpoint information and basic system status.
 * No database connections, no service dependencies, no dynamic queries.
 * Pure static information display.
 */
export default class StatusController {
    constructor(statusService) {
        console.log('[DEBUG] StatusController instantiated');
        this.statusService = statusService;
    }

    /**
     * Get all available API endpoints
     */
    async getStatus(req, res) {
        console.log('[DEBUG] StatusController.getStatus called');
        try {
            const data = await this.statusService.getApiInformation();

            res.status(200).json({
                success: true,
                data: data,
                meta: {
                    controller: 'StatusController',
                    method: 'getStatus', 
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[ERROR] Status check failed', error);
            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to get API status',
                    details: error.message
                },
                meta: {
                    controller: 'StatusController',
                    method: 'getStatus',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }


    /**
     * Get endpoints by category
     */
    async getEndpointsByCategory(req, res) {
        console.log('[DEBUG] StatusController.getEndpointsByCategory called');
        try {
            const { category } = req.params;
            const data = await this.statusService.getEndpointsByCategory(category);

            res.status(200).json({
                success: true,
                data: data,
                meta: {
                    controller: 'StatusController',
                    method: 'getEndpointsByCategory',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[ERROR] Get endpoints by category failed', error);
            
            // Handle not found error specifically
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: {
                        message: error.message,
                        availableCategories: Object.keys(API_ENDPOINTS)
                    },
                    meta: {
                        controller: 'StatusController',
                        method: 'getEndpointsByCategory',
                        timestamp: new Date().toISOString()
                    }
                });
            }
            
            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to get endpoints by category',
                    details: error.message
                },
                meta: {
                    controller: 'StatusController',
                    method: 'getEndpointsByCategory',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

}