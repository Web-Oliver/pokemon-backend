import express from 'express';
import {validationMiddlewares} from '@/system/middleware/validationMiddleware.js';

/**
 * CRUD Route Factory
 *
 * Creates standardized CRUD routes for resources to eliminate duplication
 * and ensure consistency across the API.
 *
 * Following DRY and SOLID principles:
 * - Eliminates route definition duplication
 * - Provides consistent API patterns
 * - Allows customization through configuration
 */

/**
 * Creates a complete CRUD router for a resource
 *
 * @param {Object} controller - Controller instance with CRUD methods
 * @param {Object} options - Configuration options
 * @param {boolean} options.includeMarkAsSold - Include POST /:id/mark-sold route
 * @param {Array} options.middleware - Global middleware to apply to all routes
 * @param {Object} options.routeMiddleware - Middleware for specific routes
 * @param {Array} options.customRoutes - Additional custom routes
 * @param {Object} options.routeOptions - Route-specific options
 * @returns {express.Router} - Configured Express router
 */
function createCRUDRoutes(controller, options = {}) {
    const {
        includeMarkAsSold = true,
        middleware = [],
        routeMiddleware = {},
        customRoutes = [],
        routeOptions = {}
    } = options;

    const router = express.Router();

    // Apply global middleware
    if (middleware.length > 0) {
        router.use(...middleware);
    }

    // GET / - Get all entities
    const getAllMiddleware = routeMiddleware.getAll || [];

    router.get(
        '/',
        validationMiddlewares.validatePaginationQuery,
        ...getAllMiddleware,
        controller.getAll
    );

    // GET /:id - Get single entity by ID
    const getByIdMiddleware = routeMiddleware.getById || [];

    router.get(
        '/:id',
        validationMiddlewares.validateObjectIdParam,
        ...getByIdMiddleware,
        controller.getById
    );

    // POST / - Create entity
    const createMiddleware = routeMiddleware.create || [];

    router.post(
        '/',
        ...createMiddleware,
        controller.create
    );

    // PUT /:id - Update entity by ID
    const updateMiddleware = routeMiddleware.update || [];

    router.put(
        '/:id',
        validationMiddlewares.validateObjectIdParam,
        ...updateMiddleware,
        controller.update
    );

    // DELETE /:id - Delete entity by ID
    const deleteMiddleware = routeMiddleware.delete || [];

    router.delete(
        '/:id',
        validationMiddlewares.validateObjectIdParam,
        ...deleteMiddleware,
        controller.delete
    );

    // POST /:id/mark-sold - Mark entity as sold (conditional)
    if (includeMarkAsSold && controller.markAsSold) {
        const markAsSoldMiddleware = routeMiddleware.markAsSold || [];

        router.post('/:id/mark-sold', validationMiddlewares.validateObjectIdParam, ...markAsSoldMiddleware, controller.markAsSold);
    }

    // BULK/BATCH ROUTES REMOVED
    // Frontend genericApiOperations.ts explicitly removed bulk operations
    // Removed to avoid over-engineering and maintain DRY/SOLID principles

    // Add custom routes
    customRoutes.forEach((route) => {
        const {method = 'get', path, handler, middleware: routeSpecificMiddleware = []} = route;

        const handlerFunction = typeof handler === 'string' ? controller[handler] : handler;

        if (handlerFunction) {
            router[method.toLowerCase()](path, ...routeSpecificMiddleware, handlerFunction);
        } else {
            console.warn(`Handler ${handler} not found on controller for route ${method.toUpperCase()} ${path}`);
        }
    });

    return router;
}

/**
 * Creates a read-only router for a resource (GET routes only)
 *
 * @param {Object} controller - Controller instance with read methods
 * @param {Object} options - Configuration options
 * @returns {express.Router} - Configured Express router
 */
function createReadOnlyRoutes(controller, options = {}) {
    const {middleware = [], routeMiddleware = {}, customRoutes = []} = options;

    const router = express.Router();

    // Apply global middleware
    if (middleware.length > 0) {
        router.use(...middleware);
    }

    // GET / - Get all entities
    const getAllMiddleware = routeMiddleware.getAll || [];

    router.get('/', ...getAllMiddleware, controller.getAll);

    // GET /:id - Get single entity by ID
    const getByIdMiddleware = routeMiddleware.getById || [];

    router.get('/:id', ...getByIdMiddleware, controller.getById);

    // Add custom routes
    customRoutes.forEach((route) => {
        const {method = 'get', path, handler, middleware: routeSpecificMiddleware = []} = route;

        const handlerFunction = typeof handler === 'string' ? controller[handler] : handler;

        if (handlerFunction) {
            router[method.toLowerCase()](path, ...routeSpecificMiddleware, handlerFunction);
        } else {
            console.warn(`Handler ${handler} not found on controller for route ${method.toUpperCase()} ${path}`);
        }
    });

    return router;
}

/**
 * Creates a collection item router (cards, sealed products)
 * with standard CRUD operations plus mark-as-sold functionality
 *
 * @param {Object} controller - Controller instance
 * @param {Object} options - Configuration options
 * @returns {express.Router} - Configured Express router
 */
function createCollectionItemRoutes(controller, options = {}) {
    return createCRUDRoutes(controller, {
        includeMarkAsSold: true,
        ...options
    });
}

/**
 * Creates a reference data router (sets, reference products)
 * with read-only operations plus search functionality
 *
 * @param {Object} controller - Controller instance
 * @param {Object} options - Configuration options
 * @returns {express.Router} - Configured Express router
 */
function createReferenceDataRoutes(controller, options = {}) {
    return createReadOnlyRoutes(controller, options);
}

/**
 * Creates a router with search capabilities
 *
 * @param {Object} controller - Controller instance
 * @param {Object} options - Configuration options
 * @param {Array} options.searchRoutes - Search route configurations
 * @returns {express.Router} - Configured Express router
 */
function createSearchableRoutes(controller, options = {}) {
    const {searchRoutes = []} = options;

    const router = createReadOnlyRoutes(controller, options);

    // Add search routes
    searchRoutes.forEach((route) => {
        const {path = '/search', handler = 'search', method = 'get', middleware: routeSpecificMiddleware = []} = route;

        const handlerFunction = typeof handler === 'string' ? controller[handler] : handler;

        if (handlerFunction) {
            router[method.toLowerCase()](path, ...routeSpecificMiddleware, handlerFunction);
        } else {
            console.warn(`Search handler ${handler} not found on controller`);
        }
    });

    return router;
}

/**
 * Route factory configuration presets
 */
const ROUTE_PRESETS = {
    // Standard collection item (cards, sealed products)
    COLLECTION_ITEM: {
        includeMarkAsSold: true,
        middleware: [],
        routeMiddleware: {},
        customRoutes: []
    },

    // Reference data (sets, reference products)
    REFERENCE_DATA: {
        includeMarkAsSold: false,
        middleware: [],
        routeMiddleware: {},
        customRoutes: []
    },

    // Activity/audit logs
    ACTIVITY_LOG: {
        includeMarkAsSold: false,
        middleware: [],
        routeMiddleware: {},
        customRoutes: [
            {method: 'get', path: '/stats', handler: 'getStats'},
            {method: 'post', path: '/:id/read', handler: 'markAsRead'}
        ]
    },

    // Analytics/reporting
    ANALYTICS: {
        includeMarkAsSold: false,
        middleware: [],
        routeMiddleware: {},
        customRoutes: [
            {method: 'get', path: '/summary', handler: 'getSummary'},
            {method: 'get', path: '/export', handler: 'exportData'}
        ]
    }
};

export {
    createCRUDRoutes,
    createReadOnlyRoutes,
    createCollectionItemRoutes,
    createReferenceDataRoutes,
    createSearchableRoutes,
    ROUTE_PRESETS
};
export default createCRUDRoutes;

