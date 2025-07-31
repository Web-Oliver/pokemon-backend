const BaseController = require('./base/BaseController');
const { getEntityConfig } = require('../config/entityConfigurations');

/**
 * PSA Graded Card Controller
 *
 * Extends BaseController to provide CRUD operations for PSA graded cards.
 * Uses dependency injection and repository pattern for improved architecture.
 */
class PsaGradedCardController extends BaseController {
  constructor() {
    // Get centralized entity configuration
    const entityConfig = getEntityConfig('psaGradedCard');
    
    super('psaGradedCardService', {
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

  // Custom methods specific to PSA graded cards can be added here
  // All standard CRUD operations are inherited from BaseController
}

// Create instance and export methods
const psaGradedCardController = new PsaGradedCardController();

module.exports = {
  getAllPsaGradedCards: psaGradedCardController.getAll,
  getPsaGradedCardById: psaGradedCardController.getById,
  createPsaGradedCard: psaGradedCardController.create,
  updatePsaGradedCard: psaGradedCardController.update,
  deletePsaGradedCard: psaGradedCardController.delete,
  markAsSold: psaGradedCardController.markAsSold,
};
