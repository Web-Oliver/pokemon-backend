/**
 * Modern REST-Compliant API Routes
 *
 * Implements fixes for REST violations identified in API analysis:
 * - Proper HTTP method usage
 * - Resource-based URL structure
 * - RFC 7807 Problem Details error handling
 * - Standardized response formats
 */

import express from 'express';
import {validationMiddlewares} from '@/system/middleware/validationMiddleware.js';

// Controllers
import {getSales, getSalesGraphData, getSalesSummary} from '@/collection/sales/salesController.js';
import {container, ServiceKeys} from '@/system/dependency-injection/ServiceContainer.js';
import {getAllProducts, getProductById, getProductSetNames} from '@/pokemon/products/productsController.js';
import {postToDba} from '@/marketplace/exports/exportController.js';
import {
    getCollectionExportHandler,
    getExportDownloadHandler,
    getSocialExportHandler,
    getSupportedCollectionExportFormats,
    getSupportedSocialExportTypes
} from '@/system/configuration/ExportRouteConfiguration.js';
import {cleanupAllOrphanedImages, cleanupImages, uploadImage, uploadImages} from '@/uploads/uploadController.js';
import {
    addItemToAuction,
    createAuction,
    deleteAuction,
    getAllAuctions,
    getAuctionById,
    markItemAsSold,
    removeItemFromAuction,
    updateAuction
} from '@/collection/auctions/index.js';

const router = express.Router();

// ================================
// STATUS ROUTES
// ================================
// Status endpoint using proper service layer (lazy-loaded)
router.get('/status', (req, res, next) => {
    const statusController = container.resolve(ServiceKeys.STATUS_CONTROLLER);
    statusController.getStatus(req, res, next);
});
// Health endpoints using dedicated health controller
router.get('/health', (req, res, next) => {
    const healthController = container.resolve(ServiceKeys.HEALTH_CONTROLLER);
    healthController.getSystemHealth(req, res, next);
});

router.get('/health/detailed', (req, res, next) => {
    const healthController = container.resolve(ServiceKeys.HEALTH_CONTROLLER);
    healthController.getDetailedHealth(req, res, next);
});

router.get('/health/ready', (req, res, next) => {
    const healthController = container.resolve(ServiceKeys.HEALTH_CONTROLLER);
    healthController.getReadiness(req, res, next);
});

router.get('/health/live', (req, res, next) => {
    const healthController = container.resolve(ServiceKeys.HEALTH_CONTROLLER);
    healthController.getLiveness(req, res, next);
});

// Endpoints Documentation - SOLID & DRY Implementation
router.get('/endpoints', (req, res, next) => {
    const endpointsController = container.resolve(ServiceKeys.ENDPOINTS_CONTROLLER);
    endpointsController.getEndpoints(req, res, next);
});
router.get('/endpoints/summary', (req, res, next) => {
    const endpointsController = container.resolve(ServiceKeys.ENDPOINTS_CONTROLLER);
    endpointsController.getEndpointsSummary(req, res, next);
});
router.get('/endpoints/openapi', (req, res, next) => {
    const endpointsController = container.resolve(ServiceKeys.ENDPOINTS_CONTROLLER);
    endpointsController.getOpenApiSpec(req, res, next);
});
router.get('/endpoints/category/:categoryName', (req, res, next) => {
    const endpointsController = container.resolve(ServiceKeys.ENDPOINTS_CONTROLLER);
    endpointsController.getCategoryEndpoints(req, res, next);
});
router.delete('/endpoints/cache', (req, res, next) => {
    const endpointsController = container.resolve(ServiceKeys.ENDPOINTS_CONTROLLER);
    endpointsController.clearCache(req, res, next);
});

// ================================
// SALES ROUTES
// ================================
router.get('/sales', getSales);
router.get('/sales/summary', getSalesSummary);
router.get('/sales/graph-data', getSalesGraphData);

// ================================
// PRODUCTS (SetProduct → Product hierarchy)
// ================================
router.get('/products/set-names', getProductSetNames);
router.get('/products', validationMiddlewares.validatePaginationQuery, getAllProducts);
router.get('/products/:id', validationMiddlewares.validateObjectIdParam, getProductById);

// ================================
// SOCIAL EXPORTS RESOURCE - REST COMPLIANT
// ================================
// Configuration-driven social exports
router.post('/collections/social-exports', validationMiddlewares.validateExportBody, (req, res, next) => {
    const {type} = req.body;
    const handler = getSocialExportHandler(type);

    if (handler) {
        handler(req, res, next);
    } else {
        res.status(400).json({
            type: 'https://pokemon-collection.com/problems/invalid-export-type',
            title: 'Invalid Export Type',
            status: 400,
            detail: `Export type '${type}' is not supported`,
            instance: req.originalUrl,
            supportedTypes: getSupportedSocialExportTypes()
        });
    }
});

// ================================
// COLLECTION EXPORTS RESOURCE - REST COMPLIANT
// ================================
// Configuration-driven collection exports
router.post('/collections/:type/exports', validationMiddlewares.validateExportBody, (req, res, next) => {
    const {type} = req.params;
    const {format} = req.body;
    const handler = getCollectionExportHandler(format, type);

    if (handler) {
        handler(req, res, next);
    } else {
        const supportedFormats = getSupportedCollectionExportFormats();
        res.status(400).json({
            type: 'https://pokemon-collection.com/problems/invalid-export-format',
            title: 'Invalid Export Format',
            status: 400,
            detail: `Export format '${format}' ${format === 'zip' ? `not supported for collection type '${type}'` : 'is not supported'}`,
            instance: req.originalUrl,
            supportedFormats
        });
    }
});

// Configuration-driven export downloads
router.get('/collections/exports/:exportId', (req, res, next) => {
    const {exportId} = req.params;
    const handler = getExportDownloadHandler(exportId);

    if (handler) {
        handler(req, res, next);
    } else {
        res.status(404).json({
            type: 'https://pokemon-collection.com/problems/export-not-found',
            title: 'Export Not Found',
            status: 404,
            detail: `Export with ID '${exportId}' was not found`,
            instance: req.originalUrl
        });
    }
});

// ================================
// DBA INTEGRATION RESOURCE - REST COMPLIANT
// ================================
router.post('/dba/posts', validationMiddlewares.validateExportBody, postToDba);

// ================================
// UPLOAD ROUTES
// ================================
router.post('/upload/image', uploadImage);
router.post('/upload/images', uploadImages);
router.delete('/upload/cleanup', cleanupImages);
router.delete('/upload/cleanup-all', cleanupAllOrphanedImages);

// ================================
// AUCTIONS RESOURCE - REST COMPLIANT
// ================================
router.get('/auctions', getAllAuctions);
router.get('/auctions/:id', getAuctionById);
router.post('/auctions', createAuction);
router.put('/auctions/:id', updateAuction);
router.patch('/auctions/:id', updateAuction);
router.delete('/auctions/:id', deleteAuction);

// Auction items subresource - clean parameter passing
router.post('/auctions/:id/items', addItemToAuction);
router.delete('/auctions/:id/items/:itemId', removeItemFromAuction);
router.patch('/auctions/:id/items/:itemId', markItemAsSold);

export default router;
