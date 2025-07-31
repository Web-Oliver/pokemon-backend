/**
 * PSA Graded Card Controller
 * 
 * Uses controller factory to eliminate boilerplate code.
 * All CRUD operations are provided by BaseController via factory.
 */

const { createCollectionControllerWithExports } = require('./factories/controllerFactory');

// Create controller with all standard CRUD operations in one line
module.exports = createCollectionControllerWithExports(
  'psaGradedCard',           // Entity type for configuration
  'psaGradedCardService',    // Service name for dependency injection  
  'PsaGradedCard'           // Prefix for export method names
);
