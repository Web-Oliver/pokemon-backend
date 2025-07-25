/**
 * Test Helper Utilities
 * 
 * Common utilities and helpers for integration and unit tests.
 * Provides consistent test data creation, mocking, and assertion helpers.
 */

const mongoose = require('mongoose');

/**
 * Database Test Helpers
 */
class DatabaseHelpers {
  /**
   * Creates test documents in the database
   * @param {string} modelName - Name of the Mongoose model
   * @param {Array|Object} data - Data to create
   * @returns {Promise<Array|Object>} Created documents
   */
  static async createTestDocuments(modelName, data) {
    const Model = mongoose.model(modelName);
    
    if (Array.isArray(data)) {
      return await Model.insertMany(data);
    } 
      return await Model.create(data);
    
  }

  /**
   * Clears all documents from a collection
   * @param {string} modelName - Name of the Mongoose model
   */
  static async clearCollection(modelName) {
    const Model = mongoose.model(modelName);

    await Model.deleteMany({});
  }

  /**
   * Gets document count for a collection
   * @param {string} modelName - Name of the Mongoose model
   * @returns {Promise<number>} Document count
   */
  static async getDocumentCount(modelName) {
    const Model = mongoose.model(modelName);

    return await Model.countDocuments();
  }

  /**
   * Creates a test database connection
   * @returns {Promise<Connection>} Database connection
   */
  static async createConnection() {
    return mongoose.connection;
  }
}

/**
 * Mock Data Generators
 */
class MockDataGenerators {
  /**
   * Generates mock card data
   * @param {Object} overrides - Properties to override
   * @returns {Object} Mock card data
   */
  static generateCard(overrides = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      cardName: 'Test Card',
      setName: 'Test Set',
      myPrice: Math.random() * 100 + 1,
      condition: 'Near Mint',
      sold: false,
      dateAdded: new Date(),
      priceHistory: [],
      images: [],
      ...overrides
    };
  }

  /**
   * Generates mock PSA graded card data
   * @param {Object} overrides - Properties to override
   * @returns {Object} Mock PSA card data
   */
  static generatePsaCard(overrides = {}) {
    return {
      ...this.generateCard(),
      grade: Math.floor(Math.random() * 10) + 1,
      cardId: {
        cardName: 'Test PSA Card',
        setId: { setName: 'Test Set' }
      },
      ...overrides
    };
  }

  /**
   * Generates mock sealed product data
   * @param {Object} overrides - Properties to override
   * @returns {Object} Mock sealed product data
   */
  static generateSealedProduct(overrides = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Booster Pack',
      setName: 'Test Set',
      category: 'Booster Pack',
      myPrice: Math.random() * 20 + 1,
      sold: false,
      dateAdded: new Date(),
      priceHistory: [],
      images: [],
      ...overrides
    };
  }

  /**
   * Generates mock activity data
   * @param {Object} overrides - Properties to override
   * @returns {Object} Mock activity data
   */
  static generateActivity(overrides = {}) {
    return {
      _id: new mongoose.Types.ObjectId(),
      type: 'card_added',
      title: 'Test Activity',
      description: 'Test activity description',
      details: 'Test activity details',
      priority: 'medium',
      entityType: 'raw_card',
      entityId: new mongoose.Types.ObjectId(),
      metadata: {},
      timestamp: new Date(),
      status: 'active',
      ...overrides
    };
  }

  /**
   * Generates multiple mock items
   * @param {Function} generator - Generator function to use
   * @param {number} count - Number of items to generate
   * @param {Object} baseOverrides - Base overrides for all items
   * @returns {Array} Array of mock items
   */
  static generateMultiple(generator, count, baseOverrides = {}) {
    return Array(count).fill(null).map((_, index) => 
      generator({ ...baseOverrides, index })
    );
  }
}

/**
 * HTTP Request/Response Helpers
 */
class HttpHelpers {
  /**
   * Creates a comprehensive mock request object
   * @param {Object} overrides - Properties to override
   * @returns {Object} Mock request object
   */
  static createMockRequest(overrides = {}) {
    return {
      params: {},
      query: {},
      body: {},
      headers: {
        'content-type': 'application/json',
        'user-agent': 'test-agent'
      },
      method: 'GET',
      url: '/test',
      originalUrl: '/test',
      path: '/test',
      user: null,
      ip: '127.0.0.1',
      get: jest.fn((header) => this.headers[header.toLowerCase()]),
      ...overrides
    };
  }

  /**
   * Creates a comprehensive mock response object
   * @returns {Object} Mock response object
   */
  static createMockResponse() {
    const res = {
      locals: {},
      headersSent: false,
      statusCode: 200
    };

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    res.get = jest.fn();
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    res.render = jest.fn().mockReturnValue(res);

    return res;
  }

  /**
   * Creates a mock next function
   * @returns {Function} Mock next function
   */
  static createMockNext() {
    return jest.fn();
  }

  /**
   * Simulates an HTTP request/response cycle
   * @param {Function} middleware - Middleware function to test
   * @param {Object} reqOptions - Request options
   * @param {Object} resOptions - Response options
   * @returns {Promise<Object>} Response object after middleware execution
   */
  static async simulateRequest(middleware, reqOptions = {}, resOptions = {}) {
    const req = this.createMockRequest(reqOptions);
    const res = this.createMockResponse();
    const next = this.createMockNext();

    Object.assign(res, resOptions);

    await middleware(req, res, next);

    return { req, res, next };
  }
}

/**
 * Assertion Helpers
 */
class AssertionHelpers {
  /**
   * Asserts that a response has the expected structure
   * @param {Object} response - Response object to check
   * @param {Object} expectedStructure - Expected structure
   */
  static assertResponseStructure(response, expectedStructure) {
    expect(response).toMatchObject(expectedStructure);
    
    if (expectedStructure.success !== undefined) {
      expect(response.success).toBe(expectedStructure.success);
    }
    
    if (expectedStructure.data !== undefined) {
      expect(response.data).toBeDefined();
    }
    
    if (expectedStructure.error !== undefined) {
      expect(response.error).toBeDefined();
    }
    
    expect(response.timestamp).toBeDefined();
    expect(response.requestId).toBeDefined();
  }

  /**
   * Asserts that an API response follows standard format
   * @param {Object} response - Response object to check
   */
  static assertStandardApiResponse(response) {
    expect(response).toHaveProperty('success');
    expect(response).toHaveProperty('timestamp');
    expect(response).toHaveProperty('requestId');
    
    if (response.success) {
      expect(response).toHaveProperty('data');
    } else {
      expect(response).toHaveProperty('error');
    }
  }

  /**
   * Asserts that pagination metadata is correct
   * @param {Object} pagination - Pagination object to check
   * @param {Object} expected - Expected pagination values
   */
  static assertPaginationStructure(pagination, expected = {}) {
    expect(pagination).toHaveProperty('total');
    expect(pagination).toHaveProperty('page');
    expect(pagination).toHaveProperty('limit');
    expect(pagination).toHaveProperty('totalPages');
    expect(pagination).toHaveProperty('hasNext');
    expect(pagination).toHaveProperty('hasPrev');
    
    if (expected.total !== undefined) {
      expect(pagination.total).toBe(expected.total);
    }
    
    if (expected.page !== undefined) {
      expect(pagination.page).toBe(expected.page);
    }
  }

  /**
   * Asserts that search results have the expected structure
   * @param {Object} searchResults - Search results to check
   */
  static assertSearchResultsStructure(searchResults) {
    expect(searchResults).toHaveProperty('results');
    expect(searchResults).toHaveProperty('summary');
    expect(searchResults).toHaveProperty('query');
    
    expect(searchResults.summary).toHaveProperty('total');
    expect(searchResults.query).toHaveProperty('term');
    
    if (searchResults.results.cards) {
      expect(Array.isArray(searchResults.results.cards)).toBe(true);
    }
    
    if (searchResults.results.sets) {
      expect(Array.isArray(searchResults.results.sets)).toBe(true);
    }
    
    if (searchResults.results.products) {
      expect(Array.isArray(searchResults.results.products)).toBe(true);
    }
  }

  /**
   * Asserts that an error response has the expected structure
   * @param {Object} errorResponse - Error response to check
   * @param {number} expectedStatus - Expected HTTP status code
   */
  static assertErrorResponse(errorResponse, expectedStatus) {
    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toBeDefined();
    expect(errorResponse.error.message).toBeDefined();
    expect(errorResponse.error.code).toBe(expectedStatus);
  }
}

/**
 * Performance Testing Helpers
 */
class PerformanceHelpers {
  /**
   * Measures execution time of a function
   * @param {Function} fn - Function to measure
   * @param {...any} args - Arguments to pass to function
   * @returns {Promise<Object>} Result and execution time
   */
  static async measureExecutionTime(fn, ...args) {
    const startTime = process.hrtime.bigint();
    const result = await fn(...args);
    const endTime = process.hrtime.bigint();
    
    const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    return { result, executionTime };
  }

  /**
   * Measures memory usage of a function
   * @param {Function} fn - Function to measure
   * @param {...any} args - Arguments to pass to function
   * @returns {Promise<Object>} Result and memory usage
   */
  static async measureMemoryUsage(fn, ...args) {
    const initialMemory = process.memoryUsage();
    const result = await fn(...args);
    const finalMemory = process.memoryUsage();
    
    const memoryDelta = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external
    };
    
    return { result, memoryDelta };
  }

  /**
   * Runs a performance benchmark
   * @param {Function} fn - Function to benchmark
   * @param {number} iterations - Number of iterations
   * @param {...any} args - Arguments to pass to function
   * @returns {Promise<Object>} Benchmark results
   */
  static async benchmark(fn, iterations = 100, ...args) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const { executionTime } = await this.measureExecutionTime(fn, ...args);

      times.push(executionTime);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return {
      iterations,
      avgTime,
      minTime,
      maxTime,
      totalTime: times.reduce((sum, time) => sum + time, 0)
    };
  }
}

/**
 * Async Testing Helpers
 */
class AsyncHelpers {
  /**
   * Waits for a condition to be true
   * @param {Function} condition - Condition function
   * @param {number} timeout - Timeout in milliseconds
   * @param {number} interval - Check interval in milliseconds
   * @returns {Promise<void>}
   */
  static async waitForCondition(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      
      await this.wait(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Waits for a specified amount of time
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Runs multiple async operations concurrently
   * @param {Array<Function>} operations - Array of async functions
   * @returns {Promise<Array>} Results of all operations
   */
  static async runConcurrently(operations) {
    return await Promise.all(operations.map(op => op()));
  }

  /**
   * Runs async operations in sequence
   * @param {Array<Function>} operations - Array of async functions
   * @returns {Promise<Array>} Results of all operations
   */
  static async runSequentially(operations) {
    const results = [];
    
    for (const operation of operations) {
      results.push(await operation());
    }
    
    return results;
  }
}

module.exports = {
  DatabaseHelpers,
  MockDataGenerators,
  HttpHelpers,
  AssertionHelpers,
  PerformanceHelpers,
  AsyncHelpers
};