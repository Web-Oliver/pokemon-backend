const express = require('express');
const router = express.Router();
const { zipPsaCardImages, zipRawCardImages, zipSealedProductImages } = require('../controllers/exportController');

// ZIP export endpoints for collection items
router.get('/zip/psa-cards', zipPsaCardImages);
router.get('/zip/raw-cards', zipRawCardImages);
router.get('/zip/sealed-products', zipSealedProductImages);

module.exports = router;
