/**
 * Endpoints Documentation Controller - STANDALONE
 *
 * Does NOT extend BaseController to avoid conflicts with existing code
 * Simple, focused controller for documentation endpoints only
 */
export default class EndpointsController {
    constructor(endpointsService) {
        this.endpointsService = endpointsService;
    }

    /**
     * Get comprehensive endpoints documentation
     * GET /api/endpoints
     */
    async getEndpoints(req, res) {
        try {
            const documentation = await this.endpointsService.getEndpointsDocumentation();

            res.status(200).json({
                success: true,
                data: documentation,
                message: 'Endpoints documentation retrieved successfully',
                meta: {
                    cached: this.endpointsService._isCacheValid(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: {
                    message: error.message,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                }
            });
        }
    }


}