const express = require('express');
const router = express.Router();
const {
  importAllData,
  importPsaData,
  importCardMarketData,
  getAllPsaFiles,
  getAllSealedProductFiles,
} = require('../utils/dataImporter');

// Import all data (PSA and CardMarket)
router.post('/', async (req, res, next) => {
  try {
    const options = {
      includePsa: req.body.includePsa !== false,
      includeCardMarket: req.body.includeCardMarket !== false,
      limitPsaFiles: req.body.limitPsaFiles || null,
      limitCardMarketFiles: req.body.limitCardMarketFiles || null,
    };

    console.log('Starting data import with options:', options);
    const results = await importAllData(options);

    res.status(200).json({
      status: 'success',
      message: 'Data import completed',
      results,
    });
  } catch (error) {
    console.error('Import route error:', error);
    next(error);
  }
});

// Import PSA data only
router.post('/psa', async (req, res, next) => {
  try {
    const results = await importAllData({
      includePsa: true,
      includeCardMarket: false,
      limitPsaFiles: req.body.limit || null,
    });

    res.status(200).json({
      status: 'success',
      message: 'PSA data import completed',
      results,
    });
  } catch (error) {
    next(error);
  }
});

// Import CardMarket data only
router.post('/cardmarket', async (req, res, next) => {
  try {
    const results = await importAllData({
      includePsa: false,
      includeCardMarket: true,
      limitCardMarketFiles: req.body.limit || null,
    });

    res.status(200).json({
      status: 'success',
      message: 'CardMarket data import completed',
      results,
    });
  } catch (error) {
    next(error);
  }
});

// Get available files to import
router.get('/files', (req, res, next) => {
  try {
    const psaFiles = getAllPsaFiles();
    const cardMarketFiles = getAllSealedProductFiles();

    res.status(200).json({
      status: 'success',
      data: {
        psaFiles: psaFiles.length,
        cardMarketFiles: cardMarketFiles.length,
        psaFilePaths: psaFiles.slice(0, 10), // Show first 10 for preview
        cardMarketFilePaths: cardMarketFiles.slice(0, 10), // Show first 10 for preview
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
