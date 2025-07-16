const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer = null;

/**
 * Setup in-memory MongoDB instance for testing
 */
async function setupTestDatabase() {
  if (!mongoServer) {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Close existing connection if any
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }
  
  return mongoServer;
}

/**
 * Clean all collections in the database
 */
async function cleanDatabase() {
  if (mongoose.connection.readyState === 1) {
    const {collections} = mongoose.connection;
    
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
}

/**
 * Close database connection and stop MongoDB server
 */
async function teardownTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

/**
 * Get a clean database connection for each test
 */
async function getCleanDatabase() {
  await cleanDatabase();
  return mongoose.connection;
}

/**
 * Create test data for specific collections
 */
async function createTestData(collectionName, data) {
  const collection = mongoose.connection.collection(collectionName);
  
  if (Array.isArray(data)) {
    return await collection.insertMany(data);
  } 
    return await collection.insertOne(data);
  
}

/**
 * Setup and teardown helper for tests
 */
function withDatabase() {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  
  beforeEach(async () => {
    await cleanDatabase();
  });
  
  afterAll(async () => {
    await teardownTestDatabase();
  });
}

module.exports = {
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
  getCleanDatabase,
  createTestData,
  withDatabase,
};