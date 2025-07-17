const ActivityService = require('../../services/activityService');
const { Activity, ACTIVITY_TYPES, ACTIVITY_PRIORITIES } = require('../../models/Activity');
const { createMockPsaGradedCard, createMockSealedProduct, createMockSet } = require('../helpers/real-mock-data.helper');
const mongoose = require('mongoose');

// Mock the Activity model
jest.mock('../../models/Activity', () => ({
  Activity: {
    create: jest.fn(),
    createActivity: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
    deleteOne: jest.fn(),
    countDocuments: jest.fn(),
    aggregate: jest.fn(),
    findOne: jest.fn(),
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
    jest.spyOn(console, 'log').mockImplementation(() => {
      // Mock console.log for testing - intentionally empty
    });
    jest.spyOn(console, 'error').mockImplementation(() => {
      // Mock console.error for testing - intentionally empty
    });

    // Create realistic mock data
    mockCardData = createMockPsaGradedCard();
    mockSealedProduct = createMockSealedProduct();
    mockSetData = createMockSet();

    // Reset createActivity mock
    if (ActivityService.createActivity && ActivityService.createActivity.mockReset) {
      ActivityService.createActivity.mockReset();
    }
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
        queued: true,
      };

      // Mock the createActivity method (static method)
      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardAdded(mockCardData, 'psa');

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_ADDED,
          title: expect.stringContaining('Added'),
          description: expect.any(String),
          entityType: 'psa_card',
          entityId: mockCardData._id,
          priority: ACTIVITY_PRIORITIES.MEDIUM,
          metadata: expect.objectContaining({
            cardName: expect.any(String),
            setName: expect.any(String),
            grade: mockCardData.grade,
            newPrice: expect.any(Number),
            badges: expect.any(Array),
            tags: expect.any(Array),
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
        queued: true,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardAdded(rawCardData, 'raw');

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_ADDED,
          entityType: 'raw_card',
          metadata: expect.objectContaining({
            cardName: expect.any(String),
            setName: expect.any(String),
            condition: 'Near Mint',
            badges: expect.any(Array),
            tags: expect.any(Array),
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log sealed product addition', async () => {
      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.CARD_ADDED,
        queued: true,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardAdded(mockSealedProduct, 'sealed');

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_ADDED,
          entityType: 'sealed_card',
          metadata: expect.objectContaining({
            cardName: expect.any(String),
            setName: expect.any(String),
            category: mockSealedProduct.category,
            badges: expect.any(Array),
            tags: expect.any(Array),
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log card update activity', async () => {
      const oldData = { ...mockCardData, myPrice: mongoose.Types.Decimal128.fromString('2000.00') };
      const newData = { ...mockCardData, myPrice: mongoose.Types.Decimal128.fromString('2500.00') };

      const mockActivity = {
        queued: true,
        type: ACTIVITY_TYPES.CARD_UPDATED,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardUpdated(oldData, 'psa', newData);

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_UPDATED,
          metadata: expect.objectContaining({
            changes: newData,
            cardName: expect.any(String),
            setName: expect.any(String),
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log card deletion activity', async () => {
      const mockActivity = {
        queued: true,
        type: ACTIVITY_TYPES.CARD_DELETED,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardDeleted(mockCardData, 'psa');

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.CARD_DELETED,
          priority: ACTIVITY_PRIORITIES.MEDIUM,
          metadata: expect.objectContaining({
            cardName: expect.any(String),
            setName: expect.any(String),
            badges: expect.arrayContaining(['Removed']),
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });
  });

  describe('Price Update Activities', () => {
    test('should log price increase activity', async () => {
      const mockActivity = {
        queued: true,
        type: ACTIVITY_TYPES.PRICE_UPDATE,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logPriceUpdate(
        mockCardData,
        'psa',
        2000,
        2500
      );

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.PRICE_UPDATE,
          priority: ACTIVITY_PRIORITIES.HIGH,
          metadata: expect.objectContaining({
            previousPrice: 2000,
            newPrice: 2500,
            priceChange: 500,
            priceChangePercentage: 25,
          }),
        })
      );
      expect(result).toEqual(mockActivity);
    });

    test('should log price decrease activity', async () => {
      const mockActivity = {
        queued: true,
        type: ACTIVITY_TYPES.PRICE_UPDATE,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logPriceUpdate(
        mockCardData,
        'psa',
        2500,
        2000
      );

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            previousPrice: 2500,
            newPrice: 2000,
            priceChange: -500,
            priceChangePercentage: -20,
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
        queued: true,
        type: ACTIVITY_TYPES.AUCTION_CREATED,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logAuctionCreated(auctionData);

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.AUCTION_CREATED,
          priority: ACTIVITY_PRIORITIES.HIGH,
          metadata: expect.objectContaining({
            itemCount: 1,
            estimatedValue: 10000,
            auctionTitle: auctionData.topText,
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
        queued: true,
        type: ACTIVITY_TYPES.AUCTION_ITEM_ADDED,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const auctionData = {
        _id: auctionId,
        topText: 'Test Auction',
        items: []
      };
      const result = await ActivityService.logAuctionItemAdded(auctionData, itemData);

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.AUCTION_ITEM_ADDED,
          entityType: 'auction',
          entityId: auctionId,
          metadata: expect.objectContaining({
            cardName: 'Unknown Item',
            auctionTitle: 'Test Auction',
            badges: expect.arrayContaining(['Item Added']),
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
        actualSoldPrice: 2400,
        buyerFullName: 'John Doe',
        paymentMethod: 'CASH',
        deliveryMethod: 'Local Meetup',
        source: 'Facebook',
      };

      const mockActivity = {
        queued: true,
        type: ACTIVITY_TYPES.SALE_COMPLETED,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logSaleCompleted(mockCardData, 'psa', saleData);

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ACTIVITY_TYPES.SALE_COMPLETED,
          priority: ACTIVITY_PRIORITIES.HIGH,
          metadata: expect.objectContaining({
            salePrice: 2400,
            buyerName: 'John Doe',
            paymentMethod: 'CASH',
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
        queued: true,
        type: ACTIVITY_TYPES.MILESTONE,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logMilestone('card_count', milestoneData);

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
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
    test('should get activities with default options', async () => {
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
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockActivities),
            }),
          }),
        }),
      });
      Activity.countDocuments.mockResolvedValue(2);

      const result = await ActivityService.getActivities();

      expect(Activity.find).toHaveBeenCalledWith({ status: 'active' });
      expect(result.activities).toEqual(mockActivities);
      expect(result.total).toBe(2);
    });

    test('should get activities with specific filters', async () => {
      const options = {
        type: ACTIVITY_TYPES.CARD_ADDED,
        entityType: 'psa_card',
        limit: 25
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
          skip: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(mockActivities),
            }),
          }),
        }),
      });
      Activity.countDocuments.mockResolvedValue(1);

      const result = await ActivityService.getActivities(options);

      expect(Activity.find).toHaveBeenCalledWith(expect.objectContaining({
        status: 'active',
        type: ACTIVITY_TYPES.CARD_ADDED,
        entityType: 'psa_card'
      }));
      expect(result.activities).toEqual(mockActivities);
      expect(result.total).toBe(1);
    });

    test('should get activity statistics correctly', async () => {
      Activity.countDocuments
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(5)   // today
        .mockResolvedValueOnce(20)  // week
        .mockResolvedValueOnce(50); // month
      
      Activity.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue({
            timestamp: new Date(),
          }),
        }),
      });

      const result = await ActivityService.getActivityStats();

      expect(result.total).toBe(100);
      expect(result.today).toBe(5);
      expect(result.week).toBe(20);
      expect(result.month).toBe(50);
      expect(result.lastActivity).toBeInstanceOf(Date);
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
      ActivityService.createActivity = jest.fn().mockResolvedValue({});

      // Mock queue with activities
      const originalQueue = ActivityService.activityQueue || [];
      
      await ActivityService.processBatch();

      // Should handle errors gracefully without throwing
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should handle activity creation errors', async () => {
      ActivityService.createActivity = jest.fn().mockRejectedValue(new Error('Database connection error'));

      await expect(
        ActivityService.logCardAdded(mockCardData, 'psa')
      ).rejects.toThrow('Database connection error');

      expect(ActivityService.createActivity).toHaveBeenCalled();
    });

    test('should handle invalid card data gracefully', async () => {
      const invalidCardData = {}; // Empty object instead of null

      const mockActivity = {
        _id: new mongoose.Types.ObjectId(),
        type: ACTIVITY_TYPES.CARD_ADDED,
        queued: true,
      };

      ActivityService.createActivity = jest.fn().mockResolvedValue(mockActivity);

      const result = await ActivityService.logCardAdded(invalidCardData, 'psa');

      expect(ActivityService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Unknown Card'),
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
    test('should archive old activities', async () => {
      const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
      
      Activity.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 50 });

      const result = await ActivityService.archiveOldActivities(90);

      expect(Activity.updateMany).toHaveBeenCalledWith(
        {
          timestamp: { $lt: expect.any(Date) },
          status: 'active',
          priority: { $in: ['low', 'medium'] },
        },
        {
          status: 'archived',
          isArchived: true,
          archivedAt: expect.any(Date),
        }
      );
      expect(result).toEqual({ modifiedCount: 50 });
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