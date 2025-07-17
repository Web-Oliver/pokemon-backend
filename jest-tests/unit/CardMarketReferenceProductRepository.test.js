const CardMarketReferenceProductRepository = require('../../repositories/CardMarketReferenceProductRepository');
const CardMarketReferenceProduct = require('../../models/CardMarketReferenceProduct');
const { ValidationError } = require('../../middleware/errorHandler');
const mongoose = require('mongoose');

// Mock the CardMarketReferenceProduct model
jest.mock('../../models/CardMarketReferenceProduct');

describe('CardMarketReferenceProductRepository', () => {
  let repository;
  let mockFindAll;
  let mockAggregate;
  let mockFindOne;
  let mockCountDocuments;

  const mockProduct1 = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Base Set Booster Box',
    setName: 'Base Set',
    available: 5,
    price: '12500.00',
    category: 'Booster Box',
    url: 'https://cardmarket.com/base-set-booster-box',
    lastUpdated: new Date('2024-01-15'),
  };

  const mockProduct2 = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Team Rocket Booster Pack',
    setName: 'Team Rocket',
    available: 25,
    price: '350.00',
    category: 'Booster Pack',
    url: 'https://cardmarket.com/team-rocket-booster-pack',
    lastUpdated: new Date('2024-01-20'),
  };

  const mockProduct3 = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Charizard Theme Deck',
    setName: 'Base Set',
    available: 0,
    price: '5500.00',
    category: 'Theme Deck',
    url: 'https://cardmarket.com/charizard-theme-deck',
    lastUpdated: new Date('2024-01-10'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {
      // Mock console.log for testing - intentionally empty
    });
    jest.spyOn(console, 'error').mockImplementation(() => {
      // Mock console.error for testing - intentionally empty
    });

    repository = new CardMarketReferenceProductRepository();

    // Setup common mocks
    mockFindAll = jest.fn();
    mockAggregate = jest.fn();
    mockFindOne = jest.fn();
    mockCountDocuments = jest.fn();

    // Mock repository methods inherited from BaseRepository
    repository.findAll = mockFindAll;
    repository.aggregate = mockAggregate;
    repository.findOne = mockFindOne;
    repository.countDocuments = mockCountDocuments;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Repository Initialization', () => {
    test('should initialize with correct model and options', () => {
      expect(repository.model).toBe(CardMarketReferenceProduct);
      expect(repository.options.entityName).toBe('CardMarketReferenceProduct');
      expect(repository.options.defaultSort).toEqual({ available: -1, price: 1 });
    });
  });

  describe('findByCategory', () => {
    test('should find products by category', async () => {
      const categoryProducts = [mockProduct1, mockProduct3];

      mockFindAll.mockResolvedValue(categoryProducts);

      const result = await repository.findByCategory('Booster Box');

      expect(mockFindAll).toHaveBeenCalledWith(
        { category: /Booster Box/i },
        {}
      );
      expect(result).toEqual(categoryProducts);
    });

    test('should find products by category with options', async () => {
      const options = { limit: 10, sort: { price: 1 } };

      mockFindAll.mockResolvedValue([mockProduct1]);

      const result = await repository.findByCategory('Booster', options);

      expect(mockFindAll).toHaveBeenCalledWith(
        { category: /Booster/i },
        options
      );
      expect(result).toEqual([mockProduct1]);
    });

    test('should handle category search errors', async () => {
      const error = new Error('Database connection error');

      mockFindAll.mockRejectedValue(error);

      await expect(repository.findByCategory('Booster Box')).rejects.toThrow(
        'Database connection error'
      );
    });

    test('should handle case-insensitive category search', async () => {
      mockFindAll.mockResolvedValue([mockProduct1]);

      await repository.findByCategory('booster box');

      expect(mockFindAll).toHaveBeenCalledWith(
        { category: /booster box/i },
        {}
      );
    });
  });

  describe('findBySetName', () => {
    test('should find products by set name', async () => {
      const setProducts = [mockProduct1, mockProduct3];

      mockFindAll.mockResolvedValue(setProducts);

      const result = await repository.findBySetName('Base Set');

      expect(mockFindAll).toHaveBeenCalledWith(
        { setName: /Base Set/i },
        {}
      );
      expect(result).toEqual(setProducts);
    });

    test('should find products by partial set name', async () => {
      mockFindAll.mockResolvedValue([mockProduct2]);

      const result = await repository.findBySetName('Rocket');

      expect(mockFindAll).toHaveBeenCalledWith(
        { setName: /Rocket/i },
        {}
      );
      expect(result).toEqual([mockProduct2]);
    });

    test('should handle set name search with options', async () => {
      const options = { limit: 5, sort: { name: 1 } };

      mockFindAll.mockResolvedValue([mockProduct1]);

      await repository.findBySetName('Base', options);

      expect(mockFindAll).toHaveBeenCalledWith(
        { setName: /Base/i },
        options
      );
    });

    test('should handle set name search errors', async () => {
      const error = new Error('Search failed');

      mockFindAll.mockRejectedValue(error);

      await expect(repository.findBySetName('Base Set')).rejects.toThrow(
        'Search failed'
      );
    });
  });

  describe('findAvailable', () => {
    test('should find available products only', async () => {
      const availableProducts = [mockProduct1, mockProduct2];

      mockFindAll.mockResolvedValue(availableProducts);

      const result = await repository.findAvailable();

      expect(mockFindAll).toHaveBeenCalledWith(
        { available: { $gt: 0 } },
        { sort: { available: -1, price: 1 } }
      );
      expect(result).toEqual(availableProducts);
    });

    test('should find available products with custom options', async () => {
      const options = { limit: 20 };

      mockFindAll.mockResolvedValue([mockProduct1]);

      const result = await repository.findAvailable(options);

      expect(mockFindAll).toHaveBeenCalledWith(
        { available: { $gt: 0 } },
        { ...options, sort: { available: -1, price: 1 } }
      );
      expect(result).toEqual([mockProduct1]);
    });

    test('should handle available products search errors', async () => {
      const error = new Error('Query failed');

      mockFindAll.mockRejectedValue(error);

      await expect(repository.findAvailable()).rejects.toThrow('Query failed');
    });
  });

  describe('findByPriceRange', () => {
    test('should find products within price range', async () => {
      const priceRangeResults = [
        { ...mockProduct2, priceNumeric: 350 },
        { ...mockProduct1, priceNumeric: 12500 },
      ];

      mockAggregate.mockResolvedValue(priceRangeResults);

      const result = await repository.findByPriceRange(300, 15000);

      expect(mockAggregate).toHaveBeenCalledWith([
        {
          $addFields: {
            priceNumeric: { $toDouble: '$price' },
          },
        },
        {
          $match: {
            priceNumeric: { $gte: 300, $lte: 15000 },
          },
        },
        {
          $sort: { priceNumeric: 1 },
        },
      ]);
      expect(result).toEqual(priceRangeResults);
    });

    test('should find products with custom sort options', async () => {
      const options = { sort: { available: -1 } };

      mockAggregate.mockResolvedValue([mockProduct1]);

      await repository.findByPriceRange(100, 1000, options);

      expect(mockAggregate).toHaveBeenCalledWith([
        {
          $addFields: {
            priceNumeric: { $toDouble: '$price' },
          },
        },
        {
          $match: {
            priceNumeric: { $gte: 100, $lte: 1000 },
          },
        },
        {
          $sort: { available: -1 },
        },
      ]);
    });

    test('should apply limit when provided', async () => {
      const options = { limit: 5 };

      mockAggregate.mockResolvedValue([mockProduct2]);

      await repository.findByPriceRange(0, 500, options);

      expect(mockAggregate).toHaveBeenCalledWith([
        expect.any(Object),
        expect.any(Object),
        expect.any(Object),
        { $limit: 5 },
      ]);
    });

    test('should throw ValidationError for negative prices', async () => {
      await expect(repository.findByPriceRange(-100, 500)).rejects.toThrow(
        ValidationError
      );
      await expect(repository.findByPriceRange(-100, 500)).rejects.toThrow(
        'Price values must be non-negative'
      );

      await expect(repository.findByPriceRange(100, -500)).rejects.toThrow(
        ValidationError
      );
      await expect(repository.findByPriceRange(100, -500)).rejects.toThrow(
        'Price values must be non-negative'
      );
    });

    test('should throw ValidationError when minPrice > maxPrice', async () => {
      await expect(repository.findByPriceRange(1000, 500)).rejects.toThrow(
        ValidationError
      );
      await expect(repository.findByPriceRange(1000, 500)).rejects.toThrow(
        'Minimum price cannot be greater than maximum price'
      );
    });

    test('should handle price range query errors', async () => {
      const error = new Error('Aggregation failed');

      mockAggregate.mockRejectedValue(error);

      await expect(repository.findByPriceRange(100, 500)).rejects.toThrow(
        'Aggregation failed'
      );
    });
  });

  describe('searchAdvanced', () => {
    test('should perform advanced search with query only', async () => {
      const searchResults = [
        { ...mockProduct1, priceNumeric: 12500, score: 150 },
        { ...mockProduct2, priceNumeric: 350, score: 80 },
      ];

      mockAggregate.mockResolvedValue(searchResults);

      const result = await repository.searchAdvanced('Base Set');

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $addFields: { priceNumeric: { $toDouble: '$price' } },
          }),
          expect.objectContaining({
            $match: {
              $or: [
                { name: { $regex: 'Base Set', $options: 'i' } },
                { setName: { $regex: 'Base Set', $options: 'i' } },
                { category: { $regex: 'Base Set', $options: 'i' } },
              ],
            },
          }),
          expect.objectContaining({
            $addFields: {
              score: expect.any(Object),
            },
          }),
          expect.objectContaining({
            $sort: { score: -1, available: -1, priceNumeric: 1 },
          }),
        ])
      );
      expect(result).toEqual(searchResults);
    });

    test('should perform advanced search with category filter', async () => {
      const filters = { category: 'Booster Box' };

      mockAggregate.mockResolvedValue([mockProduct1]);

      await repository.searchAdvanced('Base', filters);

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: {
              $and: [
                {
                  $or: [
                    { name: { $regex: 'Base', $options: 'i' } },
                    { setName: { $regex: 'Base', $options: 'i' } },
                    { category: { $regex: 'Base', $options: 'i' } },
                  ],
                },
                { category: /Booster Box/i },
              ],
            },
          }),
        ])
      );
    });

    test('should perform advanced search with price range filter', async () => {
      const filters = { priceRange: { min: 100, max: 1000 } };

      mockAggregate.mockResolvedValue([mockProduct2]);

      await repository.searchAdvanced('Booster', filters);

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: {
              $and: [
                expect.any(Object),
                { priceNumeric: { $gte: 100, $lte: 1000 } },
              ],
            },
          }),
        ])
      );
    });

    test('should perform advanced search with availability filter', async () => {
      const filters = { availableOnly: true };

      mockAggregate.mockResolvedValue([mockProduct1, mockProduct2]);

      await repository.searchAdvanced('Pokemon', filters);

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: {
              $and: [
                expect.any(Object),
                { available: { $gt: 0 } },
              ],
            },
          }),
        ])
      );
    });

    test('should perform advanced search with minimum availability filter', async () => {
      const filters = { minAvailable: 10 };

      mockAggregate.mockResolvedValue([mockProduct2]);

      await repository.searchAdvanced('Pack', filters);

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: {
              $and: [
                expect.any(Object),
                { available: { $gte: 10 } },
              ],
            },
          }),
        ])
      );
    });

    test('should perform advanced search with lastUpdatedAfter filter', async () => {
      const lastUpdatedAfter = new Date('2024-01-15');
      const filters = { lastUpdatedAfter: lastUpdatedAfter.toISOString() };

      mockAggregate.mockResolvedValue([mockProduct1, mockProduct2]);

      await repository.searchAdvanced('Set', filters);

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: {
              $and: [
                expect.any(Object),
                { lastUpdated: { $gte: lastUpdatedAfter } },
              ],
            },
          }),
        ])
      );
    });

    test('should perform advanced search with limit', async () => {
      const filters = { limit: 5 };

      mockAggregate.mockResolvedValue([mockProduct1]);

      await repository.searchAdvanced('Charizard', filters);

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          { $limit: 5 },
        ])
      );
    });

    test('should perform search without query (filters only)', async () => {
      const filters = { category: 'Theme Deck' };

      mockAggregate.mockResolvedValue([mockProduct3]);

      await repository.searchAdvanced('', filters);

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $sort: { available: -1, price: 1 },
          }),
        ])
      );
    });

    test('should handle advanced search errors', async () => {
      const error = new Error('Advanced search failed');

      mockAggregate.mockRejectedValue(error);

      await expect(
        repository.searchAdvanced('Pikachu', { category: 'Card' })
      ).rejects.toThrow('Advanced search failed');
    });
  });

  describe('getCategories', () => {
    test('should get available categories with statistics', async () => {
      const mockCategories = [
        {
          category: 'Booster Box',
          count: 15,
          totalAvailable: 75,
          averagePrice: 8500.25,
        },
        {
          category: 'Booster Pack',
          count: 120,
          totalAvailable: 850,
          averagePrice: 285.50,
        },
        {
          category: 'Theme Deck',
          count: 25,
          totalAvailable: 30,
          averagePrice: 4200.00,
        },
      ];

      mockAggregate.mockResolvedValue(mockCategories);

      const result = await repository.getCategories();

      expect(mockAggregate).toHaveBeenCalledWith([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            totalAvailable: { $sum: '$available' },
            averagePrice: { $avg: { $toDouble: '$price' } },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            totalAvailable: 1,
            averagePrice: { $round: ['$averagePrice', 2] },
            _id: 0,
          },
        },
      ]);
      expect(result).toEqual(mockCategories);
    });

    test('should handle getCategories errors', async () => {
      const error = new Error('Categories aggregation failed');

      mockAggregate.mockRejectedValue(error);

      await expect(repository.getCategories()).rejects.toThrow(
        'Categories aggregation failed'
      );
    });
  });

  describe('getSetNames', () => {
    test('should get available set names with statistics', async () => {
      const mockSetNames = [
        {
          setName: 'Base Set',
          count: 45,
          totalAvailable: 200,
          averagePrice: 6750.50,
          categoryCount: 5,
        },
        {
          setName: 'Team Rocket',
          count: 30,
          totalAvailable: 150,
          averagePrice: 3200.25,
          categoryCount: 4,
        },
      ];

      mockAggregate.mockResolvedValue(mockSetNames);

      const result = await repository.getSetNames();

      expect(mockAggregate).toHaveBeenCalledWith([
        {
          $group: {
            _id: '$setName',
            count: { $sum: 1 },
            totalAvailable: { $sum: '$available' },
            averagePrice: { $avg: { $toDouble: '$price' } },
            categories: { $addToSet: '$category' },
          },
        },
        {
          $sort: { count: -1 },
        },
        {
          $project: {
            setName: '$_id',
            count: 1,
            totalAvailable: 1,
            averagePrice: { $round: ['$averagePrice', 2] },
            categoryCount: { $size: '$categories' },
            _id: 0,
          },
        },
      ]);
      expect(result).toEqual(mockSetNames);
    });

    test('should handle getSetNames errors', async () => {
      const error = new Error('Set names aggregation failed');

      mockAggregate.mockRejectedValue(error);

      await expect(repository.getSetNames()).rejects.toThrow(
        'Set names aggregation failed'
      );
    });
  });

  describe('getProductStatistics', () => {
    test('should get comprehensive product statistics', async () => {
      const mockStats = {
        totalProducts: 250,
        totalAvailable: 1500,
        averagePrice: 4250.75,
        minPrice: 25.00,
        maxPrice: 25000.00,
        uniqueCategoryCount: 8,
        uniqueSetNameCount: 15,
        availableProducts: 180,
        availabilityPercentage: 72.00,
        recentlyUpdated: 45,
      };

      mockAggregate.mockResolvedValue([mockStats]);

      const result = await repository.getProductStatistics();

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $group: {
              _id: null,
              totalProducts: { $sum: 1 },
              totalAvailable: { $sum: '$available' },
              averagePrice: { $avg: { $toDouble: '$price' } },
              minPrice: { $min: { $toDouble: '$price' } },
              maxPrice: { $max: { $toDouble: '$price' } },
              uniqueCategories: { $addToSet: '$category' },
              uniqueSetNames: { $addToSet: '$setName' },
              availableProducts: {
                $sum: { $cond: [{ $gt: ['$available', 0] }, 1, 0] },
              },
              recentlyUpdated: expect.any(Object),
            },
          }),
          expect.objectContaining({
            $addFields: {
              uniqueCategoryCount: { $size: '$uniqueCategories' },
              uniqueSetNameCount: { $size: '$uniqueSetNames' },
              availabilityPercentage: expect.any(Object),
            },
          }),
          expect.objectContaining({
            $project: {
              _id: 0,
              totalProducts: 1,
              totalAvailable: 1,
              averagePrice: { $round: ['$averagePrice', 2] },
              minPrice: { $round: ['$minPrice', 2] },
              maxPrice: { $round: ['$maxPrice', 2] },
              uniqueCategoryCount: 1,
              uniqueSetNameCount: 1,
              availableProducts: 1,
              availabilityPercentage: { $round: ['$availabilityPercentage', 2] },
              recentlyUpdated: 1,
            },
          }),
        ])
      );
      expect(result).toEqual(mockStats);
    });

    test('should return empty object when no statistics available', async () => {
      mockAggregate.mockResolvedValue([]);

      const result = await repository.getProductStatistics();

      expect(result).toEqual({});
    });

    test('should handle getProductStatistics errors', async () => {
      const error = new Error('Statistics aggregation failed');

      mockAggregate.mockRejectedValue(error);

      await expect(repository.getProductStatistics()).rejects.toThrow(
        'Statistics aggregation failed'
      );
    });
  });

  describe('getProfitAnalysis', () => {
    test('should get profit analysis by category', async () => {
      const mockAnalysis = [
        {
          category: 'Booster Box',
          productCount: 20,
          totalAvailable: 100,
          averagePrice: 12500.00,
          minPrice: 8000.00,
          maxPrice: 25000.00,
          priceRange: 17000.00,
          availabilityRate: 0.8000,
          priceVolatility: 1.3600,
        },
        {
          category: 'Booster Pack',
          productCount: 150,
          totalAvailable: 800,
          averagePrice: 350.50,
          minPrice: 125.00,
          maxPrice: 750.00,
          priceRange: 625.00,
          availabilityRate: 0.9000,
          priceVolatility: 1.7835,
        },
      ];

      mockAggregate.mockResolvedValue(mockAnalysis);

      const result = await repository.getProfitAnalysis();

      expect(mockAggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $addFields: {
              priceNumeric: { $toDouble: '$price' },
            },
          }),
          expect.objectContaining({
            $group: {
              _id: '$category',
              productCount: { $sum: 1 },
              totalAvailable: { $sum: '$available' },
              averagePrice: { $avg: '$priceNumeric' },
              minPrice: { $min: '$priceNumeric' },
              maxPrice: { $max: '$priceNumeric' },
              priceRange: {
                $subtract: [{ $max: '$priceNumeric' }, { $min: '$priceNumeric' }],
              },
              availableProducts: {
                $sum: { $cond: [{ $gt: ['$available', 0] }, 1, 0] },
              },
            },
          }),
          expect.objectContaining({
            $addFields: {
              availabilityRate: expect.any(Object),
              priceVolatility: expect.any(Object),
            },
          }),
          expect.objectContaining({
            $sort: { averagePrice: -1 },
          }),
          expect.objectContaining({
            $project: {
              category: '$_id',
              productCount: 1,
              totalAvailable: 1,
              averagePrice: { $round: ['$averagePrice', 2] },
              minPrice: { $round: ['$minPrice', 2] },
              maxPrice: { $round: ['$maxPrice', 2] },
              priceRange: { $round: ['$priceRange', 2] },
              availabilityRate: { $round: ['$availabilityRate', 4] },
              priceVolatility: { $round: ['$priceVolatility', 4] },
              _id: 0,
            },
          }),
        ])
      );
      expect(result).toEqual(mockAnalysis);
    });

    test('should handle getProfitAnalysis errors', async () => {
      const error = new Error('Profit analysis failed');

      mockAggregate.mockRejectedValue(error);

      await expect(repository.getProfitAnalysis()).rejects.toThrow(
        'Profit analysis failed'
      );
    });
  });

  describe('getSuggestions', () => {
    test('should get product suggestions for autocomplete', async () => {
      const searchResults = [
        { ...mockProduct1, priceNumeric: 12500 },
        { ...mockProduct2, priceNumeric: 350 },
      ];

      mockAggregate.mockResolvedValue(searchResults);

      const result = await repository.getSuggestions('Base');

      expect(result).toEqual([
        {
          id: mockProduct1._id,
          text: mockProduct1.name,
          secondaryText: mockProduct1.setName,
          metadata: {
            category: mockProduct1.category,
            price: mockProduct1.price,
            priceNumeric: 12500,
            available: mockProduct1.available,
            setName: mockProduct1.setName,
            isAvailable: true,
          },
        },
        {
          id: mockProduct2._id,
          text: mockProduct2.name,
          secondaryText: mockProduct2.setName,
          metadata: {
            category: mockProduct2.category,
            price: mockProduct2.price,
            priceNumeric: 350,
            available: mockProduct2.available,
            setName: mockProduct2.setName,
            isAvailable: true,
          },
        },
      ]);
    });

    test('should get suggestions with custom limit', async () => {
      const options = { limit: 5 };

      mockAggregate.mockResolvedValue([mockProduct1]);

      await repository.getSuggestions('Charizard', options);

      // Verify that searchAdvanced was called with the correct limit
      expect(mockAggregate).toHaveBeenCalled();
    });

    test('should handle getSuggestions errors', async () => {
      const error = new Error('Suggestions search failed');

      mockAggregate.mockRejectedValue(error);

      await expect(repository.getSuggestions('Pokemon')).rejects.toThrow(
        'Suggestions search failed'
      );
    });
  });

  describe('getRecentlyUpdated', () => {
    test('should get recently updated products', async () => {
      const recentProducts = [mockProduct2, mockProduct1];

      mockFindAll.mockResolvedValue(recentProducts);

      const result = await repository.getRecentlyUpdated(7);

      const expectedDateThreshold = new Date();

      expectedDateThreshold.setDate(expectedDateThreshold.getDate() - 7);

      expect(mockFindAll).toHaveBeenCalledWith(
        {
          lastUpdated: { $gte: expect.any(Date) },
        },
        {
          sort: { lastUpdated: -1 },
        }
      );
      expect(result).toEqual(recentProducts);
    });

    test('should get recently updated products with custom days and options', async () => {
      const options = { limit: 20 };

      mockFindAll.mockResolvedValue([mockProduct1]);

      const result = await repository.getRecentlyUpdated(14, options);

      expect(mockFindAll).toHaveBeenCalledWith(
        {
          lastUpdated: { $gte: expect.any(Date) },
        },
        {
          ...options,
          sort: { lastUpdated: -1 },
        }
      );
      expect(result).toEqual([mockProduct1]);
    });

    test('should handle getRecentlyUpdated errors', async () => {
      const error = new Error('Recent products query failed');

      mockFindAll.mockRejectedValue(error);

      await expect(repository.getRecentlyUpdated()).rejects.toThrow(
        'Recent products query failed'
      );
    });
  });

  describe('getLowStockProducts', () => {
    test('should get low stock products with default threshold', async () => {
      const lowStockProducts = [
        { ...mockProduct1, available: 5 },
        { ...mockProduct3, available: 3 },
      ];

      mockFindAll.mockResolvedValue(lowStockProducts);

      const result = await repository.getLowStockProducts();

      expect(mockFindAll).toHaveBeenCalledWith(
        {
          available: { $gt: 0, $lte: 5 },
        },
        {
          sort: { available: 1, price: 1 },
        }
      );
      expect(result).toEqual(lowStockProducts);
    });

    test('should get low stock products with custom threshold', async () => {
      const threshold = 10;
      const options = { limit: 15 };

      mockFindAll.mockResolvedValue([mockProduct1]);

      const result = await repository.getLowStockProducts(threshold, options);

      expect(mockFindAll).toHaveBeenCalledWith(
        {
          available: { $gt: 0, $lte: 10 },
        },
        {
          ...options,
          sort: { available: 1, price: 1 },
        }
      );
      expect(result).toEqual([mockProduct1]);
    });

    test('should handle getLowStockProducts errors', async () => {
      const error = new Error('Low stock query failed');

      mockFindAll.mockRejectedValue(error);

      await expect(repository.getLowStockProducts()).rejects.toThrow(
        'Low stock query failed'
      );
    });
  });

  describe('getProductsByPriceTier', () => {
    test('should get products by low price tier', async () => {
      const lowTierProducts = [mockProduct2];

      mockAggregate.mockResolvedValue(lowTierProducts);

      const result = await repository.getProductsByPriceTier('low');

      // Verify findByPriceRange was called with correct low tier range
      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toEqual(lowTierProducts);
    });

    test('should get products by medium price tier', async () => {
      mockAggregate.mockResolvedValue([]);

      await repository.getProductsByPriceTier('medium');

      expect(mockAggregate).toHaveBeenCalled();
    });

    test('should get products by high price tier', async () => {
      mockAggregate.mockResolvedValue([]);

      await repository.getProductsByPriceTier('high');

      expect(mockAggregate).toHaveBeenCalled();
    });

    test('should get products by premium price tier', async () => {
      const premiumProducts = [mockProduct1];

      mockAggregate.mockResolvedValue(premiumProducts);

      const result = await repository.getProductsByPriceTier('premium');

      expect(mockAggregate).toHaveBeenCalled();
      expect(result).toEqual(premiumProducts);
    });

    test('should handle case-insensitive price tiers', async () => {
      mockAggregate.mockResolvedValue([]);

      await repository.getProductsByPriceTier('LOW');
      await repository.getProductsByPriceTier('Medium');
      await repository.getProductsByPriceTier('HIGH');
      await repository.getProductsByPriceTier('Premium');

      expect(mockAggregate).toHaveBeenCalledTimes(4);
    });

    test('should throw ValidationError for invalid price tier', async () => {
      await expect(
        repository.getProductsByPriceTier('invalid')
      ).rejects.toThrow(ValidationError);
      await expect(
        repository.getProductsByPriceTier('invalid')
      ).rejects.toThrow('Unknown price tier: invalid');
    });

    test('should get products by price tier with options', async () => {
      const options = { limit: 10, sort: { name: 1 } };

      mockAggregate.mockResolvedValue([mockProduct2]);

      await repository.getProductsByPriceTier('low', options);

      expect(mockAggregate).toHaveBeenCalled();
    });

    test('should handle getProductsByPriceTier errors', async () => {
      const error = new Error('Price tier query failed');

      mockAggregate.mockRejectedValue(error);

      await expect(repository.getProductsByPriceTier('medium')).rejects.toThrow(
        'Price tier query failed'
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty search queries gracefully', async () => {
      mockAggregate.mockResolvedValue([]);

      const result = await repository.searchAdvanced('');

      expect(result).toEqual([]);
    });

    test('should handle null and undefined parameters', async () => {
      mockFindAll.mockResolvedValue([]);

      await repository.findByCategory(null);
      await repository.findBySetName(undefined);

      expect(mockFindAll).toHaveBeenCalledTimes(2);
    });

    test('should handle aggregation pipeline failures', async () => {
      const pipelineError = new Error('Pipeline execution failed');

      mockAggregate.mockRejectedValue(pipelineError);

      await expect(repository.getCategories()).rejects.toThrow(
        'Pipeline execution failed'
      );
    });

    test('should handle invalid date ranges', async () => {
      const invalidDate = 'invalid-date';

      mockFindAll.mockResolvedValue([]);

      // Should not throw but should handle gracefully
      const result = await repository.getRecentlyUpdated(invalidDate);

      expect(result).toEqual([]);
    });
  });

  describe('Performance and Optimization', () => {
    test('should use efficient aggregation pipelines', async () => {
      mockAggregate.mockResolvedValue([]);

      await repository.searchAdvanced('test', {
        category: 'Booster',
        priceRange: { min: 100, max: 500 },
        availableOnly: true,
      });

      // Verify pipeline structure for performance
      const callArgs = mockAggregate.mock.calls[0][0];

      expect(callArgs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ $addFields: expect.any(Object) }),
          expect.objectContaining({ $match: expect.any(Object) }),
          expect.objectContaining({ $sort: expect.any(Object) }),
        ])
      );
    });

    test('should apply appropriate limits for large datasets', async () => {
      const largeLimit = 1000;

      mockAggregate.mockResolvedValue([]);

      await repository.searchAdvanced('pokemon', { limit: largeLimit });

      const callArgs = mockAggregate.mock.calls[0][0];

      expect(callArgs).toEqual(
        expect.arrayContaining([
          { $limit: largeLimit },
        ])
      );
    });
  });
});