const BaseController = require('./base/BaseController');
const { getEntityConfig } = require('../config/entityConfigurations');

/**
 * Raw Card Controller
 *
 * Extends BaseController to provide CRUD operations for raw cards.
 * Uses dependency injection and repository pattern for improved architecture.
 */
class RawCardController extends BaseController {
  constructor() {
    // Get centralized entity configuration
    const entityConfig = getEntityConfig('rawCard');
    
    super('rawCardService', {
      entityName: entityConfig.entityName,
      pluralName: entityConfig.pluralName,
      includeMarkAsSold: entityConfig.includeMarkAsSold,
      defaultPopulate: entityConfig.defaultPopulate,
      filterableFields: entityConfig.filterableFields,
      searchFields: entityConfig.searchFields,
      searchWeights: entityConfig.searchWeights,
      validationRules: entityConfig.validationRules,
    });
  }

  // Custom methods specific to raw cards can be added here
  // All standard CRUD operations are inherited from BaseController
}

// Create instance and export methods
const rawCardController = new RawCardController();

module.exports = {
  getAllRawCards: rawCardController.getAll,
  getRawCardById: rawCardController.getById,
  createRawCard: rawCardController.create,
  updateRawCard: rawCardController.update,
  deleteRawCard: rawCardController.delete,
  markAsSold: rawCardController.markAsSold,
};
