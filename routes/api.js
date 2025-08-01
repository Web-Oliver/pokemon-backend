/**
 * Unified API Routes
 * 
 * Consolidates all simple route files to eliminate the proliferation
 * of tiny 9-13 line route files.
 * 
 * This single file replaces:
 * - sales.js (9 lines)
 * - cardMarketRefProducts.js (13 lines)
 * - externalListing.js (11 lines)
 * - export.js (28 lines)
 * Total: 61 lines of boilerplate → ~80 lines with better organization
 */

const express = require('express');
const router = express.Router();

// Controllers
const { getSales, getSalesSummary, getSalesGraphData } = require('../controllers/salesController');

// Models for status endpoint
const Card = require('../models/Card');
const Set = require('../models/Set');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const {
  getAllCardMarketRefProducts,
  getCardMarketRefProductById,
  getCardMarketRefProductSetNames,
} = require('../controllers/cardMarketRefProductsController');
const { generateFacebookPost, getCollectionFacebookTextFile, generateDbaTitle } = require('../controllers/externalListingController');
const {
  zipPsaCardImages,
  zipRawCardImages,
  zipSealedProductImages,
  exportToDba,
  downloadDbaZip,
  postToDba,
  getDbaStatus,
  testDbaIntegration,
} = require('../controllers/exportController');
const { uploadImage, uploadImages, cleanupImages, cleanupAllOrphanedImages } = require('../controllers/uploadController');
const {
  getAllAuctions,
  getAuctionById,
  createAuction,
  updateAuction,
  deleteAuction,
  addItemToAuction,
  removeItemFromAuction,
  markItemAsSold,
} = require('../controllers/auctions');

// ================================
// STATUS ROUTES
// ================================
router.get('/status', async (req, res) => {
  try {
    const [cardCount, setCount, productCount] = await Promise.all([
      Card.countDocuments(),
      Set.countDocuments(),
      CardMarketReferenceProduct.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        cards: cardCount,
        sets: setCount,
        products: productCount,
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
// CARD MARKET REFERENCE PRODUCTS
// ================================
router.get('/cardmarket-ref-products/set-names', getCardMarketRefProductSetNames);
router.get('/cardmarket-ref-products', getAllCardMarketRefProducts);
router.get('/cardmarket-ref-products/:id', getCardMarketRefProductById);

// ================================
// EXTERNAL LISTING GENERATION
// ================================
router.post('/external-listing/generate-facebook-post', generateFacebookPost);
router.post('/generate-facebook-post', generateFacebookPost); // Frontend compatibility
router.post('/external-listing/generate-dba-title', generateDbaTitle);
router.post('/collection/facebook-text-file', getCollectionFacebookTextFile);

// ================================
// EXPORT ROUTES
// ================================
router.get('/export/zip/psa-cards', zipPsaCardImages);
router.get('/export/zip/raw-cards', zipRawCardImages);
router.get('/export/zip/sealed-products', zipSealedProductImages);
router.post('/export/dba', exportToDba);
router.get('/export/dba/download', downloadDbaZip);
router.post('/export/dba/post', postToDba);
router.get('/export/dba/status', getDbaStatus);
router.post('/export/dba/test', testDbaIntegration);

// ================================
// UPLOAD ROUTES
// ================================
router.post('/upload/image', uploadImage);
router.post('/upload/images', uploadImages);
router.delete('/upload/cleanup', cleanupImages);
router.delete('/upload/cleanup-all', cleanupAllOrphanedImages);

// ================================
// AUCTION ROUTES
// ================================
router.get('/auctions', getAllAuctions);
router.get('/auctions/:id', getAuctionById);
router.post('/auctions', createAuction);
router.put('/auctions/:id', updateAuction);
router.delete('/auctions/:id', deleteAuction);
router.post('/auctions/:id/add-item', addItemToAuction);
router.post('/auctions/:id/items', addItemToAuction); // Alternative route for frontend
router.put('/auctions/:id/items', addItemToAuction); // Frontend compatibility - add item
router.delete('/auctions/:id/remove-item', removeItemFromAuction);
router.post('/auctions/:id/mark-item-sold', markItemAsSold);
router.patch('/auctions/:id/items/sold', markItemAsSold);
router.put('/auctions/:id/items/sold', markItemAsSold); // Frontend compatibility - mark sold

module.exports = router;