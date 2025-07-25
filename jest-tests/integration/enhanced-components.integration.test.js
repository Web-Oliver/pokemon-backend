/**
 * Enhanced Components Integration Test Suite
 * 
 * Comprehensive integration tests that demonstrate all enhanced components
 * working together in realistic scenarios. Tests the complete flow from
 * request to response with all SOLID/DRY improvements.
 */

const Logger = require('../../utils/Logger');
const ValidatorFactory = require('../../utils/ValidatorFactory');
const { enhancedSearchCache } = require('../../middleware/enhancedSearchCache');
const { responseTransformer } = require('../../middleware/responseTransformer');
const Container = require('../../container');
const { HttpHelpers, MockDataGenerators, AssertionHelpers, PerformanceHelpers } = require('../utils/testHelpers');

describe('Enhanced Components Integration Test Suite', () => {
  let container;
  let mockNext; let mockReq; let mockRes;

  beforeEach(() => {
    container = new Container();
    mockReq = HttpHelpers.createMockRequest();
    mockRes = HttpHelpers.createMockResponse();
    mockNext = HttpHelpers.createMockNext();
  });

  describe('Complete Request/Response Flow', () => {
    it('should handle a complete card creation flow with all enhancements', async () => {
      // Setup: Configure container with all services
      class MockRepository {
        async create(data) {
          return { _id: 'test-id', ...data };
        }
      }

      class MockCollectionService {
        constructor(repository, options = {}) {
          this.repository = repository;
          this.options = options;
        }

        async create(data) {
          // Use centralized validation
          ValidatorFactory.collectionItemData(data, this.options.entityName);
          
          // Use centralized logging
          Logger.operation('Card', 'CREATE', { cardName: data.cardName });
          
          return await this.repository.create(data);
        }
      }

      // Register services in container
      container.registerSingleton('repository', MockRepository);
      container.configure('collectionService', { entityName: 'RawCard' });
      container.registerSingleton('collectionService', (container) => 
        new MockCollectionService(
          container.resolve('repository'),
          container.getConfiguration('collectionService')
        )
      );

      // Setup middleware pipeline
      const cacheMiddleware = enhancedSearchCache();
      const transformerMiddleware = responseTransformer();

      // Test data
      const cardData = MockDataGenerators.generateCard({
        cardName: 'Integration Test Card',
        myPrice: 15.99
      });

      // Simulate request
      mockReq.body = cardData;
      mockReq.method = 'POST';
      mockReq.path = '/api/cards';

      // Execute middleware pipeline
      await transformerMiddleware(mockReq, mockRes, mockNext);

      // Simulate controller logic
      const service = container.resolve('collectionService');
      const createdCard = await service.create(cardData);

      // Transform response
      mockRes.transform(createdCard);

      // Assertions
      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      
      AssertionHelpers.assertStandardApiResponse(response);
      expect(response.success).toBe(true);
      expect(response.data.cardName).toBe('Integration Test Card');
      expect(response.data.myPrice).toBe(15.99);
    });

    it('should handle search requests with caching and transformation', async () => {
      // Setup search service
      class MockSearchService {
        async search(query, options = {}) {
          Logger.operation('Search', 'EXECUTE', { query, options });
          
          // Simulate search results
          return {
            results: [
              MockDataGenerators.generateCard({ cardName: `${query} Card 1` }),
              MockDataGenerators.generateCard({ cardName: `${query} Card 2` })
            ],
            total: 2,
            query,
            strategy: options.strategy || 'fuzzy'
          };
        }
      }

      container.registerSingleton('searchService', MockSearchService);

      // Setup middleware
      const cacheMiddleware = enhancedSearchCache();
      const transformerMiddleware = responseTransformer();

      // First request - should miss cache
      mockReq.query = { q: 'Pikachu', strategy: 'fuzzy' };
      mockReq.originalUrl = '/api/search?q=Pikachu&strategy=fuzzy';

      await cacheMiddleware(mockReq, mockRes, mockNext);
      await transformerMiddleware(mockReq, mockRes, mockNext);

      // Simulate search execution
      const searchService = container.resolve('searchService');
      const searchResults = await searchService.search('Pikachu', { strategy: 'fuzzy' });

      mockRes.transform(searchResults);

      // Verify first request
      expect(mockNext).toHaveBeenCalled(); // Cache miss
      const firstResponse = mockRes.json.mock.calls[0][0];

      expect(firstResponse.data.total).toBe(2);

      // Second request - should hit cache
      mockNext.mockClear();
      mockRes.json.mockClear();

      await cacheMiddleware(mockReq, mockRes, mockNext);

      // Verify cache hit
      expect(mockRes.json).toHaveBeenCalled(); // Cache hit
      const cachedResponse = mockRes.json.mock.calls[0][0];

      expect(cachedResponse.cached).toBe(true);
    });

    it('should handle validation errors with proper transformation', async () => {
      const transformerMiddleware = responseTransformer();

      await transformerMiddleware(mockReq, mockRes, mockNext);

      // Test validation error
      try {
        ValidatorFactory.collectionItemData({
          myPrice: -10, // Invalid price
          cardName: '' // Empty name
        }, 'RawCard');
      } catch (error) {
        mockRes.transformError(error, 400);
      }

      const response = mockRes.json.mock.calls[0][0];
      
      AssertionHelpers.assertErrorResponse(response, 400);
      expect(response.error.message).toContain('price');
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance with all enhancements enabled', async () => {
      // Setup complete service stack
      class PerformanceTestService {
        constructor() {
          this.cache = new Map();
        }

        async processData(data) {
          Logger.operation('Performance', 'PROCESS', { itemCount: data.length });
          
          // Validate all items
          data.forEach(item => {
            ValidatorFactory.collectionItemData(item, 'RawCard');
          });

          // Simulate processing
          return data.map(item => ({ ...item, processed: true }));
        }
      }

      container.registerSingleton('performanceService', PerformanceTestService);

      // Generate test data
      const testData = MockDataGenerators.generateMultiple(
        MockDataGenerators.generateCard,
        100
      );

      // Measure performance
      const { result, executionTime } = await PerformanceHelpers.measureExecutionTime(async () => {
        const service = container.resolve('performanceService');

        return await service.processData(testData);
      });

      // Assertions
      expect(result).toHaveLength(100);
      expect(executionTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(result.every(item => item.processed)).toBe(true);
    });

    it('should handle concurrent requests efficiently', async () => {
      const cacheMiddleware = enhancedSearchCache();
      const transformerMiddleware = responseTransformer();

      // Create multiple concurrent requests
      const requests = Array(50).fill(null).map(async (_, index) => {
        const req = HttpHelpers.createMockRequest({
          query: { q: `Query${index % 5}` }, // Some overlap for cache testing
          originalUrl: `/api/search?q=Query${index % 5}`
        });
        const res = HttpHelpers.createMockResponse();
        const next = HttpHelpers.createMockNext();

        await cacheMiddleware(req, res, next);
        await transformerMiddleware(req, res, next);

        return { req, res, next };
      });

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // Should handle all requests quickly
      expect(duration).toBeLessThan(2000);
      expect(results).toHaveLength(50);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle cascading errors gracefully', async () => {
      // Setup service that can fail
      class FailingService {
        async processData(data) {
          Logger.operation('Failing', 'PROCESS', { data });
          
          if (data.shouldFail) {
            throw new Error('Service processing failed');
          }
          
          return { processed: true };
        }
      }

      container.registerSingleton('failingService', FailingService);

      const transformerMiddleware = responseTransformer();

      await transformerMiddleware(mockReq, mockRes, mockNext);

      // Test error propagation
      try {
        const service = container.resolve('failingService');

        await service.processData({ shouldFail: true });
      } catch (error) {
        Logger.error('Integration', 'TEST', error);
        mockRes.transformError(error, 500);
      }

      const response = mockRes.json.mock.calls[0][0];
      
      AssertionHelpers.assertErrorResponse(response, 500);
      expect(response.error.message).toBe('Service processing failed');
    });

    it('should maintain system stability during partial failures', async () => {
      // Setup mixed success/failure scenario
      class MixedResultsService {
        async processBatch(items) {
          const results = [];
          const errors = [];

          for (const item of items) {
            try {
              ValidatorFactory.collectionItemData(item, 'RawCard');
              Logger.operation('Batch', 'PROCESS_ITEM', { id: item.id });
              results.push({ ...item, status: 'success' });
            } catch (error) {
              Logger.error('Batch', 'PROCESS_ITEM', error, { id: item.id });
              errors.push({ id: item.id, error: error.message });
            }
          }

          return { results, errors };
        }
      }

      container.registerSingleton('mixedService', MixedResultsService);

      // Create mixed valid/invalid data
      const mixedData = [
        MockDataGenerators.generateCard({ id: 1 }), // Valid
        { id: 2, myPrice: -10 }, // Invalid price
        MockDataGenerators.generateCard({ id: 3 }), // Valid
        { id: 4, cardName: '' } // Invalid name
      ];

      const service = container.resolve('mixedService');
      const result = await service.processBatch(mixedData);

      // Should process valid items and capture errors
      expect(result.results).toHaveLength(2);
      expect(result.errors).toHaveLength(2);
      expect(result.results.every(item => item.status === 'success')).toBe(true);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should properly dispose of resources', async () => {
      let disposedCount = 0;

      class DisposableService {
        constructor() {
          this.resources = Array(100).fill('resource');
        }

        async dispose() {
          this.resources = null;
          disposedCount++;
        }
      }

      container.registerSingleton('disposableService', DisposableService);

      // Create and use service
      const service = container.resolve('disposableService');

      expect(service.resources).toHaveLength(100);

      // Dispose container
      await container.dispose();

      expect(disposedCount).toBe(1);
    });

    it('should not leak memory with extensive operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        const data = MockDataGenerators.generateCard({ id: i });
        
        try {
          ValidatorFactory.collectionItemData(data, 'RawCard');
          Logger.operation('Memory', 'TEST', { iteration: i });
        } catch (error) {
          Logger.error('Memory', 'TEST', error);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
    });
  });

  describe('Configuration and Environment Integration', () => {
    it('should adapt behavior based on configuration', async () => {
      class ConfigurableService {
        constructor(config = {}) {
          this.config = {
            enableLogging: true,
            enableValidation: true,
            enableCaching: false,
            ...config
          };
        }

        async processData(data) {
          if (this.config.enableLogging) {
            Logger.operation('Configurable', 'PROCESS', { enabled: true });
          }

          if (this.config.enableValidation) {
            ValidatorFactory.collectionItemData(data, 'RawCard');
          }

          return { ...data, processed: true, config: this.config };
        }
      }

      // Test with different configurations
      const configs = [
        { enableLogging: false, enableValidation: true },
        { enableLogging: true, enableValidation: false },
        { enableLogging: true, enableValidation: true, enableCaching: true }
      ];

      for (const config of configs) {
        container.configure('configurableService', config);
        container.registerTransient('configurableService', (container) => 
          new ConfigurableService(container.getConfiguration('configurableService'))
        );

        const service = container.resolve('configurableService');
        const testData = MockDataGenerators.generateCard();

        if (config.enableValidation) {
          const result = await service.processData(testData);

          expect(result.config).toEqual(expect.objectContaining(config));
        } else {
          // Should work even with invalid data when validation is disabled
          const result = await service.processData({ invalid: 'data' });

          expect(result.processed).toBe(true);
        }
      }
    });

    it('should handle environment-specific behavior', async () => {
      const originalEnv = process.env.NODE_ENV;

      try {
        // Test different environments
        const environments = ['development', 'test', 'production'];

        for (const env of environments) {
          process.env.NODE_ENV = env;

          class EnvironmentAwareService {
            constructor() {
              this.env = process.env.NODE_ENV;
              this.debugMode = env === 'development';
            }

            async processData(data) {
              if (this.debugMode) {
                Logger.debug('Processing in debug mode', { data });
              }

              Logger.operation('Environment', 'PROCESS', { env: this.env });
              return { ...data, env: this.env, debugMode: this.debugMode };
            }
          }

          container.registerTransient('envService', EnvironmentAwareService);
          
          const service = container.resolve('envService');
          const result = await service.processData({ test: 'data' });

          expect(result.env).toBe(env);
          expect(result.debugMode).toBe(env === 'development');
        }
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });

  describe('Real-world Scenario Simulation', () => {
    it('should handle a complete card management workflow', async () => {
      // Setup complete service stack
      class CardRepository {
        constructor() {
          this.cards = new Map();
        }

        async create(data) {
          const id = Date.now().toString();
          const card = { _id: id, ...data, dateAdded: new Date() };

          this.cards.set(id, card);
          return card;
        }

        async findById(id) {
          return this.cards.get(id);
        }

        async update(id, data) {
          const existing = this.cards.get(id);

          if (!existing) throw new Error('Card not found');
          
          const updated = { ...existing, ...data, dateUpdated: new Date() };

          this.cards.set(id, updated);
          return updated;
        }

        async delete(id) {
          const card = this.cards.get(id);

          if (!card) throw new Error('Card not found');
          
          this.cards.delete(id);
          return card;
        }
      }

      class CardService {
        constructor(repository, options = {}) {
          this.repository = repository;
          this.options = options;
        }

        async createCard(data) {
          Logger.operation('Card', 'CREATE', { cardName: data.cardName });
          ValidatorFactory.collectionItemData(data, 'RawCard');
          return await this.repository.create(data);
        }

        async updateCard(id, data) {
          Logger.operation('Card', 'UPDATE', { id, changes: Object.keys(data) });
          ValidatorFactory.objectId(id);
          return await this.repository.update(id, data);
        }

        async deleteCard(id) {
          Logger.operation('Card', 'DELETE', { id });
          ValidatorFactory.objectId(id);
          return await this.repository.delete(id);
        }
      }

      // Register services
      container.registerSingleton('cardRepository', CardRepository);
      container.registerSingleton('cardService', (container) => 
        new CardService(container.resolve('cardRepository'))
      );

      const service = container.resolve('cardService');

      // Test complete workflow
      const cardData = MockDataGenerators.generateCard({
        cardName: 'Workflow Test Card',
        myPrice: 25.99
      });

      // Create card
      const createdCard = await service.createCard(cardData);

      expect(createdCard.cardName).toBe('Workflow Test Card');
      expect(createdCard._id).toBeDefined();

      // Update card
      const updatedCard = await service.updateCard(createdCard._id, {
        myPrice: 29.99,
        condition: 'Mint'
      });

      expect(updatedCard.myPrice).toBe(29.99);
      expect(updatedCard.condition).toBe('Mint');

      // Delete card
      const deletedCard = await service.deleteCard(createdCard._id);

      expect(deletedCard._id).toBe(createdCard._id);

      // Verify deletion
      await expect(service.updateCard(createdCard._id, {}))
        .rejects.toThrow('Card not found');
    });
  });
});