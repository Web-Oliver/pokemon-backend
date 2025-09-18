/**
 * HealthController - Comprehensive System Health Checks
 *
 * Performs health checks on all critical system dependencies:
 * - MongoDB database connectivity
 * - Node-cache in-memory cache
 * - Google Vision API accessibility
 * - File system (upload directories)
 * - System resources (memory, uptime)
 */
export default class HealthController {
    constructor(healthService) {
        console.log('[DEBUG] HealthController instantiated');
        this.healthService = healthService;
    }

    /**
     * Get comprehensive system health status
     * Returns 200 for healthy, 503 for unhealthy
     */
    async getSystemHealth(req, res) {
        console.log('[DEBUG] HealthController.getSystemHealth called');

        const startTime = Date.now();

        try {
            const healthData = await this.healthService.performHealthChecks();
            const responseTime = Date.now() - startTime;

            // Add response metadata
            healthData.meta = {
                controller: 'HealthController',
                method: 'getSystemHealth',
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            };

            // Return 503 if any critical dependencies are down
            const statusCode = healthData.status === 'UP' ? 200 : 503;

            res.status(statusCode).json({
                success: healthData.status === 'UP',
                ...healthData
            });

        } catch (error) {
            console.error('[ERROR] Health check failed', error);

            const responseTime = Date.now() - startTime;

            res.status(503).json({
                success: false,
                status: 'DOWN',
                error: {
                    message: 'Health check system failure',
                    details: error.message
                },
                meta: {
                    controller: 'HealthController',
                    method: 'getSystemHealth',
                    responseTime: `${responseTime}ms`,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }


}