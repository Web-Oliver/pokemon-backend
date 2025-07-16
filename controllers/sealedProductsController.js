const BaseController = require('./base/BaseController');

/**
 * Sealed Product Controller
 * 
 * Extends BaseController to provide CRUD operations for sealed products.
 * Uses dependency injection and repository pattern for improved architecture.
 */
class SealedProductController extends BaseController {
  constructor() {
    super('sealedProductService', {
      entityName: 'SealedProduct',
      pluralName: 'sealedProducts',
      includeMarkAsSold: true,
      defaultPopulate: {
        path: 'productId'
      }
    });
  }

  // Custom methods specific to sealed products can be added here
  // All standard CRUD operations are inherited from BaseController
}

// Create instance and export methods
const sealedProductController = new SealedProductController();

module.exports = {
  getAllSealedProducts: sealedProductController.getAll,
  getSealedProductById: sealedProductController.getById,
  createSealedProduct: sealedProductController.create,
  updateSealedProduct: sealedProductController.update,
  deleteSealedProduct: sealedProductController.delete,
  markAsSold: sealedProductController.markAsSold,
};