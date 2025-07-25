/**
 * Dependency Injection Container Integration Tests
 * 
 * Tests the enhanced dependency injection container functionality including
 * service registration, lifecycle management, and configuration injection.
 */

const Container = require('../../container');

describe('Dependency Injection Container Integration Tests', () => {
  let container;

  beforeEach(() => {
    // Create fresh container instance for each test
    container = new Container();
  });

  describe('Service Registration', () => {
    it('should register and resolve singleton services', () => {
      class TestService {
        constructor() {
          this.id = Math.random();
        }
      }

      container.registerSingleton('testService', TestService);
      
      const instance1 = container.resolve('testService');
      const instance2 = container.resolve('testService');
      
      expect(instance1).toBeInstanceOf(TestService);
      expect(instance2).toBeInstanceOf(TestService);
      expect(instance1.id).toBe(instance2.id); // Same instance
    });

    it('should register and resolve transient services', () => {
      class TestService {
        constructor() {
          this.id = Math.random();
        }
      }

      container.registerTransient('testService', () => new TestService());
      
      const instance1 = container.resolve('testService');
      const instance2 = container.resolve('testService');
      
      expect(instance1).toBeInstanceOf(TestService);
      expect(instance2).toBeInstanceOf(TestService);
      expect(instance1.id).not.toBe(instance2.id); // Different instances
    });

    it('should register and resolve scoped services', () => {
      class TestService {
        constructor() {
          this.id = Math.random();
        }
      }

      container.registerScoped('testService', () => new TestService());
      
      const scope1 = container.createScope();
      const scope2 = container.createScope();
      
      const instance1a = scope1.resolve('testService');
      const instance1b = scope1.resolve('testService');
      const instance2a = scope2.resolve('testService');
      
      expect(instance1a.id).toBe(instance1b.id); // Same within scope
      expect(instance1a.id).not.toBe(instance2a.id); // Different across scopes
    });

    it('should handle service dependencies', () => {
      class DatabaseService {
        constructor() {
          this.connected = true;
        }
      }

      class UserService {
        constructor(database) {
          this.database = database;
        }
      }

      container.registerSingleton('database', DatabaseService);
      container.registerTransient('userService', (container) => 
        new UserService(container.resolve('database'))
      );
      
      const userService = container.resolve('userService');
      
      expect(userService).toBeInstanceOf(UserService);
      expect(userService.database).toBeInstanceOf(DatabaseService);
      expect(userService.database.connected).toBe(true);
    });
  });

  describe('Configuration Injection', () => {
    it('should inject configuration into services', () => {
      class ConfigurableService {
        constructor(config = {}) {
          this.config = config;
        }
      }

      const serviceConfig = {
        apiUrl: 'https://api.example.com',
        timeout: 5000,
        retries: 3
      };

      container.configure('configurableService', serviceConfig);
      container.registerSingleton('configurableService', (container) => 
        new ConfigurableService(container.getConfiguration('configurableService'))
      );
      
      const service = container.resolve('configurableService');
      
      expect(service.config).toEqual(serviceConfig);
      expect(service.config.apiUrl).toBe('https://api.example.com');
    });

    it('should merge configuration with defaults', () => {
      class ServiceWithDefaults {
        constructor(config = {}) {
          this.config = {
            timeout: 1000,
            retries: 1,
            ...config
          };
        }
      }

      container.configure('serviceWithDefaults', { timeout: 5000 });
      container.registerSingleton('serviceWithDefaults', (container) => 
        new ServiceWithDefaults(container.getConfiguration('serviceWithDefaults'))
      );
      
      const service = container.resolve('serviceWithDefaults');
      
      expect(service.config.timeout).toBe(5000); // Overridden
      expect(service.config.retries).toBe(1); // Default
    });

    it('should support environment-specific configuration', () => {
      const originalEnv = process.env.NODE_ENV;
      
      try {
        process.env.NODE_ENV = 'test';
        
        class EnvironmentService {
          constructor(config = {}) {
            this.config = config;
          }
        }

        const configs = {
          development: { debug: true, logLevel: 'debug' },
          test: { debug: false, logLevel: 'error' },
          production: { debug: false, logLevel: 'warn' }
        };

        container.configureForEnvironment('envService', configs);
        container.registerSingleton('envService', (container) => 
          new EnvironmentService(container.getConfiguration('envService'))
        );
        
        const service = container.resolve('envService');
        
        expect(service.config.debug).toBe(false);
        expect(service.config.logLevel).toBe('error');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize services in correct order', async () => {
      const initOrder = [];

      class ServiceA {
        async initialize() {
          initOrder.push('A');
        }
      }

      class ServiceB {
        constructor(serviceA) {
          this.serviceA = serviceA;
        }
        
        async initialize() {
          initOrder.push('B');
        }
      }

      container.registerSingleton('serviceA', ServiceA);
      container.registerSingleton('serviceB', (container) => 
        new ServiceB(container.resolve('serviceA'))
      );
      
      await container.initializeServices(['serviceA', 'serviceB']);
      
      expect(initOrder).toEqual(['A', 'B']);
    });

    it('should handle service disposal', async () => {
      const disposalOrder = [];

      class DisposableService {
        async dispose() {
          disposalOrder.push(this.constructor.name);
        }
      }

      class ServiceA extends DisposableService {}
      class ServiceB extends DisposableService {}

      container.registerSingleton('serviceA', ServiceA);
      container.registerSingleton('serviceB', ServiceB);
      
      // Resolve services to create instances
      container.resolve('serviceA');
      container.resolve('serviceB');
      
      await container.dispose();
      
      expect(disposalOrder).toContain('ServiceA');
      expect(disposalOrder).toContain('ServiceB');
    });

    it('should handle service health checks', async () => {
      class HealthyService {
        async healthCheck() {
          return { status: 'healthy', details: 'All systems operational' };
        }
      }

      class UnhealthyService {
        async healthCheck() {
          return { status: 'unhealthy', details: 'Database connection failed' };
        }
      }

      container.registerSingleton('healthyService', HealthyService);
      container.registerSingleton('unhealthyService', UnhealthyService);
      
      const healthReport = await container.checkHealth();
      
      expect(healthReport.healthyService.status).toBe('healthy');
      expect(healthReport.unhealthyService.status).toBe('unhealthy');
    });
  });

  describe('Dependency Validation', () => {
    it('should detect circular dependencies', () => {
      class ServiceA {
        constructor(serviceB) {
          this.serviceB = serviceB;
        }
      }

      class ServiceB {
        constructor(serviceA) {
          this.serviceA = serviceA;
        }
      }

      container.registerSingleton('serviceA', (container) => 
        new ServiceA(container.resolve('serviceB'))
      );
      container.registerSingleton('serviceB', (container) => 
        new ServiceB(container.resolve('serviceA'))
      );
      
      expect(() => container.validateDependencies()).toThrow(/circular dependency/i);
    });

    it('should validate missing dependencies', () => {
      class ServiceWithDependency {
        constructor(missingService) {
          this.missingService = missingService;
        }
      }

      container.registerSingleton('serviceWithDependency', (container) => 
        new ServiceWithDependency(container.resolve('missingService'))
      );
      
      expect(() => container.resolve('serviceWithDependency')).toThrow(/not registered/i);
    });

    it('should provide dependency graph visualization', () => {
      class ServiceA {}
      class ServiceB {
        constructor(serviceA) {
          this.serviceA = serviceA;
        }
      }
      class ServiceC {
        constructor(serviceA, serviceB) {
          this.serviceA = serviceA;
          this.serviceB = serviceB;
        }
      }

      container.registerSingleton('serviceA', ServiceA);
      container.registerSingleton('serviceB', (container) => 
        new ServiceB(container.resolve('serviceA'))
      );
      container.registerSingleton('serviceC', (container) => 
        new ServiceC(container.resolve('serviceA'), container.resolve('serviceB'))
      );
      
      const graph = container.getDependencyGraph();
      
      expect(graph.serviceA).toEqual([]);
      expect(graph.serviceB).toContain('serviceA');
      expect(graph.serviceC).toContain('serviceA');
      expect(graph.serviceC).toContain('serviceB');
    });
  });

  describe('Integration with Existing Services', () => {
    it('should integrate with CollectionService', () => {
      // Mock repository
      class MockRepository {
        async findAll() {
          return [];
        }
      }

      // Mock CollectionService (simplified)
      class CollectionService {
        constructor(repository, options = {}) {
          this.repository = repository;
          this.options = options;
        }
      }

      const serviceConfig = {
        entityName: 'TestCard',
        enableImageManagement: true
      };

      container.registerSingleton('repository', MockRepository);
      container.configure('collectionService', serviceConfig);
      container.registerSingleton('collectionService', (container) => 
        new CollectionService(
          container.resolve('repository'),
          container.getConfiguration('collectionService')
        )
      );
      
      const service = container.resolve('collectionService');
      
      expect(service).toBeInstanceOf(CollectionService);
      expect(service.repository).toBeInstanceOf(MockRepository);
      expect(service.options.entityName).toBe('TestCard');
    });

    it('should integrate with BaseController', () => {
      // Mock service and repository
      class MockService {
        async getAll() {
          return [];
        }
      }

      // Mock BaseController (simplified)
      class BaseController {
        constructor(service, options = {}) {
          this.service = service;
          this.options = options;
        }
      }

      const controllerConfig = {
        entityName: 'TestEntity',
        enableLogging: true
      };

      container.registerSingleton('mockService', MockService);
      container.configure('baseController', controllerConfig);
      container.registerSingleton('baseController', (container) => 
        new BaseController(
          container.resolve('mockService'),
          container.getConfiguration('baseController')
        )
      );
      
      const controller = container.resolve('baseController');
      
      expect(controller).toBeInstanceOf(BaseController);
      expect(controller.service).toBeInstanceOf(MockService);
      expect(controller.options.entityName).toBe('TestEntity');
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large numbers of services efficiently', () => {
      const startTime = Date.now();
      
      // Register many services
      for (let i = 0; i < 1000; i++) {
        container.registerTransient(`service${i}`, () => ({ id: i }));
      }
      
      // Resolve many services
      for (let i = 0; i < 1000; i++) {
        const service = container.resolve(`service${i}`);

        expect(service.id).toBe(i);
      }
      
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should not cause memory leaks with singleton services', () => {
      class TestService {
        constructor() {
          this.data = new Array(1000).fill('test data');
        }
      }

      container.registerSingleton('testService', TestService);
      
      // Resolve service multiple times
      for (let i = 0; i < 100; i++) {
        container.resolve('testService');
      }
      
      // Should only create one instance
      const instance1 = container.resolve('testService');
      const instance2 = container.resolve('testService');
      
      expect(instance1).toBe(instance2);
    });

    it('should properly dispose of scoped services', async () => {
      let disposedCount = 0;

      class ScopedService {
        async dispose() {
          disposedCount++;
        }
      }

      container.registerScoped('scopedService', () => new ScopedService());
      
      const scope1 = container.createScope();
      const scope2 = container.createScope();
      
      scope1.resolve('scopedService');
      scope2.resolve('scopedService');
      
      await scope1.dispose();
      expect(disposedCount).toBe(1);
      
      await scope2.dispose();
      expect(disposedCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle service construction errors', () => {
      class FailingService {
        constructor() {
          throw new Error('Service construction failed');
        }
      }

      container.registerSingleton('failingService', FailingService);
      
      expect(() => container.resolve('failingService')).toThrow('Service construction failed');
    });

    it('should handle factory function errors', () => {
      container.registerTransient('failingFactory', () => {
        throw new Error('Factory function failed');
      });
      
      expect(() => container.resolve('failingFactory')).toThrow('Factory function failed');
    });

    it('should provide helpful error messages for missing services', () => {
      expect(() => container.resolve('nonExistentService')).toThrow(/not registered/i);
      expect(() => container.resolve('nonExistentService')).toThrow(/nonExistentService/);
    });

    it('should handle disposal errors gracefully', async () => {
      class FailingDisposalService {
        async dispose() {
          throw new Error('Disposal failed');
        }
      }

      container.registerSingleton('failingDisposal', FailingDisposalService);
      container.resolve('failingDisposal'); // Create instance
      
      // Should not throw despite disposal error
      await expect(container.dispose()).resolves.not.toThrow();
    });
  });
});