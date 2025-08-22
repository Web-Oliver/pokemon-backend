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
const router = express.Router();

// Controllers
import { getSales, getSalesSummary, getSalesGraphData   } from '@/Presentation/Controllers/salesController.js';
import Card from '@/Domain/Entities/Card.js';
import Set from '@/Domain/Entities/Set.js';
import Product from '@/Domain/Entities/Product.js';
import SetProduct from '@/Domain/Entities/SetProduct.js';
import { getAllProducts,
  getProductById,
  getProductSetNames,
  } from '@/Presentation/Controllers/productsController.js';
import { generateFacebookPost, getCollectionFacebookTextFile, generateDbaTitle   } from '@/Presentation/Controllers/externalListingController.js';
import { zipPsaCardImages,
  zipRawCardImages,
  zipSealedProductImages,
  exportToDba,
  downloadDbaZip,
  postToDba,
  getDbaStatus,
  testDbaIntegration,
  } from '@/Presentation/Controllers/exportController.js';
import { uploadImage, uploadImages, cleanupImages, cleanupAllOrphanedImages   } from '@/Presentation/Controllers/uploadController.js';
import { getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  addItemToAuction,
  removeItemFromAuction,
  markItemAsSold,
  } from '@/Presentation/Controllers/auctions/index.js';
// ================================
// STATUS ROUTES
// ================================
router.get('/status', async (req, res) => {
  try {
    const [cardCount, setCount, productCount, setProductCount] = await Promise.all([
      Card.countDocuments(),
      Set.countDocuments(),
      Product.countDocuments(),
      SetProduct.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        cards: cardCount,
        sets: setCount,
        products: productCount,
        setProducts: setProductCount,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get database status',
      error: error.message,
    });
  }
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
router.get('/products', getAllProducts);
router.get('/products/:id', getProductById);

// ================================
// SOCIAL EXPORTS RESOURCE - REST COMPLIANT
// ================================
router.post('/collections/social-exports', (req, res, next) => {
  const { type } = req.body;

  switch (type) {
    case 'facebook-post':
      generateFacebookPost(req, res, next);
      break;
    case 'dba-title':
      generateDbaTitle(req, res, next);
      break;
    case 'facebook-text-file':
      getCollectionFacebookTextFile(req, res, next);
      break;
    default:
      res.status(400).json({
        type: 'https://pokemon-collection.com/problems/invalid-export-type',
        title: 'Invalid Export Type',
        status: 400,
        detail: `Export type '${type}' is not supported`,
        instance: req.originalUrl,
        supportedTypes: ['facebook-post', 'dba-title', 'facebook-text-file']
      });
  }
});

// ================================
// COLLECTION EXPORTS RESOURCE - REST COMPLIANT
// ================================
router.post('/collections/:type/exports', (req, res, next) => {
  const { type } = req.params;
  const { format } = req.body;

  switch (format) {
    case 'dba':
      exportToDba(req, res, next);
      break;
    case 'zip':
      switch (type) {
        case 'psa-cards':
        case 'psa-graded-cards':
          zipPsaCardImages(req, res, next);
          break;
        case 'raw-cards':
          zipRawCardImages(req, res, next);
          break;
        case 'sealed-products':
          zipSealedProductImages(req, res, next);
          break;
        default:
          res.status(400).json({
            type: 'https://pokemon-collection.com/problems/unsupported-export',
            title: 'Unsupported Export',
            status: 400,
            detail: `ZIP export not supported for collection type '${type}'`,
            instance: req.originalUrl
          });
      }
      break;
    default:
      res.status(400).json({
        type: 'https://pokemon-collection.com/problems/invalid-export-format',
        title: 'Invalid Export Format',
        status: 400,
        detail: `Export format '${format}' is not supported`,
        instance: req.originalUrl,
        supportedFormats: ['dba', 'zip']
      });
  }
});

router.get('/collections/exports/:exportId', (req, res, next) => {
  const { exportId } = req.params;

  if (exportId === 'dba' || exportId.includes('dba')) {
    downloadDbaZip(req, res, next);
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
router.post('/dba/posts', postToDba);
router.get('/dba/status', getDbaStatus);
router.post('/dba/test', testDbaIntegration);

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

// Auction items subresource
router.post('/auctions/:id/items', addItemToAuction);
router.delete('/auctions/:id/items/:itemId', (req, res, next) => {
  req.body.itemId = req.params.itemId;
  removeItemFromAuction(req, res, next);
});
router.patch('/auctions/:id/items/:itemId', (req, res, next) => {
  req.body.itemId = req.params.itemId;
  markItemAsSold(req, res, next);
});

export default router;
