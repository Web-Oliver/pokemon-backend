const { asyncHandler, ValidationError } = require('../middleware/errorHandler');
const { DbaExportService } = require('../services/dbaExportService');
const { DbaIntegrationService } = require('../services/dbaIntegrationService');
const { zipCollectionImages } = require('../utils/exportHelpers');
const path = require('path');
const fs = require('fs');

// Import required models
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const SealedProduct = require('../models/SealedProduct');

/**
 * ZIP PSA Card images
 * GET /api/export/zip/psa-cards?ids=id1,id2,id3 (optional - if no ids, zip all)
 */
const zipPsaCardImages = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  const result = await zipCollectionImages('psa-cards', ids);

  res.status(200).json(result);
});

/**
 * ZIP Raw Card images
 * GET /api/export/zip/raw-cards?ids=id1,id2,id3 (optional - if no ids, zip all)
 */
const zipRawCardImages = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  const result = await zipCollectionImages('raw-cards', ids);

  res.status(200).json(result);
});

/**
 * ZIP Sealed Product images
 * GET /api/export/zip/sealed-products?ids=id1,id2,id3 (optional - if no ids, zip all)
 */
const zipSealedProductImages = asyncHandler(async (req, res) => {
  const { ids } = req.query;
  const result = await zipCollectionImages('sealed-products', ids);

  res.status(200).json(result);
});

/**
 * Export collection items to DBA.dk format
 * POST /api/export/dba
 */
const exportToDba = asyncHandler(async (req, res) => {
  const { items, customDescription = '', includeMetadata = true } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('No items provided for DBA export');
  }

  console.log(`[DBA EXPORT] Received request for ${items.length} items`);
  console.log('[DBA EXPORT] First item from frontend:', JSON.stringify(items[0], null, 2));

  try {
    // Collect all items with their data
    const collectionItems = [];

    for (const itemRequest of items) {
      const { id, type, name, setName, customTitle, customDescription: itemCustomDescription } = itemRequest;

      if (!id || !type) {
        throw new ValidationError('Each item must have id and type fields');
      }

      let item = null;

      // Fetch item based on type
      switch (type) {
        case 'psa':
          item = await PsaGradedCard.findById(id).populate({
            path: 'cardId',
            populate: { path: 'setId', model: 'Set' }
          });
          break;
        case 'raw':
          item = await RawCard.findById(id).populate({
            path: 'cardId', 
            populate: { path: 'setId', model: 'Set' }
          });
          break;
        case 'sealed':
          item = await SealedProduct.findById(id).populate({
            path: 'productId',
            model: 'Product'
          });
          break;
        default:
          throw new ValidationError(`Invalid item type: ${type}`);
      }

      if (!item) {
        throw new ValidationError(`Item not found: ${id} (${type})`);
      }

      // Convert mongoose document to plain object
      const itemData = item.toJSON ? item.toJSON() : item;
      
      collectionItems.push({ 
        item: {
          ...itemData,
          // Use frontend name which contains the correct product name
          name: name || itemData.name,
          setName: setName || itemData.setName
        }, 
        itemType: type, 
        customTitle: customTitle?.trim() || null, 
        customDescription: itemCustomDescription?.trim() || null 
      });
    }

    console.log(`[DBA EXPORT] Fetched ${collectionItems.length} items from database`);

    // Generate DBA export using service
    const dbaService = new DbaExportService();
    const exportResult = await dbaService.generateDbaExport(collectionItems, {
      customDescription,
      includeMetadata
    });

    res.status(200).json({
      success: true,
      message: 'DBA export generated successfully',
      data: {
        itemCount: exportResult.itemCount,
        jsonFilePath: exportResult.jsonFilePath,
        dataFolder: exportResult.dataFolder,
        items: exportResult.items,
      }
    });

  } catch (error) {
    console.error('[DBA EXPORT] Export failed:', error);
    throw error;
  }
});

/**
 * Download DBA export as ZIP file
 * GET /api/export/dba/download
 */
const downloadDbaZip = asyncHandler(async (req, res) => {
  const dataFolder = path.join(process.cwd(), 'data');

  if (!fs.existsSync(dataFolder)) {
    throw new ValidationError('No DBA export data found. Please generate export first.');
  }

  try {
    const dbaService = new DbaExportService();
    const zipBuffer = await dbaService.createDbaZip(dataFolder);

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `dba-export-${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);

    res.send(zipBuffer);

  } catch (error) {
    console.error('[DBA EXPORT] ZIP download failed:', error);
    throw error;
  }
});

/**
 * Export collection items and post directly to DBA.dk
 * POST /api/export/dba/post
 */
const postToDba = asyncHandler(async (req, res) => {
  const { items, customDescription = '', dryRun = false } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('No items provided for DBA posting');
  }

  console.log(`[DBA POST] Received request for ${items.length} items (dryRun: ${dryRun})`);
  console.log(`[DBA POST] Items received:`, JSON.stringify(items, null, 2));

  try {
    // Collect all items with their data (same logic as exportToDba)
    const collectionItems = [];

    for (const itemRequest of items) {
      const { id, type } = itemRequest;

      if (!id || !type) {
        throw new ValidationError('Each item must have id and type fields');
      }

      let item = null;

      // Fetch item based on type
      switch (type) {
        case 'psa':
          item = await PsaGradedCard.findById(id).populate({
            path: 'cardId',
            populate: { path: 'setId', model: 'Set' }
          });
          break;
        case 'raw':
          item = await RawCard.findById(id).populate({
            path: 'cardId', 
            populate: { path: 'setId', model: 'Set' }
          });
          break;
        case 'sealed':
          item = await SealedProduct.findById(id).populate({
            path: 'productId',
            model: 'Product'
          });
          break;
        default:
          throw new ValidationError(`Invalid item type: ${type}`);
      }

      if (!item) {
        throw new ValidationError(`Item not found: ${id} (${type})`);
      }

      collectionItems.push({ item, itemType: type });
    }

    console.log(`[DBA POST] Fetched ${collectionItems.length} items from database`);

    // Use DBA integration service to export and post
    const dbaIntegration = new DbaIntegrationService();
    const integrationResult = await dbaIntegration.exportAndPostToDba(collectionItems, {
      customDescription,
      includeMetadata: true,
      dryRun
    });

    // Check if integration was successful
    if (!integrationResult.success) {
      console.error('[DBA POST] Integration service returned failure:', integrationResult);
      return res.status(500).json({
        success: false,
        message: 'DBA integration failed',
        error: integrationResult.error,
        data: {
          itemCount: integrationResult.totalItemsProcessed,
          export: integrationResult.export,
          posting: integrationResult.posting,
          dryRun,
          timestamp: integrationResult.timestamp
        }
      });
    }

    res.status(200).json({
      success: true,
      message: dryRun ? 'DBA export test completed successfully' : 'Items exported and posted to DBA.dk successfully',
      data: {
        itemCount: integrationResult.totalItemsProcessed,
        export: integrationResult.export,
        posting: integrationResult.posting,
        dryRun,
        timestamp: integrationResult.timestamp
      }
    });

  } catch (error) {
    console.error('[DBA POST] Integration failed:', error);
    throw error;
  }
});

/**
 * Get DBA integration status
 * GET /api/export/dba/status
 */
const getDbaStatus = asyncHandler(async (req, res) => {
  try {
    const dbaIntegration = new DbaIntegrationService();
    const status = await dbaIntegration.getDbaStatus();

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('[DBA STATUS] Failed to get status:', error);
    throw error;
  }
});

/**
 * Test DBA integration
 * POST /api/export/dba/test
 */
const testDbaIntegration = asyncHandler(async (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ValidationError('No items provided for DBA integration test');
  }

  try {
    // Collect items (same logic as above, but simplified for test)
    const collectionItems = [];

    for (const itemRequest of items) {
      const { id, type } = itemRequest;

      let item = null;

      switch (type) {
        case 'psa':
          item = await PsaGradedCard.findById(id).populate({
            path: 'cardId',
            populate: { path: 'setId', model: 'Set' }
          });
          break;
        case 'raw':
          item = await RawCard.findById(id).populate({
            path: 'cardId', 
            populate: { path: 'setId', model: 'Set' }
          });
          break;
        case 'sealed':
          item = await SealedProduct.findById(id).populate({
            path: 'productId',
            model: 'Product'
          });
          break;
      }

      if (item) {
        collectionItems.push({ item, itemType: type });
      }
    }

    const dbaIntegration = new DbaIntegrationService();
    const testResult = await dbaIntegration.testIntegration(collectionItems);

    res.status(200).json({
      success: true,
      message: 'DBA integration test completed',
      data: testResult
    });

  } catch (error) {
    console.error('[DBA TEST] Test failed:', error);
    throw error;
  }
});

module.exports = {
  zipPsaCardImages,
  zipRawCardImages,
  zipSealedProductImages,
  exportToDba,
  downloadDbaZip,
  postToDba,
  getDbaStatus,
  testDbaIntegration,
};
