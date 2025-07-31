/**
 * Raw Card Controller
 * 
 * Uses controller factory to eliminate boilerplate code.
 * All CRUD operations are provided by BaseController via factory.
 */

const { createCollectionControllerWithExports } = require('./factories/controllerFactory');

// Create controller with all standard CRUD operations in one line
module.exports = createCollectionControllerWithExports(
  'rawCard',           // Entity type for configuration
  'rawCardService',    // Service name for dependency injection  
  'RawCard'           // Prefix for export method names
);
