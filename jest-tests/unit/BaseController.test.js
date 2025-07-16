const BaseController = require('../../controllers/base/BaseController');
const { NotFoundError, ValidationError } = require('../../middleware/errorHandler');
const { withDatabase } = require('../helpers/database.helper');

// Mock the container before requiring
jest.mock('../../container', () => ({
  resolve: jest.fn(),
}));

const mockContainer = require('../../container');

describe('BaseController', () => {
  let controller;
  let mockService;
  let mockRequest;
  let mockResponse;

  withDatabase();

  beforeEach(() => {
    // Mock service methods
    mockService = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      markAsSold: jest.fn(),
    };

    // Mock container resolution
    mockContainer.resolve.mockReturnValue(mockService);

    // Create controller instance
    controller = new BaseController('testService', {
      entityName: 'TestEntity',
      pluralName: 'testEntities',
      defaultPopulate: 'relatedField',
      defaultSort: { createdAt: -1 },
      defaultLimit: 10,
    });

    // Mock Express request and response objects
    mockRequest = {
      params: {},
      query: {},
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    // Mock console methods to reduce test noise
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Constructor', () => {
    test('should initialize with correct service name and options', () => {
      expect(mockContainer.resolve).toHaveBeenCalledWith('testService');
      expect(controller.serviceName).toBe('testService');
      expect(controller.service).toBe(mockService);
      expect(controller.options.entityName).toBe('TestEntity');
      expect(controller.options.pluralName).toBe('testEntities');
      expect(controller.options.defaultPopulate).toBe('relatedField');
    });

    test('should use default options when not provided', () => {
      const defaultController = new BaseController('defaultService');

      expect(defaultController.options.entityName).toBe('Entity');
      expect(defaultController.options.pluralName).toBe('entities');
      expect(defaultController.options.defaultLimit).toBe(15);
    });

    test('should bind methods to maintain context', () => {
      expect(typeof controller.getAll).toBe('function');
      expect(typeof controller.getById).toBe('function');
      expect(typeof controller.create).toBe('function');
      expect(typeof controller.update).toBe('function');
      expect(typeof controller.delete).toBe('function');
      expect(typeof controller.markAsSold).toBe('function');
    });
  });

  describe('getAll', () => {
    test('should successfully get all entities', async () => {
      const mockEntities = [
        { _id: '123', name: 'Entity 1' },
        { _id: '456', name: 'Entity 2' },
      ];

      mockService.getAll.mockResolvedValue(mockEntities);
      mockRequest.query = { limit: '5' };

      await controller.getAll(mockRequest, mockResponse);

      expect(mockService.getAll).toHaveBeenCalledWith(
        {},
        {
          populate: 'relatedField',
          sort: { createdAt: -1 },
          limit: 5,
        }
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: mockEntities,
      });
    });

    test('should use default limit when not provided', async () => {
      mockService.getAll.mockResolvedValue([]);

      await controller.getAll(mockRequest, mockResponse);

      expect(mockService.getAll).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          limit: 10,
        })
      );
    });

    test('should handle service errors', async () => {
      const error = new Error('Service error');

      mockService.getAll.mockRejectedValue(error);

      await expect(controller.getAll(mockRequest, mockResponse)).rejects.toThrow('Service error');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    test('should successfully get entity by ID', async () => {
      const mockEntity = { _id: '123', name: 'Test Entity' };

      mockService.getById.mockResolvedValue(mockEntity);
      mockRequest.params.id = '123';

      await controller.getById(mockRequest, mockResponse);

      expect(mockService.getById).toHaveBeenCalledWith('123', {
        populate: 'relatedField',
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEntity,
      });
    });

    test('should handle service errors for getById', async () => {
      const error = new NotFoundError('Entity not found');

      mockService.getById.mockRejectedValue(error);
      mockRequest.params.id = '999';

      await expect(controller.getById(mockRequest, mockResponse)).rejects.toThrow('Entity not found');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('create', () => {
    test('should successfully create entity', async () => {
      const mockEntity = { _id: '123', name: 'New Entity' };
      const requestData = { name: 'New Entity' };

      mockService.create.mockResolvedValue(mockEntity);
      mockRequest.body = requestData;

      await controller.create(mockRequest, mockResponse);

      expect(mockService.create).toHaveBeenCalledWith(requestData, {
        populate: 'relatedField',
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEntity,
      });
    });

    test('should handle validation errors', async () => {
      const error = new ValidationError('Invalid data');

      mockService.create.mockRejectedValue(error);
      mockRequest.body = { invalid: 'data' };

      await expect(controller.create(mockRequest, mockResponse)).rejects.toThrow('Invalid data');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    test('should successfully update entity', async () => {
      const mockEntity = { _id: '123', name: 'Updated Entity' };
      const updateData = { name: 'Updated Entity' };

      mockService.update.mockResolvedValue(mockEntity);
      mockRequest.params.id = '123';
      mockRequest.body = updateData;

      await controller.update(mockRequest, mockResponse);

      expect(mockService.update).toHaveBeenCalledWith('123', updateData, {
        populate: 'relatedField',
      });

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEntity,
      });
    });

    test('should handle update errors', async () => {
      const error = new NotFoundError('Entity not found');

      mockService.update.mockRejectedValue(error);
      mockRequest.params.id = '999';
      mockRequest.body = { name: 'Updated' };

      await expect(controller.update(mockRequest, mockResponse)).rejects.toThrow('Entity not found');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    test('should successfully delete entity', async () => {
      const mockEntity = { _id: '123', name: 'Deleted Entity' };

      mockService.delete.mockResolvedValue(mockEntity);
      mockRequest.params.id = '123';

      await controller.delete(mockRequest, mockResponse);

      expect(mockService.delete).toHaveBeenCalledWith('123');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'TestEntity deleted successfully',
      });
    });

    test('should handle delete errors', async () => {
      const error = new NotFoundError('Entity not found');

      mockService.delete.mockRejectedValue(error);
      mockRequest.params.id = '999';

      await expect(controller.delete(mockRequest, mockResponse)).rejects.toThrow('Entity not found');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('markAsSold', () => {
    test('should successfully mark entity as sold', async () => {
      const mockEntity = { _id: '123', name: 'Sold Entity', sold: true };
      const saleDetails = {
        paymentStatus: 'completed',
        salePrice: 100,
        buyerName: 'John Doe',
      };

      mockService.markAsSold.mockResolvedValue(mockEntity);
      mockRequest.params.id = '123';
      mockRequest.body = { saleDetails };

      await controller.markAsSold(mockRequest, mockResponse);

      expect(mockService.markAsSold).toHaveBeenCalledWith('123', saleDetails);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockEntity,
      });
    });

    test('should extract sale details from root of request body', async () => {
      const mockEntity = { _id: '123', name: 'Sold Entity', sold: true };
      const saleDetails = {
        paymentStatus: 'completed',
        salePrice: 100,
      };

      mockService.markAsSold.mockResolvedValue(mockEntity);
      mockRequest.params.id = '123';
      mockRequest.body = saleDetails;

      await controller.markAsSold(mockRequest, mockResponse);

      expect(mockService.markAsSold).toHaveBeenCalledWith('123', saleDetails);
    });

    test('should throw error when markAsSold is not supported', async () => {
      const controllerWithoutSold = new BaseController('testService', {
        includeMarkAsSold: false,
      });

      mockRequest.params.id = '123';

      await expect(
        controllerWithoutSold.markAsSold(mockRequest, mockResponse)
      ).rejects.toThrow('Mark as sold not supported for this resource');
    });

    test('should handle markAsSold service errors', async () => {
      const error = new NotFoundError('Entity not found');

      mockService.markAsSold.mockRejectedValue(error);
      mockRequest.params.id = '999';
      mockRequest.body = { saleDetails: {} };

      await expect(controller.markAsSold(mockRequest, mockResponse)).rejects.toThrow(
        'Entity not found'
      );
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('Error Handling and Logging', () => {
    test('should log appropriate messages for successful operations', async () => {
      const mockEntity = { _id: '123', name: 'Test Entity' };

      mockService.getById.mockResolvedValue(mockEntity);
      mockRequest.params.id = '123';

      await controller.getById(mockRequest, mockResponse);

      expect(console.log).toHaveBeenCalledWith(
        '=== GET TESTENTITY BY ID START ==='
      );
      expect(console.log).toHaveBeenCalledWith('ID:', '123');
      expect(console.log).toHaveBeenCalledWith(
        '=== GET TESTENTITY BY ID END ==='
      );
    });

    test('should log error messages for failed operations', async () => {
      const error = new Error('Service failure');

      mockService.getById.mockRejectedValue(error);
      mockRequest.params.id = '123';

      await expect(controller.getById(mockRequest, mockResponse)).rejects.toThrow();

      expect(console.error).toHaveBeenCalledWith(
        '=== GET TESTENTITY BY ID ERROR ==='
      );
      expect(console.error).toHaveBeenCalledWith('Error:', 'Service failure');
    });
  });

  describe('Integration with Container', () => {
    test('should resolve service from container correctly', () => {
      expect(mockContainer.resolve).toHaveBeenCalledWith('testService');
      expect(controller.service).toBe(mockService);
    });

    test('should handle container resolution errors', () => {
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Service not found');
      });

      expect(() => {
        new BaseController('nonExistentService');
      }).toThrow('Service not found');
    });
  });
});