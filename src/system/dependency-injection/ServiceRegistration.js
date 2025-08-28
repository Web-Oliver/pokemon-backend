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

// Services
import ProductService from '@/pokemon/products/ProductService.js';
import SearchService from '@/search/services/SearchService.js';
import ExportService from '@/marketplace/exports/ExportService.js';
import IcrBatchService from '@/icr/application/IcrBatchService.js';
import IcrStatusService from '@/icr/application/services/IcrStatusService.js';
import IcrStitchingOrchestrator from '@/icr/application/services/IcrStitchingOrchestrator.js';

/**
 * Register all services in the container
 */
export function registerServices() {
  console.log('📦 Registering all services...');

  // ============ REPOSITORY REGISTRATIONS ============
  container.registerSingleton(ServiceKeys.CARD_REPOSITORY, () => {
    console.log('🗃️ Creating CardRepository singleton');
    return new CardRepository();
  });

  container.registerSingleton(ServiceKeys.SET_REPOSITORY, () => {
    console.log('🗃️ Creating SetRepository singleton');
    return new SetRepository();
  });

  container.registerSingleton(ServiceKeys.PRODUCT_REPOSITORY, () => {
    console.log('🗃️ Creating ProductRepository singleton');
    return new ProductRepository();
  });

  container.registerSingleton(ServiceKeys.GRADED_CARD_SCAN_REPOSITORY, () => {
    console.log('🗃️ Creating GradedCardScanRepository singleton');
    return new GradedCardScanRepository();
  });

  container.registerSingleton(ServiceKeys.STITCHED_LABEL_REPOSITORY, () => {
    console.log('🗃️ Creating StitchedLabelRepository singleton');
    return new StitchedLabelRepository();
  });

  // ============ BUSINESS LOGIC SERVICE REGISTRATIONS ============
  container.registerSingleton(ServiceKeys.PRODUCT_SERVICE, () => {
    console.log('🏢 Creating ProductService singleton');
    return new ProductService();
  });

  container.registerSingleton(ServiceKeys.SEARCH_SERVICE, () => {
    console.log('🏢 Creating SearchService singleton');
    return new SearchService();
  });

  container.registerSingleton(ServiceKeys.EXPORT_SERVICE, () => {
    console.log('🏢 Creating ExportService singleton');
    return new ExportService();
  });

  console.log('🔍 [DEBUG] ICR_BATCH_SERVICE key:', ServiceKeys.ICR_BATCH_SERVICE);
  container.registerSingleton(ServiceKeys.ICR_BATCH_SERVICE, () => {
    console.log('🏢 Creating IcrBatchService singleton');
    return new IcrBatchService();
  });

  // ============ ICR SERVICE REGISTRATIONS ============
  container.registerSingleton(ServiceKeys.ICR_STATUS_SERVICE, () => {
    console.log('🏢 Creating IcrStatusService singleton');
    return new IcrStatusService();
  });

  container.register(ServiceKeys.ICR_STITCHING_ORCHESTRATOR, () => {
    console.log('🏢 Creating IcrStitchingOrchestrator transient (with injected dependencies)');
    return new IcrStitchingOrchestrator(
      container.resolve(ServiceKeys.ICR_STATUS_SERVICE),
      container.resolve(ServiceKeys.GRADED_CARD_SCAN_REPOSITORY),
      container.resolve(ServiceKeys.STITCHED_LABEL_REPOSITORY)
    );
  });

  console.log('✅ All services registered successfully');

  // Log registration stats
  const stats = container.getStats();
  console.log('📊 Registration stats:', stats);
}

/**
 * Initialize services that need startup initialization
 */
export async function initializeServices() {
  console.log('🚀 Initializing services...');

  try {
    // OCR services now use new domain-driven architecture
    // No startup initialization needed for repositories
    console.log('✅ Services initialized successfully');
  } catch (error) {
    console.error('❌ Service initialization failed:', error);
    throw error;
  }
}

/**
 * Cleanup services on application shutdown
 */
export async function cleanupServices() {
  console.log('🧹 Cleaning up services...');

  try {
    container.clear();
    console.log('✅ Services cleaned up successfully');
  } catch (error) {
    console.error('❌ Service cleanup failed:', error);
  }
}
