const UnifiedSearchController = require('../../controllers/search/UnifiedSearchController');
const { ValidationError } = require('../../middleware/errorHandler');

// Mock the container before requiring
jest.mock('../../container', () => ({
  resolve: jest.fn(),
  getStats: jest.fn(() => ({
    totalDependencies: 10,
    singletons: 5,
    transients: 5,
    initialized: true,
  })),
}));

const mockContainer = require('../../container');

// Mock search factory
const mockSearchFactory = {
  searchMultiple: jest.fn(),
  suggestMultiple: jest.fn(),
  getStrategy: jest.fn(),
  getRegisteredTypes: jest.fn(),
  isTypeSupported: jest.fn(),
  getSupportedOptions: jest.fn(),
  getCacheStats: jest.fn(),
};

describe('UnifiedSearchController', () => {
  let mockRequest;
  let mockResponse;
  let mockStrategy;

  beforeEach(() => {
    // Mock Express request and response objects
    mockRequest = {
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock search strategy
    mockStrategy = {
      search: jest.fn(),
      suggest: jest.fn(),
    };

    // Mock console methods to reduce test noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('search (unified search)', () => {
    test('should perform unified search with valid parameters', async () => {
      const mockResults = {
        cards: {
          data: [{ id: '1', name: 'Pikachu' }],
          count: 1,
          success: true,
        },
        products: {
          data: [{ id: '2', name: 'Base Set Booster' }],
          count: 1,
          success: true,
        },
      };

      mockSearchFactory.searchMultiple.mockResolvedValue(mockResults);
      mockRequest.query = {
        query: 'pikachu',
        types: 'cards,products',
        limit: '10',
        page: '1',
      };

      await UnifiedSearchController.search(mockRequest, mockResponse);

      expect(mockSearchFactory.searchMultiple).toHaveBeenCalledWith(
        'pikachu',
        ['cards', 'products'],
        {
          limit: 10,
          page: 1,
          sort: undefined,
          filters: {},
        }
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        query: 'pikachu',
        totalCount: 2,
        results: mockResults,
      });
    });

    test('should use default types when not provided', async () => {
      const mockResults = {
        cards: { data: [], count: 0, success: true },
        products: { data: [], count: 0, success: true },
        sets: { data: [], count: 0, success: true },
      };

      mockSearchFactory.searchMultiple.mockResolvedValue(mockResults);
      mockRequest.query = { query: 'test' };

      await UnifiedSearchController.search(mockRequest, mockResponse);

      expect(mockSearchFactory.searchMultiple).toHaveBeenCalledWith(
        'test',
        ['cards', 'products', 'sets'],
        expect.any(Object)
      );
    });

    test('should parse complex options correctly', async () => {
      const mockResults = { cards: { data: [], count: 0, success: true } };

      mockSearchFactory.searchMultiple.mockResolvedValue(mockResults);

      mockRequest.query = {
        query: 'test',
        types: 'cards',
        limit: '20',
        page: '2',
        sort: '{"name": 1}',
        filters: '{"category": "pokemon"}',
      };

      await UnifiedSearchController.search(mockRequest, mockResponse);

      expect(mockSearchFactory.searchMultiple).toHaveBeenCalledWith('test', ['cards'], {
        limit: 20,
        page: 2,
        sort: { name: 1 },
        filters: { category: 'pokemon' },
      });
    });

    test('should throw ValidationError for missing query', async () => {
      mockRequest.query = {};

      await expect(UnifiedSearchController.search(mockRequest, mockResponse)).rejects.toThrow(
        ValidationError
      );
      await expect(UnifiedSearchController.search(mockRequest, mockResponse)).rejects.toThrow(
        'Query parameter is required and must be a string'
      );
    });

    test('should throw ValidationError for non-string query', async () => {
      mockRequest.query = { query: 123 };

      await expect(UnifiedSearchController.search(mockRequest, mockResponse)).rejects.toThrow(
        ValidationError
      );
    });

    test('should handle search factory errors', async () => {
      mockSearchFactory.searchMultiple.mockRejectedValue(new Error('Search failed'));
      mockRequest.query = { query: 'test' };

      await expect(UnifiedSearchController.search(mockRequest, mockResponse)).rejects.toThrow(
        'Search failed'
      );
      expect(console.error).toHaveBeenCalled();
    });

    test('should calculate total count correctly', async () => {
      const mockResults = {
        cards: { data: [1, 2, 3], count: 3, success: true },
        products: { data: [1, 2], count: 2, success: true },
        sets: { data: [1], count: 1, success: true },
      };

      mockSearchFactory.searchMultiple.mockResolvedValue(mockResults);
      mockRequest.query = { query: 'test' };

      await UnifiedSearchController.search(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCount: 6,
        })
      );
    });
  });

  describe('suggest (unified suggestions)', () => {
    test('should provide suggestions with valid parameters', async () => {
      const mockSuggestions = {
        cards: {
          data: ['Pikachu', 'Pikachurium'],
          count: 2,
          success: true,
        },
        products: {
          data: ['Pikachu Card', 'Pikachu Plushie'],
          count: 2,
          success: true,
        },
      };

      mockSearchFactory.suggestMultiple.mockResolvedValue(mockSuggestions);
      mockRequest.query = {
        query: 'pika',
        types: 'cards,products',
        limit: '5',
      };

      await UnifiedSearchController.suggest(mockRequest, mockResponse);

      expect(mockSearchFactory.suggestMultiple).toHaveBeenCalledWith(
        'pika',
        ['cards', 'products'],
        { limit: 5 }
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        query: 'pika',
        suggestions: mockSuggestions,
      });
    });

    test('should use default limit for suggestions', async () => {
      const mockSuggestions = { cards: { data: [], count: 0, success: true } };

      mockSearchFactory.suggestMultiple.mockResolvedValue(mockSuggestions);
      mockRequest.query = { query: 'test' };

      await UnifiedSearchController.suggest(mockRequest, mockResponse);

      expect(mockSearchFactory.suggestMultiple).toHaveBeenCalledWith(
        'test',
        ['cards', 'products', 'sets'],
        { limit: 5 }
      );
    });

    test('should throw ValidationError for missing query in suggestions', async () => {
      mockRequest.query = {};

      await expect(UnifiedSearchController.suggest(mockRequest, mockResponse)).rejects.toThrow(
        ValidationError
      );
    });

    test('should handle suggestion factory errors', async () => {
      mockSearchFactory.suggestMultiple.mockRejectedValue(new Error('Suggestion failed'));
      mockRequest.query = { query: 'test' };

      await expect(UnifiedSearchController.suggest(mockRequest, mockResponse)).rejects.toThrow(
        'Suggestion failed'
      );
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('searchCards (card-specific search)', () => {
    test('should search cards with all filter parameters', async () => {
      const mockCards = [
        { id: '1', name: 'Pikachu', setName: 'Base Set' },
        { id: '2', name: 'Charizard', setName: 'Base Set' },
      ];

      mockStrategy.search.mockResolvedValue(mockCards);
      mockSearchFactory.getStrategy.mockReturnValue(mockStrategy);

      mockRequest.query = {
        query: 'pikachu',
        setId: '123',
        setName: 'Base Set',
        year: '1998',
        pokemonNumber: '25',
        variety: 'Holo',
        minPsaPopulation: '1000',
        limit: '10',
        page: '1',
        sort: '{"name": 1}',
      };

      await UnifiedSearchController.searchCards(mockRequest, mockResponse);

      expect(mockSearchFactory.getStrategy).toHaveBeenCalledWith('cards');
      expect(mockStrategy.search).toHaveBeenCalledWith('pikachu', {
        limit: 10,
        page: 1,
        sort: { name: 1 },
        filters: {
          setId: '123',
          setName: 'Base Set',
          year: 1998,
          pokemonNumber: '25',
          variety: 'Holo',
          minPsaPopulation: 1000,
        },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        query: 'pikachu',
        count: 2,
        data: mockCards,
      });
    });

    test('should handle card search with minimal parameters', async () => {
      const mockCards = [{ id: '1', name: 'Pikachu' }];

      mockStrategy.search.mockResolvedValue(mockCards);
      mockSearchFactory.getStrategy.mockReturnValue(mockStrategy);

      mockRequest.query = { query: 'pikachu' };

      await UnifiedSearchController.searchCards(mockRequest, mockResponse);

      expect(mockStrategy.search).toHaveBeenCalledWith('pikachu', {
        limit: 20,
        page: 1,
        sort: undefined,
        filters: {},
      });
    });

    test('should throw ValidationError for missing query in card search', async () => {
      mockRequest.query = {};

      await expect(UnifiedSearchController.searchCards(mockRequest, mockResponse)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('searchProducts (product-specific search)', () => {
    test('should search products with all filter parameters', async () => {
      const mockProducts = [
        { id: '1', name: 'Base Set Booster Box', category: 'Booster Box' },
        { id: '2', name: 'Elite Trainer Box', category: 'ETB' },
      ];

      mockStrategy.search.mockResolvedValue(mockProducts);
      mockSearchFactory.getStrategy.mockReturnValue(mockStrategy);

      mockRequest.query = {
        query: 'booster',
        category: 'Booster Box',
        setName: 'Base Set',
        minPrice: '100',
        maxPrice: '500',
        availableOnly: 'true',
        limit: '15',
        page: '2',
        sort: '{"price": -1}',
      };

      await UnifiedSearchController.searchProducts(mockRequest, mockResponse);

      expect(mockSearchFactory.getStrategy).toHaveBeenCalledWith('products');
      expect(mockStrategy.search).toHaveBeenCalledWith('booster', {
        limit: 15,
        page: 2,
        sort: { price: -1 },
        filters: {
          category: 'Booster Box',
          setName: 'Base Set',
          priceRange: { min: 100, max: 500 },
          availableOnly: true,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        query: 'booster',
        count: 2,
        data: mockProducts,
      });
    });

    test('should handle price range filtering', async () => {
      const mockProducts = [];

      mockStrategy.search.mockResolvedValue(mockProducts);
      mockSearchFactory.getStrategy.mockReturnValue(mockStrategy);

      mockRequest.query = {
        query: 'product',
        minPrice: '50.99',
        maxPrice: '199.99',
      };

      await UnifiedSearchController.searchProducts(mockRequest, mockResponse);

      expect(mockStrategy.search).toHaveBeenCalledWith(
        'product',
        expect.objectContaining({
          filters: {
            priceRange: { min: 50.99, max: 199.99 },
          },
        })
      );
    });

    test('should handle availability filtering', async () => {
      const mockProducts = [];

      mockStrategy.search.mockResolvedValue(mockProducts);
      mockSearchFactory.getStrategy.mockReturnValue(mockStrategy);

      mockRequest.query = {
        query: 'product',
        availableOnly: 'true',
      };

      await UnifiedSearchController.searchProducts(mockRequest, mockResponse);

      expect(mockStrategy.search).toHaveBeenCalledWith(
        'product',
        expect.objectContaining({
          filters: { availableOnly: true },
        })
      );
    });
  });

  describe('searchSets (set-specific search)', () => {
    test('should search sets with all filter parameters', async () => {
      const mockSets = [
        { id: '1', setName: 'Base Set', year: 1998 },
        { id: '2', setName: 'Jungle', year: 1999 },
      ];

      mockStrategy.search.mockResolvedValue(mockSets);
      mockSearchFactory.getStrategy.mockReturnValue(mockStrategy);

      mockRequest.query = {
        query: 'base',
        year: '1998',
        minYear: '1990',
        maxYear: '2000',
        minPsaPopulation: '10000',
        minCardCount: '100',
        limit: '25',
        page: '1',
        sort: '{"year": 1}',
      };

      await UnifiedSearchController.searchSets(mockRequest, mockResponse);

      expect(mockSearchFactory.getStrategy).toHaveBeenCalledWith('sets');
      expect(mockStrategy.search).toHaveBeenCalledWith('base', {
        limit: 25,
        page: 1,
        sort: { year: 1 },
        filters: {
          year: 1998,
          yearRange: { start: 1990, end: 2000 },
          minPsaPopulation: 10000,
          minCardCount: 100,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        query: 'base',
        count: 2,
        data: mockSets,
      });
    });

    test('should handle year range filtering', async () => {
      const mockSets = [];

      mockStrategy.search.mockResolvedValue(mockSets);
      mockSearchFactory.getStrategy.mockReturnValue(mockStrategy);

      mockRequest.query = {
        query: 'set',
        minYear: '1995',
        maxYear: '2005',
      };

      await UnifiedSearchController.searchSets(mockRequest, mockResponse);

      expect(mockStrategy.search).toHaveBeenCalledWith(
        'set',
        expect.objectContaining({
          filters: {
            yearRange: { start: 1995, end: 2005 },
          },
        })
      );
    });
  });

  describe('getSearchTypes', () => {
    test('should return available search types with metadata', async () => {
      const mockTypes = ['cards', 'products', 'sets'];
      const mockOptions = { limit: 50, enableFuzzy: true };

      mockSearchFactory.getRegisteredTypes.mockReturnValue(mockTypes);
      mockSearchFactory.isTypeSupported.mockImplementation((type) => 
        mockTypes.includes(type)
      );
      mockSearchFactory.getSupportedOptions.mockReturnValue(mockOptions);

      await UnifiedSearchController.getSearchTypes(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        types: [
          { type: 'cards', supported: true, options: mockOptions },
          { type: 'products', supported: true, options: mockOptions },
          { type: 'sets', supported: true, options: mockOptions },
        ],
      });
    });

    test('should handle search factory errors in getSearchTypes', async () => {
      mockSearchFactory.getRegisteredTypes.mockImplementation(() => {
        throw new Error('Factory error');
      });

      await expect(
        UnifiedSearchController.getSearchTypes(mockRequest, mockResponse)
      ).rejects.toThrow('Factory error');
    });
  });

  describe('getSearchStats', () => {
    test('should return comprehensive search statistics', async () => {
      const mockCacheStats = { enabled: true, size: 5, keys: ['cards:1', 'products:2'] };
      const mockRegisteredTypes = ['cards', 'products', 'sets'];

      mockSearchFactory.getCacheStats.mockReturnValue(mockCacheStats);
      mockSearchFactory.getRegisteredTypes.mockReturnValue(mockRegisteredTypes);

      await UnifiedSearchController.getSearchStats(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        stats: {
          registeredTypes: mockRegisteredTypes,
          cacheStats: mockCacheStats,
          containerStats: {
            totalDependencies: 10,
            singletons: 5,
            transients: 5,
            initialized: true,
          },
        },
      });
    });

    test('should handle errors in getSearchStats', async () => {
      mockSearchFactory.getCacheStats.mockImplementation(() => {
        throw new Error('Stats error');
      });

      await expect(
        UnifiedSearchController.getSearchStats(mockRequest, mockResponse)
      ).rejects.toThrow('Stats error');
    });
  });

  describe('Error Handling and Logging', () => {
    test('should log appropriate messages for successful searches', async () => {
      const mockResults = { cards: { data: [], count: 0, success: true } };

      mockSearchFactory.searchMultiple.mockResolvedValue(mockResults);
      mockRequest.query = { query: 'test' };

      await UnifiedSearchController.search(mockRequest, mockResponse);

      expect(console.log).toHaveBeenCalledWith('=== UNIFIED SEARCH START ===');
      expect(console.log).toHaveBeenCalledWith('=== UNIFIED SEARCH END ===');
    });

    test('should log error messages for failed searches', async () => {
      mockSearchFactory.searchMultiple.mockRejectedValue(new Error('Search failed'));
      mockRequest.query = { query: 'test' };

      await expect(UnifiedSearchController.search(mockRequest, mockResponse)).rejects.toThrow();

      expect(console.error).toHaveBeenCalledWith('=== UNIFIED SEARCH ERROR ===');
      expect(console.error).toHaveBeenCalledWith('Error:', 'Search failed');
    });

    test('should handle JSON parsing errors in parameters', async () => {
      mockRequest.query = {
        query: 'test',
        sort: 'invalid-json',
      };

      await expect(UnifiedSearchController.search(mockRequest, mockResponse)).rejects.toThrow();
    });

    test('should handle strategy resolution errors', async () => {
      mockSearchFactory.getStrategy.mockImplementation(() => {
        throw new Error('Strategy not found');
      });
      mockRequest.query = { query: 'test' };

      await expect(
        UnifiedSearchController.searchCards(mockRequest, mockResponse)
      ).rejects.toThrow('Strategy not found');
    });
  });

  describe('Input Validation', () => {
    test('should validate query parameter type across all methods', async () => {
      const invalidQueries = [null, undefined, 123, {}, []];

      for (const invalidQuery of invalidQueries) {
        mockRequest.query = { query: invalidQuery };

        await expect(UnifiedSearchController.search(mockRequest, mockResponse)).rejects.toThrow(
          ValidationError
        );
        await expect(UnifiedSearchController.suggest(mockRequest, mockResponse)).rejects.toThrow(
          ValidationError
        );
        await expect(
          UnifiedSearchController.searchCards(mockRequest, mockResponse)
        ).rejects.toThrow(ValidationError);
        await expect(
          UnifiedSearchController.searchProducts(mockRequest, mockResponse)
        ).rejects.toThrow(ValidationError);
        await expect(
          UnifiedSearchController.searchSets(mockRequest, mockResponse)
        ).rejects.toThrow(ValidationError);
      }
    });

    test('should handle type parsing with spaces and case variations', async () => {
      const mockResults = { cards: { data: [], count: 0, success: true } };

      mockSearchFactory.searchMultiple.mockResolvedValue(mockResults);

      mockRequest.query = {
        query: 'test',
        types: ' CARDS , Products , SETS ',
      };

      await UnifiedSearchController.search(mockRequest, mockResponse);

      expect(mockSearchFactory.searchMultiple).toHaveBeenCalledWith(
        'test',
        ['CARDS', 'Products', 'SETS'],
        expect.any(Object)
      );
    });

    test('should validate numeric parameters', async () => {
      const mockProducts = [];

      mockStrategy.search.mockResolvedValue(mockProducts);
      mockSearchFactory.getStrategy.mockReturnValue(mockStrategy);

      mockRequest.query = {
        query: 'test',
        limit: 'not-a-number',
        page: 'also-not-a-number',
      };

      await UnifiedSearchController.searchProducts(mockRequest, mockResponse);

      // Should fall back to defaults for invalid numbers
      expect(mockStrategy.search).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          limit: 20, // Default limit
          page: 1, // Default page
        })
      );
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large result sets efficiently', async () => {
      const largeResults = {
        cards: { data: new Array(1000).fill({ id: '1', name: 'Card' }), count: 1000, success: true },
        products: { data: new Array(500).fill({ id: '2', name: 'Product' }), count: 500, success: true },
      };

      mockSearchFactory.searchMultiple.mockResolvedValue(largeResults);
      mockRequest.query = { query: 'test' };

      await UnifiedSearchController.search(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCount: 1500,
        })
      );
    });

    test('should handle concurrent search requests', async () => {
      const mockResults = { cards: { data: [], count: 0, success: true } };

      mockSearchFactory.searchMultiple.mockResolvedValue(mockResults);

      const requests = Array.from({ length: 10 }, () => ({
        query: { query: `test-${Math.random()}` },
      }));

      const promises = requests.map((req) =>
        UnifiedSearchController.search(req, mockResponse)
      );

      await Promise.all(promises);

      expect(mockSearchFactory.searchMultiple).toHaveBeenCalledTimes(10);
    });
  });
});