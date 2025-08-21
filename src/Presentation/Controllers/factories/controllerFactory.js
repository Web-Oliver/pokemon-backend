/**
 * Controller Factory
 *
 * Creates standardized controllers for collection entities to eliminate
 * the massive duplication across PSA/Raw/Sealed controller files.
 *
 * Follows DRY principles by centralizing controller creation logic.
 */

import BaseController from '@/Presentation/Controllers/base/BaseController.js';
import { getEntityConfig   } from '@/Infrastructure/Configuration/entityConfigurations.js';
/**
 * Creates a standard collection controller with entity configuration
 * @param {string} entityType - Entity type (e.g., 'psaGradedCard', 'rawCard', 'sealedProduct')
 * @param {string} serviceName - Service name to inject (e.g., 'psaGradedCardService')
 * @param {Object} customMethods - Optional custom methods to add to controller
 * @returns {Object} Controller instance with all CRUD methods
 */
const createCollectionController = (entityType, serviceName, customMethods = {}) => {
  // Get centralized entity configuration
  const entityConfig = getEntityConfig(entityType);

  // Create controller class dynamically
  class DynamicCollectionController extends BaseController {
    constructor() {
      super(serviceName, {
        entityName: entityConfig.entityName,
        pluralName: entityConfig.pluralName,
        includeMarkAsSold: entityConfig.includeMarkAsSold,
        defaultPopulate: entityConfig.defaultPopulate,
        filterableFields: entityConfig.filterableFields,
        searchFields: entityConfig.searchFields,
        searchWeights: entityConfig.searchWeights,
        validationRules: entityConfig.validationRules,
      });

      // Add custom methods if provided
      Object.assign(this, customMethods);
    }
  }

  // Create and return instance
  return new DynamicCollectionController();
};

/**
 * Creates standard exports object for collection controllers
 * @param {Object} controller - Controller instance
 * @param {string} entityPrefix - Prefix for method names (e.g., 'PsaGradedCard', 'RawCard')
 * @returns {Object} Standard exports object
 */
const createStandardExports = (controller, entityPrefix) => {
  const exports = {
    [`getAll${entityPrefix}s`]: controller.getAll,
    [`get${entityPrefix}ById`]: controller.getById,
    [`create${entityPrefix}`]: controller.create,
    [`update${entityPrefix}`]: controller.update,
    [`delete${entityPrefix}`]: controller.delete,
  };

  // Add markAsSold if available
  if (controller.markAsSold) {
    exports.markAsSold = controller.markAsSold;
  }

  return exports;
};

/**
 * One-liner function to create a complete collection controller with exports
 * @param {string} entityType - Entity type for configuration
 * @param {string} serviceName - Service name for dependency injection
 * @param {string} entityPrefix - Prefix for export method names
 * @param {Object} customMethods - Optional custom methods
 * @returns {Object} Complete exports object
 */
const createCollectionControllerWithExports = (entityType, serviceName, entityPrefix, customMethods = {}) => {
  const controller = createCollectionController(entityType, serviceName, customMethods);

  return createStandardExports(controller, entityPrefix);
};

export {
  createCollectionController,
  createStandardExports,
  createCollectionControllerWithExports
};
export default createCollectionController;;
