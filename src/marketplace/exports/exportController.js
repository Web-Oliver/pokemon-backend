/**
 * Modern Export Controller
 *
 * Refactored to use BaseController pattern and ExportService for:
 * - Consistent architecture across all controllers
 * - Unified response formats
 * - Service layer abstraction (eliminates 200+ lines of duplication)
 * - Built-in caching, metrics, and plugin support
 * - SOLID principles compliance
 */

import BaseController from '@/system/middleware/BaseController.js';
import ExportService from '@/marketplace/exports/ExportService.js';
import { asyncHandler, ValidationError, CentralizedErrorHandler, ERROR_CONTEXTS } from '@/system/middleware/CentralizedErrorHandler.js';
import Logger from '@/system/logging/Logger.js';
import path from 'path';
import fs from 'fs';

// Legacy imports - maintained for backward compatibility
import { ErrorFactory } from '@/system/errors/ErrorTypes.js';
import { DbaExportService } from '@/marketplace/dba/dbaExportService.js';
import { DbaIntegrationService } from '@/marketplace/dba/dbaIntegrationService.js';
import { zipCollectionImages } from '@/marketplace/exports/exportHelpers.js';
import ItemFetcher from '@/collection/shared/ItemFetcher.js';
import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import RawCard from '@/collection/items/RawCard.js';
import SealedProduct from '@/collection/items/SealedProduct.js';
/**
 * Enhanced Export Controller using BaseController pattern
 * Provides consistent architecture and service layer abstraction
 */
class ExportController extends BaseController {
  constructor() {
    super('ExportService', {
      entityName: 'Export',
      pluralName: 'exports',
      enableCaching: true,
      enableMetrics: true,
      defaultLimit: 20
    });

  }

  /**
   * Create generic ZIP export method to eliminate duplication
   * @param {string} collectionType - Collection type (psa-cards, raw-cards, sealed-products)
   * @returns {Function} - Configured export method
   */
  createZipExportMethod(collectionType) {
    const operationMap = {
      'psa-cards': { operation: 'zipPsaCards', displayName: 'ZIP PSA CARDS' },
      'raw-cards': { operation: 'zipRawCards', displayName: 'ZIP RAW CARDS' },
      'sealed-products': { operation: 'zipSealedProducts', displayName: 'ZIP SEALED PRODUCTS' }
    };

    const config = operationMap[collectionType];
    if (!config) {
      throw new Error(`Unsupported collection type: ${collectionType}`);
    }

    return asyncHandler(async (req, res) => {
      const operation = config.operation;
      const context = { req, res, operation };

      Logger.operationStart('Export', config.displayName, req.query);

      try {
        await this.executeHooks('beforeOperation', operation, req.query, context);

        const { ids } = req.query;
        const result = await this.service.exportToZip(collectionType, ids);

        await this.executeHooks('afterOperation', operation, result, context);

        Logger.operationSuccess('Export', config.displayName, {
          itemCount: result.data?.itemCount || 0
        });

        let responseData = {
          success: true,
          data: result.data
        };

        responseData = await this.executeHooks('beforeResponse', operation, responseData, context);
        res.status(200).json(responseData);
      } catch (error) {
        await this.executeHooks('onError', operation, error, context);
        Logger.operationError('Export', config.displayName, error, req.query);
        throw error;
      }
    });
  }

  /**
   * ZIP PSA Card images - Generated method using factory pattern
   * GET /api/export/zip/psa-cards?ids=id1,id2,id3 (optional - if no ids, zip all)
   */
  zipPsaCardImages = this.createZipExportMethod('psa-cards');

  /**
   * ZIP Raw Card images - Generated method using factory pattern
   * GET /api/export/zip/raw-cards?ids=id1,id2,id3 (optional - if no ids, zip all)
   */
  zipRawCardImages = this.createZipExportMethod('raw-cards');

  /**
   * ZIP Sealed Product images - Generated method using factory pattern
   * GET /api/export/zip/sealed-products?ids=id1,id2,id3 (optional - if no ids, zip all)
   */
  zipSealedProductImages = this.createZipExportMethod('sealed-products');

  /**
   * Export collection items to DBA.dk format
   * POST /api/export/dba
   */
  exportToDba = asyncHandler(async (req, res) => {
    const operation = 'exportToDba';
    const context = { req, res, operation };

    const { items, customDescription = '', includeMetadata = true } = req.body;

    Logger.operationStart('Export', 'DBA EXPORT', {
      itemCount: items?.length || 0,
      includeMetadata
    });

    try {
      await this.executeHooks('beforeOperation', operation, req.body, context);

      const result = await this.service.exportToDba(items, {
        customDescription,
        includeMetadata
      });

      await this.executeHooks('afterOperation', operation, result, context);

      Logger.operationSuccess('Export', 'DBA EXPORT', {
        itemCount: result.data?.itemCount || 0
      });

      let responseData = {
        success: true,
        message: 'DBA export generated successfully',
        data: result.data
      };

      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);
      res.status(200).json(responseData);
    } catch (error) {
      await this.executeHooks('onError', operation, error, context);
      Logger.operationError('Export', 'DBA EXPORT', error, {
        itemCount: items?.length || 0,
        includeMetadata,
        customDescription: customDescription?.length || 0
      });
      throw error;
    }
  });

  /**
   * Download DBA export as ZIP file
   * GET /api/export/dba/download
   */
  downloadDbaZip = asyncHandler(async (req, res) => {
    const operation = 'downloadDbaZip';
    const context = { req, res, operation };

    const dataFolder = path.join(process.cwd(), 'data');

    Logger.operationStart('Export', 'DBA DOWNLOAD', { dataFolder });

    try {
      await this.executeHooks('beforeOperation', operation, { dataFolder }, context);

      if (!fs.existsSync(dataFolder)) {
        throw new ValidationError('No DBA export data found. Please generate export first.');
      }

      const dbaService = new DbaExportService();
      const zipBuffer = await dbaService.createDbaZip(dataFolder);

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `dba-export-${timestamp}.zip`;

      await this.executeHooks('afterOperation', operation, { filename, size: zipBuffer.length }, context);

      Logger.operationSuccess('Export', 'DBA DOWNLOAD', {
        filename,
        size: zipBuffer.length
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', zipBuffer.length);

      res.send(zipBuffer);

    } catch (error) {
      await this.executeHooks('onError', operation, error, context);
      Logger.operationError('Export', 'DBA DOWNLOAD', error, {
        dataFolderExists: fs.existsSync(dataFolder)
      });
      throw error;
    }
  });

  /**
   * Export collection items and post directly to DBA.dk
   * POST /api/export/dba/post
   */
  postToDba = asyncHandler(async (req, res) => {
    const operation = 'postToDba';
    const context = { req, res, operation };

    const { items, customDescription = '', dryRun = false } = req.body;

    Logger.operationStart('Export', 'DBA POST', {
      itemCount: items?.length || 0,
      dryRun
    });

    try {
      await this.executeHooks('beforeOperation', operation, req.body, context);

      const result = await this.service.postToDba(items, {
        customDescription,
        dryRun
      });

      await this.executeHooks('afterOperation', operation, result, context);

      Logger.operationSuccess('Export', 'DBA POST', {
        itemCount: result.data?.totalItemsProcessed || 0,
        dryRun
      });

      let responseData = {
        success: true,
        message: dryRun ? 'DBA export test completed successfully' : 'Items exported and posted to DBA.dk successfully',
        data: result.data
      };

      responseData = await this.executeHooks('beforeResponse', operation, responseData, context);
      res.status(200).json(responseData);
    } catch (error) {
      await this.executeHooks('onError', operation, error, context);
      Logger.operationError('Export', 'DBA POST', error, {
        itemCount: items?.length || 0,
        dryRun,
        customDescription: customDescription?.length || 0
      });
      throw error;
    }
  });

}

// Lazy controller instance creation
let exportController = null;

const getController = () => {
  if (!exportController) {
    exportController = new ExportController();
  }
  return exportController;
};

// Export controller methods for route binding with lazy initialization
const zipPsaCardImages = (req, res, next) => getController().zipPsaCardImages(req, res, next);
const zipRawCardImages = (req, res, next) => getController().zipRawCardImages(req, res, next);
const zipSealedProductImages = (req, res, next) => getController().zipSealedProductImages(req, res, next);
const exportToDba = (req, res, next) => getController().exportToDba(req, res, next);
const downloadDbaZip = (req, res, next) => getController().downloadDbaZip(req, res, next);
const postToDba = (req, res, next) => getController().postToDba(req, res, next);
const getDbaStatus = (req, res, next) => getController().getDbaStatus(req, res, next);
const testDbaIntegration = (req, res, next) => getController().testDbaIntegration(req, res, next);

// Export individual methods for route compatibility
export {
  zipPsaCardImages,
  zipRawCardImages,
  zipSealedProductImages,
  exportToDba,
  downloadDbaZip,
  postToDba
};

// Export controller instance accessor for advanced usage
export const getExportController = getController;

// Default export for backward compatibility
export default zipPsaCardImages;
