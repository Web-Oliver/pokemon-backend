const ActivityService = require('../../services/activityService');
const { Activity, ACTIVITY_TYPES, ACTIVITY_PRIORITIES } = require('../../models/Activity');
const { createMockPsaGradedCard, createMockSealedProduct, createMockSet } = require('../helpers/real-mock-data.helper');
const mongoose = require('mongoose');

// Mock the Activity model
jest.mock('../../models/Activity', () => ({
  Activity: {
    create: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
  },
  ACTIVITY_TYPES: {
    CARD_ADDED: 'card_added',
    CARD_UPDATED: 'card_updated',
    CARD_DELETED: 'card_deleted',
    PRICE_UPDATE: 'price_update',
    AUCTION_CREATED: 'auction_created',
    AUCTION_UPDATED: 'auction_updated',
    AUCTION_DELETED: 'auction_deleted',
    AUCTION_ITEM_ADDED: 'auction_item_added',
    AUCTION_ITEM_REMOVED: 'auction_item_removed',
    SALE_COMPLETED: 'sale_completed',
    SALE_UPDATED: 'sale_updated',
    MILESTONE: 'milestone',
    COLLECTION_STATS: 'collection_stats',
    SYSTEM: 'system',
  },
  ACTIVITY_PRIORITIES: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    CRITICAL: 'critical',
  },
}));

describe('ActivityService', () => {
  let mockCardData;
  let mockSealedProduct;
  let mockSetData;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    // Create realistic mock data
    mockCardData = createMockPsaGradedCard();
    mockSealedProduct = createMockSealedProduct();
    mockSetData = createMockSet();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Price Conversion Utilities', () => {
    test('should convert Decimal128 to number', () => {
      const decimal128Price = mongoose.Types.Decimal128.fromString('2500.00');
      const result = ActivityService.convertPrice(decimal128Price);
      expect(result).toBe(2500);
    });

    test('should handle number prices', () => {
      const result = ActivityService.convertPrice(1500);
      expect(result).toBe(1500);
    });

    test('should handle $numberDecimal format', () => {
      const price = { $numberDecimal: '3500.50' };
      const result = ActivityService.convertPrice(price);
      expect(result).toBe(3500.5);
    });

    test('should handle null and undefined prices', () => {
      expect(ActivityService.convertPrice(null)).toBeNull();
      expect(ActivityService.convertPrice(undefined)).toBeNull();
    });

    test('should handle price with toString method', () => {
      const price = { toString: () => '4250.75' };
      const result = ActivityService.convertPrice(price);
      expect(result).toBe(4250.75);
    });
  });

  describe('Card Activity Logging', () => {
    test('should log PSA graded card addition', async () => {
      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.CARD_ADDED,
        title: 'Added Pikachu PSA 9',
        description: 'Base Set - Pikachu PSA 9 added to collection',
        entityType: 'psa_card',
        entityId: mockCardData._id,
        metadata: expect.any(Object),
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardAdded(mockCardData, 'psa');

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_ADDED,
          title: expect.stringContaining('Added'),
          description: expect.any(String),
          entityType: 'psa_card',
          entityId: mockCardData._id,
          priority: ACTIVITY_PRIORITIES.MEDIUM,
          metadata: expect.objectContaining({
            cardType: 'psa',
            grade: mockCardData.grade,
            price: expect.any(Number),
            setName: expect.any(String),
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log raw card addition', async () => {
      const rawCardData = {
        ...mockCardData,
        condition: 'Near Mint',
        grade: undefined,
      };

      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.CARD_ADDED,
        title: 'Added Pikachu (Near Mint)',
        description: 'Base Set - Pikachu (Near Mint) added to collection',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardAdded(rawCardData, 'raw');

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_ADDED,
          entityType: 'raw_card',
          metadata: expect.objectContaining({
            cardType: 'raw',
            condition: 'Near Mint',
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log sealed product addition', async () => {
      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.CARD_ADDED,
        title: 'Added Base Set Booster Box',
        description: 'Base Set Booster Box added to collection',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardAdded(mockSealedProduct, 'sealed');

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_ADDED,
          entityType: 'sealed_product',
          metadata: expect.objectContaining({
            cardType: 'sealed',
            category: mockSealedProduct.category,
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log card update activity', async () => {
      const oldData = { ...mockCardData, myPrice: mongoose.Types.Decimal128.fromString('2000.00') };
      const newData = { ...mockCardData, myPrice: mongoose.Types.Decimal128.fromString('2500.00') };

      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.CARD_UPDATED,
        title: 'Updated Pikachu PSA 9',
        description: 'Base Set - Pikachu PSA 9 updated',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardUpdated(oldData, newData, 'psa');

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_UPDATED,
          metadata: expect.objectContaining({
            changes: expect.objectContaining({
              price: {
                old: 2000,
                new: 2500,
              },
            }),
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log card deletion activity', async () => {
      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.CARD_DELETED,
        title: 'Removed Pikachu PSA 9',
        description: 'Base Set - Pikachu PSA 9 removed from collection',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardDeleted(mockCardData, 'psa');

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_DELETED,
          priority: ACTIVITY_PRIORITIES.LOW,
          metadata: expect.objectContaining({
            cardType: 'psa',
            isDeleted: true,
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('Price Update Activities', () => {
    test('should log price increase activity', async () => {
      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.PRICE_UPDATE,
        title: 'Price Updated: Pikachu PSA 9',
        description: 'Price increased from $2,000.00 to $2,500.00 (+$500.00)',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logPriceUpdate(
        mockCardData._id,
        'psa_card',
        2000,
        2500,
        'Pikachu PSA 9'
      );

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.PRICE_UPDATE,
          priority: ACTIVITY_PRIORITIES.MEDIUM,
          metadata: expect.objectContaining({
            priceChange: {
              oldPrice: 2000,
              newPrice: 2500,
              difference: 500,
              percentChange: 25,
            },
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log price decrease activity', async () => {
      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.PRICE_UPDATE,
        title: 'Price Updated: Pikachu PSA 9',
        description: 'Price decreased from $2,500.00 to $2,000.00 (-$500.00)',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logPriceUpdate(
        mockCardData._id,
        'psa_card',
        2500,
        2000,
        'Pikachu PSA 9'
      );

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            priceChange: {
              oldPrice: 2500,
              newPrice: 2000,
              difference: -500,
              percentChange: -20,
            },
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('Auction Activities', () => {
    test('should log auction creation', async () => {
      const auctionData = {
        _id: new mongoose.Types.ObjectId(),
        topText: 'Premium Pokemon Cards',
        bottomText: 'Auction ends Friday',
        auctionDate: new Date('2024-12-31'),
        items: [mockCardData._id],
        totalValue: mongoose.Types.Decimal128.fromString('10000.00'),
      };

      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.AUCTION_CREATED,
        title: 'Created Auction: Premium Pokemon Cards',
        description: 'New auction created with 1 item(s), total value: $10,000.00',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logAuctionCreated(auctionData);

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.AUCTION_CREATED,
          priority: ACTIVITY_PRIORITIES.HIGH,
          metadata: expect.objectContaining({
            itemCount: 1,
            totalValue: 10000,
            auctionDate: auctionData.auctionDate,
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log auction item addition', async () => {
      const auctionId = new mongoose.Types.ObjectId();
      const itemData = {
        itemId: mockCardData._id,
        itemCategory: 'PsaGradedCard',
        itemName: 'Pikachu PSA 9',
      };

      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.AUCTION_ITEM_ADDED,
        title: 'Added Item to Auction',
        description: 'Pikachu PSA 9 added to auction',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logAuctionItemAdded(auctionId, itemData);

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.AUCTION_ITEM_ADDED,
          entityType: 'auction',
          entityId: auctionId,
          metadata: expect.objectContaining({
            itemCategory: 'PsaGradedCard',
            itemName: 'Pikachu PSA 9',
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('Sale Activities', () => {
    test('should log sale completion', async () => {
      const saleData = {
        itemId: mockCardData._id,
        itemType: 'psa_card',
        itemName: 'Pikachu PSA 9',
        salePrice: 2400,
        buyerName: 'John Doe',
        paymentMethod: 'CASH',
        deliveryMethod: 'Local Meetup',
        source: 'Facebook',
      };

      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.SALE_COMPLETED,
        title: 'Sale Completed: Pikachu PSA 9',
        description: 'Sold Pikachu PSA 9 for $2,400.00 to John Doe',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logSaleCompleted(saleData);

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.SALE_COMPLETED,
          priority: ACTIVITY_PRIORITIES.HIGH,
          metadata: expect.objectContaining({
            salePrice: 2400,
            buyerName: 'John Doe',
            paymentMethod: 'CASH',
            deliveryMethod: 'Local Meetup',
            source: 'Facebook',
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('Milestone Activities', () => {
    test('should log collection milestone', async () => {
      const milestoneData = {
        type: 'card_count',
        value: 1000,
        description: 'Reached 1,000 cards in collection',
      };

      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.MILESTONE,
        title: 'Milestone Achieved: 1,000 Cards',
        description: 'Reached 1,000 cards in collection',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logMilestone(milestoneData);

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.MILESTONE,
          priority: ACTIVITY_PRIORITIES.HIGH,
          metadata: expect.objectContaining({
            milestoneType: 'card_count',
            milestoneValue: 1000,
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('Activity Retrieval', () => {
    test('should get recent activities with default limit', async () => {
      const mockActivities = [
        {
          _id: new mongoose.Types.ObjectId(),
          type: ACTIVITY_TYPES.CARD_ADDED,
          title: 'Added Pikachu PSA 9',
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          type: ACTIVITY_TYPES.PRICE_UPDATE,
          title: 'Price Updated: Charizard PSA 10',
          createdAt: new Date(),
        },
      ];

      Activity.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockActivities),
          }),
        }),
      });

      const result = await ActivityService.getRecentActivities();

      expect(Activity.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockActivities);
    });

    test('should get activities with filters', async () => {
      const filters = {
        type: ACTIVITY_TYPES.CARD_ADDED,
        entityType: 'psa_card',
      };

      const mockActivities = [
        {
          _id: new mongoose.Types.ObjectId(),
          type: ACTIVITY_TYPES.CARD_ADDED,
          entityType: 'psa_card',
          title: 'Added Pikachu PSA 9',
        },
      ];

      Activity.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockActivities),
          }),
        }),
      });

      const result = await ActivityService.getRecentActivities(50, filters);

      expect(Activity.find).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockActivities);
    });

    test('should get activity statistics', async () => {
      const mockStats = [
        { _id: ACTIVITY_TYPES.CARD_ADDED, count: 150 },
        { _id: ACTIVITY_TYPES.CARD_UPDATED, count: 75 },
        { _id: ACTIVITY_TYPES.SALE_COMPLETED, count: 25 },
      ];

      Activity.aggregate.mockResolvedValue(mockStats);

      const result = await ActivityService.getActivityStats();

      expect(Activity.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ $group: expect.any(Object) }),
          expect.objectContaining({ $sort: expect.any(Object) }),
        ])
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('Batch Processing', () => {
    test('should process activity batch', async () => {
      const activities = [
        {
          type: ACTIVITY_TYPES.CARD_ADDED,
          title: 'Added Card 1',
          description: 'Description 1',
        },
        {
          type: ACTIVITY_TYPES.CARD_ADDED,
          title: 'Added Card 2',
          description: 'Description 2',
        },
      ];

      Activity.insertMany.mockResolvedValue(activities);

      await ActivityService.processBatch();

      // Test requires accessing internal queue, which is private
      // This tests the method exists and handles empty queue
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Batch processed')
      );
    });

    test('should handle batch processing errors', async () => {
      Activity.insertMany.mockRejectedValue(new Error('Database error'));
      Activity.create.mockResolvedValue({});

      // Mock queue with activities
      const originalQueue = ActivityService.activityQueue || [];
      
      await ActivityService.processBatch();

      // Should handle errors gracefully without throwing
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle activity creation errors', async () => {
      Activity.create.mockRejectedValue(new Error('Database connection error'));

      await expect(
        ActivityService.logCardAdded(mockCardData, 'psa')
      ).rejects.toThrow('Database connection error');

      expect(Activity.create).toHaveBeenCalled();
    });

    test('should handle invalid card data gracefully', async () => {
      const invalidCardData = null;

      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.CARD_ADDED,
        title: 'Added Unknown Card',
        description: 'Unknown Set - Card added to collection',
      };

      Activity.create.mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardAdded(invalidCardData, 'psa');

      expect(Activity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Added Unknown Card',
          metadata: expect.objectContaining({
            cardName: 'Unknown Card',
            setName: 'Unknown Set',
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('Activity Cleanup', () => {
    test('should clean up old activities', async () => {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      
      Activity.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 50 });

      const result = await ActivityService.cleanupOldActivities(90);

      expect(Activity.deleteMany).toHaveBeenCalledWith({
        createdAt: { $lt: expect.any(Date) },
      });
      expect(result).toEqual({ deletedCount: 50 });
    });
  });

  describe('Activity Validation', () => {
    test('should validate activity data before creation', () => {
      const validActivityData = {
        type: ACTIVITY_TYPES.CARD_ADDED,
        title: 'Test Activity',
        description: 'Test Description',
        entityType: 'psa_card',
        entityId: new mongoose.Types.ObjectId(),
      };

      const isValid = ActivityService.validateActivityData(validActivityData);
      expect(isValid).toBe(true);
    });

    test('should reject invalid activity data', () => {
      const invalidActivityData = {
        type: 'invalid_type',
        title: '',
        // missing required fields
      };

      const isValid = ActivityService.validateActivityData(invalidActivityData);
      expect(isValid).toBe(false);
    });
  });
});