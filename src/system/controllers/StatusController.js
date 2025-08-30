/**
 * Simple Status Controller for system health endpoints
 * Does NOT extend BaseController - standalone utility controller
 */
export default class StatusController {
    constructor(statusService) {
        console.log('[DEBUG] StatusController instantiated - standalone controller');
        this.statusService = statusService;
    }

    /**
     * Get database status and counts
     */
    async getStatus(req, res) {
        console.log('[DEBUG] StatusController.getStatus called');
        try {
            const data = await this.statusService.getDatabaseCounts();
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
                    message: 'Failed to get database status',
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
     * Get comprehensive system status
     */
    async getSystemHealth(req, res) {
        console.log('[DEBUG] StatusController.getSystemHealth called');
        try {
            const data = await this.statusService.getSystemStatus();
            res.status(200).json({
                success: true,
                data: data,
                meta: {
                    controller: 'StatusController',
                    method: 'getSystemHealth',
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('[ERROR] System health check failed', error);
            res.status(500).json({
                success: false,
                error: {
                    message: 'Failed to get system status',
                    details: error.message
                },
                meta: {
                    controller: 'StatusController',
                    method: 'getSystemHealth',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
}