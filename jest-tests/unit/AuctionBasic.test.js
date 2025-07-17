const Auction = require('../../models/Auction');
const auctionCrudOperations = require('../../controllers/auctions/auctionCrudOperations');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');
const mongoose = require('mongoose');

// Mock the Auction model
jest.mock('../../models/Auction');

describe('Auction Basic Operations', () => {
  let mockReq;
  let mockRes;
  let mockAuction;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});

    mockAuction = {
      _id: new mongoose.Types.ObjectId(),
      topText: 'Test Auction',
      bottomText: 'Test Description',
      status: 'draft',
      items: [],
      totalValue: 0,
      save: jest.fn(),
    };

    mockReq = {
      params: { id: mockAuction._id.toString() },
      query: {},
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAllAuctions', () => {
    test('should get all auctions successfully', async () => {
      const mockAuctions = [mockAuction];
      Auction.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockAuctions),
      });

      await auctionCrudOperations.getAllAuctions(mockReq, mockRes);

      expect(Auction.find).toHaveBeenCalledWith({});
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockAuctions);
    });

    test('should filter auctions by isActive', async () => {
      mockReq.query.isActive = 'true';
      const activeAuctions = [mockAuction];
      Auction.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(activeAuctions),
      });

      await auctionCrudOperations.getAllAuctions(mockReq, mockRes);

      expect(Auction.find).toHaveBeenCalledWith({ isActive: true });
      expect(mockRes.json).toHaveBeenCalledWith(activeAuctions);
    });
  });

  describe('createAuction', () => {
    test('should create auction successfully', async () => {
      mockReq.body = {
        topText: 'New Auction',
        bottomText: 'Description',
      };

      const savedAuction = { ...mockAuction, save: jest.fn().mockResolvedValue(mockAuction) };
      Auction.mockImplementation(() => savedAuction);

      await auctionCrudOperations.createAuction(mockReq, mockRes);

      expect(Auction).toHaveBeenCalledWith({
        topText: 'New Auction',
        bottomText: 'Description',
        auctionDate: null,
        status: 'draft',
        generatedFacebookPost: '',
        isActive: true,
        items: [],
        totalValue: 0,
      });
      expect(savedAuction.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('should throw ValidationError for missing required fields', async () => {
      mockReq.body = { topText: 'Only top text' };

      await expect(auctionCrudOperations.createAuction(mockReq, mockRes))
        .rejects.toThrow(ValidationError);
      await expect(auctionCrudOperations.createAuction(mockReq, mockRes))
        .rejects.toThrow('Missing required fields: topText and bottomText are required');
    });
  });

  describe('getAuctionById', () => {
    test('should throw ValidationError for invalid ObjectId', async () => {
      mockReq.params.id = 'invalid-id';

      await expect(auctionCrudOperations.getAuctionById(mockReq, mockRes))
        .rejects.toThrow(ValidationError);
      await expect(auctionCrudOperations.getAuctionById(mockReq, mockRes))
        .rejects.toThrow('Invalid ObjectId format');
    });

    test('should throw NotFoundError when auction not found', async () => {
      Auction.findById.mockResolvedValue(null);

      await expect(auctionCrudOperations.getAuctionById(mockReq, mockRes))
        .rejects.toThrow(NotFoundError);
      await expect(auctionCrudOperations.getAuctionById(mockReq, mockRes))
        .rejects.toThrow('Auction not found');
    });
  });

  describe('updateAuction', () => {
    test('should update auction successfully', async () => {
      mockReq.body = {
        topText: 'Updated Auction',
        status: 'active',
      };

      const updatedAuction = { ...mockAuction, topText: 'Updated Auction', status: 'active' };
      Auction.findByIdAndUpdate.mockResolvedValue(updatedAuction);

      await auctionCrudOperations.updateAuction(mockReq, mockRes);

      expect(Auction.findByIdAndUpdate).toHaveBeenCalledWith(
        mockAuction._id.toString(),
        { topText: 'Updated Auction', status: 'active' },
        { new: true, runValidators: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(updatedAuction);
    });

    test('should throw NotFoundError when auction not found', async () => {
      mockReq.body = { topText: 'Updated' };
      Auction.findByIdAndUpdate.mockResolvedValue(null);

      await expect(auctionCrudOperations.updateAuction(mockReq, mockRes))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteAuction', () => {
    test('should delete auction successfully', async () => {
      Auction.findByIdAndDelete.mockResolvedValue(mockAuction);

      await auctionCrudOperations.deleteAuction(mockReq, mockRes);

      expect(Auction.findByIdAndDelete).toHaveBeenCalledWith(mockAuction._id.toString());
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Auction deleted successfully',
      });
    });

    test('should throw ValidationError for invalid ObjectId', async () => {
      mockReq.params.id = 'invalid-id';

      await expect(auctionCrudOperations.deleteAuction(mockReq, mockRes))
        .rejects.toThrow(ValidationError);
    });

    test('should throw NotFoundError when auction not found', async () => {
      Auction.findByIdAndDelete.mockResolvedValue(null);

      await expect(auctionCrudOperations.deleteAuction(mockReq, mockRes))
        .rejects.toThrow(NotFoundError);
    });
  });
});