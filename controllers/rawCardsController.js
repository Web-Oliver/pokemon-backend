const BaseController = require('./base/BaseController');

/**
 * Raw Card Controller
 *
 * Extends BaseController to provide CRUD operations for raw cards.
 * Uses dependency injection and repository pattern for improved architecture.
 */
class RawCardController extends BaseController {
  constructor() {
    super('rawCardService', {
      entityName: 'RawCard',
      pluralName: 'rawCards',
      includeMarkAsSold: true,
      defaultPopulate: {
        path: 'cardId',
        populate: {
          path: 'setId',
          model: 'Set',
        },
      },
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
