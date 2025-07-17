const mongoose = require('mongoose');

// Mock all dependencies first
jest.mock('../../models/Auction');
jest.mock('../../models/SealedProduct');
jest.mock('../../models/PsaGradedCard');
jest.mock('../../models/RawCard');
jest.mock('../../controllers/auctions/auctionItemHelpers');

const Auction = require('../../models/Auction');
const auctionCrudOperations = require('../../controllers/auctions/auctionCrudOperations');
const auctionItemOperations = require('../../controllers/auctions/auctionItemOperations');
const auctionItemHelpers = require('../../controllers/auctions/auctionItemHelpers');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

describe('Auction CRUD Operations', () => {
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
      save: jest.fn().mockResolvedValue(true),
      toObject: jest.fn().mockReturnValue({
        _id: new mongoose.Types.ObjectId(),
        topText: 'Test Auction',
        bottomText: 'Test Description',
      }),
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

    // Setup default mocks
    auctionItemHelpers.populateAuctionItems = jest.fn().mockResolvedValue(mockAuction);
    auctionItemHelpers.validateAuctionItems = jest.fn().mockResolvedValue(true);
    auctionItemHelpers.validateAndFindItem = jest.fn().mockResolvedValue({});
    auctionItemHelpers.calculateAuctionTotalValue = jest.fn().mockResolvedValue(0);
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

    test('should filter auctions by isActive true', async () => {
      mockReq.query.isActive = 'true';
      const activeAuctions = [mockAuction];
      Auction.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(activeAuctions),
      });

      await auctionCrudOperations.getAllAuctions(mockReq, mockRes);

      expect(Auction.find).toHaveBeenCalledWith({ isActive: true });
    });

    test('should filter auctions by isActive false', async () => {
      mockReq.query.isActive = 'false';
      Auction.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([]),
      });

      await auctionCrudOperations.getAllAuctions(mockReq, mockRes);

      expect(Auction.find).toHaveBeenCalledWith({ isActive: false });
    });
  });

  describe('getAuctionById', () => {
    test('should get auction by ID successfully', async () => {
      Auction.findById.mockResolvedValue(mockAuction);

      await auctionCrudOperations.getAuctionById(mockReq, mockRes);

      expect(Auction.findById).toHaveBeenCalledWith(mockAuction._id.toString());
      expect(auctionItemHelpers.populateAuctionItems).toHaveBeenCalledWith(mockAuction);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockAuction);
    });

    test('should throw ValidationError for invalid ObjectId', async () => {
      mockReq.params.id = 'invalid-id';

      await expect(auctionCrudOperations.getAuctionById(mockReq, mockRes))
        .rejects.toThrow(ValidationError);
    });

    test('should throw NotFoundError when auction not found', async () => {
      Auction.findById.mockResolvedValue(null);

      await expect(auctionCrudOperations.getAuctionById(mockReq, mockRes))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('createAuction', () => {
    test('should create auction successfully with required fields', async () => {
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
      expect(mockRes.json).toHaveBeenCalledWith(mockAuction);
    });

    test('should create auction with all optional fields', async () => {
      mockReq.body = {
        topText: 'Complete Auction',
        bottomText: 'Full Description',
        auctionDate: '2024-12-31',
        status: 'active',
        generatedFacebookPost: 'Facebook post',
        isActive: false,
        totalValue: 5000,
      };

      const savedAuction = { ...mockAuction, save: jest.fn().mockResolvedValue(mockAuction) };
      Auction.mockImplementation(() => savedAuction);

      await auctionCrudOperations.createAuction(mockReq, mockRes);

      expect(Auction).toHaveBeenCalledWith({
        topText: 'Complete Auction',
        bottomText: 'Full Description',
        auctionDate: new Date('2024-12-31'),
        status: 'active',
        generatedFacebookPost: 'Facebook post',
        isActive: false,
        items: [],
        totalValue: 5000,
      });
    });

    test('should validate items when provided', async () => {
      const mockItems = [
        { itemId: new mongoose.Types.ObjectId(), itemCategory: 'PsaGradedCard' },
      ];
      
      mockReq.body = {
        topText: 'Auction with items',
        bottomText: 'Description',
        items: mockItems,
      };

      const savedAuction = { ...mockAuction, save: jest.fn().mockResolvedValue(mockAuction) };
      Auction.mockImplementation(() => savedAuction);

      await auctionCrudOperations.createAuction(mockReq, mockRes);

      expect(auctionItemHelpers.validateAuctionItems).toHaveBeenCalledWith(mockItems);
    });

    test('should throw ValidationError for missing topText', async () => {
      mockReq.body = { bottomText: 'Only bottom text' };

      await expect(auctionCrudOperations.createAuction(mockReq, mockRes))
        .rejects.toThrow(ValidationError);
    });

    test('should throw ValidationError for missing bottomText', async () => {
      mockReq.body = { topText: 'Only top text' };

      await expect(auctionCrudOperations.createAuction(mockReq, mockRes))
        .rejects.toThrow(ValidationError);
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

    test('should update auction with all fields', async () => {
      mockReq.body = {
        topText: 'New Top',
        bottomText: 'New Bottom',
        auctionDate: '2024-12-25',
        status: 'sold',
        generatedFacebookPost: 'New post',
        isActive: false,
        totalValue: 20000,
        soldValue: 15000,
        items: [],
      };

      Auction.findByIdAndUpdate.mockResolvedValue(mockAuction);

      await auctionCrudOperations.updateAuction(mockReq, mockRes);

      expect(Auction.findByIdAndUpdate).toHaveBeenCalledWith(
        mockAuction._id.toString(),
        {
          topText: 'New Top',
          bottomText: 'New Bottom',
          auctionDate: new Date('2024-12-25'),
          status: 'sold',
          generatedFacebookPost: 'New post',
          isActive: false,
          totalValue: 20000,
          soldValue: 15000,
          items: [],
        },
        { new: true, runValidators: true }
      );
      expect(auctionItemHelpers.validateAuctionItems).toHaveBeenCalledWith([]);
    });

    test('should handle null auctionDate', async () => {
      mockReq.body = { auctionDate: null };
      Auction.findByIdAndUpdate.mockResolvedValue(mockAuction);

      await auctionCrudOperations.updateAuction(mockReq, mockRes);

      expect(Auction.findByIdAndUpdate).toHaveBeenCalledWith(
        mockAuction._id.toString(),
        { auctionDate: null },
        { new: true, runValidators: true }
      );
    });

    test('should throw ValidationError for invalid ObjectId', async () => {
      mockReq.params.id = 'invalid-id';

      await expect(auctionCrudOperations.updateAuction(mockReq, mockRes))
        .rejects.toThrow(ValidationError);
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