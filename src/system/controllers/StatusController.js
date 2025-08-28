import BaseController from '@/system/middleware/BaseController.js';
import { DatabaseError } from '@/system/errors/ErrorTypes.js';

/**
 * Controller for system status endpoints
 */
export default class StatusController extends BaseController {
    constructor(statusService) {
        super();
        this.statusService = statusService;
    }

    /**
     * Get database status and counts
     */
    async getStatus(req, res) {
        try {
            const data = await this.statusService.getDatabaseCounts();
            this.sendSuccessResponse(res, data);
        } catch (error) {
            this.logger.error('Status check failed', error);
            throw new DatabaseError('Failed to get database status');
        }
    }

    /**
     * Get comprehensive system status
     */
    async getSystemHealth(req, res) {
        try {
            const data = await this.statusService.getSystemStatus();
            this.sendSuccessResponse(res, data);
        } catch (error) {
            this.logger.error('System health check failed', error);
            throw new DatabaseError('Failed to get system status');
        }
    }
}