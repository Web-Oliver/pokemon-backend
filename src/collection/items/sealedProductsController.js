/**
 * Sealed Products Controller
 * Updated to use CollectionControllerFactory to eliminate code duplication
 *
 * BEFORE: 76 lines of duplicated CRUD code
 * AFTER: 8 lines using factory pattern
 *
 * This update eliminates DRY violations by leveraging the factory pattern
 * and BaseController infrastructure. Enhanced functionality like search,
 * bulkUpdate, and statistics are now provided by the factory.
 */

import { CollectionControllerFactories } from '@/system/factories/CollectionControllerFactory.js';

// Create controller using factory - eliminates 68+ lines of duplicate code
const controller = CollectionControllerFactories.createSealedProductsController();

export default controller;
