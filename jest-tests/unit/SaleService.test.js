const SaleService = require('../../services/shared/saleService');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');
const { createMockPsaGradedCard, createMockSealedProduct } = require('../helpers/real-mock-data.helper');
const mongoose = require('mongoose');

// Mock mongoose model
const mockModel = {
  findById: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
  find: jest.fn(),
  modelName: 'PsaGradedCard',
};

describe('SaleService', () => {
  let mockPsaCard;
  let mockSealedProduct;
  let validSaleDetails;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {
      // Mock console.log for testing - intentionally empty
    });
    jest.spyOn(console, 'error').mockImplementation(() => {
      // Mock console.error for testing - intentionally empty
    });

    // Create realistic mock data
    mockPsaCard = createMockPsaGradedCard();
    mockSealedProduct = createMockSealedProduct();

    validSaleDetails = {
      paymentMethod: 'CASH',
      actualSoldPrice: 2400.00,
      deliveryMethod: 'Local Meetup',
      source: 'Facebook',
      buyerFullName: 'John Doe',
      buyerAddress: '123 Main St, City, State 12345',
      buyerPhoneNumber: '+1-555-123-4567',
      buyerEmail: 'john.doe@example.com',
      trackingNumber: 'TRK123456789',
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('markAsSold', () => {
    test('should mark item as sold successfully', async () => {
      const itemId = mockPsaCard._id.toString();
      const mockItem = {
        ...mockPsaCard,
        save: jest.fn().mockResolvedValue(mockPsaCard),
        populate: jest.fn().mockResolvedValue(mockPsaCard),
      };

      mockModel.findById.mockResolvedValue(mockItem);

      const result = await SaleService.markAsSold(
        mockModel,
        itemId,
        validSaleDetails
      );

      expect(mockModel.findById).toHaveBeenCalledWith(itemId);
      expect(mockItem.sold).toBe(true);
      expect(mockItem.saleDetails).toEqual(
        expect.objectContaining({
          paymentMethod: 'CASH',
          actualSoldPrice: 2400.00,
          deliveryMethod: 'Local Meetup',
          source: 'Facebook',
          dateSold: expect.any(Date),
          buyerFullName: 'John Doe',
          buyerAddress: '123 Main St, City, State 12345',
          buyerPhoneNumber: '+1-555-123-4567',
          buyerEmail: 'john.doe@example.com',
          trackingNumber: 'TRK123456789',
        })
      );
      expect(mockItem.save).toHaveBeenCalled();
      expect(result.sold).toBe(true);
      expect(result.saleDetails.actualSoldPrice).toBe(2400.00);
    });

    test('should mark item as sold with population options', async () => {
      const itemId = mockPsaCard._id.toString();
      const populateOptions = {
        path: 'cardId',
        populate: {
          path: 'setId',
          model: 'Set',
        },
      };

      const mockItem = {
        ...mockPsaCard,
        save: jest.fn().mockResolvedValue(mockPsaCard),
        populate: jest.fn().mockResolvedValue(mockPsaCard),
      };

      mockModel.findById.mockResolvedValue(mockItem);

      const result = await SaleService.markAsSold(
        mockModel,
        itemId,
        validSaleDetails,
        populateOptions
      );

      expect(mockItem.populate).toHaveBeenCalledWith(populateOptions);
      expect(result.sold).toBe(true);
      expect(result.saleDetails.actualSoldPrice).toBe(2400.00);
    });

    test('should throw ValidationError for invalid ObjectId', async () => {
      const invalidId = 'invalid-object-id';

      await expect(
        SaleService.markAsSold(mockModel, invalidId, validSaleDetails)
      ).rejects.toThrow('Invalid ObjectId format');
    });

    test('should throw NotFoundError when item not found', async () => {
      const itemId = new mongoose.Types.ObjectId().toString();

      mockModel.findById.mockResolvedValue(null);

      await expect(
        SaleService.markAsSold(mockModel, itemId, validSaleDetails)
      ).rejects.toThrow('PsaGradedCard not found');
    });

    test('should handle save errors', async () => {
      const itemId = mockPsaCard._id.toString();
      const saveError = new Error('Database save error');
      
      const mockItem = {
        ...mockPsaCard,
        save: jest.fn().mockRejectedValue(saveError),
      };

      mockModel.findById.mockResolvedValue(mockItem);

      await expect(
        SaleService.markAsSold(mockModel, itemId, validSaleDetails)
      ).rejects.toThrow('Database save error');
    });
  });

  describe('markCardAsSold', () => {
    test('should mark card as sold with card-specific population', async () => {
      const itemId = mockPsaCard._id.toString();
      const mockItem = {
        ...mockPsaCard,
        save: jest.fn().mockResolvedValue(mockPsaCard),
        populate: jest.fn().mockResolvedValue(mockPsaCard),
      };

      mockModel.findById.mockResolvedValue(mockItem);

      const result = await SaleService.markCardAsSold(
        mockModel,
        itemId,
        validSaleDetails
      );

      expect(mockItem.populate).toHaveBeenCalledWith({
        path: 'cardId',
        populate: {
          path: 'setId',
          model: 'Set',
        },
      });
      expect(result.sold).toBe(true);
      expect(result.saleDetails.actualSoldPrice).toBe(2400.00);
    });
  });

  describe('markSealedProductAsSold', () => {
    test('should mark sealed product as sold with product-specific population', async () => {
      const itemId = mockSealedProduct._id.toString();
      const mockItem = {
        ...mockSealedProduct,
        save: jest.fn().mockResolvedValue(mockSealedProduct),
        populate: jest.fn().mockResolvedValue(mockSealedProduct),
      };

      const mockSealedModel = { ...mockModel, modelName: 'SealedProduct' };

      mockSealedModel.findById.mockResolvedValue(mockItem);

      const result = await SaleService.markSealedProductAsSold(
        mockSealedModel,
        itemId,
        validSaleDetails
      );

      expect(mockItem.populate).toHaveBeenCalledWith({
        path: 'productId',
      });
      expect(result.sold).toBe(true);
      expect(result.saleDetails.actualSoldPrice).toBe(2400.00);
    });
  });

  describe('validateSaleDetails', () => {
    test('should validate complete sale details', () => {
      const result = SaleService.validateSaleDetails(validSaleDetails);

      expect(result).toBe(true);
    });

    test('should throw ValidationError for missing paymentMethod', () => {
      const invalidSaleDetails = { ...validSaleDetails };

      delete invalidSaleDetails.paymentMethod;

      expect(() => SaleService.validateSaleDetails(invalidSaleDetails))
        .toThrow('Missing required field: paymentMethod');
    });

    test('should throw ValidationError for missing actualSoldPrice', () => {
      const invalidSaleDetails = { ...validSaleDetails };

      delete invalidSaleDetails.actualSoldPrice;

      expect(() => SaleService.validateSaleDetails(invalidSaleDetails))
        .toThrow('Missing required field: actualSoldPrice');
    });

    test('should throw ValidationError for missing deliveryMethod', () => {
      const invalidSaleDetails = { ...validSaleDetails };

      delete invalidSaleDetails.deliveryMethod;

      expect(() => SaleService.validateSaleDetails(invalidSaleDetails))
        .toThrow('Missing required field: deliveryMethod');
    });

    test('should throw ValidationError for missing source', () => {
      const invalidSaleDetails = { ...validSaleDetails };

      delete invalidSaleDetails.source;

      expect(() => SaleService.validateSaleDetails(invalidSaleDetails))
        .toThrow('Missing required field: source');
    });

    test('should throw ValidationError for invalid actualSoldPrice type', () => {
      const invalidSaleDetails = { 
        ...validSaleDetails, 
        actualSoldPrice: 'not-a-number' 
      };

      expect(() => SaleService.validateSaleDetails(invalidSaleDetails))
        .toThrow('actualSoldPrice must be a positive number');
    });

    test('should throw ValidationError for negative actualSoldPrice', () => {
      const invalidSaleDetails = { 
        ...validSaleDetails, 
        actualSoldPrice: -100 
      };

      expect(() => SaleService.validateSaleDetails(invalidSaleDetails))
        .toThrow('actualSoldPrice must be a positive number');
    });

    test('should throw ValidationError for zero actualSoldPrice', () => {
      const invalidSaleDetails = { 
        ...validSaleDetails, 
        actualSoldPrice: 0 
      };

      expect(() => SaleService.validateSaleDetails(invalidSaleDetails))
        .toThrow('Missing required field: actualSoldPrice');
    });

    test('should validate with minimal required fields', () => {
      const minimalSaleDetails = {
        paymentMethod: 'PAYPAL',
        actualSoldPrice: 150.50,
        deliveryMethod: 'Shipping',
        source: 'eBay',
      };

      const result = SaleService.validateSaleDetails(minimalSaleDetails);

      expect(result).toBe(true);
    });
  });

  describe('getSaleStatistics', () => {
    test('should get sale statistics with default filters', async () => {
      const mockStats = [
        { total: 25000.50 }
      ];

      mockModel.countDocuments.mockResolvedValue(15);
      mockModel.aggregate.mockResolvedValue(mockStats);

      const result = await SaleService.getSaleStatistics(mockModel);

      expect(mockModel.countDocuments).toHaveBeenCalledWith({ sold: true });
      expect(mockModel.aggregate).toHaveBeenCalledWith([
        { $match: { sold: true } },
        {
          $group: {
            _id: null,
            total: { $sum: '$saleDetails.actualSoldPrice' },
          },
        },
      ]);
      expect(result).toEqual({
        totalSold: 15,
        totalRevenue: 25000.50,
      });
    });

    test('should get sale statistics with custom filters', async () => {
      const filters = { grade: 'PSA 10' };
      const expectedQuery = { sold: true, grade: 'PSA 10' };

      mockModel.countDocuments.mockResolvedValue(5);
      mockModel.aggregate.mockResolvedValue([{ total: 15000 }]);

      const result = await SaleService.getSaleStatistics(mockModel, filters);

      expect(mockModel.countDocuments).toHaveBeenCalledWith(expectedQuery);
      expect(mockModel.aggregate).toHaveBeenCalledWith([
        { $match: expectedQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$saleDetails.actualSoldPrice' },
          },
        },
      ]);
      expect(result).toEqual({
        totalSold: 5,
        totalRevenue: 15000,
      });
    });

    test('should handle empty revenue aggregation result', async () => {
      mockModel.countDocuments.mockResolvedValue(0);
      mockModel.aggregate.mockResolvedValue([]);

      const result = await SaleService.getSaleStatistics(mockModel);

      expect(result).toEqual({
        totalSold: 0,
        totalRevenue: 0,
      });
    });

    test('should handle aggregation errors', async () => {
      mockModel.countDocuments.mockResolvedValue(5);
      mockModel.aggregate.mockRejectedValue(new Error('Aggregation failed'));

      await expect(SaleService.getSaleStatistics(mockModel))
        .rejects.toThrow('Aggregation failed');
    });
  });

  describe('getSoldItemsByDateRange', () => {
    test('should get sold items within date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');
      const mockSoldItems = [
        { 
          ...mockPsaCard, 
          sold: true,
          saleDetails: { 
            dateSold: new Date('2024-01-15'),
            actualSoldPrice: 2400 
          }
        },
        { 
          ...mockSealedProduct, 
          sold: true,
          saleDetails: { 
            dateSold: new Date('2024-01-20'),
            actualSoldPrice: 350 
          }
        },
      ];

      mockModel.find.mockResolvedValue(mockSoldItems);

      const result = await SaleService.getSoldItemsByDateRange(
        mockModel,
        startDate,
        endDate
      );

      expect(mockModel.find).toHaveBeenCalledWith({
        sold: true,
        'saleDetails.dateSold': {
          $gte: startDate,
          $lte: endDate,
        },
      });
      expect(result).toEqual(mockSoldItems);
    });

    test('should return empty array when no items sold in range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockModel.find.mockResolvedValue([]);

      const result = await SaleService.getSoldItemsByDateRange(
        mockModel,
        startDate,
        endDate
      );

      expect(result).toEqual([]);
    });

    test('should handle date range query errors', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      mockModel.find.mockRejectedValue(new Error('Query failed'));

      await expect(
        SaleService.getSoldItemsByDateRange(mockModel, startDate, endDate)
      ).rejects.toThrow('Query failed');
    });
  });

  describe('Payment Method Validation', () => {
    test('should accept valid payment methods', () => {
      const validPaymentMethods = ['CASH', 'PAYPAL', 'BANK_TRANSFER', 'CHECK', 'CRYPTO'];
      
      validPaymentMethods.forEach(method => {
        const saleDetails = { ...validSaleDetails, paymentMethod: method };

        expect(() => SaleService.validateSaleDetails(saleDetails)).not.toThrow();
      });
    });

    test('should accept any string as payment method', () => {
      const customPaymentMethod = 'CUSTOM_PAYMENT';
      const saleDetails = { ...validSaleDetails, paymentMethod: customPaymentMethod };
      
      expect(() => SaleService.validateSaleDetails(saleDetails)).not.toThrow();
    });
  });

  describe('Delivery Method Validation', () => {
    test('should accept valid delivery methods', () => {
      const validDeliveryMethods = ['Local Meetup', 'Shipping', 'Digital Delivery', 'Pickup'];
      
      validDeliveryMethods.forEach(method => {
        const saleDetails = { ...validSaleDetails, deliveryMethod: method };

        expect(() => SaleService.validateSaleDetails(saleDetails)).not.toThrow();
      });
    });
  });

  describe('Source Validation', () => {
    test('should accept valid sources', () => {
      const validSources = ['Facebook', 'eBay', 'DBA', 'Instagram', 'Local', 'Website'];
      
      validSources.forEach(source => {
        const saleDetails = { ...validSaleDetails, source };

        expect(() => SaleService.validateSaleDetails(saleDetails)).not.toThrow();
      });
    });
  });

  describe('Optional Fields Handling', () => {
    test('should handle missing optional buyer information', () => {
      const saleDetailsWithoutOptional = {
        paymentMethod: 'CASH',
        actualSoldPrice: 2400.00,
        deliveryMethod: 'Local Meetup',
        source: 'Facebook',
        // Optional fields omitted
      };

      expect(() => SaleService.validateSaleDetails(saleDetailsWithoutOptional))
        .not.toThrow();
    });

    test('should handle partial buyer information', () => {
      const saleDetailsPartial = {
        paymentMethod: 'CASH',
        actualSoldPrice: 2400.00,
        deliveryMethod: 'Local Meetup',
        source: 'Facebook',
        buyerFullName: 'John Doe',
        // Other buyer fields omitted
      };

      expect(() => SaleService.validateSaleDetails(saleDetailsPartial))
        .not.toThrow();
    });
  });

  describe('Price Formatting and Conversion', () => {
    test('should handle decimal prices correctly', () => {
      const saleDetails = { 
        ...validSaleDetails, 
        actualSoldPrice: 1999.99 
      };

      expect(() => SaleService.validateSaleDetails(saleDetails)).not.toThrow();
    });

    test('should handle integer prices correctly', () => {
      const saleDetails = { 
        ...validSaleDetails, 
        actualSoldPrice: 2000 
      };

      expect(() => SaleService.validateSaleDetails(saleDetails)).not.toThrow();
    });

    test('should handle large prices correctly', () => {
      const saleDetails = { 
        ...validSaleDetails, 
        actualSoldPrice: 999999.99 
      };

      expect(() => SaleService.validateSaleDetails(saleDetails)).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle null sale details', () => {
      expect(() => SaleService.validateSaleDetails(null))
        .toThrow('Cannot read properties of null');
    });

    test('should handle undefined sale details', () => {
      expect(() => SaleService.validateSaleDetails(undefined))
        .toThrow('Cannot read properties of undefined');
    });

    test('should handle empty sale details object', () => {
      expect(() => SaleService.validateSaleDetails({}))
        .toThrow('Missing required field: paymentMethod');
    });

    test('should handle sale details with extra fields', () => {
      const saleDetailsWithExtra = {
        ...validSaleDetails,
        extraField: 'extra value',
        anotherField: 123,
      };

      expect(() => SaleService.validateSaleDetails(saleDetailsWithExtra))
        .not.toThrow();
    });
  });
});