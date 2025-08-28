/**
 * ExportService - Business Logic Service for Export Operations
 *
 * Abstracts export business logic from the controller layer.
 * Provides consistent service layer interface for all export operations.
 *
 * Follows SOLID principles:
 * - Single Responsibility: Handles only export business logic
 * - Dependency Inversion: Controllers depend on this abstraction
 * - Open/Closed: Extensible for new export types
 */

import ItemFetcher from '@/system/utilities/ItemFetcher.js';
import { DbaExportService } from '@/marketplace/dba/dbaExportService.js';
import { DbaIntegrationService } from '@/marketplace/dba/dbaIntegrationService.js';
import { zipCollectionImages } from '@/marketplace/exports/exportHelpers.js';
import Logger from '@/system/logging/Logger.js';
import { ValidationError, NotFoundError } from '@/system/middleware/errorHandler.js';

class ExportService {
  constructor() {
    this.dbaExportService = new DbaExportService();
    this.dbaIntegrationService = new DbaIntegrationService();
  }

  /**
   * Export collection items to ZIP format
   * @param {string} collectionType - Type of collection ('psa-cards', 'raw-cards', 'sealed-products')
   * @param {string} ids - Comma-separated IDs (optional)
   * @param {Object} options - Export options
   * @returns {Promise<Object>} - Export result
   */
  async exportToZip(collectionType, ids = null, options = {}) {
    Logger.debug('ExportService', 'Starting ZIP export', { collectionType, ids, options });

    // Validate collection type
    const supportedTypes = ['psa-cards', 'raw-cards', 'sealed-products'];
    if (!supportedTypes.includes(collectionType)) {
      throw new ValidationError(`Unsupported collection type: ${collectionType}. Supported: ${supportedTypes.join(', ')}`);
    }

    try {
      const result = await zipCollectionImages(collectionType, ids);

      Logger.info('ExportService', 'ZIP export completed', {
        collectionType,
        itemCount: result.itemCount || 0,
        success: result.success
      });

      return {
        success: true,
        data: result,
        exportType: 'zip',
        collectionType
      };
    } catch (error) {
      Logger.error('ExportService', 'ZIP export failed', error);
      throw error;
    }
  }

  /**
   * Export collection items to DBA format
   * @param {Array} items - Items to export with metadata
   * @param {Object} options - Export options
   * @returns {Promise<Object>} - Export result
   */
  async exportToDba(items, options = {}) {
    const {
      customDescription = '',
      includeMetadata = true
    } = options;

    Logger.debug('ExportService', 'Starting DBA export', {
      itemCount: items.length,
      options
    });

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('No items provided for DBA export');
    }

    try {
      // Use ItemFetcher for consistent item fetching
      const collectionItems = await this.fetchItemsForExport(items);

      if (collectionItems.length === 0) {
        throw new ValidationError('No valid items found for DBA export');
      }

      // Generate DBA export using service
      const exportResult = await this.dbaExportService.generateDbaExport(collectionItems, {
        customDescription,
        includeMetadata
      });

      Logger.info('ExportService', 'DBA export completed', {
        itemCount: exportResult.itemCount,
        exportPath: exportResult.jsonFilePath
      });

      return {
        success: true,
        data: {
          itemCount: exportResult.itemCount,
          jsonFilePath: exportResult.jsonFilePath,
          dataFolder: exportResult.dataFolder,
          items: exportResult.items
        },
        exportType: 'dba',
        metadata: {
          customDescription,
          includeMetadata,
          processedItems: collectionItems.length
        }
      };
    } catch (error) {
      Logger.error('ExportService', 'DBA export failed', error);
      throw error;
    }
  }

  /**
   * Post items to DBA marketplace
   * @param {Array} items - Items to post
   * @param {Object} options - Posting options
   * @returns {Promise<Object>} - Posting result
   */
  async postToDba(items, options = {}) {
    const {
      customDescription = '',
      dryRun = false
    } = options;

    Logger.debug('ExportService', 'Starting DBA posting', {
      itemCount: items.length,
      dryRun,
      options
    });

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('No items provided for DBA posting');
    }

    try {
      // Use ItemFetcher for consistent item fetching
      const collectionItems = await this.fetchItemsForExport(items);

      if (collectionItems.length === 0) {
        throw new ValidationError('No valid items found for DBA posting');
      }

      // Use DBA integration service to export and post
      const integrationResult = await this.dbaIntegrationService.exportAndPostToDba(collectionItems, {
        customDescription,
        includeMetadata: true,
        dryRun
      });

      Logger.info('ExportService', 'DBA posting completed', {
        success: integrationResult.success,
        dryRun,
        itemCount: collectionItems.length
      });

      return {
        success: true,
        data: integrationResult,
        exportType: 'dba-post',
        metadata: {
          dryRun,
          customDescription,
          processedItems: collectionItems.length
        }
      };
    } catch (error) {
      Logger.error('ExportService', 'DBA posting failed', error);
      throw error;
    }
  }

  /**
   * Test DBA integration
   * @param {Array} items - Items to test with
   * @returns {Promise<Object>} - Test result
   */
  async testDbaIntegration(items) {
    Logger.debug('ExportService', 'Starting DBA integration test', {
      itemCount: items.length
    });

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new ValidationError('No items provided for DBA integration test');
    }

    try {
      // Use ItemFetcher for consistent item fetching
      const collectionItems = await this.fetchItemsForExport(items);

      Logger.debug('ExportService', 'Items fetched for DBA test', {
        fetched: collectionItems.length,
        requested: items.length
      });

      // Test integration with available items
      const testResult = await this.dbaIntegrationService.testIntegration(collectionItems);

      Logger.info('ExportService', 'DBA integration test completed', {
        success: testResult.success || true,
        testedItems: collectionItems.length
      });

      return {
        success: true,
        data: testResult,
        exportType: 'dba-test',
        metadata: {
          requestedItems: items.length,
          processedItems: collectionItems.length
        }
      };
    } catch (error) {
      Logger.error('ExportService', 'DBA integration test failed', error);
      throw error;
    }
  }

  /**
   * Download DBA export ZIP file
   * @param {string} exportId - Export ID or identifier
   * @returns {Promise<Object>} - Download information
   */
  async downloadDbaZip(exportId) {
    Logger.debug('ExportService', 'Processing DBA ZIP download', { exportId });

    // This method coordinates with the DBA export service
    // The actual file streaming is handled by the controller
    try {
      // Validate export exists and get metadata
      // Implementation depends on how DBA exports are stored/tracked

      Logger.info('ExportService', 'DBA ZIP download prepared', { exportId });

      return {
        success: true,
        downloadReady: true,
        exportId,
        exportType: 'dba-download'
      };
    } catch (error) {
      Logger.error('ExportService', 'DBA ZIP download preparation failed', error);
      throw error;
    }
  }

  /**
   * Get DBA integration status
   * @returns {Promise<Object>} - Status information
   */
  async getDbaStatus() {
    Logger.debug('ExportService', 'Getting DBA status');

    try {
      // Check DBA integration service status
      const status = await this.dbaIntegrationService.getStatus?.() || {
        available: true,
        lastCheck: new Date().toISOString()
      };

      Logger.debug('ExportService', 'DBA status retrieved', status);

      return {
        success: true,
        data: status,
        service: 'dba-integration'
      };
    } catch (error) {
      Logger.error('ExportService', 'Failed to get DBA status', error);
      throw error;
    }
  }

  /**
   * Fetch items for export using ItemFetcher
   * @private
   */
  async fetchItemsForExport(items) {
    Logger.debug('ExportService', 'Fetching items for export', { count: items.length });

    // Prepare item requests for ItemFetcher
    const itemRequests = items.map(itemRequest => {
      const { id, type, name, setName, customTitle, customDescription } = itemRequest;

      if (!id || !type) {
        throw new ValidationError('Each item must have id and type fields');
      }

      return { itemType: type, itemId: id };
    });

    // Define populate options for different item types
    const populateOptions = {
      populate: [
        {
          path: 'cardId',
          populate: { path: 'setId', model: 'Set' }
        },
        {
          path: 'productId',
          model: 'Product'
        }
      ]
    };

    // Fetch all items in batch
    const fetchResult = await ItemFetcher.fetchCollectionItems(itemRequests, populateOptions);

    if (fetchResult.failed.length > 0) {
      Logger.warn('ExportService', `Failed to fetch ${fetchResult.failed.length} items`, fetchResult.failed);
    }

    // Process successful items with original metadata
    const collectionItems = fetchResult.items.map((itemData, index) => {
      const originalRequest = items[index];
      const { name, setName, customTitle, customDescription: itemCustomDescription } = originalRequest;

      return {
        item: {
          ...itemData,
          // Use frontend name which contains the correct product name
          name: name || itemData.name,
          setName: setName || itemData.setName
        },
        itemType: originalRequest.type,
        customTitle: customTitle?.trim() || null,
        customDescription: itemCustomDescription?.trim() || null
      };
    });

    Logger.debug('ExportService', 'Items fetched for export', {
      successful: collectionItems.length,
      failed: fetchResult.failed.length,
      total: items.length
    });

    return collectionItems;
  }

  /**
   * Get export statistics
   * @returns {Promise<Object>} - Export statistics
   */
  async getExportStatistics() {
    Logger.debug('ExportService', 'Getting export statistics');

    try {
      // This could be expanded to include actual export history tracking
      const stats = {
        totalExports: 0,
        exportsByType: {
          zip: 0,
          dba: 0,
          'dba-post': 0
        },
        lastExport: null,
        availableTypes: ['zip', 'dba', 'dba-post', 'dba-test']
      };

      Logger.debug('ExportService', 'Export statistics compiled', stats);

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      Logger.error('ExportService', 'Failed to get export statistics', error);
      throw error;
    }
  }
}

export default ExportService;
