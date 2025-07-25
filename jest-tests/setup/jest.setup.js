/**
 * Jest Test Setup
 * 
 * Global setup for Jest tests including database connection,
 * test utilities, and common mocks.
 */

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Global test variables
let mongoServer;

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
  // Start in-memory MongoDB instance
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(mongoUri);
  
  console.log('Connected to in-memory MongoDB for testing');
});

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
  // Close database connection
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  
  // Stop the in-memory MongoDB instance
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  console.log('Disconnected from in-memory MongoDB');
});

/**
 * Test cleanup - runs before each test
 */
beforeEach(async () => {
  // Clear all collections before each test
  const {collections} = mongoose.connection;
  
  for (const key in collections) {
    const collection = collections[key];

    await collection.deleteMany({});
  }
});

/**
 * Global test utilities
 */
global.testUtils = {
  /**
   * Creates a test database connection
   */
  async createTestConnection() {
    return mongoose.connection;
  },
  
  /**
   * Creates test data for various entities
   */
  createTestData: {
    card: (overrides = {}) => ({
      cardName: 'Test Card',
      setName: 'Test Set',
      myPrice: 10.99,
      condition: 'Near Mint',
      sold: false,
      dateAdded: new Date(),
      priceHistory: [],
      images: [],
      ...overrides
    }),
    
    psaCard: (overrides = {}) => ({
      cardName: 'Test PSA Card',
      setName: 'Test Set',
      grade: 9,
      myPrice: 25.99,
      sold: false,
      dateAdded: new Date(),
      priceHistory: [],
      images: [],
      ...overrides
    }),
    
    sealedProduct: (overrides = {}) => ({
      name: 'Test Booster Pack',
      setName: 'Test Set',
      category: 'Booster Pack',
      myPrice: 4.99,
      sold: false,
      dateAdded: new Date(),
      priceHistory: [],
      images: [],
      ...overrides
    }),
    
    activity: (overrides = {}) => ({
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
    })
  },
  
  /**
   * Waits for a specified amount of time
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  /**
   * Creates a mock Express request object
   */
  createMockReq(overrides = {}) {
    return {
      params: {},
      query: {},
      body: {},
      headers: {},
      user: null,
      ...overrides
    };
  },
  
  /**
   * Creates a mock Express response object
   */
  createMockRes() {
    const res = {};

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    res.set = jest.fn().mockReturnValue(res);
    return res;
  },
  
  /**
   * Creates a mock next function
   */
  createMockNext() {
    return jest.fn();
  }
};

// Suppress console.log during tests unless explicitly needed
if (process.env.NODE_ENV === 'test' && !process.env.VERBOSE_TESTS) {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/pokemon_collection_test';