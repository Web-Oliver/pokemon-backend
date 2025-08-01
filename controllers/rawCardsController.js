/**
 * Raw Card Controller
 * 
 * Fixed controller factory to properly export methods with correct names
 */

const { createCollectionController } = require('./factories/controllerFactory');

// Create controller with proper factory
const controller = createCollectionController('rawCard', 'rawCardService');

// Export methods with the names expected by CRUD route factory
module.exports = {
  getAll: controller.getAll,
  getById: controller.getById,
  create: controller.create,
  update: controller.update,
  delete: controller.delete,
  markAsSold: controller.markAsSold
};
