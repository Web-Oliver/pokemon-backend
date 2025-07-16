// Jest global setup
require('@testing-library/jest-dom');

// Global test timeout
jest.setTimeout(10000);

// Console error suppression for specific warnings
const originalError = console.error;

beforeAll(() => {
  console.error = (...args) => {
    // Suppress MongoDB warnings during tests
    if (
      typeof args[0] === 'string' && 
      (args[0].includes('DeprecationWarning') || 
       args[0].includes('MongooseServerSelectionError'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Global cleanup for all tests
afterEach(() => {
  jest.clearAllMocks();
});

// Extend Jest matchers
expect.extend({
  toBeValidObjectId(received) {
    const pass = /^[0-9a-fA-F]{24}$/.test(received);

    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid ObjectId`,
        pass: true,
      };
    } 
      return {
        message: () => `expected ${received} to be a valid ObjectId`,
        pass: false,
      };
    
  },
  
  toHaveStatusAndSuccess(received, expectedStatus, expectedSuccess = true) {
    const hasCorrectStatus = received.status === expectedStatus;
    const hasCorrectSuccess = received.body && received.body.success === expectedSuccess;
    
    const pass = hasCorrectStatus && hasCorrectSuccess;
    
    if (pass) {
      return {
        message: () => 
          `expected response not to have status ${expectedStatus} and success ${expectedSuccess}`,
        pass: true,
      };
    } 
      return {
        message: () => 
          `expected response to have status ${expectedStatus} and success ${expectedSuccess}, but got status ${received.status} and success ${received.body?.success}`,
        pass: false,
      };
    
  }
});