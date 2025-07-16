const PsaGradedCard = require('../models/PsaGradedCard');
const psaQueryService = require('../services/psaGradedCardQueryService');
const psaCrudService = require('../services/psaGradedCardCrudService');
const BaseController = require('./base/BaseController');

/**
 * PSA Graded Card Controller
 * 
 * Extends BaseController to provide CRUD operations for PSA graded cards.
 * Uses the new architecture with significantly reduced code duplication.
 */
class PsaGradedCardController extends BaseController {
  constructor() {
    super(PsaGradedCard, psaQueryService, psaCrudService, {
      entityName: 'PsaGradedCard',
      pluralName: 'psaGradedCards',
      includeMarkAsSold: true,
      defaultPopulate: {
        path: 'cardId',
        populate: {
          path: 'setId',
          model: 'Set'
        }
      }
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