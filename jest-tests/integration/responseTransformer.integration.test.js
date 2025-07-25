/**
 * Response Transformer Integration Tests
 * 
 * Tests the response transformation middleware functionality including
 * consistent formatting, compression, and API standardization.
 */

const { responseTransformer, transformSearchResults, transformCollectionData } = require('../../middleware/responseTransformer');

describe('Response Transformer Integration Tests', () => {
  let mockNext; let mockReq; let mockRes;

  beforeEach(() => {
    mockReq = testUtils.createMockReq();
    mockRes = testUtils.createMockRes();
    mockNext = testUtils.createMockNext();
    
    // Add transform method to response
    mockRes.transform = jest.fn().mockReturnValue(mockRes);
  });

  describe('Basic Response Transformation', () => {
    it('should transform simple data responses', () => {
      const middleware = responseTransformer();
      
      middleware(mockReq, mockRes, mockNext);
      
      const testData = { id: 1, name: 'Test Item' };

      mockRes.transform(testData);
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: testData,
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should transform array responses with metadata', () => {
      const middleware = responseTransformer();
      
      middleware(mockReq, mockRes, mockNext);
      
      const testData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' }
      ];
      
      mockRes.transform(testData, { total: 2, page: 1 });
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: testData,
        meta: { total: 2, page: 1 },
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should transform error responses', () => {
      const middleware = responseTransformer();
      
      middleware(mockReq, mockRes, mockNext);
      
      const error = new Error('Test error');

      mockRes.transformError(error, 400);
      
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Test error',
          code: 400,
          type: 'Error'
        },
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });
  });

  describe('Search Results Transformation', () => {
    it('should transform unified search results', () => {
      const searchResults = {
        cards: [
          { id: 1, cardName: 'Pikachu', setName: 'Base Set' },
          { id: 2, cardName: 'Charizard', setName: 'Base Set' }
        ],
        sets: [
          { id: 1, setName: 'Base Set', totalCards: 102 }
        ],
        products: [
          { id: 1, name: 'Booster Pack', category: 'Pack' }
        ],
        total: 4,
        query: 'Base Set',
        strategy: 'fuzzy'
      };

      const transformed = transformSearchResults(searchResults);

      expect(transformed).toEqual({
        results: {
          cards: expect.any(Array),
          sets: expect.any(Array),
          products: expect.any(Array)
        },
        summary: {
          total: 4,
          cardCount: 2,
          setCount: 1,
          productCount: 1
        },
        query: {
          term: 'Base Set',
          strategy: 'fuzzy'
        },
        performance: expect.objectContaining({
          searchTime: expect.any(Number)
        })
      });
    });

    it('should handle empty search results', () => {
      const emptyResults = {
        cards: [],
        sets: [],
        products: [],
        total: 0,
        query: 'NonExistent'
      };

      const transformed = transformSearchResults(emptyResults);

      expect(transformed.summary.total).toBe(0);
      expect(transformed.results.cards).toEqual([]);
      expect(transformed.query.term).toBe('NonExistent');
    });

    it('should add relevance scores to search results', () => {
      const searchResults = {
        cards: [
          { id: 1, cardName: 'Pikachu', relevanceScore: 0.95 },
          { id: 2, cardName: 'Raichu', relevanceScore: 0.75 }
        ],
        total: 2,
        query: 'Pikachu'
      };

      const transformed = transformSearchResults(searchResults);

      expect(transformed.results.cards[0]).toHaveProperty('relevanceScore', 0.95);
      expect(transformed.results.cards[1]).toHaveProperty('relevanceScore', 0.75);
    });
  });

  describe('Collection Data Transformation', () => {
    it('should transform PSA graded card data', () => {
      const psaCard = {
        _id: '507f1f77bcf86cd799439011',
        cardId: {
          cardName: 'Charizard',
          setId: { setName: 'Base Set' }
        },
        grade: 9,
        myPrice: 299.99,
        priceHistory: [
          { price: 250.00, dateUpdated: new Date('2024-01-01') },
          { price: 299.99, dateUpdated: new Date('2024-02-01') }
        ],
        images: ['/uploads/images/charizard-psa9.jpg'],
        sold: false,
        dateAdded: new Date('2024-01-01')
      };

      const transformed = transformCollectionData(psaCard, 'PsaGradedCard');

      expect(transformed).toEqual({
        id: '507f1f77bcf86cd799439011',
        cardName: 'Charizard',
        setName: 'Base Set',
        type: 'psa_graded',
        grade: 9,
        currentPrice: 299.99,
        priceHistory: expect.any(Array),
        images: expect.any(Array),
        status: 'available',
        dateAdded: expect.any(String),
        metadata: {
          priceChange: expect.any(Number),
          priceChangePercent: expect.any(Number),
          imageCount: 1
        }
      });
    });

    it('should transform raw card data', () => {
      const rawCard = {
        _id: '507f1f77bcf86cd799439012',
        cardId: {
          cardName: 'Blastoise',
          setId: { setName: 'Base Set' }
        },
        condition: 'Near Mint',
        myPrice: 89.99,
        sold: true,
        saleDetails: {
          actualSoldPrice: 95.00,
          dateSold: new Date('2024-02-15')
        }
      };

      const transformed = transformCollectionData(rawCard, 'RawCard');

      expect(transformed).toEqual({
        id: '507f1f77bcf86cd799439012',
        cardName: 'Blastoise',
        setName: 'Base Set',
        type: 'raw_card',
        condition: 'Near Mint',
        currentPrice: 89.99,
        status: 'sold',
        salePrice: 95.00,
        dateSold: expect.any(String),
        metadata: {
          profit: 5.01,
          profitPercent: expect.any(Number)
        }
      });
    });

    it('should transform sealed product data', () => {
      const sealedProduct = {
        _id: '507f1f77bcf86cd799439013',
        productId: {
          name: 'Base Set Booster Pack',
          setId: { setName: 'Base Set' }
        },
        category: 'Booster Pack',
        myPrice: 299.99,
        availability: 'In Stock'
      };

      const transformed = transformCollectionData(sealedProduct, 'SealedProduct');

      expect(transformed.type).toBe('sealed_product');
      expect(transformed.category).toBe('Booster Pack');
      expect(transformed.availability).toBe('In Stock');
    });
  });

  describe('Pagination Transformation', () => {
    it('should transform paginated responses', () => {
      const middleware = responseTransformer();
      
      middleware(mockReq, mockRes, mockNext);
      
      const paginatedData = {
        items: [{ id: 1 }, { id: 2 }],
        total: 100,
        page: 2,
        limit: 10,
        totalPages: 10,
        hasNext: true,
        hasPrev: true
      };
      
      mockRes.transform(paginatedData.items, {
        pagination: {
          total: paginatedData.total,
          page: paginatedData.page,
          limit: paginatedData.limit,
          totalPages: paginatedData.totalPages,
          hasNext: paginatedData.hasNext,
          hasPrev: paginatedData.hasPrev
        }
      });
      
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: paginatedData.items,
        meta: {
          pagination: expect.objectContaining({
            total: 100,
            page: 2,
            limit: 10,
            totalPages: 10,
            hasNext: true,
            hasPrev: true
          })
        },
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should calculate pagination links', () => {
      mockReq.originalUrl = '/api/cards?page=2&limit=10';
      
      const middleware = responseTransformer();

      middleware(mockReq, mockRes, mockNext);
      
      const paginatedData = {
        items: [],
        total: 100,
        page: 2,
        limit: 10,
        totalPages: 10
      };
      
      mockRes.transform(paginatedData.items, {
        pagination: paginatedData
      });
      
      const response = mockRes.json.mock.calls[0][0];
      
      expect(response.meta.pagination.links).toEqual({
        first: '/api/cards?page=1&limit=10',
        prev: '/api/cards?page=1&limit=10',
        next: '/api/cards?page=3&limit=10',
        last: '/api/cards?page=10&limit=10'
      });
    });
  });

  describe('Performance Metrics', () => {
    it('should add performance metrics to responses', () => {
      const startTime = Date.now();
      
      const middleware = responseTransformer({ includePerformance: true });

      middleware(mockReq, mockRes, mockNext);
      
      // Simulate some processing time
      setTimeout(() => {
        mockRes.transform({ data: 'test' });
        
        const response = mockRes.json.mock.calls[0][0];
        
        expect(response.performance).toEqual({
          responseTime: expect.any(Number),
          timestamp: expect.any(String)
        });
        
        expect(response.performance.responseTime).toBeGreaterThan(0);
      }, 10);
    });

    it('should include database query metrics', () => {
      const middleware = responseTransformer({ includePerformance: true });

      middleware(mockReq, mockRes, mockNext);
      
      // Simulate database metrics
      mockRes.locals.dbMetrics = {
        queryCount: 3,
        queryTime: 45,
        cacheHits: 2
      };
      
      mockRes.transform({ data: 'test' });
      
      const response = mockRes.json.mock.calls[0][0];
      
      expect(response.performance.database).toEqual({
        queryCount: 3,
        queryTime: 45,
        cacheHits: 2
      });
    });
  });

  describe('Content Compression', () => {
    it('should compress large responses', () => {
      const middleware = responseTransformer({ enableCompression: true });

      middleware(mockReq, mockRes, mockNext);
      
      // Create large response data
      const largeData = Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: 'A'.repeat(100)
      }));
      
      mockRes.transform(largeData);
      
      // Should set compression headers for large responses
      expect(mockRes.set).toHaveBeenCalledWith('Content-Encoding', 'gzip');
    });

    it('should not compress small responses', () => {
      const middleware = responseTransformer({ enableCompression: true });

      middleware(mockReq, mockRes, mockNext);
      
      const smallData = { id: 1, name: 'Small Item' };
      
      mockRes.transform(smallData);
      
      // Should not set compression headers for small responses
      expect(mockRes.set).not.toHaveBeenCalledWith('Content-Encoding', 'gzip');
    });
  });

  describe('API Versioning', () => {
    it('should handle API version headers', () => {
      mockReq.headers['api-version'] = 'v2';
      
      const middleware = responseTransformer({ supportVersioning: true });

      middleware(mockReq, mockRes, mockNext);
      
      mockRes.transform({ data: 'test' });
      
      const response = mockRes.json.mock.calls[0][0];
      
      expect(response.apiVersion).toBe('v2');
      expect(mockRes.set).toHaveBeenCalledWith('API-Version', 'v2');
    });

    it('should apply version-specific transformations', () => {
      mockReq.headers['api-version'] = 'v1';
      
      const middleware = responseTransformer({ supportVersioning: true });

      middleware(mockReq, mockRes, mockNext);
      
      const cardData = {
        id: 1,
        cardName: 'Pikachu',
        myPrice: 10.99,
        newField: 'Only in v2+'
      };
      
      mockRes.transform(cardData);
      
      const response = mockRes.json.mock.calls[0][0];
      
      // v1 should not include new fields
      expect(response.data).not.toHaveProperty('newField');
    });
  });

  describe('Error Handling', () => {
    it('should handle transformation errors gracefully', () => {
      const middleware = responseTransformer();

      middleware(mockReq, mockRes, mockNext);
      
      // Create circular reference that would cause JSON.stringify to fail
      const circularData = { name: 'test' };

      circularData.self = circularData;
      
      mockRes.transform(circularData);
      
      // Should handle the error and return a safe response
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: expect.stringContaining('transformation'),
          code: 500
        },
        timestamp: expect.any(String),
        requestId: expect.any(String)
      });
    });

    it('should sanitize sensitive data from error responses', () => {
      const middleware = responseTransformer();

      middleware(mockReq, mockRes, mockNext);
      
      const error = new Error('Database connection failed: password123');

      error.stack = 'Error: Database connection failed: password123\n    at sensitive/path/file.js:123';
      
      mockRes.transformError(error, 500);
      
      const response = mockRes.json.mock.calls[0][0];
      
      // Should not include sensitive information
      expect(response.error.message).not.toContain('password123');
      expect(response.error.stack).toBeUndefined(); // Stack traces should be removed in production
    });
  });

  describe('Integration with Controllers', () => {
    it('should integrate with BaseController responses', () => {
      const middleware = responseTransformer();

      middleware(mockReq, mockRes, mockNext);
      
      // Simulate BaseController response pattern
      const controllerData = {
        items: [{ id: 1, name: 'Test Card' }],
        total: 1,
        page: 1,
        limit: 10
      };
      
      mockRes.transform(controllerData.items, {
        pagination: {
          total: controllerData.total,
          page: controllerData.page,
          limit: controllerData.limit
        }
      });
      
      const response = mockRes.json.mock.calls[0][0];
      
      expect(response.success).toBe(true);
      expect(response.data).toEqual(controllerData.items);
      expect(response.meta.pagination.total).toBe(1);
    });

    it('should handle search controller responses', () => {
      const middleware = responseTransformer();

      middleware(mockReq, mockRes, mockNext);
      
      // Simulate search controller response
      const searchData = {
        results: [{ id: 1, cardName: 'Pikachu' }],
        total: 1,
        query: 'Pikachu',
        strategy: 'fuzzy',
        cached: true
      };
      
      mockRes.transform(searchData);
      
      const response = mockRes.json.mock.calls[0][0];
      
      expect(response.data.results).toBeDefined();
      expect(response.data.query).toBe('Pikachu');
      expect(response.data.cached).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle large datasets efficiently', () => {
      const middleware = responseTransformer();

      middleware(mockReq, mockRes, mockNext);
      
      const startTime = Date.now();
      
      // Create large dataset
      const largeDataset = Array(10000).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: Array(10).fill('test data')
      }));
      
      mockRes.transform(largeDataset);
      
      const duration = Date.now() - startTime;
      
      // Should complete transformation quickly
      expect(duration).toBeLessThan(1000);
    });

    it('should not cause memory leaks with repeated transformations', () => {
      const middleware = responseTransformer();

      middleware(mockReq, mockRes, mockNext);
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many transformations
      for (let i = 0; i < 1000; i++) {
        const testData = { id: i, data: Array(100).fill('test') };

        mockRes.transform(testData);
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });
});