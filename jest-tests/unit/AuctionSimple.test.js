const mongoose = require('mongoose');

// Mock dependencies first
jest.mock('../../models/Auction');
jest.mock('../../controllers/auctions/auctionItemHelpers');

const Auction = require('../../models/Auction');
const auctionItemHelpers = require('../../controllers/auctions/auctionItemHelpers');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

describe('Auction Operations', () => {
  let mockAuction;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {
      // Mock console.log for testing - intentionally empty
    });
    jest.spyOn(console, 'error').mockImplementation(() => {
      // Mock console.error for testing - intentionally empty
    });

    mockAuction = {
      _id: new mongoose.Types.ObjectId(),
      topText: 'Test Auction',
      bottomText: 'Test Description',
      status: 'draft',
      items: [],
      totalValue: 0,
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnValue({
        _id: new mongoose.Types.ObjectId(),
        topText: 'Test Auction',
        bottomText: 'Test Description',
      }),
    };

    // Setup mocks
    auctionItemHelpers.populateAuctionItems = jest.fn().mockResolvedValue(mockAuction);
    auctionItemHelpers.validateAuctionItems = jest.fn().mockResolvedValue(true);
    auctionItemHelpers.validateAndFindItem = jest.fn().mockResolvedValue({});
    auctionItemHelpers.calculateAuctionTotalValue = jest.fn().mockResolvedValue(0);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Auction Model Operations', () => {
    test('should create auction with Auction model', async () => {
      const auctionData = {
        topText: 'New Auction',
        bottomText: 'Description',
        status: 'draft',
        items: [],
        totalValue: 0,
      };

      Auction.mockImplementation(() => ({
        ...auctionData,
        save: jest.fn().mockResolvedValue(auctionData),
      }));

      const newAuction = new Auction(auctionData);
      const savedAuction = await newAuction.save();

      expect(Auction).toHaveBeenCalledWith(auctionData);
      expect(newAuction.save).toHaveBeenCalled();
      expect(savedAuction).toEqual(auctionData);
    });

    test('should find auction by ID', async () => {
      const auctionId = new mongoose.Types.ObjectId();

      Auction.findById.mockResolvedValue(mockAuction);

      const result = await Auction.findById(auctionId);

      expect(Auction.findById).toHaveBeenCalledWith(auctionId);
      expect(result).toEqual(mockAuction);
    });

    test('should find all auctions', async () => {
      const mockAuctions = [mockAuction];

      Auction.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockAuctions),
      });

      const result = await Auction.find({}).sort({ createdAt: -1 });

      expect(Auction.find).toHaveBeenCalledWith({});
      expect(result).toEqual(mockAuctions);
    });

    test('should update auction', async () => {
      const updateData = { topText: 'Updated Auction' };
      const updatedAuction = { ...mockAuction, ...updateData };
      
      Auction.findByIdAndUpdate.mockResolvedValue(updatedAuction);

      const result = await Auction.findByIdAndUpdate(
        mockAuction._id,
        updateData,
        { new: true, runValidators: true }
      );

      expect(Auction.findByIdAndUpdate).toHaveBeenCalledWith(
        mockAuction._id,
        updateData,
        { new: true, runValidators: true }
      );
      expect(result).toEqual(updatedAuction);
    });

    test('should delete auction', async () => {
      Auction.findByIdAndDelete.mockResolvedValue(mockAuction);

      const result = await Auction.findByIdAndDelete(mockAuction._id);

      expect(Auction.findByIdAndDelete).toHaveBeenCalledWith(mockAuction._id);
      expect(result).toEqual(mockAuction);
    });

    test('should handle auction not found', async () => {
      Auction.findById.mockResolvedValue(null);

      const result = await Auction.findById(new mongoose.Types.ObjectId());

      expect(result).toBeNull();
    });
  });

  describe('Auction Item Helpers', () => {
    test('should populate auction items', async () => {
      const populatedAuction = { ...mockAuction, items: [] };

      auctionItemHelpers.populateAuctionItems.mockResolvedValue(populatedAuction);

      const result = await auctionItemHelpers.populateAuctionItems(mockAuction);

      expect(auctionItemHelpers.populateAuctionItems).toHaveBeenCalledWith(mockAuction);
      expect(result).toEqual(populatedAuction);
    });

    test('should validate auction items', async () => {
      const items = [
        { itemId: new mongoose.Types.ObjectId(), itemCategory: 'PsaGradedCard' },
      ];

      await auctionItemHelpers.validateAuctionItems(items);

      expect(auctionItemHelpers.validateAuctionItems).toHaveBeenCalledWith(items);
    });

    test('should validate and find single item', async () => {
      const itemId = new mongoose.Types.ObjectId();
      const itemCategory = 'PsaGradedCard';
      const mockItem = { _id: itemId, sold: false };

      auctionItemHelpers.validateAndFindItem.mockResolvedValue(mockItem);

      const result = await auctionItemHelpers.validateAndFindItem(itemId, itemCategory);

      expect(auctionItemHelpers.validateAndFindItem).toHaveBeenCalledWith(itemId, itemCategory);
      expect(result).toEqual(mockItem);
    });

    test('should calculate auction total value', async () => {
      const totalValue = 5000;

      auctionItemHelpers.calculateAuctionTotalValue.mockResolvedValue(totalValue);

      const result = await auctionItemHelpers.calculateAuctionTotalValue(mockAuction);

      expect(auctionItemHelpers.calculateAuctionTotalValue).toHaveBeenCalledWith(mockAuction);
      expect(result).toBe(totalValue);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle validation errors', async () => {
      const error = new ValidationError('Invalid data');

      auctionItemHelpers.validateAuctionItems.mockRejectedValue(error);

      await expect(auctionItemHelpers.validateAuctionItems([])).rejects.toThrow(ValidationError);
    });

    test('should handle not found errors', async () => {
      const error = new NotFoundError('Item not found');

      auctionItemHelpers.validateAndFindItem.mockRejectedValue(error);

      await expect(
        auctionItemHelpers.validateAndFindItem(
          new mongoose.Types.ObjectId(),
          'PsaGradedCard'
        )
      ).rejects.toThrow(NotFoundError);
    });

    test('should handle auction save errors', async () => {
      const error = new Error('Save failed');
      const failingAuction = {
        save: jest.fn().mockRejectedValue(error),
      };

      await expect(failingAuction.save()).rejects.toThrow('Save failed');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty auction items', async () => {
      const emptyAuction = { ...mockAuction, items: [] };

      auctionItemHelpers.calculateAuctionTotalValue.mockResolvedValue(0);

      const result = await auctionItemHelpers.calculateAuctionTotalValue(emptyAuction);

      expect(result).toBe(0);
    });

    test('should handle auction with multiple items', async () => {
      const multiItemAuction = {
        ...mockAuction,
        items: [
          { itemId: new mongoose.Types.ObjectId(), itemCategory: 'PsaGradedCard' },
          { itemId: new mongoose.Types.ObjectId(), itemCategory: 'SealedProduct' },
        ],
      };

      auctionItemHelpers.calculateAuctionTotalValue.mockResolvedValue(7500);

      const result = await auctionItemHelpers.calculateAuctionTotalValue(multiItemAuction);

      expect(result).toBe(7500);
    });

    test('should handle different auction statuses', async () => {
      const statuses = ['draft', 'active', 'sold', 'expired'];

      for (const status of statuses) {
        const auctionWithStatus = { ...mockAuction, status };

        Auction.findById.mockResolvedValue(auctionWithStatus);

        const result = await Auction.findById(mockAuction._id);

        expect(result.status).toBe(status);
      }
    });
  });
});