/**
 * Enhanced Components Simple Integration Tests
 * 
 * Focused integration tests that verify the enhanced components work together
 * correctly with the actual implementations. Tests real-world scenarios.
 */

const Logger = require('../../utils/Logger');
const ValidatorFactory = require('../../utils/ValidatorFactory');
const { ValidationError } = require('../../middleware/errorHandler');
const mongoose = require('mongoose');

describe('Enhanced Components Simple Integration Tests', () => {
  let originalConsoleError; let originalConsoleLog;
  let errorOutput; let logOutput;

  beforeEach(() => {
    // Capture console output
    logOutput = [];
    errorOutput = [];
    
    originalConsoleLog = console.log;
    originalConsoleError = console.error;
    
    console.log = (...args) => logOutput.push(args.join(' '));
    console.error = (...args) => errorOutput.push(args.join(' '));
  });

  afterEach(() => {
    // Restore console
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('Logger and ValidatorFactory Integration', () => {
    it('should log validation operations consistently', () => {
      Logger.operationStart('Validation', 'PRICE_CHECK', { price: 25.99 });
      
      // This should not throw
      ValidatorFactory.price(25.99, 'Test Price');
      
      Logger.operationSuccess('Validation', 'PRICE_CHECK', { valid: true });
      
      expect(logOutput.some(log => log.includes('=== PRICE_CHECK VALIDATION START ==='))).toBe(true);
      expect(logOutput.some(log => log.includes('=== PRICE_CHECK VALIDATION END ==='))).toBe(true);
    });

    it('should log validation errors consistently', () => {
      Logger.operationStart('Validation', 'PRICE_CHECK', { price: -10 });
      
      let validationError;

      try {
        ValidatorFactory.price(-10, 'Invalid Price');
      } catch (error) {
        validationError = error;
        Logger.operationError('Validation', 'PRICE_CHECK', error, { price: -10 });
      }
      
      expect(validationError).toBeInstanceOf(ValidationError);
      expect(errorOutput.some(log => log.includes('=== PRICE_CHECK VALIDATION ERROR ==='))).toBe(true);
      expect(errorOutput.some(log => log.includes('must be a non-negative number'))).toBe(true);
    });
  });

  describe('Real Collection Item Validation Flow', () => {
    it('should validate a complete PSA card creation flow', () => {
      const cardData = {
        cardId: new mongoose.Types.ObjectId().toString(),
        myPrice: 299.99,
        images: ['/uploads/images/charizard-psa9.jpg'],
        sold: false,
        dateAdded: new Date()
      };

      Logger.operationStart('Card', 'CREATE_PSA', { cardName: 'Charizard PSA 9' });

      // Validate all fields
      expect(() => {
        ValidatorFactory.objectId(cardData.cardId, 'Card ID');
        ValidatorFactory.price(cardData.myPrice, 'Price');
        ValidatorFactory.imageArray(cardData.images, 'Images');
        ValidatorFactory.boolean(cardData.sold, 'Sold status');
        ValidatorFactory.date(cardData.dateAdded, 'Date added');
      }).not.toThrow();

      Logger.operationSuccess('Card', 'CREATE_PSA', { id: cardData.cardId });

      expect(logOutput.some(log => log.includes('=== CREATE_PSA CARD START ==='))).toBe(true);
      expect(logOutput.some(log => log.includes('=== CREATE_PSA CARD END ==='))).toBe(true);
    });

    it('should handle validation failures in collection flow', () => {
      const invalidCardData = {
        cardId: 'invalid-id',
        myPrice: -50,
        images: ['not-an-upload-path'],
        sold: 'not-boolean'
      };

      Logger.operationStart('Card', 'CREATE_INVALID', { cardName: 'Invalid Card' });

      const errors = [];

      // Test each validation and collect errors
      try {
        ValidatorFactory.objectId(invalidCardData.cardId, 'Card ID');
      } catch (error) {
        errors.push(error);
      }

      try {
        ValidatorFactory.price(invalidCardData.myPrice, 'Price');
      } catch (error) {
        errors.push(error);
      }

      try {
        ValidatorFactory.boolean(invalidCardData.sold, 'Sold status');
      } catch (error) {
        errors.push(error);
      }

      expect(errors).toHaveLength(3);
      expect(errors.every(error => error instanceof ValidationError)).toBe(true);

      // Log the validation failure
      const combinedError = new Error(`Validation failed: ${errors.map(e => e.message).join(', ')}`);

      Logger.operationError('Card', 'CREATE_INVALID', combinedError, { errorCount: errors.length });

      expect(errorOutput.some(log => log.includes('=== CREATE_INVALID CARD ERROR ==='))).toBe(true);
    });
  });

  describe('Sale Details Validation Integration', () => {
    it('should validate complete sale details', () => {
      const saleDetails = {
        actualSoldPrice: 150.00,
        paymentMethod: 'paypal',
        deliveryMethod: 'shipping',
        buyerEmail: 'buyer@example.com',
        dateSold: new Date()
      };

      Logger.operationStart('Sale', 'VALIDATE_DETAILS', { price: saleDetails.actualSoldPrice });

      expect(() => {
        ValidatorFactory.saleDetails(saleDetails);
      }).not.toThrow();

      Logger.operationSuccess('Sale', 'VALIDATE_DETAILS', { valid: true });

      expect(logOutput.some(log => log.includes('=== VALIDATE_DETAILS SALE START ==='))).toBe(true);
    });

    it('should reject invalid sale details', () => {
      const invalidSaleDetails = {
        actualSoldPrice: -10,
        paymentMethod: 'invalid_method',
        buyerEmail: 'not-an-email'
      };

      Logger.operationStart('Sale', 'VALIDATE_INVALID', { price: invalidSaleDetails.actualSoldPrice });

      expect(() => {
        ValidatorFactory.saleDetails(invalidSaleDetails);
      }).toThrow(ValidationError);

      Logger.operationError('Sale', 'VALIDATE_INVALID', new Error('Invalid sale details'));

      expect(errorOutput.some(log => log.includes('=== VALIDATE_INVALID SALE ERROR ==='))).toBe(true);
    });
  });

  describe('Performance Integration', () => {
    it('should handle bulk validation with logging efficiently', () => {
      const startTime = Date.now();
      
      Logger.operationStart('Bulk', 'VALIDATE_100_ITEMS', { count: 100 });

      // Validate 100 items
      for (let i = 0; i < 100; i++) {
        const itemData = {
          cardId: new mongoose.Types.ObjectId().toString(),
          myPrice: Math.random() * 100 + 1,
          sold: false
        };

        ValidatorFactory.objectId(itemData.cardId);
        ValidatorFactory.price(itemData.myPrice);
        ValidatorFactory.boolean(itemData.sold);
      }

      const duration = Date.now() - startTime;

      Logger.performance('Bulk Validation', duration, { itemCount: 100 });
      Logger.operationSuccess('Bulk', 'VALIDATE_100_ITEMS', { duration, itemsPerSecond: Math.round(100 / (duration / 1000)) });

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
      expect(logOutput.some(log => log.includes('[PERFORMANCE]'))).toBe(true);
      expect(logOutput.some(log => log.includes('=== VALIDATE_100_ITEMS BULK END ==='))).toBe(true);
    });
  });

  describe('Error Handling Integration', () => {
    it('should provide consistent error handling across components', () => {
      const testScenarios = [
        { name: 'Invalid ObjectId', test: () => ValidatorFactory.objectId('invalid') },
        { name: 'Negative Price', test: () => ValidatorFactory.price(-10) },
        { name: 'Invalid Email', test: () => ValidatorFactory.email('not-email') },
        { name: 'Invalid Boolean', test: () => ValidatorFactory.boolean('not-boolean') }
      ];

      testScenarios.forEach(scenario => {
        Logger.operationStart('ErrorTest', scenario.name.toUpperCase().replace(/\s+/g, '_'));
        
        let caughtError;

        try {
          scenario.test();
        } catch (error) {
          caughtError = error;
          Logger.operationError('ErrorTest', scenario.name.toUpperCase().replace(/\s+/g, '_'), error);
        }

        expect(caughtError).toBeInstanceOf(ValidationError);
        expect(caughtError.message).toBeTruthy();
      });

      // Should have logged all error scenarios
      expect(errorOutput.filter(log => log.includes('=== ') && log.includes('ERRORTEST') && log.includes('ERROR ==='))).toHaveLength(4);
    });
  });

  describe('Service Integration Patterns', () => {
    it('should demonstrate typical service method pattern', () => {
      // Simulate a typical service method that uses both logging and validation
      const simulateServiceMethod = (entityType, operation, data) => {
        Logger.operationStart(entityType, operation, { dataKeys: Object.keys(data) });

        try {
          // Validate input data
          ValidatorFactory.collectionItemData(data, entityType);
          
          // Simulate processing
          const result = { id: new mongoose.Types.ObjectId().toString(), ...data, processed: true };
          
          Logger.operationSuccess(entityType, operation, { id: result.id });
          return result;
        } catch (error) {
          Logger.operationError(entityType, operation, error, { data });
          throw error;
        }
      };

      // Test successful case
      const validData = {
        myPrice: 25.99,
        images: ['/uploads/test.jpg'],
        sold: false
      };

      const result = simulateServiceMethod('Card', 'CREATE', validData);

      expect(result.processed).toBe(true);
      expect(result.myPrice).toBe(25.99);

      // Test failure case
      const invalidData = {
        myPrice: -10,
        sold: 'invalid'
      };

      expect(() => {
        simulateServiceMethod('Card', 'CREATE_INVALID', invalidData);
      }).toThrow(ValidationError);

      // Verify logging occurred for both cases
      expect(logOutput.some(log => log.includes('=== CREATE CARD START ==='))).toBe(true);
      expect(logOutput.some(log => log.includes('=== CREATE CARD END ==='))).toBe(true);
      expect(errorOutput.some(log => log.includes('=== CREATE_INVALID CARD ERROR ==='))).toBe(true);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory with extensive logging and validation', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        Logger.operationStart('Memory', 'TEST', { iteration: i });
        
        try {
          ValidatorFactory.price(Math.random() * 100);
          ValidatorFactory.objectId(new mongoose.Types.ObjectId().toString());
          Logger.operationSuccess('Memory', 'TEST', { iteration: i });
        } catch (error) {
          Logger.operationError('Memory', 'TEST', error);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for 1000 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});