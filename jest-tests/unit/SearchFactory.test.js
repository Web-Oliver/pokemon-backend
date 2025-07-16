const SearchFactory = require('../../services/search/SearchFactory');
const { ValidationError } = require('../../middleware/errorHandler');

// Mock strategy modules first
jest.mock('../../services/search/strategies/CardSearchStrategy', () => jest.fn());
jest.mock('../../services/search/strategies/ProductSearchStrategy', () => jest.fn());
jest.mock('../../services/search/strategies/SetSearchStrategy', () => jest.fn());

// Get the mocked strategy classes
const MockCardSearchStrategy = require('../../services/search/strategies/CardSearchStrategy');
const MockProductSearchStrategy = require('../../services/search/strategies/ProductSearchStrategy');
const MockSetSearchStrategy = require('../../services/search/strategies/SetSearchStrategy');

// Mock strategy instances
const mockCardStrategy = {
  search: jest.fn(),
  suggest: jest.fn(),
  getSupportedOptions: jest.fn(),
  validateSearchInput: jest.fn(),
};

const mockProductStrategy = {
  search: jest.fn(),
  suggest: jest.fn(),
  getSupportedOptions: jest.fn(),
  validateSearchInput: jest.fn(),
};

const mockSetStrategy = {
  search: jest.fn(),
  suggest: jest.fn(),
  getSupportedOptions: jest.fn(),
  validateSearchInput: jest.fn(),
};

// Mock container
const mockContainer = {
  resolve: jest.fn(),
};

describe('SearchFactory', () => {
  let searchFactory;
  let mockCardRepository;
  let mockSetRepository;
  let mockCardMarketRepository;

  beforeEach(() => {
    // Mock repositories
    mockCardRepository = { find: jest.fn(), count: jest.fn() };
    mockSetRepository = { find: jest.fn(), count: jest.fn() };
    mockCardMarketRepository = { find: jest.fn(), count: jest.fn() };

    // Setup container resolutions
    mockContainer.resolve.mockImplementation((dep) => {
      switch (dep) {
        case 'cardRepository':
          return mockCardRepository;
        case 'setRepository':
          return mockSetRepository;
        case 'cardMarketReferenceProductRepository':
          return mockCardMarketRepository;
        default:
          throw new Error(`Unknown dependency: ${dep}`);
      }
    });

    // Setup strategy constructor mocks
    MockCardSearchStrategy.mockImplementation(() => mockCardStrategy);
    MockProductSearchStrategy.mockImplementation(() => mockProductStrategy);
    MockSetSearchStrategy.mockImplementation(() => mockSetStrategy);

    // Create factory instance
    searchFactory = new SearchFactory(mockContainer, {
      enableCaching: true,
      defaultMaxResults: 25,
      enableFuzzySearch: true,
      enableScoring: true,
    });

    // Mock console methods
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    test('should initialize with correct options', () => {
      expect(searchFactory.container).toBe(mockContainer);
      expect(searchFactory.options.enableCaching).toBe(true);
      expect(searchFactory.options.defaultMaxResults).toBe(25);
      expect(searchFactory.options.enableFuzzySearch).toBe(true);
      expect(searchFactory.options.enableScoring).toBe(true);
    });

    test('should use default options when not provided', () => {
      const defaultFactory = new SearchFactory(mockContainer);
      
      expect(defaultFactory.options.enableCaching).toBe(true);
      expect(defaultFactory.options.defaultMaxResults).toBe(50);
      expect(defaultFactory.options.enableFuzzySearch).toBe(true);
      expect(defaultFactory.options.enableScoring).toBe(true);
    });

    test('should initialize strategy registry', () => {
      expect(searchFactory.strategies.size).toBe(3);
      expect(searchFactory.strategies.has('cards')).toBe(true);
      expect(searchFactory.strategies.has('products')).toBe(true);
      expect(searchFactory.strategies.has('sets')).toBe(true);
    });

    test('should configure strategy options correctly', () => {
      const cardConfig = searchFactory.strategies.get('cards');

      expect(cardConfig.strategyClass).toBe(MockCardSearchStrategy);
      expect(cardConfig.dependencies).toEqual(['cardRepository', 'setRepository']);
      expect(cardConfig.options.maxResults).toBe(25);
      expect(cardConfig.options.enableFuzzySearch).toBe(true);
      expect(cardConfig.options.enableScoring).toBe(true);
    });
  });

  describe('Strategy Creation', () => {
    test('should create card search strategy successfully', () => {
      const strategy = searchFactory.createStrategy('cards');

      expect(MockCardSearchStrategy).toHaveBeenCalledWith(
        mockCardRepository,
        mockSetRepository,
        expect.objectContaining({
          maxResults: 25,
          enableFuzzySearch: true,
          enableScoring: true,
          enableSetContext: true,
          enablePopularityScoring: true,
          minQueryLength: 1,
        })
      );
      expect(strategy).toBe(mockCardStrategy);
    });

    test('should create product search strategy successfully', () => {
      const strategy = searchFactory.createStrategy('products');

      expect(MockProductSearchStrategy).toHaveBeenCalledWith(
        mockCardMarketRepository,
        expect.objectContaining({
          maxResults: 25,
          enableFuzzySearch: true,
          enableScoring: true,
          enablePriceScoring: true,
          enableAvailabilityScoring: true,
          enableCategoryFiltering: true,
          minQueryLength: 2,
        })
      );
      expect(strategy).toBe(mockProductStrategy);
    });

    test('should create set search strategy successfully', () => {
      const strategy = searchFactory.createStrategy('sets');

      expect(MockSetSearchStrategy).toHaveBeenCalledWith(
        mockSetRepository,
        mockCardRepository,
        expect.objectContaining({
          maxResults: 30,
          enableFuzzySearch: true,
          enableScoring: true,
          enableYearFiltering: true,
          enableCardCountMetrics: true,
          enablePsaPopulationMetrics: true,
          minQueryLength: 1,
        })
      );
      expect(strategy).toBe(mockSetStrategy);
    });

    test('should merge custom options with default options', () => {
      const customOptions = {
        maxResults: 100,
        enableCustomFeature: true,
      };

      searchFactory.createStrategy('cards', customOptions);

      expect(MockCardSearchStrategy).toHaveBeenCalledWith(
        mockCardRepository,
        mockSetRepository,
        expect.objectContaining({
          maxResults: 100, // Override
          enableFuzzySearch: true, // Default preserved
          enableCustomFeature: true, // Custom option added
        })
      );
    });

    test('should handle case insensitive strategy types', () => {
      const strategy1 = searchFactory.createStrategy('CARDS');
      const strategy2 = searchFactory.createStrategy('Cards');
      const strategy3 = searchFactory.createStrategy('cards');

      expect(strategy1).toBe(mockCardStrategy);
      expect(strategy2).toBe(mockCardStrategy);
      expect(strategy3).toBe(mockCardStrategy);
    });

    test('should throw ValidationError for invalid type', () => {
      expect(() => searchFactory.createStrategy('')).toThrow(ValidationError);
      expect(() => searchFactory.createStrategy(null)).toThrow(ValidationError);
      expect(() => searchFactory.createStrategy(123)).toThrow(ValidationError);
    });

    test('should throw ValidationError for unknown strategy type', () => {
      expect(() => searchFactory.createStrategy('unknown')).toThrow(ValidationError);
      expect(() => searchFactory.createStrategy('unknown')).toThrow('Unknown search type: unknown');
    });

    test('should handle dependency resolution errors', () => {
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Dependency not found');
      });

      expect(() => searchFactory.createStrategy('cards')).toThrow('Dependency not found');
    });
  });

  describe('Multiple Strategy Creation', () => {
    test('should create multiple strategies successfully', () => {
      const strategies = searchFactory.createStrategies(['cards', 'products', 'sets']);

      expect(strategies.size).toBe(3);
      expect(strategies.get('cards')).toBe(mockCardStrategy);
      expect(strategies.get('products')).toBe(mockProductStrategy);
      expect(strategies.get('sets')).toBe(mockSetStrategy);
    });

    test('should handle partial failures in strategy creation', () => {
      // Mock one strategy to fail
      MockProductSearchStrategy.mockImplementationOnce(() => {
        throw new Error('Strategy creation failed');
      });

      const strategies = searchFactory.createStrategies(['cards', 'products', 'sets']);

      expect(strategies.size).toBe(2); // Only cards and sets succeed
      expect(strategies.has('cards')).toBe(true);
      expect(strategies.has('products')).toBe(false);
      expect(strategies.has('sets')).toBe(true);
      expect(console.warn).toHaveBeenCalledWith(
        "Failed to create strategy for type 'products':",
        'Strategy creation failed'
      );
    });

    test('should return empty map for empty types array', () => {
      const strategies = searchFactory.createStrategies([]);

      expect(strategies.size).toBe(0);
    });
  });

  describe('Strategy Caching', () => {
    test('should cache strategies when caching is enabled', () => {
      const strategy1 = searchFactory.getStrategy('cards');
      const strategy2 = searchFactory.getStrategy('cards');

      expect(strategy1).toBe(strategy2);
      expect(MockCardSearchStrategy).toHaveBeenCalledTimes(1);
    });

    test('should create different cache entries for different options', () => {
      // Clear previous calls to get accurate count for this test
      MockCardSearchStrategy.mockClear();
      
      const options1 = { option1: 'value1' };
      const options2 = { option1: 'value2' };
      
      const strategy1 = searchFactory.getStrategy('cards', options1);
      const strategy2 = searchFactory.getStrategy('cards', options2);

      // Verify cache keys are different
      const key1 = searchFactory.buildCacheKey('cards', options1);
      const key2 = searchFactory.buildCacheKey('cards', options2);
      expect(key1).not.toBe(key2);

      expect(strategy1).not.toBe(strategy2);
      expect(MockCardSearchStrategy).toHaveBeenCalledTimes(2);
    });

    test('should not cache when caching is disabled', () => {
      // Clear previous calls to get accurate count for this test
      MockCardSearchStrategy.mockClear();
      
      const noCacheFactory = new SearchFactory(mockContainer, { enableCaching: false });
      
      const strategy1 = noCacheFactory.getStrategy('cards');
      const strategy2 = noCacheFactory.getStrategy('cards');

      // Should create new instances each time
      expect(MockCardSearchStrategy).toHaveBeenCalledTimes(2);
    });

    test('should build consistent cache keys', () => {
      const key1 = searchFactory.buildCacheKey('cards', { a: 1, b: 2 });
      const key2 = searchFactory.buildCacheKey('cards', { a: 1, b: 2 });
      const key3 = searchFactory.buildCacheKey('cards', { a: 2, b: 1 });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    test('should clear cache correctly', () => {
      searchFactory.getStrategy('cards');
      searchFactory.getStrategy('products');
      
      expect(searchFactory.getCacheStats().size).toBe(2);
      
      searchFactory.clearCache();
      
      expect(searchFactory.getCacheStats().size).toBe(0);
    });

    test('should provide accurate cache statistics', () => {
      searchFactory.getStrategy('cards');
      searchFactory.getStrategy('products', { custom: true });
      
      const stats = searchFactory.getCacheStats();
      
      expect(stats.enabled).toBe(true);
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('cards:{}');
      expect(stats.keys.some(key => key.includes('custom'))).toBe(true);
    });
  });

  describe('Strategy Registration', () => {
    test('should register custom strategy successfully', () => {
      const CustomStrategy = jest.fn();
      const config = {
        strategyClass: CustomStrategy,
        dependencies: ['customRepository'],
        options: { customOption: true },
      };

      searchFactory.registerStrategy('custom', config);

      expect(searchFactory.strategies.has('custom')).toBe(true);
      expect(searchFactory.getRegisteredTypes()).toContain('custom');
    });

    test('should validate strategy configuration', () => {
      const invalidConfigs = [
        null,
        {},
        { strategyClass: 'not-a-function' },
        { strategyClass: jest.fn(), dependencies: 'not-an-array' },
        { strategyClass: jest.fn(), dependencies: [], options: 'not-an-object' },
      ];

      invalidConfigs.forEach((config) => {
        expect(() => searchFactory.registerStrategy('invalid', config)).toThrow(ValidationError);
      });
    });

    test('should unregister strategy and clear cache', () => {
      // First, cache a strategy
      searchFactory.getStrategy('cards');
      expect(searchFactory.getCacheStats().size).toBe(1);

      // Unregister the strategy
      searchFactory.unregisterStrategy('cards');

      expect(searchFactory.strategies.has('cards')).toBe(false);
      expect(searchFactory.getCacheStats().size).toBe(0);
    });

    test('should handle case insensitive registration and unregistration', () => {
      const CustomStrategy = jest.fn();
      const config = {
        strategyClass: CustomStrategy,
        dependencies: [],
        options: {},
      };

      searchFactory.registerStrategy('CUSTOM', config);
      expect(searchFactory.strategies.has('custom')).toBe(true);

      searchFactory.unregisterStrategy('Custom');
      expect(searchFactory.strategies.has('custom')).toBe(false);
    });
  });

  describe('Strategy Information and Validation', () => {
    test('should return correct registered types', () => {
      const types = searchFactory.getRegisteredTypes();

      expect(types).toEqual(['cards', 'products', 'sets']);
    });

    test('should return strategy configuration', () => {
      const config = searchFactory.getStrategyConfig('cards');

      expect(config.strategyClass).toBe(MockCardSearchStrategy);
      expect(config.dependencies).toEqual(['cardRepository', 'setRepository']);
    });

    test('should return null for unknown strategy configuration', () => {
      const config = searchFactory.getStrategyConfig('unknown');

      expect(config).toBeNull();
    });

    test('should check type support correctly', () => {
      expect(searchFactory.isTypeSupported('cards')).toBe(true);
      expect(searchFactory.isTypeSupported('products')).toBe(true);
      expect(searchFactory.isTypeSupported('unknown')).toBe(false);
    });

    test('should get supported options from strategy', () => {
      const mockOptions = { fuzzySearch: true, scoring: true };

      mockCardStrategy.getSupportedOptions.mockReturnValue(mockOptions);

      const options = searchFactory.getSupportedOptions('cards');

      expect(options).toBe(mockOptions);
      expect(mockCardStrategy.getSupportedOptions).toHaveBeenCalled();
    });

    test('should validate search input using strategy', () => {
      searchFactory.validateSearchInput('cards', 'test query', { limit: 10 });
      
      expect(mockCardStrategy.validateSearchInput).toHaveBeenCalledWith(
        'test query',
        { limit: 10 }
      );
    });
  });

  describe('Multi-Type Search Operations', () => {
    test('should perform successful multi-type search', async () => {
      const mockCardResults = [{ id: '1', name: 'Pikachu' }];
      const mockProductResults = [{ id: '2', name: 'Booster' }];
      const mockSetResults = [{ id: '3', name: 'Base Set' }];

      mockCardStrategy.search.mockResolvedValue(mockCardResults);
      mockProductStrategy.search.mockResolvedValue(mockProductResults);
      mockSetStrategy.search.mockResolvedValue(mockSetResults);

      const results = await searchFactory.searchMultiple(
        'test',
        ['cards', 'products', 'sets'],
        { limit: 30 }
      );

      expect(results).toEqual({
        cards: {
          data: mockCardResults,
          count: 1,
          success: true,
        },
        products: {
          data: mockProductResults,
          count: 1,
          success: true,
        },
        sets: {
          data: mockSetResults,
          count: 1,
          success: true,
        },
      });

      // Verify each strategy was called with distributed limit
      expect(mockCardStrategy.search).toHaveBeenCalledWith('test', { limit: 10 });
      expect(mockProductStrategy.search).toHaveBeenCalledWith('test', { limit: 10 });
      expect(mockSetStrategy.search).toHaveBeenCalledWith('test', { limit: 10 });
    });

    test('should handle partial failures in multi-type search', async () => {
      const mockCardResults = [{ id: '1', name: 'Pikachu' }];
      
      mockCardStrategy.search.mockResolvedValue(mockCardResults);
      mockProductStrategy.search.mockRejectedValue(new Error('Product search failed'));
      mockSetStrategy.search.mockResolvedValue([]);

      const results = await searchFactory.searchMultiple(
        'test',
        ['cards', 'products', 'sets'],
        { limit: 30 }
      );

      expect(results.cards.success).toBe(true);
      expect(results.cards.data).toEqual(mockCardResults);
      
      expect(results.products.success).toBe(false);
      expect(results.products.data).toEqual([]);
      expect(results.products.error).toBe('Product search failed');
      
      expect(results.sets.success).toBe(true);
      expect(results.sets.data).toEqual([]);

      expect(console.warn).toHaveBeenCalledWith(
        "Search failed for type 'products':",
        'Product search failed'
      );
    });

    test('should perform successful multi-type suggestions', async () => {
      const mockCardSuggestions = ['Pikachu', 'Pikachute'];
      const mockProductSuggestions = ['Booster Box', 'Booster Pack'];

      mockCardStrategy.suggest.mockResolvedValue(mockCardSuggestions);
      mockProductStrategy.suggest.mockResolvedValue(mockProductSuggestions);

      const results = await searchFactory.suggestMultiple(
        'pika',
        ['cards', 'products'],
        { limit: 10 }
      );

      expect(results).toEqual({
        cards: {
          data: mockCardSuggestions,
          count: 2,
          success: true,
        },
        products: {
          data: mockProductSuggestions,
          count: 2,
          success: true,
        },
      });

      expect(mockCardStrategy.suggest).toHaveBeenCalledWith('pika', { limit: 5 });
      expect(mockProductStrategy.suggest).toHaveBeenCalledWith('pika', { limit: 5 });
    });

    test('should distribute limits evenly across types', async () => {
      mockCardStrategy.search.mockResolvedValue([]);
      mockProductStrategy.search.mockResolvedValue([]);
      mockSetStrategy.search.mockResolvedValue([]);

      await searchFactory.searchMultiple('test', ['cards', 'products', 'sets'], { limit: 30 });

      expect(mockCardStrategy.search).toHaveBeenCalledWith('test', { limit: 10 });
      expect(mockProductStrategy.search).toHaveBeenCalledWith('test', { limit: 10 });
      expect(mockSetStrategy.search).toHaveBeenCalledWith('test', { limit: 10 });
    });

    test('should handle uneven limit distribution', async () => {
      mockCardStrategy.search.mockResolvedValue([]);
      mockProductStrategy.search.mockResolvedValue([]);

      await searchFactory.searchMultiple('test', ['cards', 'products'], { limit: 25 });

      // 25 / 2 = 12.5, should floor to 12
      expect(mockCardStrategy.search).toHaveBeenCalledWith('test', { limit: 12 });
      expect(mockProductStrategy.search).toHaveBeenCalledWith('test', { limit: 12 });
    });
  });

  describe('Error Handling', () => {
    test('should handle dependency resolution failures gracefully', () => {
      mockContainer.resolve.mockImplementation((dep) => {
        if (dep === 'cardRepository') {
          throw new Error('Repository not found');
        }
        return mockSetRepository;
      });

      expect(() => searchFactory.createStrategy('cards')).toThrow('Repository not found');
    });

    test('should handle strategy constructor failures', () => {
      MockCardSearchStrategy.mockImplementationOnce(() => {
        throw new Error('Strategy constructor failed');
      });

      expect(() => searchFactory.createStrategy('cards')).toThrow('Strategy constructor failed');
    });

    test('should propagate validation errors from strategies', () => {
      mockCardStrategy.validateSearchInput.mockImplementation(() => {
        throw new ValidationError('Invalid query');
      });

      expect(() => 
        searchFactory.validateSearchInput('cards', 'invalid', {})
      ).toThrow('Invalid query');
    });

    test('should handle cache key generation errors', () => {
      const circularObj = {};

      circularObj.self = circularObj;

      expect(() => 
        searchFactory.buildCacheKey('cards', circularObj)
      ).toThrow();
    });
  });

  describe('Performance and Memory Management', () => {
    test('should limit cache size implicitly through proper cleanup', () => {
      // Create many cached strategies
      for (let i = 0; i < 100; i++) {
        searchFactory.getStrategy('cards', { iteration: i });
      }

      const stats = searchFactory.getCacheStats();

      expect(stats.size).toBe(100);
      
      // Clear cache to prevent memory leaks
      searchFactory.clearCache();
      expect(searchFactory.getCacheStats().size).toBe(0);
    });

    test('should handle concurrent strategy creation', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        Promise.resolve(searchFactory.getStrategy('cards', { concurrent: i }))
      );

      const strategies = await Promise.all(promises);
      
      // All should be created successfully
      expect(strategies).toHaveLength(10);
      expect(strategies.every(s => s === mockCardStrategy)).toBe(true);
    });

    test('should handle rapid cache operations', () => {
      // Rapid cache operations
      for (let i = 0; i < 1000; i++) {
        searchFactory.getStrategy('cards');
        if (i % 100 === 0) {
          searchFactory.clearCache();
        }
      }

      // Should not throw errors
      expect(searchFactory.getCacheStats().enabled).toBe(true);
    });
  });
});