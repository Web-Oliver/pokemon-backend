/**
 * Endpoints Documentation Service
 *
 * SOLID Principles:
 * - Single Responsibility: Manages endpoint metadata and documentation
 * - Open/Closed: Extensible through configuration without modifying core logic
 * - Interface Segregation: Focused interface for endpoint documentation
 * - Dependency Inversion: Depends on abstractions, not concrete implementations
 *
 * Note: Does not extend BaseService as it doesn't need repository functionality
 */
export default class EndpointsService {
    constructor(logger) {
        this.logger = logger;
        this.endpointsCache = null;
        this.lastCacheTime = null;
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get comprehensive endpoint documentation
     * Uses caching to avoid expensive computation on each request
     */
    async getEndpointsDocumentation() {
        if (this._isCacheValid()) {
            console.log('Returning cached endpoints documentation');
            return this.endpointsCache;
        }

        console.log('Generating fresh endpoints documentation');
        const documentation = await this._generateEndpointsDocumentation();

        this.endpointsCache = documentation;
        this.lastCacheTime = Date.now();

        return documentation;
    }

    /**
     * Clear cache to force regeneration
     */
    clearCache() {
        this.endpointsCache = null;
        this.lastCacheTime = null;
        console.log('Endpoints cache cleared');
    }

    /**
     * Check if cache is still valid
     * @private
     */
    _isCacheValid() {
        return this.endpointsCache &&
            this.lastCacheTime &&
            (Date.now() - this.lastCacheTime) < this.cacheTimeout;
    }

    /**
     * Generate comprehensive endpoints documentation
     * @private
     */
    async _generateEndpointsDocumentation() {
        const endpoints = {
            meta: {
                version: '2.0',
                generatedAt: new Date().toISOString(),
                totalEndpoints: 0,
                baseUrl: process.env.API_BASE_URL || 'http://localhost:3000/api'
            },
            categories: {}
        };

        // System & Status endpoints
        endpoints.categories.system = this._getSystemEndpoints();

        // Collection endpoints
        endpoints.categories.collections = this._getCollectionEndpoints();

        // Pokemon data endpoints
        endpoints.categories.pokemon = this._getPokemonEndpoints();

        // Search endpoints
        endpoints.categories.search = this._getSearchEndpoints();

        // ICR (Image Character Recognition) endpoints
        endpoints.categories.icr = this._getIcrEndpoints();

        // Marketplace endpoints
        endpoints.categories.marketplace = this._getMarketplaceEndpoints();

        // Activity endpoints
        endpoints.categories.activities = this._getActivityEndpoints();

        // Upload endpoints
        endpoints.categories.uploads = this._getUploadEndpoints();

        // Workflow endpoints
        endpoints.categories.workflow = this._getWorkflowEndpoints();

        // Management endpoints
        endpoints.categories.management = this._getManagementEndpoints();

        // Calculate total endpoints
        endpoints.meta.totalEndpoints = Object.values(endpoints.categories)
            .reduce((total, category) => total + category.endpoints.length, 0);

        return endpoints;
    }

    /**
     * System and status endpoints
     * @private
     */
    _getSystemEndpoints() {
        return {
            name: 'System & Status',
            description: 'Health checks, status monitoring, and system information',
            baseRoute: '/api',
            endpoints: [
                {
                    method: 'GET',
                    path: '/',
                    summary: 'Root API information',
                    description: 'Returns basic API information and version'
                },
                {
                    method: 'GET',
                    path: '/status',
                    summary: 'Application status',
                    description: 'Returns application status and basic metrics'
                },
                {
                    method: 'GET',
                    path: '/health',
                    summary: 'Health check with metrics',
                    description: 'Comprehensive health check including cache and memory metrics'
                },
                {
                    method: 'GET',
                    path: '/endpoints',
                    summary: 'Get all endpoints documentation',
                    description: 'Comprehensive documentation of all API endpoints with request/response schemas'
                },
                {
                    method: 'GET',
                    path: '/endpoints/summary',
                    summary: 'Get endpoints summary',
                    description: 'Condensed overview of all API categories and endpoint counts'
                },
                {
                    method: 'GET',
                    path: '/endpoints/openapi',
                    summary: 'Get OpenAPI specification',
                    description: 'OpenAPI 3.0 compliant specification for the entire API'
                },
                {
                    method: 'GET',
                    path: '/endpoints/category/:categoryName',
                    summary: 'Get category-specific endpoints',
                    description: 'Detailed endpoints for a specific category'
                }
            ]
        };
    }

    /**
     * Collection management endpoints
     * @private
     */
    _getCollectionEndpoints() {
        const collectionTypes = ['psa-cards', 'raw-cards', 'sealed-products'];

        return {
            name: 'Collections',
            description: 'Pokemon card and product collection management',
            baseRoute: '/api/collections',
            supportedTypes: collectionTypes,
            endpoints: collectionTypes.flatMap(type => [
                {
                    method: 'GET',
                    path: `/collections/${type}`,
                    summary: `Get all ${type}`,
                    description: `Retrieve paginated list of ${type} in collection`
                },
                {
                    method: 'GET',
                    path: `/collections/${type}/:id`,
                    summary: `Get ${type} by ID`,
                    description: `Retrieve specific ${type} by ObjectId`
                },
                {
                    method: 'POST',
                    path: `/collections/${type}`,
                    summary: `Create new ${type}`,
                    description: `Add new ${type} to collection`
                },
                {
                    method: 'PUT',
                    path: `/collections/${type}/:id`,
                    summary: `Update ${type}`,
                    description: `Update existing ${type} completely`
                },
                {
                    method: 'PATCH',
                    path: `/collections/${type}/:id`,
                    summary: `Partially update ${type}`,
                    description: `Update specific fields of ${type}. Can mark as sold using { "sold": true }`
                },
                {
                    method: 'DELETE',
                    path: `/collections/${type}/:id`,
                    summary: `Delete ${type}`,
                    description: `Remove ${type} from collection`
                }
            ])
        };
    }

    /**
     * Pokemon reference data endpoints
     * @private
     */
    _getPokemonEndpoints() {
        return {
            name: 'Pokemon Data',
            description: 'Pokemon cards, sets, and products reference data',
            baseRoute: '/api',
            endpoints: [
                {method: 'GET', path: '/sets', summary: 'Get Pokemon sets'},
                {method: 'GET', path: '/sets/:id', summary: 'Get set by ID'},
                {method: 'GET', path: '/sets/:setId/cards', summary: 'Get cards in set'},
                {method: 'GET', path: '/cards', summary: 'Get Pokemon cards'},
                {method: 'GET', path: '/cards/metrics', summary: 'Get card metrics'},
                {method: 'GET', path: '/cards/:id', summary: 'Get card by ID'},
                {method: 'GET', path: '/products', summary: 'Get Pokemon products'},
                {method: 'GET', path: '/products/:id', summary: 'Get product by ID'},
                {method: 'GET', path: '/products/set-names', summary: 'Get product set names'},
                {method: 'GET', path: '/products/search', summary: 'Search products'},
                {method: 'GET', path: '/products/categories', summary: 'Get product categories'},
                {method: 'GET', path: '/products/categories/:category', summary: 'Get products by category'},
                {method: 'GET', path: '/set-products', summary: 'Get set products'},
                {method: 'GET', path: '/set-products/search', summary: 'Search set products'},
                {method: 'GET', path: '/set-products/stats', summary: 'Get set product statistics'},
                {method: 'GET', path: '/set-products/:id', summary: 'Get set product by ID'}
            ]
        };
    }

    /**
     * Search endpoints
     * @private
     */
    _getSearchEndpoints() {
        return {
            name: 'Search',
            description: 'Multi-engine search across all Pokemon data (FlexSearch + FuseJS + MongoDB)',
            baseRoute: '/api/search',
            endpoints: [
                {method: 'GET', path: '/search', summary: 'Unified search'},
                {method: 'GET', path: '/search/suggest', summary: 'Search suggestions'},
                {method: 'GET', path: '/search/cards', summary: 'Search cards'},
                {method: 'GET', path: '/search/products', summary: 'Search products'},
                {method: 'GET', path: '/search/sets', summary: 'Search sets'},
                {method: 'GET', path: '/search/set-products', summary: 'Search set products'},
                {method: 'GET', path: '/search/stats', summary: 'Get search statistics'}
            ]
        };
    }

    /**
     * ICR (Image Character Recognition) endpoints
     * @private
     */
    _getIcrEndpoints() {
        return {
            name: 'ICR (Image Character Recognition)',
            description: 'OCR pipeline for PSA graded card processing using Google Vision API',
            baseRoute: '/api/icr',
            endpoints: [
                {method: 'POST', path: '/icr/upload', summary: 'Upload images for OCR'},
                {method: 'POST', path: '/icr/extract-labels', summary: 'Extract PSA labels'},
                {method: 'POST', path: '/icr/stitch', summary: 'Stitch images'},
                {method: 'POST', path: '/icr/ocr', summary: 'Perform OCR'},
                {method: 'POST', path: '/icr/distribute', summary: 'Distribute OCR text'},
                {method: 'POST', path: '/icr/match', summary: 'Match cards'},
                {method: 'GET', path: '/icr/scans', summary: 'Get all scans'},
                {method: 'GET', path: '/icr/scans/:id', summary: 'Get scan by ID'},
                {method: 'GET', path: '/icr/stitched', summary: 'Get stitched images'},
                {method: 'GET', path: '/icr/status', summary: 'Get processing status'},
                {method: 'POST', path: '/icr/status/check', summary: 'Check batch status'},
                {method: 'POST', path: '/icr/sync-statuses', summary: 'Sync processing statuses'},
                {method: 'GET', path: '/icr/images/full/:filename', summary: 'Get full image'},
                {method: 'GET', path: '/icr/images/labels/:filename', summary: 'Get label image'},
                {method: 'GET', path: '/icr/images/stitched/:filename', summary: 'Get stitched image'},
                {method: 'DELETE', path: '/icr/scans', summary: 'Delete scans'},
                {method: 'DELETE', path: '/icr/stitched/:id', summary: 'Delete stitched image'},
                {method: 'PUT', path: '/icr/batch/:id/select-match', summary: 'Select card match'},
                {method: 'POST', path: '/icr/create-psa', summary: 'Create PSA card'}
            ]
        };
    }

    /**
     * Marketplace endpoints
     * @private
     */
    _getMarketplaceEndpoints() {
        return {
            name: 'Marketplace',
            description: 'External marketplace integrations (DBA, Facebook)',
            baseRoute: '/api',
            endpoints: [
                {method: 'POST', path: '/dba/posts', summary: 'Post to DBA'},
                {method: 'GET', path: '/dba-selection', summary: 'Get DBA selections'},
                {method: 'POST', path: '/dba-selection', summary: 'Add to DBA selection'},
                {method: 'DELETE', path: '/dba-selection', summary: 'Remove from DBA selection'}
            ]
        };
    }

    /**
     * Activity tracking endpoints
     * @private
     */
    _getActivityEndpoints() {
        return {
            name: 'Activities',
            description: 'Collection activity tracking and history',
            baseRoute: '/api/activities',
            endpoints: [
                {method: 'GET', path: '/activities', summary: 'Get activities'},
                {method: 'GET', path: '/activities/stats', summary: 'Get activity statistics'},
                {method: 'GET', path: '/activities/types', summary: 'Get activity types'},
                {method: 'GET', path: '/activities/recent', summary: 'Get recent activities'},
                {method: 'GET', path: '/activities/:id', summary: 'Get activity by ID'},
                {method: 'POST', path: '/activities', summary: 'Create activity'},
                {method: 'DELETE', path: '/activities/:id', summary: 'Delete activity'}
            ]
        };
    }

    /**
     * Upload endpoints
     * @private
     */
    _getUploadEndpoints() {
        return {
            name: 'Uploads',
            description: 'File upload and image management',
            baseRoute: '/api',
            endpoints: [
                {method: 'POST', path: '/upload/image', summary: 'Upload single image'},
                {method: 'POST', path: '/upload/images', summary: 'Upload multiple images'},
                {method: 'DELETE', path: '/upload/cleanup', summary: 'Cleanup orphaned images'}
            ]
        };
    }

    /**
     * Workflow endpoints
     * @private
     */
    _getWorkflowEndpoints() {
        return {
            name: 'Workflow',
            description: 'OCR to Collection approval workflow',
            baseRoute: '/api/workflow',
            endpoints: []
        };
    }

    /**
     * Management endpoints
     * @private
     */
    _getManagementEndpoints() {
        return {
            name: 'Management',
            description: 'System management - cache and monitoring',
            baseRoute: '/api',
            endpoints: [
                {method: 'GET', path: '/cache/stats', summary: 'Get cache statistics'}
            ]
        };
    }
}