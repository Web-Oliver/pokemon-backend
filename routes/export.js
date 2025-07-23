const express = require('express');
const router = express.Router();
const { 
  zipPsaCardImages, 
  zipRawCardImages, 
  zipSealedProductImages,
  exportToDba,
  downloadDbaZip,
  postToDba,
  getDbaStatus,
  testDbaIntegration
} = require('../controllers/exportController');

// ZIP export endpoints for collection items
router.get('/zip/psa-cards', zipPsaCardImages);
router.get('/zip/raw-cards', zipRawCardImages);
router.get('/zip/sealed-products', zipSealedProductImages);

// DBA.dk export endpoints
router.post('/dba', exportToDba);
router.get('/dba/download', downloadDbaZip);

// DBA.dk integration endpoints (direct posting)
router.post('/dba/post', postToDba);
router.get('/dba/status', getDbaStatus);
router.post('/dba/test', testDbaIntegration);

module.exports = router;
