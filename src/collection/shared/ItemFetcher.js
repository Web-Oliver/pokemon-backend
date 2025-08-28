/**
 * Centralized Item Fetcher Utility
 *
 * Eliminates code duplication across export and marketplace controllers.
 * Provides standardized item fetching logic for all collection item types.
 *
 * Before: 200+ lines of duplicated switch statements across 4 methods
 * After: Single centralized utility with service layer integration
 */

import { container } from '@/system/dependency-injection/ServiceContainer.js';
import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import RawCard from '@/collection/items/RawCard.js';
import SealedProduct from '@/collection/items/SealedProduct.js';
import Logger from '@/system/logging/Logger.js';
import { NotFoundError, ValidationError } from '@/system/errors/ErrorTypes.js';

/**
 * Centralized item fetching utility
 * Supports both service layer and direct model access patterns
 */
class ItemFetcher {
  /**
   * Fetch a single collection item by type and ID
   * @param {string} itemType - Type of item ('psa', 'raw', 'sealed')
   * @param {string} itemId - Item ID
   * @param {Object} options - Fetch options (populate, select, etc.)
   * @returns {Promise<Object>} - The fetched item
   */
  static async fetchCollectionItem(itemType, itemId, options = {}) {
    if (!itemType || !itemId) {
      throw new ValidationError('Item type and ID are required');
    }

    Logger.debug('ItemFetcher', `Fetching ${itemType} item`, { itemId, options });

    try {
      // Try service layer first (preferred approach)
      const serviceResult = await this.fetchViaService(itemType, itemId, options);
      if (serviceResult) {
        return serviceResult;
      }

      // Fallback to direct model access for backwards compatibility
      return await this.fetchViaModel(itemType, itemId, options);
    } catch (error) {
      Logger.error('ItemFetcher', `Failed to fetch ${itemType} item ${itemId}`, error);
      throw error;
    }
  }

  /**
   * Fetch multiple collection items
   * @param {Array} items - Array of {itemType, itemId} objects
   * @param {Object} options - Fetch options
   * @returns {Promise<Array>} - Array of fetched items
   */
  static async fetchCollectionItems(items, options = {}) {
    if (!Array.isArray(items)) {
      throw new ValidationError('Items must be an array');
    }

    Logger.debug('ItemFetcher', `Fetching ${items.length} collection items`);

    const results = await Promise.allSettled(
      items.map(item => this.fetchCollectionItem(item.itemType, item.itemId, options))
    );

    const successfulItems = [];
    const failedItems = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        successfulItems.push({
          ...result.value.toObject ? result.value.toObject() : result.value,
          originalRequest: items[index]
        });
      } else {
        failedItems.push({
          ...items[index],
          error: result.reason?.message || 'Unknown error'
        });
      }
    });

    Logger.debug('ItemFetcher', 'Batch fetch complete', {
      successful: successfulItems.length,
      failed: failedItems.length
    });

    return {
      items: successfulItems,
      failed: failedItems,
      total: items.length
    };
  }

  /**
   * Fetch via service layer (preferred)
   * @private
   */
  static async fetchViaService(itemType, itemId, options) {
    try {
      const serviceMap = {
        'psa': 'psaGradedCardService',
        'psa-graded-cards': 'psaGradedCardService',
        'raw': 'rawCardService',
        'raw-cards': 'rawCardService',
        'sealed': 'sealedProductService',
        'sealed-products': 'sealedProductService'
      };

      const serviceName = serviceMap[itemType];
      if (!serviceName) {
        return null; // Not supported via service layer
      }

      const service = container.resolve(serviceName);
      if (!service) {
        return null; // Service not available
      }

      return await service.getById(itemId, options);
    } catch (error) {
      // Service layer failed, will fallback to model access
      Logger.debug('ItemFetcher', `Service layer fetch failed for ${itemType}:${itemId}`, error.message);
      return null;
    }
  }

  /**
   * Fetch via direct model access (fallback)
   * @private
   */
  static async fetchViaModel(itemType, itemId, options) {
    const modelMap = {
      'psa': PsaGradedCard,
      'psa-graded-cards': PsaGradedCard,
      'psa-cards': PsaGradedCard,
      'raw': RawCard,
      'raw-cards': RawCard,
      'sealed': SealedProduct,
      'sealed-products': SealedProduct
    };

    const Model = modelMap[itemType];
    if (!Model) {
      throw new ValidationError(`Unsupported item type: ${itemType}`);
    }

    let query = Model.findById(itemId);

    // Apply options
    if (options.populate) {
      if (Array.isArray(options.populate)) {
        options.populate.forEach(field => query = query.populate(field));
      } else {
        query = query.populate(options.populate);
      }
    }

    if (options.select) {
      query = query.select(options.select);
    }

    if (options.lean !== false) {
      query = query.lean();
    }

    const item = await query;
    if (!item) {
      throw new NotFoundError(`${itemType} item with ID ${itemId} not found`);
    }

    return item;
  }

  /**
   * Get supported item types
   * @returns {Array} - Array of supported item types
   */
  static getSupportedTypes() {
    return [
      'psa',
      'psa-graded-cards',
      'psa-cards',
      'raw',
      'raw-cards',
      'sealed',
      'sealed-products'
    ];
  }

  /**
   * Validate item type
   * @param {string} itemType - Item type to validate
   * @returns {boolean} - True if supported
   */
  static isValidItemType(itemType) {
    return this.getSupportedTypes().includes(itemType);
  }

  /**
   * Normalize item type (handle aliases)
   * @param {string} itemType - Item type to normalize
   * @returns {string} - Normalized item type
   */
  static normalizeItemType(itemType) {
    const normalizeMap = {
      'psa-graded-cards': 'psa',
      'psa-cards': 'psa',
      'raw-cards': 'raw',
      'sealed-products': 'sealed'
    };

    return normalizeMap[itemType] || itemType;
  }

  /**
   * Get collection statistics for fetched items
   * @param {Array} items - Array of items
   * @returns {Object} - Statistics object
   */
  static getCollectionStats(items) {
    if (!Array.isArray(items)) {
      return { total: 0, byType: {} };
    }

    const stats = {
      total: items.length,
      byType: {},
      sold: 0,
      available: 0
    };

    items.forEach(item => {
      // Count by type
      const type = item.originalRequest?.itemType || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count sold vs available
      if (item.sold) {
        stats.sold++;
      } else {
        stats.available++;
      }
    });

    return stats;
  }
}

export default ItemFetcher;
