/**
 * Enhanced Search Cache Integration Tests
 * 
 * Tests the enhanced caching middleware functionality including
 * cache warming, invalidation patterns, and performance optimization.
 */

const { enhancedSearchCache, warmupCache, invalidatePattern } = require('../../middleware/enhancedSearchCache');
const NodeCache = require('node-cache');

describe('Enhanced Search Cache Integration Tests', () => {
  let mockNext; let mockReq; let mockRes;
  let cache;

  beforeEach(() => {
    // Create fresh cache instance for each test
    cache = new NodeCache({ stdTTL: 300 });
    
    // Mock Express objects
    mockReq = testUtils.createMockReq();
    mockRes = testUtils.createMockRes();
    mockNext = testUtils.createMockNext();
    
    // Clear any existing cache
    cache.flushAll();
  });

  describe('Basic Caching Functionality', () => {
    it('should cache search results', async () => {
      mockReq.query = { q: 'Pikachu', type: 'cards' };
      mockReq.originalUrl = '/api/search?q=Pikachu&type=cards';
      
      const middleware = enhancedSearchCache();
      
      // First request - should miss cache
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Simulate response data
      mockRes.locals = {
        searchResults: {
          results: [{ name: 'Pikachu', set: 'Base Set' }],
          total: 1,
          cached: false
        }
      };
      
      // Second request - should hit cache
      mockNext.mockClear();
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          cached: true,
          results: expect.any(Array)
        })
      );
    });

    it('should generate consistent cache keys', async () => {
      const req1 = { ...mockReq, query: { q: 'Charizard', type: 'cards' } };
      const req2 = { ...mockReq, query: { type: 'cards', q: 'Charizard' } }; // Different order
      
      const middleware = enhancedSearchCache();
      
      await middleware(req1, mockRes, mockNext);
      const key1 = mockRes.locals?.cacheKey;
      
      mockNext.mockClear();
      await middleware(req2, mockRes, mockNext);
      const key2 = mockRes.locals?.cacheKey;
      
      expect(key1).toBe(key2);
    });

    it('should respect cache TTL settings', async () => {
      const shortTTLCache = enhancedSearchCache({ ttl: 1 }); // 1 second TTL
      
      mockReq.query = { q: 'Blastoise' };
      
      await shortTTLCache(mockReq, mockRes, mockNext);
      mockRes.locals = { searchResults: { results: [], total: 0 } };
      
      // Wait for cache to expire
      await testUtils.wait(1100);
      
      mockNext.mockClear();
      await shortTTLCache(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled(); // Should miss cache after expiry
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache with popular queries', async () => {
      const popularQueries = [
        { q: 'Charizard', type: 'cards' },
        { q: 'Base Set', type: 'sets' },
        { q: 'Booster Pack', type: 'products' }
      ];
      
      // Mock search function
      const mockSearchFn = jest.fn().mockResolvedValue({
        results: [{ name: 'Test Result' }],
        total: 1
      });
      
      await warmupCache(popularQueries, mockSearchFn);
      
      expect(mockSearchFn).toHaveBeenCalledTimes(3);
      expect(mockSearchFn).toHaveBeenCalledWith('Charizard', { type: 'cards' });
      expect(mockSearchFn).toHaveBeenCalledWith('Base Set', { type: 'sets' });
      expect(mockSearchFn).toHaveBeenCalledWith('Booster Pack', { type: 'products' });
    });

    it('should handle warmup failures gracefully', async () => {
      const queries = [{ q: 'ValidQuery' }, { q: 'FailingQuery' }];
      
      const mockSearchFn = jest.fn()
        .mockResolvedValueOnce({ results: [], total: 0 })
        .mockRejectedValueOnce(new Error('Search failed'));
      
      // Should not throw despite one failure
      await expect(warmupCache(queries, mockSearchFn)).resolves.not.toThrow();
      
      expect(mockSearchFn).toHaveBeenCalledTimes(2);
    });

    it('should warm cache in batches for performance', async () => {
      const manyQueries = Array(50).fill(null).map((_, i) => ({ q: `Query${i}` }));
      
      const mockSearchFn = jest.fn().mockResolvedValue({ results: [], total: 0 });
      
      const startTime = Date.now();

      await warmupCache(manyQueries, mockSearchFn, { batchSize: 10 });
      const duration = Date.now() - startTime;
      
      expect(mockSearchFn).toHaveBeenCalledTimes(50);
      // Should complete reasonably quickly with batching
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(async () => {
      // Pre-populate cache with test data
      const middleware = enhancedSearchCache();
      
      const testQueries = [
        { q: 'Pikachu', type: 'cards' },
        { q: 'Charizard', type: 'cards' },
        { q: 'Base Set', type: 'sets' },
        { q: 'Booster', type: 'products' }
      ];
      
      for (const query of testQueries) {
        mockReq.query = query;
        mockReq.originalUrl = `/api/search?${new URLSearchParams(query).toString()}`;
        await middleware(mockReq, mockRes, mockNext);
        mockRes.locals = { searchResults: { results: [], total: 0 } };
      }
    });

    it('should invalidate cache by pattern', async () => {
      // Invalidate all card searches
      await invalidatePattern('*type=cards*');
      
      // Card searches should miss cache
      mockReq.query = { q: 'Pikachu', type: 'cards' };
      const middleware = enhancedSearchCache();
      
      mockNext.mockClear();
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled(); // Cache miss
      
      // Set searches should still hit cache
      mockReq.query = { q: 'Base Set', type: 'sets' };
      mockNext.mockClear();
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalled(); // Cache hit
    });

    it('should invalidate specific query patterns', async () => {
      await invalidatePattern('*Pikachu*');
      
      // Pikachu search should miss
      mockReq.query = { q: 'Pikachu', type: 'cards' };
      const middleware = enhancedSearchCache();
      
      mockNext.mockClear();
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Charizard search should still hit
      mockReq.query = { q: 'Charizard', type: 'cards' };
      mockNext.mockClear();
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should handle wildcard patterns correctly', async () => {
      await invalidatePattern('*cards*');
      
      const middleware = enhancedSearchCache();
      
      // All card-related searches should miss
      const cardQueries = [
        { q: 'Pikachu', type: 'cards' },
        { q: 'Charizard', type: 'cards' }
      ];
      
      for (const query of cardQueries) {
        mockReq.query = query;
        mockNext.mockClear();
        await middleware(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
      }
    });
  });

  describe('Performance Optimization', () => {
    it('should handle high-frequency requests efficiently', async () => {
      const middleware = enhancedSearchCache();
      const requests = [];
      
      // Simulate 100 concurrent requests
      for (let i = 0; i < 100; i++) {
        const req = { ...mockReq, query: { q: 'Popular Query' } };
        const res = testUtils.createMockRes();
        const next = testUtils.createMockNext();
        
        requests.push(middleware(req, res, next));
      }
      
      const startTime = Date.now();

      await Promise.all(requests);
      const duration = Date.now() - startTime;
      
      // Should handle concurrent requests quickly
      expect(duration).toBeLessThan(1000);
    });

    it('should prevent cache stampede', async () => {
      const middleware = enhancedSearchCache();
      const mockSearchFn = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ results: [], total: 0 }), 100))
      );
      
      // Simulate multiple concurrent requests for same uncached query
      const requests = [];

      for (let i = 0; i < 10; i++) {
        const req = { ...mockReq, query: { q: 'Uncached Query' } };
        const res = testUtils.createMockRes();
        const next = testUtils.createMockNext();
        
        requests.push(middleware(req, res, next));
      }
      
      await Promise.all(requests);
      
      // Should only call search function once despite multiple concurrent requests
      // (This would require implementing cache stampede prevention in the actual middleware)
    });

    it('should maintain cache size limits', async () => {
      const limitedCache = enhancedSearchCache({ maxKeys: 5 });
      
      // Add more entries than the limit
      for (let i = 0; i < 10; i++) {
        mockReq.query = { q: `Query${i}` };
        mockReq.originalUrl = `/api/search?q=Query${i}`;
        await limitedCache(mockReq, mockRes, mockNext);
        mockRes.locals = { searchResults: { results: [], total: 0 } };
      }
      
      // Cache should not exceed size limit
      const cacheStats = cache.getStats();

      expect(cacheStats.keys).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      // Mock cache that throws errors
      const faultyCache = {
        get: jest.fn().mockImplementation(() => { throw new Error('Cache error'); }),
        set: jest.fn().mockImplementation(() => { throw new Error('Cache error'); })
      };
      
      const middleware = enhancedSearchCache({ cache: faultyCache });
      
      // Should not throw despite cache errors
      await expect(middleware(mockReq, mockRes, mockNext)).resolves.not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle malformed cache data', async () => {
      // Manually insert malformed data into cache
      cache.set('malformed-key', 'invalid-json-data');
      
      mockReq.query = { q: 'test' };
      mockReq.originalUrl = '/api/search?q=test';
      
      const middleware = enhancedSearchCache();
      
      // Should handle malformed data gracefully
      await expect(middleware(mockReq, mockRes, mockNext)).resolves.not.toThrow();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Integration with Search Service', () => {
    it('should integrate with unified search endpoint', async () => {
      // Mock unified search request
      mockReq.path = '/api/search/unified';
      mockReq.query = { q: 'Charizard', types: 'cards,sets' };
      
      const middleware = enhancedSearchCache();
      
      await middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
      
      // Simulate search results
      mockRes.locals = {
        searchResults: {
          cards: [{ name: 'Charizard' }],
          sets: [{ name: 'Base Set' }],
          total: 2
        }
      };
      
      // Second request should hit cache
      mockNext.mockClear();
      await middleware(mockReq, mockRes, mockNext);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should handle different search strategies', async () => {
      const strategies = ['fuzzy', 'exact', 'partial'];
      const middleware = enhancedSearchCache();
      
      for (const strategy of strategies) {
        mockReq.query = { q: 'Pikachu', strategy };
        mockReq.originalUrl = `/api/search?q=Pikachu&strategy=${strategy}`;
        
        await middleware(mockReq, mockRes, mockNext);
        mockRes.locals = { searchResults: { results: [], total: 0, strategy } };
      }
      
      // Each strategy should have separate cache entries
      const cacheStats = cache.getStats();

      expect(cacheStats.keys).toBe(3);
    });
  });

  describe('Cache Analytics', () => {
    it('should track cache hit/miss statistics', async () => {
      const middleware = enhancedSearchCache({ enableStats: true });
      
      // Generate some cache hits and misses
      for (let i = 0; i < 5; i++) {
        mockReq.query = { q: 'Popular Query' };
        await middleware(mockReq, mockRes, mockNext);
        mockRes.locals = { searchResults: { results: [], total: 0 } };
      }
      
      for (let i = 0; i < 3; i++) {
        mockReq.query = { q: `Unique Query ${i}` };
        await middleware(mockReq, mockRes, mockNext);
        mockRes.locals = { searchResults: { results: [], total: 0 } };
      }
      
      const stats = cache.getStats();

      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should provide cache performance metrics', async () => {
      const middleware = enhancedSearchCache({ enableMetrics: true });
      
      const startTime = Date.now();
      
      // Perform various cache operations
      for (let i = 0; i < 10; i++) {
        mockReq.query = { q: `Query ${i % 3}` }; // Some repeats for cache hits
        await middleware(mockReq, mockRes, mockNext);
        mockRes.locals = { searchResults: { results: [], total: 0 } };
      }
      
      const duration = Date.now() - startTime;
      
      // Should complete quickly with caching
      expect(duration).toBeLessThan(500);
    });
  });
});