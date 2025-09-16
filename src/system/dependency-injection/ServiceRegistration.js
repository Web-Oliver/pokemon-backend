/**
 * Service Registration Configuration
 *
 * SINGLE PLACE to register ALL services
 * Eliminates service instantiation duplication across the codebase
 * Updated for new domain-driven architecture
 */

import { container, ServiceKeys } from './ServiceContainer.js';

// Repositories
import CardRepository from '@/pokemon/cards/CardRepository.js';
import SetRepository from '@/pokemon/sets/SetRepository.js';
import ProductRepository from '@/pokemon/products/ProductRepository.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import StitchedLabelRepository from '@/icr/infrastructure/repositories/StitchedLabelRepository.js';

// Collection Models and Services
import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import RawCard from '@/collection/items/RawCard.js';
import SealedProduct from '@/collection/items/SealedProduct.js';
import CollectionRepository from '@/collection/items/CollectionRepository.js';
import CollectionService from '@/collection/items/CollectionService.js';
import OcrCollectionService from '@/collection/services/CollectionService.js';
import { getEntityConfig } from '@/system/database/entityConfigurations.js';

// Services
import ProductService from '@/pokemon/products/ProductService.js';
import SearchService from '@/search/services/SearchService.js';
import ExportService from '@/marketplace/exports/ExportService.js';
import StatusService from '@/system/services/StatusService.js';
import StatusController from '@/system/controllers/StatusController.js';
import HealthService from '@/system/services/HealthService.js';
import HealthController from '@/system/controllers/HealthController.js';
import { cacheManager } from '@/search/middleware/searchCache.js';
import EndpointsService from '@/system/services/EndpointsService.js';
import EndpointsController from '@/system/controllers/EndpointsController.js';
import Logger from '@/system/logging/Logger.js';
import IcrBatchService from '@/icr/application/IcrBatchService.js';
import IcrStatusService from '@/icr/application/services/IcrStatusService.js';
import IcrStitchingOrchestrator from '@/icr/application/services/IcrStitchingOrchestrator.js';
import { GoogleVisionOcrProvider } from '@/icr/infrastructure/external/GoogleVisionOcrProvider.js';
import PsaLabelExtractionService from '@/icr/infrastructure/services/PsaLabelExtractionService.js';
import IcrLabelExtractionService from '@/icr/application/services/IcrLabelExtractionService.js';
import IcrTextDistributionService from '@/icr/application/services/IcrTextDistributionService.js';

/**
 * Register all services in the container
 */
export function registerServices() {

  // ============ REPOSITORY REGISTRATIONS ============
  container.registerSingleton(ServiceKeys.CARD_REPOSITORY, () => {
    return new CardRepository();
  });

  container.registerSingleton(ServiceKeys.SET_REPOSITORY, () => {
    return new SetRepository();
  });

  container.registerSingleton(ServiceKeys.PRODUCT_REPOSITORY, () => {
    return new ProductRepository();
  });

  container.registerSingleton(ServiceKeys.GRADED_CARD_SCAN_REPOSITORY, () => {
    return new GradedCardScanRepository();
  });

  container.registerSingleton(ServiceKeys.STITCHED_LABEL_REPOSITORY, () => {
    return new StitchedLabelRepository();
  });

  // ============ COLLECTION REPOSITORY REGISTRATIONS ============
  container.registerSingleton('psaGradedCardRepository', () => {
    return new CollectionRepository(PsaGradedCard, 'PsaGradedCard');
  });

  container.registerSingleton('rawCardRepository', () => {
    return new CollectionRepository(RawCard, 'RawCard');
  });

  container.registerSingleton('sealedProductRepository', () => {
    return new CollectionRepository(SealedProduct, 'SealedProduct');
  });

  // ============ COLLECTION SERVICE REGISTRATIONS ============
  container.registerSingleton('psaGradedCardService', () => {
    return new CollectionService(
      container.resolve('psaGradedCardRepository'),
      { entityName: 'PsaGradedCard' }
    );
  });

  container.registerSingleton('rawCardService', () => {
    return new CollectionService(
      container.resolve('rawCardRepository'),
      { entityName: 'RawCard' }
    );
  });

  container.registerSingleton('sealedProductService', () => {
    return new CollectionService(
      container.resolve('sealedProductRepository'),
      { entityName: 'SealedProduct' }
    );
  });

  // ============ OCR COLLECTION SERVICE REGISTRATIONS ============
  // OCR-specific service for PSA card approval workflow
  container.register('ocrCollectionService', () => {
    return new OcrCollectionService();
  });

  // ============ BUSINESS LOGIC SERVICE REGISTRATIONS ============
  container.registerSingleton(ServiceKeys.PRODUCT_SERVICE, () => {
    return new ProductService();
  });

  container.registerSingleton(ServiceKeys.SEARCH_SERVICE, () => {
    return new SearchService();
  });

  container.registerSingleton(ServiceKeys.EXPORT_SERVICE, () => {
    return new ExportService();
  });

  container.registerSingleton(ServiceKeys.ICR_BATCH_SERVICE, () => {
    return new IcrBatchService();
  });

  // ============ ICR SERVICE REGISTRATIONS ============
  container.registerSingleton(ServiceKeys.ICR_STATUS_SERVICE, () => {
    return new IcrStatusService();
  });

  container.register(ServiceKeys.ICR_STITCHING_ORCHESTRATOR, () => {
    return new IcrStitchingOrchestrator(
      container.resolve(ServiceKeys.ICR_STATUS_SERVICE),
      container.resolve(ServiceKeys.GRADED_CARD_SCAN_REPOSITORY),
      container.resolve(ServiceKeys.STITCHED_LABEL_REPOSITORY)
    );
  });

  // Additional OCR services
  container.register('GoogleVisionOcrProvider', () => {
    return new GoogleVisionOcrProvider();
  });

  container.register('PsaLabelExtractionService', () => {
    return new PsaLabelExtractionService();
  });

  container.register('IcrLabelExtractionService', () => {
    return new IcrLabelExtractionService();
  });

  container.register('IcrTextDistributionService', () => {
    return new IcrTextDistributionService();
  });

  // ============ SYSTEM SERVICE REGISTRATIONS ============
  container.registerSingleton('Logger', () => {
    return new Logger();
  });

  container.registerSingleton(ServiceKeys.STATUS_SERVICE, () => {
    return new StatusService();
  });

  container.registerSingleton(ServiceKeys.STATUS_CONTROLLER, () => {
    return new StatusController(
      container.resolve(ServiceKeys.STATUS_SERVICE)
    );
  });

  // Health Service & Controller - DEPENDENCY CHECKS
  container.registerSingleton(ServiceKeys.HEALTH_SERVICE, () => {
    return new HealthService({
      cacheManager: cacheManager, // Use working cache manager from searchCache.js
      uploadPath: process.env.UPLOAD_PATH || './uploads'
    });
  });

  container.registerSingleton(ServiceKeys.HEALTH_CONTROLLER, () => {
    return new HealthController(
      container.resolve(ServiceKeys.HEALTH_SERVICE)
    );
  });

  // Endpoints Documentation Service & Controller - STANDALONE
  container.registerSingleton(ServiceKeys.ENDPOINTS_SERVICE, () => {
    return new EndpointsService(console); // Use console instead of complex logger
  });

  container.registerSingleton(ServiceKeys.ENDPOINTS_CONTROLLER, () => {
    return new EndpointsController(
      container.resolve(ServiceKeys.ENDPOINTS_SERVICE)
    );
  });

  // Log registration stats
  const stats = container.getStats();
}

/**
 * Initialize services that need startup initialization
 */
export async function initializeServices() {

  try {
    // OCR services now use new domain-driven architecture
    // No startup initialization needed for repositories
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

/**
 * Cleanup services on application shutdown
 */
export async function cleanupServices() {

  try {
    container.clear();
  } catch (error) {
    console.error('❌ Service cleanup failed:', error);
  }
}
