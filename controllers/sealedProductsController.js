/**
 * Sealed Product Controller
 * 
 * Uses controller factory to eliminate boilerplate code.
 * All CRUD operations are provided by BaseController via factory.
 */

const { createCollectionControllerWithExports } = require('./factories/controllerFactory');

// Create controller with all standard CRUD operations in one line
module.exports = createCollectionControllerWithExports(
  'sealedProduct',           // Entity type for configuration
  'sealedProductService',    // Service name for dependency injection  
  'SealedProduct'           // Prefix for export method names
);
