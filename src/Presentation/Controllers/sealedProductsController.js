/**
 * Sealed Product Controller
 *
 * Fixed controller factory to properly export methods with correct names
 */

import { createCollectionController   } from './factories/controllerFactory.js';
// Create controller with proper factory
const controller = createCollectionController('sealedProduct', 'sealedProductService');

// Export methods with the names expected by CRUD route factory
export const getAll = controller.getAll;
export const getById = controller.getById;
export const create = controller.create;
export const update = controller.update;
export const deleteCard = controller.delete;
export const markAsSold = controller.markAsSold;

export default {
  getAll: controller.getAll,
  getById: controller.getById,
  create: controller.create,
  update: controller.update,
  delete: controller.delete,
  markAsSold: controller.markAsSold
};
