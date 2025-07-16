const CollectionService = require('../../services/domain/CollectionService');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');
const { createMockPsaGradedCard, createMockSoldPsaCard, createMockCollectionStats } = require('../helpers/real-mock-data.helper');
const mongoose = require('mongoose');

describe('CollectionService', () => {
  let collectionService;
  let mockRepository;

  beforeEach(() => {
    // Mock repository
    mockRepository = {
      findAll: jest.fn(),
      findWithPagination: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getStatistics: jest.fn(),
      search: jest.fn(),
      findSold: jest.fn(),
      findUnsold: jest.fn(),
      getTotalValue: jest.fn(),
    };

    // Create service instance
    collectionService = new CollectionService(mockRepository, {
      entityName: 'TestItem',
      enableSaleTracking: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct repository and options', () => {
      expect(collectionService.repository).toBe(mockRepository);
      expect(collectionService.options.entityName).toBe('TestItem');
      expect(collectionService.options.enableSaleTracking).toBe(true);
    });

    test('should use default options when not provided', () => {
      const defaultService = new CollectionService(mockRepository);

      expect(defaultService.options.entityName).toBe('CollectionItem');
      expect(defaultService.options.enableSaleTracking).toBe(true);
    });
  });

  describe('getAll', () => {
    test('should get all items successfully', async () => {
      const mockItems = [
        createMockPsaGradedCard(),
        createMockPsaGradedCard(new mongoose.Types.ObjectId(), {
          grade: 'PSA 10',
          myPrice: mongoose.Types.Decimal128.fromString('5000.00')
        }),
      ];

      mockRepository.findAll.mockResolvedValue(mockItems);

      const filters = { sold: false };
      const options = { limit: 10, sort: { dateAdded: -1 } };

      const result = await collectionService.getAll(filters, options);

      expect(mockRepository.findAll).toHaveBeenCalledWith(filters, options);
      expect(result).toEqual(mockItems);
    });

    test('should handle repository errors', async () => {
      const error = new Error('Repository error');

      mockRepository.findAll.mockRejectedValue(error);

      await expect(collectionService.getAll()).rejects.toThrow('Repository error');
    });
  });

  describe('getAllWithPagination', () => {
    test('should get paginated items successfully', async () => {
      const mockResult = {
        data: [createMockPsaGradedCard()],
        pagination: { 
          page: 1, 
          totalPages: 3, 
          totalItems: 25,
          limit: 10,
          hasNext: true,
          hasPrev: false
        },
      };

      mockRepository.findWithPagination.mockResolvedValue(mockResult);

      const result = await collectionService.getAllWithPagination({ sold: false }, { page: 1, limit: 10 });

      expect(mockRepository.findWithPagination).toHaveBeenCalledWith({ sold: false }, { page: 1, limit: 10 });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getById', () => {
    test('should get item by ID successfully', async () => {
      const itemId = new mongoose.Types.ObjectId();
      const mockItem = createMockPsaGradedCard(new mongoose.Types.ObjectId(), { _id: itemId });

      mockRepository.findById.mockResolvedValue(mockItem);

      const result = await collectionService.getById(itemId.toString());

      expect(mockRepository.findById).toHaveBeenCalledWith(itemId.toString(), {});
      expect(result).toEqual(mockItem);
    });

    test('should pass options to repository', async () => {
      const itemId = new mongoose.Types.ObjectId();
      const mockItem = createMockPsaGradedCard(new mongoose.Types.ObjectId(), { _id: itemId });

      mockRepository.findById.mockResolvedValue(mockItem);

      const options = { populate: 'cardId' };

      await collectionService.getById(itemId.toString(), options);

      expect(mockRepository.findById).toHaveBeenCalledWith(itemId.toString(), options);
    });
  });

  describe('create', () => {
    test('should create item successfully with default fields', async () => {
      const cardId = new mongoose.Types.ObjectId();
      const itemData = { 
        cardId,
        grade: 'PSA 9',
        images: ['image-1752151241475-235568771.jpg']
      };
      const mockCreatedItem = createMockPsaGradedCard(cardId, itemData);

      mockRepository.create.mockResolvedValue(mockCreatedItem);

      const result = await collectionService.create(itemData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId,
          grade: 'PSA 9',
          images: ['image-1752151241475-235568771.jpg'],
          sold: false,
          dateAdded: expect.any(Date),
          priceHistory: [],
        }),
        {}
      );
      expect(result).toEqual(mockCreatedItem);
    });

    test('should create item with price history when myPrice provided', async () => {
      const cardId = new mongoose.Types.ObjectId();
      const itemData = { 
        cardId,
        grade: 'PSA 10',
        myPrice: 5000.00
      };
      const mockCreatedItem = createMockPsaGradedCard(cardId, itemData);

      mockRepository.create.mockResolvedValue(mockCreatedItem);

      await collectionService.create(itemData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId,
          grade: 'PSA 10',
          myPrice: 5000.00,
          sold: false,
          dateAdded: expect.any(Date),
          priceHistory: [
            {
              price: 5000.00,
              dateUpdated: expect.any(Date),
            },
          ],
        }),
        {}
      );
    });

    test('should validate create data', async () => {
      await expect(collectionService.create(null)).rejects.toThrow(ValidationError);
      await expect(collectionService.create(null)).rejects.toThrow('Item data is required');
    });

    test('should validate price when provided', async () => {
      const invalidPriceData = { 
        cardId: new mongoose.Types.ObjectId(),
        grade: 'PSA 9',
        myPrice: -10 
      };
      
      await expect(collectionService.create(invalidPriceData)).rejects.toThrow(ValidationError);
      await expect(collectionService.create(invalidPriceData)).rejects.toThrow('Price must be a non-negative number');
    });

    test('should validate images array', async () => {
      const invalidImagesData = { 
        cardId: new mongoose.Types.ObjectId(),
        grade: 'PSA 9',
        images: 'not-an-array' 
      };
      
      await expect(collectionService.create(invalidImagesData)).rejects.toThrow(ValidationError);
      await expect(collectionService.create(invalidImagesData)).rejects.toThrow('Images must be an array');
    });
  });

  describe('update', () => {
    test('should update item successfully', async () => {
      const itemId = new mongoose.Types.ObjectId();
      const cardId = new mongoose.Types.ObjectId();
      const existingItem = createMockPsaGradedCard(cardId, {
        _id: itemId,
        myPrice: mongoose.Types.Decimal128.fromString('2000.00'),
        priceHistory: [{ 
          price: mongoose.Types.Decimal128.fromString('2000.00'), 
          dateUpdated: new Date('2024-01-01') 
        }]
      });
      const updateData = { 
        images: ['image-1752151241475-235568771.jpg', 'image-new-update.jpg'] 
      };
      const mockUpdatedItem = { ...existingItem, ...updateData };

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.update.mockResolvedValue(mockUpdatedItem);

      const result = await collectionService.update(itemId.toString(), updateData);

      expect(mockRepository.findById).toHaveBeenCalledWith(itemId.toString());
      expect(mockRepository.update).toHaveBeenCalledWith(itemId.toString(), updateData, {});
      expect(result).toEqual(mockUpdatedItem);
    });

    test('should update price history when price changes', async () => {
      const itemId = new mongoose.Types.ObjectId();
      const cardId = new mongoose.Types.ObjectId();
      const existingItem = createMockPsaGradedCard(cardId, {
        _id: itemId,
        myPrice: mongoose.Types.Decimal128.fromString('2000.00'),
        priceHistory: [{ 
          price: mongoose.Types.Decimal128.fromString('2000.00'), 
          dateUpdated: new Date('2024-01-01') 
        }]
      });
      const updateData = { 
        myPrice: mongoose.Types.Decimal128.fromString('2500.00') 
      };

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.update.mockResolvedValue({ ...existingItem, ...updateData });

      await collectionService.update(itemId.toString(), updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(
        itemId.toString(),
        expect.objectContaining({
          myPrice: mongoose.Types.Decimal128.fromString('2500.00'),
          priceHistory: [
            { 
              price: mongoose.Types.Decimal128.fromString('2000.00'), 
              dateUpdated: expect.any(Date) 
            },
            { 
              price: mongoose.Types.Decimal128.fromString('2500.00'), 
              dateUpdated: expect.any(Date) 
            },
          ],
        }),
        {}
      );
    });

    test('should not update price history when price stays the same', async () => {
      const itemId = new mongoose.Types.ObjectId();
      const cardId = new mongoose.Types.ObjectId();
      const existingItem = createMockPsaGradedCard(cardId, {
        _id: itemId,
        myPrice: mongoose.Types.Decimal128.fromString('2000.00'),
        priceHistory: [{ 
          price: mongoose.Types.Decimal128.fromString('2000.00'), 
          dateUpdated: new Date('2024-01-01') 
        }]
      });
      const updateData = { 
        images: ['new-image.jpg']
      };

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.update.mockResolvedValue({ ...existingItem, ...updateData });

      await collectionService.update(itemId.toString(), updateData);

      expect(mockRepository.update).toHaveBeenCalledWith(
        itemId.toString(),
        { 
          images: ['new-image.jpg']
        },
        {}
      );
    });
  });

  describe('delete', () => {
    test('should delete item successfully', async () => {
      const mockItem = { id: '123', name: 'Deleted Item', images: [] };
      const mockDeletedItem = { id: '123', name: 'Deleted Item' };

      mockRepository.findById.mockResolvedValue(mockItem);
      mockRepository.delete.mockResolvedValue(mockDeletedItem);

      const result = await collectionService.delete('123');

      expect(mockRepository.findById).toHaveBeenCalledWith('123');
      expect(mockRepository.delete).toHaveBeenCalledWith('123');
      expect(result).toEqual(mockDeletedItem);
    });
  });

  describe('markAsSold', () => {
    test('should mark item as sold successfully', async () => {
      const saleDetails = {
        paymentMethod: 'CASH',
        actualSoldPrice: 2400.00,
        deliveryMethod: 'Local Meetup',
        source: 'Facebook',
        buyerFullName: 'John Doe',
      };
      const existingItem = { id: '123', name: 'Item', sold: false };
      const mockSoldItem = { id: '123', name: 'Sold Item', sold: true };

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.update.mockResolvedValue(mockSoldItem);

      const result = await collectionService.markAsSold('123', saleDetails);

      expect(mockRepository.findById).toHaveBeenCalledWith('123');
      expect(mockRepository.update).toHaveBeenCalledWith('123', {
        sold: true,
        saleDetails: {
          ...saleDetails,
          dateSold: expect.any(Date),
        },
      });
      expect(result).toEqual(mockSoldItem);
    });

    test('should throw error when sale tracking is disabled', async () => {
      const serviceWithoutSales = new CollectionService(mockRepository, {
        enableSaleTracking: false,
      });

      await expect(
        serviceWithoutSales.markAsSold('123', {})
      ).rejects.toThrow('Sale tracking is not enabled for this collection type');
    });
  });

  describe('markAsUnsold', () => {
    test('should mark item as unsold successfully', async () => {
      const itemId = new mongoose.Types.ObjectId();
      const cardId = new mongoose.Types.ObjectId();
      const existingItem = createMockSoldPsaCard(cardId, { _id: itemId });
      const mockUnsoldItem = { ...existingItem, sold: false };

      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.update.mockResolvedValue(mockUnsoldItem);

      const result = await collectionService.markAsUnsold(itemId.toString());

      expect(mockRepository.update).toHaveBeenCalledWith(itemId.toString(), {
        sold: false,
        saleDetails: {
          dateSold: null,
          paymentMethod: null,
          actualSoldPrice: null,
          deliveryMethod: null,
          source: null,
          buyerFullName: null,
          buyerAddress: null,
          buyerPhoneNumber: null,
          buyerEmail: null,
          trackingNumber: null,
        },
      });
      expect(result).toEqual(mockUnsoldItem);
    });

    test('should throw error when item is not sold', async () => {
      const itemId = new mongoose.Types.ObjectId();
      const cardId = new mongoose.Types.ObjectId();
      const existingItem = createMockPsaGradedCard(cardId, { _id: itemId, sold: false });

      mockRepository.findById.mockResolvedValue(existingItem);

      await expect(collectionService.markAsUnsold(itemId.toString())).rejects.toThrow(
        'TestItem is not marked as sold'
      );
    });
  });

  describe('search', () => {
    test('should search items successfully', async () => {
      const cardId = new mongoose.Types.ObjectId();
      const mockResults = [
        createMockPsaGradedCard(cardId, {
          grade: 'PSA 9',
          myPrice: mongoose.Types.Decimal128.fromString('2500.00')
        })
      ];

      mockRepository.search.mockResolvedValue(mockResults);

      const result = await collectionService.search('pikachu', { limit: 10 });

      expect(mockRepository.search).toHaveBeenCalledWith('pikachu', { limit: 10 });
      expect(result).toEqual(mockResults);
    });

    test('should validate search term', async () => {
      await expect(collectionService.search('')).rejects.toThrow('Search term is required');
      await expect(collectionService.search('   ')).rejects.toThrow('Search term is required');
      await expect(collectionService.search(null)).rejects.toThrow('Search term is required');
    });

    test('should trim search term', async () => {
      mockRepository.search.mockResolvedValue([]);

      await collectionService.search('  pikachu  ');

      expect(mockRepository.search).toHaveBeenCalledWith('pikachu', {});
    });
  });

  describe('getSoldItems', () => {
    test('should get sold items successfully', async () => {
      const cardId = new mongoose.Types.ObjectId();
      const mockSoldItems = [
        createMockSoldPsaCard(cardId)
      ];

      mockRepository.findSold.mockResolvedValue(mockSoldItems);

      const result = await collectionService.getSoldItems({ limit: 5 });

      expect(mockRepository.findSold).toHaveBeenCalledWith({ limit: 5 });
      expect(result).toEqual(mockSoldItems);
    });
  });

  describe('getUnsoldItems', () => {
    test('should get unsold items successfully', async () => {
      const cardId = new mongoose.Types.ObjectId();
      const mockUnsoldItems = [
        createMockPsaGradedCard(cardId, { sold: false })
      ];

      mockRepository.findUnsold.mockResolvedValue(mockUnsoldItems);

      const result = await collectionService.getUnsoldItems({ limit: 5 });

      expect(mockRepository.findUnsold).toHaveBeenCalledWith({ limit: 5 });
      expect(result).toEqual(mockUnsoldItems);
    });
  });

  describe('getTotalValue', () => {
    test('should get total value successfully', async () => {
      const mockValue = { 
        total: mongoose.Types.Decimal128.fromString('285000.00'), 
        count: 125,
        averageValue: mongoose.Types.Decimal128.fromString('2280.00')
      };

      mockRepository.getTotalValue.mockResolvedValue(mockValue);

      const result = await collectionService.getTotalValue({ sold: false });

      expect(mockRepository.getTotalValue).toHaveBeenCalledWith({ sold: false });
      expect(result).toEqual(mockValue);
    });
  });

  describe('getStatistics', () => {
    test('should get statistics successfully', async () => {
      const mockStats = createMockCollectionStats();

      mockRepository.getStatistics.mockResolvedValue(mockStats);

      const result = await collectionService.getStatistics();

      expect(mockRepository.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });
  });

  describe('Error Handling', () => {
    test('should propagate repository errors', async () => {
      const repositoryError = new NotFoundError('Item not found');

      mockRepository.findById.mockRejectedValue(repositoryError);

      await expect(collectionService.getById('999')).rejects.toThrow(NotFoundError);
      await expect(collectionService.getById('999')).rejects.toThrow('Item not found');
    });

    test('should handle validation errors appropriately', async () => {
      await expect(collectionService.create({ myPrice: 'invalid' })).rejects.toThrow(ValidationError);
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle full item lifecycle', async () => {
      // Create
      const createData = { name: 'Lifecycle Item', myPrice: 100.00 };
      const createdItem = { id: '123', ...createData, sold: false, dateAdded: new Date() };

      mockRepository.create.mockResolvedValue(createdItem);

      const created = await collectionService.create(createData);

      expect(created).toBeDefined();

      // Update
      const updateData = { name: 'Updated Item', myPrice: 150.00 };
      const existingItem = { ...createdItem, priceHistory: [{ price: 100.00, dateUpdated: new Date() }] };
      const updatedItem = { ...existingItem, ...updateData };
      
      mockRepository.findById.mockResolvedValue(existingItem);
      mockRepository.update.mockResolvedValue(updatedItem);

      const updated = await collectionService.update('123', updateData);

      expect(updated).toBeDefined();

      // Mark as sold
      const saleDetails = { 
        paymentMethod: 'CASH', 
        actualSoldPrice: 2500.00, 
        deliveryMethod: 'Local Meetup',
        source: 'DBA',
        buyerFullName: 'Test Buyer'
      };
      const soldItem = { ...updatedItem, sold: true };

      mockRepository.findById.mockResolvedValue(updatedItem);
      mockRepository.update.mockResolvedValue(soldItem);

      const sold = await collectionService.markAsSold('123', saleDetails);

      expect(sold).toBeDefined();

      // Delete
      mockRepository.findById.mockResolvedValue(soldItem);
      mockRepository.delete.mockResolvedValue(soldItem);
      const deleted = await collectionService.delete('123');

      expect(deleted).toBeDefined();
    });
  });
});