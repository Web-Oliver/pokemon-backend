const PsaGradedCardRepository = require('../repositories/PsaGradedCardRepository');
const RawCardRepository = require('../repositories/RawCardRepository');
const SealedProductRepository = require('../repositories/SealedProductRepository');
const CardRepository = require('../repositories/CardRepository');
const SetRepository = require('../repositories/SetRepository');
const CardMarketReferenceProductRepository = require('../repositories/CardMarketReferenceProductRepository');
const CollectionService = require('../services/domain/CollectionService');
const ImageManager = require('../services/shared/imageManager');
const SaleService = require('../services/shared/saleService');
const SearchFactory = require('../services/search/SearchFactory');

/**
 * Dependency Injection Container
 *
 * Provides centralized dependency management for the application.
 * Implements the Dependency Injection pattern to reduce coupling
 * and improve testability.
 *
 * Following SOLID principles:
 * - Single Responsibility: Manages dependencies only
 * - Open/Closed: Extensible for new dependencies
 * - Dependency Inversion: Provides abstractions for dependencies
 */
class Container {
  constructor() {
    this.dependencies = new Map();
    this.singletons = new Map();
    this.initialized = false;
  }

  /**
   * Initializes the container with all dependencies
   */
  initialize() {
    if (this.initialized) {
      return;
    }

    // Register shared services
    this.registerSingleton('imageManager', () => ImageManager);
    this.registerSingleton('saleService', () => SaleService);

    // Register repositories
    this.registerSingleton('psaGradedCardRepository', () => new PsaGradedCardRepository());
    this.registerSingleton('rawCardRepository', () => new RawCardRepository());
    this.registerSingleton('sealedProductRepository', () => new SealedProductRepository());
    this.registerSingleton('cardRepository', () => new CardRepository());
    this.registerSingleton('setRepository', () => new SetRepository());
    this.registerSingleton('cardMarketReferenceProductRepository', () => new CardMarketReferenceProductRepository());

    // Register domain services
    this.registerTransient('psaGradedCardService', () => new CollectionService(
      this.resolve('psaGradedCardRepository'),
      {
        entityName: 'PsaGradedCard',
        imageManager: this.resolve('imageManager'),
        saleService: this.resolve('saleService'),
        enableImageManagement: true,
        enableSaleTracking: true,
      },
    ));

    this.registerTransient('rawCardService', () => new CollectionService(
      this.resolve('rawCardRepository'),
      {
        entityName: 'RawCard',
        imageManager: this.resolve('imageManager'),
        saleService: this.resolve('saleService'),
        enableImageManagement: true,
        enableSaleTracking: true,
      },
    ));

    this.registerTransient('sealedProductService', () => new CollectionService(
      this.resolve('sealedProductRepository'),
      {
        entityName: 'SealedProduct',
        imageManager: this.resolve('imageManager'),
        saleService: this.resolve('saleService'),
        enableImageManagement: true,
        enableSaleTracking: true,
      },
    ));

    // Register search services
    this.registerSingleton('searchFactory', () => new SearchFactory(this, {
      enableCaching: true,
      defaultMaxResults: 50,
      enableFuzzySearch: true,
      enableScoring: true,
    }));

    this.initialized = true;
  }

  /**
   * Registers a singleton dependency
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function to create the dependency
   */
  registerSingleton(name, factory) {
    this.dependencies.set(name, {
      factory,
      type: 'singleton',
    });
  }

  /**
   * Registers a transient dependency
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function to create the dependency
   */
  registerTransient(name, factory) {
    this.dependencies.set(name, {
      factory,
      type: 'transient',
    });
  }

  /**
   * Resolves a dependency by name
   * @param {string} name - Dependency name
   * @returns {*} - Resolved dependency
   */
  resolve(name) {
    if (!this.initialized) {
      this.initialize();
    }

    const dependency = this.dependencies.get(name);

    if (!dependency) {
      throw new Error(`Dependency '${name}' not found`);
    }

    if (dependency.type === 'singleton') {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, dependency.factory());
      }
      return this.singletons.get(name);
    }

    if (dependency.type === 'transient') {
      return dependency.factory();
    }

    throw new Error(`Unknown dependency type: ${dependency.type}`);
  }

  /**
   * Checks if a dependency is registered
   * @param {string} name - Dependency name
   * @returns {boolean} - True if dependency is registered
   */
  has(name) {
    return this.dependencies.has(name);
  }

  /**
   * Gets all registered dependency names
   * @returns {Array<string>} - Array of dependency names
   */
  getDependencyNames() {
    return Array.from(this.dependencies.keys());
  }

  /**
   * Clears all dependencies (useful for testing)
   */
  clear() {
    this.dependencies.clear();
    this.singletons.clear();
    this.initialized = false;
  }

  /**
   * Resets the container to initial state
   */
  reset() {
    this.clear();
    this.initialize();
  }

  /**
   * Gets container statistics
   * @returns {Object} - Container statistics
   */
  getStats() {
    return {
      totalDependencies: this.dependencies.size,
      singletons: this.singletons.size,
      transients: this.dependencies.size - this.singletons.size,
      initialized: this.initialized,
    };
  }
}

// Create and export container instance
const container = new Container();

// Auto-initialize on first import
container.initialize();

module.exports = container;
