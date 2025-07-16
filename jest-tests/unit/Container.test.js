const Container = require('../../container');

// Mock all the dependencies to avoid database connections
jest.mock('../../repositories/PsaGradedCardRepository');
jest.mock('../../repositories/RawCardRepository');
jest.mock('../../repositories/SealedProductRepository');
jest.mock('../../repositories/CardRepository');
jest.mock('../../repositories/SetRepository');
jest.mock('../../repositories/CardMarketReferenceProductRepository');
jest.mock('../../services/domain/CollectionService');
jest.mock('../../services/shared/imageManager');
jest.mock('../../services/shared/saleService');
jest.mock('../../services/search/SearchFactory');

describe('Container (Dependency Injection)', () => {
  let container;

  beforeEach(() => {
    // Create a fresh container instance for each test
    container = new (require('../../container/index').constructor)();
  });

  afterEach(() => {
    if (container) {
      container.clear();
    }
  });

  describe('Container Initialization', () => {
    test('should initialize container properly', () => {
      expect(container.initialized).toBe(false);
      
      container.initialize();
      
      expect(container.initialized).toBe(true);
      expect(container.dependencies.size).toBeGreaterThan(0);
    });

    test('should not reinitialize if already initialized', () => {
      container.initialize();
      const firstInitSize = container.dependencies.size;
      
      container.initialize(); // Should not reinitialize
      
      expect(container.dependencies.size).toBe(firstInitSize);
    });

    test('should auto-initialize on first resolve', () => {
      expect(container.initialized).toBe(false);
      
      // This should trigger auto-initialization
      expect(() => container.resolve('imageManager')).not.toThrow();
      
      expect(container.initialized).toBe(true);
    });
  });

  describe('Dependency Registration', () => {
    test('should register singleton dependencies', () => {
      const factory = jest.fn(() => ({ test: 'singleton' }));
      
      container.registerSingleton('testSingleton', factory);
      
      expect(container.has('testSingleton')).toBe(true);
      expect(container.dependencies.get('testSingleton').type).toBe('singleton');
    });

    test('should register transient dependencies', () => {
      const factory = jest.fn(() => ({ test: 'transient' }));
      
      container.registerTransient('testTransient', factory);
      
      expect(container.has('testTransient')).toBe(true);
      expect(container.dependencies.get('testTransient').type).toBe('transient');
    });

    test('should get all dependency names', () => {
      container.registerSingleton('dep1', () => ({}));
      container.registerTransient('dep2', () => ({}));
      
      const names = container.getDependencyNames();
      
      expect(names).toContain('dep1');
      expect(names).toContain('dep2');
      expect(Array.isArray(names)).toBe(true);
    });
  });

  describe('Dependency Resolution', () => {
    test('should resolve singleton dependencies correctly', () => {
      const mockInstance = { id: 'singleton-instance' };
      const factory = jest.fn(() => mockInstance);
      
      container.registerSingleton('testSingleton', factory);
      
      const resolved1 = container.resolve('testSingleton');
      const resolved2 = container.resolve('testSingleton');
      
      expect(resolved1).toBe(mockInstance);
      expect(resolved2).toBe(mockInstance);
      expect(resolved1).toBe(resolved2); // Same instance
      expect(factory).toHaveBeenCalledTimes(1); // Factory called only once
    });

    test('should resolve transient dependencies correctly', () => {
      const factory = jest.fn(() => ({ id: Math.random() }));
      
      container.registerTransient('testTransient', factory);
      
      const resolved1 = container.resolve('testTransient');
      const resolved2 = container.resolve('testTransient');
      
      expect(resolved1).not.toBe(resolved2); // Different instances
      expect(factory).toHaveBeenCalledTimes(2); // Factory called twice
    });

    test('should throw error for unregistered dependencies', () => {
      expect(() => {
        container.resolve('nonExistentDependency');
      }).toThrow("Dependency 'nonExistentDependency' not found");
    });

    test('should throw error for unknown dependency type', () => {
      container.dependencies.set('invalidType', {
        factory: () => ({}),
        type: 'unknown',
      });
      
      expect(() => {
        container.resolve('invalidType');
      }).toThrow('Unknown dependency type: unknown');
    });
  });

  describe('Container Management', () => {
    test('should check if dependency exists', () => {
      container.registerSingleton('existing', () => ({}));
      
      expect(container.has('existing')).toBe(true);
      expect(container.has('nonExisting')).toBe(false);
    });

    test('should clear all dependencies', () => {
      container.registerSingleton('dep1', () => ({}));
      container.registerTransient('dep2', () => ({}));
      container.resolve('dep1'); // Create singleton instance
      
      expect(container.dependencies.size).toBeGreaterThan(0);
      expect(container.singletons.size).toBeGreaterThan(0);
      expect(container.initialized).toBe(true);
      
      container.clear();
      
      expect(container.dependencies.size).toBe(0);
      expect(container.singletons.size).toBe(0);
      expect(container.initialized).toBe(false);
    });

    test('should reset container to initial state', () => {
      // Setup initial state
      container.registerSingleton('dep1', () => ({}));
      container.resolve('dep1');
      
      expect(container.dependencies.size).toBeGreaterThan(0);
      expect(container.singletons.size).toBeGreaterThan(0);
      
      const originalSize = container.dependencies.size;
      
      container.reset();
      
      // Should be cleared and re-initialized
      expect(container.initialized).toBe(true);
      expect(container.dependencies.size).toBeGreaterThan(0);
      expect(container.singletons.size).toBe(0); // Fresh singletons
    });

    test('should provide container statistics', () => {
      container.registerSingleton('singleton1', () => ({}));
      container.registerSingleton('singleton2', () => ({}));
      container.registerTransient('transient1', () => ({}));
      
      // Resolve one singleton to create instance
      container.resolve('singleton1');
      
      const stats = container.getStats();
      
      expect(stats.initialized).toBe(true);
      expect(stats.singletons).toBeGreaterThanOrEqual(1); // At least one singleton instance created
      expect(stats.totalDependencies).toBeGreaterThanOrEqual(3); // At least our registered dependencies
      expect(stats.transients).toBeGreaterThanOrEqual(0); // Non-singleton dependencies
    });
  });

  describe('Real Dependencies Integration', () => {
    test('should register all required repositories', () => {
      container.initialize();
      
      expect(container.has('psaGradedCardRepository')).toBe(true);
      expect(container.has('rawCardRepository')).toBe(true);
      expect(container.has('sealedProductRepository')).toBe(true);
      expect(container.has('cardRepository')).toBe(true);
      expect(container.has('setRepository')).toBe(true);
      expect(container.has('cardMarketReferenceProductRepository')).toBe(true);
    });

    test('should register all required services', () => {
      container.initialize();
      
      expect(container.has('psaGradedCardService')).toBe(true);
      expect(container.has('rawCardService')).toBe(true);
      expect(container.has('sealedProductService')).toBe(true);
      expect(container.has('imageManager')).toBe(true);
      expect(container.has('saleService')).toBe(true);
      expect(container.has('searchFactory')).toBe(true);
    });

    test('should resolve shared services as singletons', () => {
      container.initialize();
      
      const imageManager1 = container.resolve('imageManager');
      const imageManager2 = container.resolve('imageManager');
      
      expect(imageManager1).toBe(imageManager2);
    });

    test('should resolve collection services as transients', () => {
      container.initialize();
      
      const service1 = container.resolve('psaGradedCardService');
      const service2 = container.resolve('psaGradedCardService');
      
      expect(service1).not.toBe(service2); // Different instances
    });
  });

  describe('Error Handling', () => {
    test('should handle factory function errors gracefully', () => {
      const errorFactory = jest.fn(() => {
        throw new Error('Factory error');
      });
      
      container.registerSingleton('errorDependency', errorFactory);
      
      expect(() => {
        container.resolve('errorDependency');
      }).toThrow('Factory error');
    });

    test('should handle circular dependency resolution', () => {
      container.registerSingleton('dep1', () => ({ dependency: container.resolve('dep2') }));
      
      container.registerSingleton('dep2', () => ({ dependency: container.resolve('dep1') }));
      
      // This should cause a stack overflow or similar error
      expect(() => {
        container.resolve('dep1');
      }).toThrow();
    });
  });

  describe('Performance', () => {
    test('should efficiently resolve singletons', () => {
      let callCount = 0;
      const factory = jest.fn(() => {
        callCount++;
        return { count: callCount };
      });
      
      container.registerSingleton('performanceTest', factory);
      
      // Resolve many times
      for (let i = 0; i < 100; i++) {
        container.resolve('performanceTest');
      }
      
      expect(factory).toHaveBeenCalledTimes(1); // Only called once
      expect(callCount).toBe(1);
    });

    test('should handle large number of dependencies', () => {
      // Register many dependencies
      for (let i = 0; i < 1000; i++) {
        container.registerSingleton(`dep${i}`, () => ({ id: i }));
      }
      
      expect(container.dependencies.size).toBe(1000);
      
      // Resolve random dependencies
      const resolved = container.resolve('dep500');

      expect(resolved.id).toBe(500);
    });
  });
});