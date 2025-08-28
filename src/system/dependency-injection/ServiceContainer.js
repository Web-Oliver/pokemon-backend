/**
 * Service Container - Dependency Injection Implementation
 *
 * Single responsibility: Manage service registration and resolution
 * Eliminates service instantiation duplication across the codebase
 */

/**
 * Service Container Implementation
 *
 * Features:
 * - Lazy instantiation (services created only when needed)
 * - Singleton support (one instance per container)
 * - Factory registration (flexible instantiation)
 */
export class ServiceContainer {
  constructor() {
    this.factories = new Map();
    this.singletons = new Map();
    this.singletonFactories = new Set();
  }

  /**
   * Register a transient service (new instance each time)
   */
  register(key, factory) {
    if (this.factories.has(key)) {
      throw new Error(`Service '${key}' is already registered`);
    }
    this.factories.set(key, factory);
  }

  /**
   * Register a singleton service (same instance each time)
   */
  registerSingleton(key, factory) {
    this.register(key, factory);
    this.singletonFactories.add(key);
  }

  /**
   * Resolve a service by key
   */
  resolve(key) {
    // Check for singleton first
    if (this.singletonFactories.has(key)) {
      if (this.singletons.has(key)) {
        return this.singletons.get(key);
      }

      const factory = this.factories.get(key);
      if (!factory) {
        throw new Error(`Service '${key}' is not registered`);
      }

      const instance = factory();
      this.singletons.set(key, instance);
      return instance;
    }

    // Regular transient service
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(`Service '${key}' is not registered`);
    }

    return factory();
  }

  /**
   * Check if service is registered
   */
  has(key) {
    return this.factories.has(key);
  }

  /**
   * Clear all registrations
   */
  clear() {
    this.factories.clear();
    this.singletons.clear();
    this.singletonFactories.clear();
  }

  /**
   * Get registration statistics
   */
  getStats() {
    return {
      totalRegistered: this.factories.size,
      singletonsCreated: this.singletons.size,
      singletonFactories: this.singletonFactories.size
    };
  }
}

/**
 * Global service container instance
 */
export const container = new ServiceContainer();

/**
 * Service Keys
 */
export const ServiceKeys = {

  // ICR Services
  ICR_STATUS_SERVICE: 'IcrStatusService',
  ICR_STITCHING_ORCHESTRATOR: 'IcrStitchingOrchestrator',

  // Repository Services
  CARD_REPOSITORY: 'CardRepository',
  PRODUCT_REPOSITORY: 'ProductRepository',
  SET_REPOSITORY: 'SetRepository',
  PSA_REPOSITORY: 'PsaRepository',
  GRADED_CARD_SCAN_REPOSITORY: 'GradedCardScanRepository',
  STITCHED_LABEL_REPOSITORY: 'StitchedLabelRepository',

  // Business Logic Services
  PRODUCT_SERVICE: 'ProductService',
  SEARCH_SERVICE: 'SearchService',
  EXPORT_SERVICE: 'ExportService',
  ICR_BATCH_SERVICE: 'IcrBatchService',
  
  // System Services
  STATUS_SERVICE: 'StatusService',
  STATUS_CONTROLLER: 'StatusController'
};
