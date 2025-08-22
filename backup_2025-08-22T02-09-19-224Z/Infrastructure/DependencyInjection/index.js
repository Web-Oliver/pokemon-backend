import CollectionRepository from '@/Infrastructure/Persistence/Repositories/CollectionRepository.js';
import PsaGradedCard from '@/Domain/Entities/PsaGradedCard.js';
import RawCard from '@/Domain/Entities/RawCard.js';
import SealedProduct from '@/Domain/Entities/SealedProduct.js';
import CardRepository from '@/Infrastructure/Persistence/Repositories/CardRepository.js';
import SetRepository from '@/Infrastructure/Persistence/Repositories/SetRepository.js';
import ProductRepository from '@/Infrastructure/Persistence/Repositories/ProductRepository.js';
import SetProductRepository from '@/Infrastructure/Persistence/Repositories/SetProductRepository.js';
import CollectionService from '@/Application/UseCases/Collections/CollectionService.js';
import ImageManager from '@/Application/Services/Core/imageManager.js';
import SaleService from '@/Application/Services/Core/saleService.js';
// SearchFactory removed - replaced with simple searchService
import { getEntityConfig   } from '@/Infrastructure/Configuration/entityConfigurations.js';
import Logger from '@/Infrastructure/Utilities/Logger.js';
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
    this.scoped = new Map();
    this.configurations = new Map();
    this.hooks = new Map();
    this.initialized = false;
    this.isResolvingStack = new Set(); // Circular dependency detection
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

    // Register repositories using consolidated CollectionRepository
    this.registerSingleton('psaGradedCardRepository', () => new CollectionRepository(PsaGradedCard, 'PsaGradedCard'));
    this.registerSingleton('rawCardRepository', () => new CollectionRepository(RawCard, 'RawCard'));
    this.registerSingleton('sealedProductRepository', () => new CollectionRepository(SealedProduct, 'SealedProduct'));
    this.registerSingleton('cardRepository', () => new CardRepository());
    this.registerSingleton('setRepository', () => new SetRepository());
    this.registerSingleton('productRepository', () => new ProductRepository());
    this.registerSingleton('setProductRepository', () => new SetProductRepository());

    // Register domain services using entity configurations
    this.registerTransient(
      'psaGradedCardService',
      () => {
        const entityConfig = getEntityConfig('psaGradedCard');

        return new CollectionService(this.resolve('psaGradedCardRepository'), {
          entityName: entityConfig?.entityName || 'PsaGradedCard',
          imageManager: this.resolve('imageManager'),
          saleService: this.resolve('saleService'),
          enableImageManagement: true,
          enableSaleTracking: entityConfig?.includeMarkAsSold !== false,
          ...this.getConfiguration('psaGradedCardService'),
        });
      }
    );

    this.registerTransient(
      'rawCardService',
      () => {
        const entityConfig = getEntityConfig('rawCard');

        return new CollectionService(this.resolve('rawCardRepository'), {
          entityName: entityConfig?.entityName || 'RawCard',
          imageManager: this.resolve('imageManager'),
          saleService: this.resolve('saleService'),
          enableImageManagement: true,
          enableSaleTracking: entityConfig?.includeMarkAsSold !== false,
          ...this.getConfiguration('rawCardService'),
        });
      }
    );

    this.registerTransient(
      'sealedProductService',
      () => {
        const entityConfig = getEntityConfig('sealedProduct');

        return new CollectionService(this.resolve('sealedProductRepository'), {
          entityName: entityConfig?.entityName || 'SealedProduct',
          imageManager: this.resolve('imageManager'),
          saleService: this.resolve('saleService'),
          enableImageManagement: true,
          enableSaleTracking: entityConfig?.includeMarkAsSold !== false,
          ...this.getConfiguration('sealedProductService'),
        });
      }
    );

    // Search services removed - using simple searchService directly

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
   * Registers a scoped dependency (one instance per request/context)
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function to create the dependency
   */
  registerScoped(name, factory) {
    this.dependencies.set(name, {
      factory,
      type: 'scoped',
    });
  }

  /**
   * Registers a factory-based dependency with custom creation logic
   * @param {string} name - Dependency name
   * @param {Function} factory - Factory function that receives container as parameter
   * @param {string} lifecycle - Lifecycle type ('singleton', 'transient', 'scoped')
   */
  registerFactory(name, factory, lifecycle = 'transient') {
    this.dependencies.set(name, {
      factory: () => factory(this),
      type: lifecycle,
    });
  }

  /**
   * Registers configuration for a dependency
   * @param {string} serviceName - Service name
   * @param {Object} config - Configuration object
   */
  configure(serviceName, config) {
    this.configurations.set(serviceName, config);
    Logger.debug('Container', `Configuration registered for ${serviceName}`, config);
  }

  /**
   * Gets configuration for a service
   * @param {string} serviceName - Service name
   * @returns {Object} - Configuration object
   */
  getConfiguration(serviceName) {
    return this.configurations.get(serviceName) || {};
  }

  /**
   * Registers a lifecycle hook
   * @param {string} event - Event name ('beforeResolve', 'afterResolve', 'onError')
   * @param {Function} handler - Hook handler function
   */
  registerHook(event, handler) {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event).push(handler);
  }

  /**
   * Executes hooks for an event
   * @param {string} event - Event name
   * @param {Object} context - Context data
   */
  executeHooks(event, context) {
    const handlers = this.hooks.get(event) || [];

    handlers.forEach(handler => {
      try {
        handler(context);
      } catch (error) {
        Logger.error('Container', `Hook execution failed for ${event}`, error);
      }
    });
  }

  /**
   * Resolves a dependency by name with enhanced lifecycle management
   * @param {string} name - Dependency name
   * @param {Object} context - Resolution context for scoped dependencies
   * @returns {*} - Resolved dependency
   */
  resolve(name, context = null) {
    if (!this.initialized) {
      this.initialize();
    }

    // Circular dependency detection
    if (this.isResolvingStack.has(name)) {
      throw new Error(`Circular dependency detected: ${Array.from(this.isResolvingStack).join(' -> ')} -> ${name}`);
    }

    const dependency = this.dependencies.get(name);

    if (!dependency) {
      throw new Error(`Dependency '${name}' not found. Available: ${this.getDependencyNames().join(', ')}`);
    }

    // Execute before resolve hooks
    this.executeHooks('beforeResolve', { name, dependency, context });

    this.isResolvingStack.add(name);

    try {
      let instance;

      switch (dependency.type) {
        case 'singleton':
          if (!this.singletons.has(name)) {
            Logger.debug('Container', `Creating singleton instance of ${name}`);
            this.singletons.set(name, dependency.factory());
          }
          instance = this.singletons.get(name);
          break;

        case 'scoped':
          const scopeKey = context?.scopeId || 'default';
          const scopedInstances = this.scoped.get(scopeKey) || new Map();

          if (!scopedInstances.has(name)) {
            Logger.debug('Container', `Creating scoped instance of ${name} for scope ${scopeKey}`);
            scopedInstances.set(name, dependency.factory());
            this.scoped.set(scopeKey, scopedInstances);
          }
          instance = scopedInstances.get(name);
          break;

        case 'transient':
          Logger.debug('Container', `Creating transient instance of ${name}`);
          instance = dependency.factory();
          break;

        default:
          throw new Error(`Unknown dependency type: ${dependency.type}`);
      }

      // Execute after resolve hooks
      this.executeHooks('afterResolve', { name, instance, dependency, context });

      return instance;

    } catch (error) {
      // Execute error hooks
      this.executeHooks('onError', { name, error, dependency, context });
      throw error;
    } finally {
      this.isResolvingStack.delete(name);
    }
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
    this.scoped.clear();
    this.configurations.clear();
    this.hooks.clear();
    this.isResolvingStack.clear();
    this.initialized = false;
  }

  /**
   * Clears scoped instances for a specific scope
   * @param {string} scopeId - Scope identifier
   */
  clearScope(scopeId) {
    this.scoped.delete(scopeId);
    Logger.debug('Container', `Cleared scope: ${scopeId}`);
  }

  /**
   * Resolves multiple dependencies at once
   * @param {Array<string>} names - Array of dependency names
   * @param {Object} context - Resolution context
   * @returns {Array} - Array of resolved dependencies
   */
  resolveMultiple(names, context = null) {
    return names.map(name => this.resolve(name, context));
  }

  /**
   * Checks if all dependencies in a list can be resolved
   * @param {Array<string>} names - Array of dependency names
   * @returns {boolean} - True if all dependencies can be resolved
   */
  canResolveAll(names) {
    return names.every(name => this.has(name));
  }

  /**
   * Gets dependency graph information
   * @returns {Object} - Dependency graph with types and relationships
   */
  getDependencyGraph() {
    const graph = {};

    for (const [name, dependency] of this.dependencies) {
      graph[name] = {
        type: dependency.type,
        hasConfiguration: this.configurations.has(name),
        isResolved: dependency.type === 'singleton' ? this.singletons.has(name) : false,
      };
    }

    return graph;
  }

  /**
   * Validates the container configuration
   * @returns {Object} - Validation results
   */
  validateContainer() {
    const issues = [];
    const warnings = [];

    // Check for circular dependencies by attempting to resolve all
    for (const name of this.dependencies.keys()) {
      try {
        this.resolve(name);
      } catch (error) {
        if (error.message.includes('Circular dependency')) {
          issues.push(`Circular dependency detected for ${name}: ${error.message}`);
        } else {
          issues.push(`Failed to resolve ${name}: ${error.message}`);
        }
      }
    }

    // Check for unused configurations
    for (const configName of this.configurations.keys()) {
      if (!this.has(configName)) {
        warnings.push(`Configuration exists for unregistered dependency: ${configName}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      totalDependencies: this.dependencies.size,
      totalConfigurations: this.configurations.size,
    };
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
    const dependenciesByType = {
      singleton: 0,
      transient: 0,
      scoped: 0,
    };

    for (const dependency of this.dependencies.values()) {
      dependenciesByType[dependency.type]++;
    }

    return {
      totalDependencies: this.dependencies.size,
      dependenciesByType,
      resolvedSingletons: this.singletons.size,
      totalConfigurations: this.configurations.size,
      totalHooks: Array.from(this.hooks.values()).reduce((total, handlers) => total + handlers.length, 0),
      scopedContexts: this.scoped.size,
      initialized: this.initialized,
      isResolving: this.isResolvingStack.size > 0,
    };
  }
}

// Create and export container instance
const container = new Container();

// Auto-initialize on first import
container.initialize();

export default container;
