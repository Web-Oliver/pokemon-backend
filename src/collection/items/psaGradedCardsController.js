/**
 * PSA Graded Cards Controller
 * Updated to use CollectionControllerFactory to eliminate code duplication
 *
 * BEFORE: 58 lines of duplicated CRUD code
 * AFTER: 8 lines using factory pattern
 *
 * This update eliminates DRY violations by leveraging the factory pattern
 * and BaseController infrastructure for consistent API responses and error handling.
 */

import {CollectionControllerFactories} from '@/system/factories/CollectionControllerFactory.js';

// Create controller using factory - eliminates 50+ lines of duplicate code
const controller = CollectionControllerFactories.createPsaGradedCardsController();

export default controller;
