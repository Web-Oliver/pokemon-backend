/**
 * Modern Products Controller
 *
 * Refactored to use BaseController pattern and ProductService for:
 * - Consistent architecture across all controllers
 * - Unified response formats
 * - Built-in caching, metrics, and plugin support
 * - Service layer abstraction (no more direct model access)
 * - SOLID principles compliance
 */

import BaseController from '@/system/middleware/BaseController.js';
import {asyncHandler} from '@/system/middleware/CentralizedErrorHandler.js';
import Logger from '@/system/logging/Logger.js';
import {ControllerExportFactory} from '@/system/factories/ControllerExportFactory.js';

// Legacy direct model imports - kept for compatibility during transition
/**
 * Enhanced Products Controller using BaseController pattern
 * Provides consistent architecture and service layer abstraction
 */
class ProductsController extends BaseController {
    /**
     * Get all products with search and filtering support
     * Overrides BaseController.getAll for product-specific logic
     */
    getAll = asyncHandler(async (req, res) => {
        const operation = 'getAll';
        const context = {req, res, operation};

        Logger.operationStart('Products', 'GET ALL', req.query);

        try {
            // Execute before operation hooks
            await this.executeHooks('beforeOperation', operation, req.query, context);

            // Extract query parameters
            const {name, setName, category, page, limit, q, search, available} = req.query;
            const searchQuery = q || search || name || setName;

            // Build filters
            const filters = {};
            if (category) filters.category = category;
            if (setName) filters.setName = setName;
            if (available === 'true') filters.available = true;

            // Build options
            const options = {
                page: parseInt(page, 10) || 1,
                limit: parseInt(limit, 10) || this.options.defaultLimit,
                maxLimit: 100,
                searchQuery,
                sortBy: 'available',
                sortOrder: -1
            };

            // Use ProductService for consistent data access (injected via BaseController)
            const result = await this.service.getAllProducts(filters, options);

            // Execute after operation hooks
            await this.executeHooks('afterOperation', operation, result, context);

            Logger.operationSuccess('Products', 'GET ALL', {
                found: result.products.length,
                total: result.pagination.total,
                searchUsed: Boolean(searchQuery)
            });

            let responseData = {
                success: true,
                data: {
                    products: result.products,
                    total: result.pagination.total,
                    currentPage: result.pagination.currentPage,
                    totalPages: result.pagination.totalPages,
                    hasNextPage: result.pagination.hasNextPage,
                    hasPrevPage: result.pagination.hasPrevPage,
                    count: result.pagination.count,
                    limit: result.pagination.limit
                },
                pagination: result.pagination
            };

            // Execute before response hooks
            responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            await this.executeHooks('onError', operation, error, context);
            Logger.operationError('Products', 'GET ALL', error, req.query);
            throw error;
        }
    });
    /**
     * Get product by ID
     * Uses service layer with BaseController error handling
     */
    getById = asyncHandler(async (req, res) => {
        const operation = 'getById';
        const context = {req, res, operation, entityId: req.params.id};

        Logger.operationStart('Product', 'GET BY ID', {id: req.params.id});

        try {
            // Execute before operation hooks
            await this.executeHooks('beforeOperation', operation, {id: req.params.id}, context);

            // Use ProductService for consistent data access (injected via BaseController)
            const product = await this.service.getProductById(req.params.id);

            // Execute after operation hooks
            await this.executeHooks('afterOperation', operation, product, context);

            Logger.operationSuccess('Product', 'GET BY ID', {productId: product._id});

            let responseData = {
                success: true,
                data: product
            };

            // Execute before response hooks
            responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            await this.executeHooks('onError', operation, error, context);
            Logger.operationError('Product', 'GET BY ID', error, {id: req.params.id});
            throw error;
        }
    });
    /**
     * Get product set names with metadata
     * Product-specific business logic using service layer
     */
    getSetNames = asyncHandler(async (req, res) => {
        const operation = 'getSetNames';
        const context = {req, res, operation};

        Logger.operationStart('Products', 'GET SET NAMES', req.query);

        try {
            // Execute before operation hooks
            await this.executeHooks('beforeOperation', operation, req.query, context);

            const {q, search} = req.query;
            const searchQuery = q || search;

            // Use ProductService for consistent data access (injected via BaseController)
            const setNames = await this.service.getProductSetNames(searchQuery);

            // Execute after operation hooks
            await this.executeHooks('afterOperation', operation, setNames, context);

            Logger.operationSuccess('Products', 'GET SET NAMES', {
                found: setNames.length,
                searchUsed: Boolean(searchQuery)
            });

            let responseData = {
                success: true,
                data: setNames
            };

            // Execute before response hooks
            responseData = await this.executeHooks('beforeResponse', operation, responseData, context);

            res.status(200).json(responseData);
        } catch (error) {
            // Execute error hooks
            await this.executeHooks('onError', operation, error, context);
            Logger.operationError('Products', 'GET SET NAMES', error, req.query);
            throw error;
        }
    });

    constructor() {
        super('ProductService', {
            entityName: 'Product',
            pluralName: 'products',
            enableCaching: true,
            enableMetrics: true,
            // Custom configuration for products
            defaultLimit: 20,
            defaultSort: {available: -1, price: 1, _id: 1},
            filterableFields: ['category', 'setName', 'available', 'minPrice', 'maxPrice']
        });

        // ProductService will be available as this.service via BaseController DI
        // No need to manually instantiate - handled by dependency injection

    }
}

// Use ControllerExportFactory to eliminate duplication
const controllerExports = ControllerExportFactory.createPokemonControllerExports(ProductsController, {
    entityName: 'Product',
    pluralName: 'products',
    includeMetrics: true,
    customMethods: ['getSetNames']
});

// Add custom method implementation for getSetNames
controllerExports.getSetNames = (req, res, next) => controllerExports.getController().getSetNames(req, res, next);

// Export all methods generated by factory
export const {
    getAll: getAllProducts,
    getById: getProductById,
    getSetNames: getProductSetNames,
    // Controller getter
    getProductsController
} = controllerExports;

// Default export for backward compatibility
export default getAllProducts;
