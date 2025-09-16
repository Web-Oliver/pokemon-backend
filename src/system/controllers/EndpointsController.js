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
  async getEndpoints(req, res, next) {
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

  /**
   * Get endpoints summary
   * GET /api/endpoints/summary
   */
  async getEndpointsSummary(req, res, next) {
    try {
      const documentation = await this.endpointsService.getEndpointsDocumentation();

      const summary = {
        meta: documentation.meta,
        categories: Object.keys(documentation.categories).map(key => ({
          name: key,
          displayName: documentation.categories[key].name,
          description: documentation.categories[key].description,
          baseRoute: documentation.categories[key].baseRoute,
          endpointCount: documentation.categories[key].endpoints.length,
          methods: [...new Set(documentation.categories[key].endpoints.map(e => e.method))]
        }))
      };

      res.status(200).json({
        success: true,
        data: summary,
        message: 'Endpoints summary retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: error.message }
      });
    }
  }

  /**
   * Get specific category documentation
   * GET /api/endpoints/category/:categoryName
   */
  async getCategoryEndpoints(req, res, next) {
    try {
      const { categoryName } = req.params;
      const documentation = await this.endpointsService.getEndpointsDocumentation();

      const category = documentation.categories[categoryName];
      if (!category) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Category '${categoryName}' not found`,
            availableCategories: Object.keys(documentation.categories)
          }
        });
      }

      res.status(200).json({
        success: true,
        data: category,
        message: `Endpoints for category '${categoryName}' retrieved successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: error.message }
      });
    }
  }

  /**
   * Clear endpoints cache
   * DELETE /api/endpoints/cache
   */
  async clearCache(req, res, next) {
    try {
      this.endpointsService.clearCache();

      res.status(200).json({
        success: true,
        data: null,
        message: 'Endpoints cache cleared successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { message: error.message }
      });
    }
  }
}