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

    /**
     * Get detailed health information for monitoring systems
     */
    async getDetailedHealth(req, res) {
        console.log('[DEBUG] HealthController.getDetailedHealth called');
        
        const startTime = Date.now();
        
        try {
            const healthData = await this.healthService.getDetailedHealthInfo();
            const responseTime = Date.now() - startTime;
            
            healthData.meta = {
                controller: 'HealthController', 
                method: 'getDetailedHealth',
                responseTime: `${responseTime}ms`,
                timestamp: new Date().toISOString()
            };

            const statusCode = healthData.status === 'UP' ? 200 : 503;
            
            res.status(statusCode).json({
                success: healthData.status === 'UP',
                ...healthData
            });
            
        } catch (error) {
            console.error('[ERROR] Detailed health check failed', error);
            
            const responseTime = Date.now() - startTime;
            
            res.status(503).json({
                success: false,
                status: 'DOWN',
                error: {
                    message: 'Detailed health check failure',
                    details: error.message
                },
                meta: {
                    controller: 'HealthController',
                    method: 'getDetailedHealth', 
                    responseTime: `${responseTime}ms`,
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    /**
     * Get readiness probe - for container orchestration
     * Checks if service is ready to accept traffic
     */
    async getReadiness(req, res) {
        console.log('[DEBUG] HealthController.getReadiness called');
        
        try {
            const isReady = await this.healthService.checkReadiness();
            
            const statusCode = isReady ? 200 : 503;
            const status = isReady ? 'READY' : 'NOT_READY';
            
            res.status(statusCode).json({
                success: isReady,
                data: {
                    status: status,
                    ready: isReady,
                    timestamp: new Date().toISOString()
                },
                meta: {
                    controller: 'HealthController',
                    method: 'getReadiness',
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('[ERROR] Readiness check failed', error);
            
            res.status(503).json({
                success: false,
                data: {
                    status: 'NOT_READY',
                    ready: false,
                    error: {
                        message: 'Readiness check failed',
                        details: error.message
                    },
                    timestamp: new Date().toISOString()
                },
                meta: {
                    controller: 'HealthController',
                    method: 'getReadiness',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    /**
     * Get liveness probe - for container orchestration  
     * Checks if service is alive and should be restarted if not
     */
    async getLiveness(req, res) {
        console.log('[DEBUG] HealthController.getLiveness called');
        
        try {
            const isAlive = await this.healthService.checkLiveness();
            
            const statusCode = isAlive ? 200 : 503;
            const status = isAlive ? 'ALIVE' : 'DEAD';
            
            res.status(statusCode).json({
                success: isAlive,
                data: {
                    status: status,
                    alive: isAlive,
                    timestamp: new Date().toISOString()
                },
                meta: {
                    controller: 'HealthController',
                    method: 'getLiveness',
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('[ERROR] Liveness check failed', error);
            
            res.status(503).json({
                success: false,
                data: {
                    status: 'DEAD',
                    alive: false,
                    error: {
                        message: 'Liveness check failed',
                        details: error.message
                    },
                    timestamp: new Date().toISOString()
                },
                meta: {
                    controller: 'HealthController',
                    method: 'getLiveness',
                    timestamp: new Date().toISOString()
                }
            });
        }
    }
}