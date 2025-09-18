import mongoose from 'mongoose';
import fs from 'fs/promises';
import path from 'path';
import { ImageAnnotatorClient } from '@google-cloud/vision';

/**
 * HealthService - Comprehensive Dependency Health Checks
 *
 * Performs health checks on all critical system dependencies:
 * - MongoDB database connectivity via mongoose
 * - Node-cache in-memory cache functionality
 * - Google Vision API accessibility
 * - File system access (upload directories)
 * - System resources and metrics
 */
export default class HealthService {
    constructor(dependencies = {}) {
        console.log('[DEBUG] HealthService instantiated');

        // Inject dependencies for testing
        this.cacheManager = dependencies.cacheManager;
        this.visionClient = dependencies.visionClient;
        this.uploadPath = dependencies.uploadPath || './uploads';

        // Initialize Google Vision client if not injected
        if (!this.visionClient) {
            try {
                this.visionClient = new ImageAnnotatorClient();
            } catch (error) {
                console.warn('[WARN] Google Vision client initialization failed', error.message);
                this.visionClient = null;
            }
        }
    }

    /**
     * Perform comprehensive health checks on all dependencies
     * @returns {Promise<Object>} Complete health status
     */
    async performHealthChecks() {
        const startTime = Date.now();

        try {
            // Run all health checks in parallel for speed
            const [
                databaseCheck,
                cacheCheck,
                visionCheck,
                filesystemCheck,
                systemCheck
            ] = await Promise.allSettled([
                this.checkDatabase(),
                this.checkCache(),
                this.checkGoogleVision(),
                this.checkFilesystem(),
                this.checkSystemResources()
            ]);

            const checks = {
                database: this.processCheckResult(databaseCheck, 'MongoDB'),
                cache: this.processCheckResult(cacheCheck, 'Node-cache'),
                googleVision: this.processCheckResult(visionCheck, 'Google Vision API'),
                filesystem: this.processCheckResult(filesystemCheck, 'File System'),
                system: this.processCheckResult(systemCheck, 'System Resources')
            };

            // Determine overall status
            const criticalFailures = Object.values(checks)
                .filter(check => check.status === 'DOWN' && check.critical);

            const degradedServices = Object.values(checks)
                .filter(check => check.status === 'DOWN' && !check.critical);

            let overallStatus = 'UP';
            if (criticalFailures.length > 0) {
                overallStatus = 'DOWN';
            } else if (degradedServices.length > 0) {
                overallStatus = 'DEGRADED';
            }

            const totalTime = Date.now() - startTime;

            return {
                status: overallStatus,
                timestamp: new Date().toISOString(),
                responseTime: `${totalTime}ms`,
                checks: checks,
                summary: {
                    total: Object.keys(checks).length,
                    healthy: Object.values(checks).filter(c => c.status === 'UP').length,
                    unhealthy: Object.values(checks).filter(c => c.status === 'DOWN').length,
                    critical: criticalFailures.length,
                    degraded: degradedServices.length
                }
            };

        } catch (error) {
            console.error('[ERROR] Health check system failure', error);
            throw new Error(`Health check system failure: ${error.message}`);
        }
    }


    /**
     * Check MongoDB database connectivity
     * @private
     */
    async checkDatabase() {
        const startTime = Date.now();

        try {
            // Check if mongoose is connected
            if (mongoose.connection.readyState !== 1) {
                throw new Error(`MongoDB connection state: ${mongoose.connection.readyState}`);
            }

            // Perform a ping to verify connectivity
            await mongoose.connection.db.admin().ping();

            const responseTime = Date.now() - startTime;

            return {
                status: 'UP',
                responseTime: `${responseTime}ms`,
                details: {
                    connectionState: mongoose.connection.readyState,
                    host: mongoose.connection.host,
                    port: mongoose.connection.port,
                    database: mongoose.connection.name
                },
                critical: true
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('[ERROR] Database health check failed', error);

            return {
                status: 'DOWN',
                responseTime: `${responseTime}ms`,
                error: error.message,
                details: {
                    connectionState: mongoose.connection.readyState
                },
                critical: true
            };
        }
    }

    /**
     * Check node-cache functionality
     * @private
     */
    async checkCache() {
        const startTime = Date.now();

        try {
            if (!this.cacheManager) {
                throw new Error('Cache manager not available');
            }

            // Test cache set/get functionality
            const testKey = `health_check_${Date.now()}`;
            const testValue = 'health_test_value';

            this.cacheManager.set(testKey, testValue, 10); // 10 second TTL
            const retrievedValue = this.cacheManager.get(testKey);

            if (retrievedValue !== testValue) {
                throw new Error('Cache set/get test failed');
            }

            // Clean up test key
            this.cacheManager.del(testKey);

            const responseTime = Date.now() - startTime;
            const stats = this.cacheManager.getStats();

            return {
                status: 'UP',
                responseTime: `${responseTime}ms`,
                details: {
                    type: 'node-cache',
                    keys: stats.keys,
                    hits: stats.hits,
                    misses: stats.misses,
                    hitRate: stats.hits > 0 ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%' : '0%'
                },
                critical: false
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('[ERROR] Cache health check failed', error);

            return {
                status: 'DOWN',
                responseTime: `${responseTime}ms`,
                error: error.message,
                critical: false
            };
        }
    }

    /**
     * Check Google Vision API accessibility
     * @private
     */
    async checkGoogleVision() {
        const startTime = Date.now();

        try {
            if (!this.visionClient) {
                throw new Error('Google Vision client not initialized');
            }

            // We can't easily test the API without making a real call
            // So we just verify the client is initialized properly
            const responseTime = Date.now() - startTime;

            return {
                status: 'UP',
                responseTime: `${responseTime}ms`,
                details: {
                    service: 'Google Cloud Vision API',
                    clientInitialized: true,
                    note: 'Client initialized - actual API calls tested during OCR operations'
                },
                critical: false
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('[ERROR] Google Vision health check failed', error);

            return {
                status: 'DOWN',
                responseTime: `${responseTime}ms`,
                error: error.message,
                critical: false
            };
        }
    }

    /**
     * Check filesystem access (upload directories)
     * @private
     */
    async checkFilesystem() {
        const startTime = Date.now();

        try {
            // Check if upload directory exists and is writable
            const uploadDir = path.resolve(this.uploadPath);

            // Check directory exists
            await fs.access(uploadDir, fs.constants.F_OK);

            // Check directory is writable
            await fs.access(uploadDir, fs.constants.W_OK);

            // Test write/read/delete
            const testFile = path.join(uploadDir, `health_test_${Date.now()}.tmp`);
            const testContent = 'health_check_test';

            await fs.writeFile(testFile, testContent);
            const readContent = await fs.readFile(testFile, 'utf8');

            if (readContent !== testContent) {
                throw new Error('File write/read test failed');
            }

            // Clean up test file
            await fs.unlink(testFile);

            const responseTime = Date.now() - startTime;

            return {
                status: 'UP',
                responseTime: `${responseTime}ms`,
                details: {
                    uploadPath: uploadDir,
                    permissions: 'read/write',
                    testPassed: true
                },
                critical: true
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('[ERROR] Filesystem health check failed', error);

            return {
                status: 'DOWN',
                responseTime: `${responseTime}ms`,
                error: error.message,
                details: {
                    uploadPath: path.resolve(this.uploadPath)
                },
                critical: true
            };
        }
    }

    /**
     * Check system resources
     * @private
     */
    async checkSystemResources() {
        const startTime = Date.now();

        try {
            const memUsage = process.memoryUsage();
            const uptime = process.uptime();

            // Check if memory usage is concerning (>90% of heap limit)
            const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            const isMemoryHigh = memoryUsagePercent > 90;

            const responseTime = Date.now() - startTime;

            return {
                status: isMemoryHigh ? 'DEGRADED' : 'UP',
                responseTime: `${responseTime}ms`,
                details: {
                    uptime: {
                        seconds: Math.floor(uptime),
                        formatted: this.formatUptime(uptime)
                    },
                    memory: {
                        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
                        usagePercent: `${memoryUsagePercent.toFixed(1)}%`,
                        isHigh: isMemoryHigh
                    },
                    process: {
                        pid: process.pid,
                        version: process.version,
                        platform: process.platform,
                        arch: process.arch
                    }
                },
                critical: true
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            console.error('[ERROR] System resources health check failed', error);

            return {
                status: 'DOWN',
                responseTime: `${responseTime}ms`,
                error: error.message,
                critical: true
            };
        }
    }

    /**
     * Get detailed system information
     * @private
     */
    async getDetailedSystemInfo() {
        try {
            const memUsage = process.memoryUsage();

            return {
                detailed: true,
                resourceUsage: {
                    cpu: {
                        usage: process.cpuUsage()
                    },
                    memory: {
                        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
                        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
                        arrayBuffers: `${Math.round(memUsage.arrayBuffers / 1024 / 1024)}MB`
                    }
                },
                environment: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                    nodeEnv: process.env.NODE_ENV || 'development'
                }
            };
        } catch (error) {
            return {
                error: 'Failed to get detailed system info',
                details: error.message
            };
        }
    }

    /**
     * Process check result from Promise.allSettled
     * @private
     */
    processCheckResult(result, serviceName) {
        if (result.status === 'fulfilled') {
            return result.value;
        } else {
            console.error(`[ERROR] ${serviceName} health check rejected`, result.reason);
            return {
                status: 'DOWN',
                error: result.reason?.message || 'Health check failed',
                responseTime: 'timeout',
                critical: true
            };
        }
    }

    /**
     * Format uptime into human readable string
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