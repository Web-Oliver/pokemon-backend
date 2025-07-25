/**
 * ValidatorFactory Integration Tests
 * 
 * Tests the centralized validation framework functionality including
 * price validation, ObjectId validation, and entity-specific validations.
 */

const ValidatorFactory = require('../../utils/ValidatorFactory');
const { ValidationError } = require('../../middleware/errorHandler');
const mongoose = require('mongoose');

describe('ValidatorFactory Integration Tests', () => {
  describe('Price Validation', () => {
    it('should validate positive prices', () => {
      expect(() => ValidatorFactory.price(10.99)).not.toThrow();
      expect(() => ValidatorFactory.price(0.01)).not.toThrow();
      expect(() => ValidatorFactory.price(1000)).not.toThrow();
    });

    it('should reject negative prices', () => {
      expect(() => ValidatorFactory.price(-1)).toThrow(ValidationError);
      expect(() => ValidatorFactory.price(-0.01)).toThrow(ValidationError);
    });

    it('should reject zero prices when required', () => {
      expect(() => ValidatorFactory.price(0, { allowZero: false })).toThrow(ValidationError);
    });

    it('should allow zero prices when explicitly allowed', () => {
      expect(() => ValidatorFactory.price(0, { allowZero: true })).not.toThrow();
    });

    it('should reject non-numeric prices', () => {
      expect(() => ValidatorFactory.price('invalid')).toThrow(ValidationError);
      expect(() => ValidatorFactory.price(null)).toThrow(ValidationError);
      expect(() => ValidatorFactory.price(undefined)).toThrow(ValidationError);
    });

    it('should validate price ranges', () => {
      expect(() => ValidatorFactory.price(50, { min: 10, max: 100 })).not.toThrow();
      expect(() => ValidatorFactory.price(5, { min: 10, max: 100 })).toThrow(ValidationError);
      expect(() => ValidatorFactory.price(150, { min: 10, max: 100 })).toThrow(ValidationError);
    });

    it('should handle decimal precision', () => {
      expect(() => ValidatorFactory.price(10.999)).not.toThrow();
      expect(() => ValidatorFactory.price(10.9999, { maxDecimals: 2 })).toThrow(ValidationError);
    });
  });

  describe('ObjectId Validation', () => {
    it('should validate valid ObjectIds', () => {
      const validId = new mongoose.Types.ObjectId();

      expect(() => ValidatorFactory.objectId(validId.toString())).not.toThrow();
      expect(() => ValidatorFactory.objectId(validId)).not.toThrow();
    });

    it('should reject invalid ObjectIds', () => {
      expect(() => ValidatorFactory.objectId('invalid')).toThrow(ValidationError);
      expect(() => ValidatorFactory.objectId('123')).toThrow(ValidationError);
      expect(() => ValidatorFactory.objectId(null)).toThrow(ValidationError);
      expect(() => ValidatorFactory.objectId(undefined)).toThrow(ValidationError);
    });

    it('should handle ObjectId arrays', () => {
      const id1 = new mongoose.Types.ObjectId();
      const id2 = new mongoose.Types.ObjectId();
      
      expect(() => ValidatorFactory.objectIdArray([id1, id2])).not.toThrow();
      expect(() => ValidatorFactory.objectIdArray([id1, 'invalid'])).toThrow(ValidationError);
      expect(() => ValidatorFactory.objectIdArray([])).not.toThrow();
    });

    it('should validate required vs optional ObjectIds', () => {
      expect(() => ValidatorFactory.objectId(null, { required: false })).not.toThrow();
      expect(() => ValidatorFactory.objectId(null, { required: true })).toThrow(ValidationError);
    });
  });

  describe('Image Array Validation', () => {
    it('should validate valid image arrays', () => {
      const validImages = [
        '/uploads/images/card1.jpg',
        '/uploads/images/card2.png'
      ];
      
      expect(() => ValidatorFactory.imageArray(validImages)).not.toThrow();
    });

    it('should reject invalid image URLs', () => {
      const invalidImages = [
        '/uploads/images/card1.jpg',
        'http://external.com/image.jpg' // External URL
      ];
      
      expect(() => ValidatorFactory.imageArray(invalidImages)).toThrow(ValidationError);
    });

    it('should validate image file extensions', () => {
      const invalidExtensions = [
        '/uploads/images/card1.txt',
        '/uploads/images/card2.pdf'
      ];
      
      expect(() => ValidatorFactory.imageArray(invalidExtensions)).toThrow(ValidationError);
    });

    it('should handle empty arrays', () => {
      expect(() => ValidatorFactory.imageArray([])).not.toThrow();
    });

    it('should validate array size limits', () => {
      const tooManyImages = Array(11).fill('/uploads/images/card.jpg');
      
      expect(() => ValidatorFactory.imageArray(tooManyImages, { maxCount: 10 })).toThrow(ValidationError);
    });
  });

  describe('Collection Item Data Validation', () => {
    it('should validate PSA graded card data', () => {
      const validPsaData = {
        cardId: new mongoose.Types.ObjectId(),
        grade: 9,
        myPrice: 25.99,
        images: ['/uploads/images/psa-card.jpg']
      };
      
      expect(() => ValidatorFactory.collectionItemData(validPsaData, 'PsaGradedCard')).not.toThrow();
    });

    it('should validate raw card data', () => {
      const validRawData = {
        cardId: new mongoose.Types.ObjectId(),
        condition: 'Near Mint',
        myPrice: 10.99,
        images: []
      };
      
      expect(() => ValidatorFactory.collectionItemData(validRawData, 'RawCard')).not.toThrow();
    });

    it('should validate sealed product data', () => {
      const validSealedData = {
        productId: new mongoose.Types.ObjectId(),
        category: 'Booster Pack',
        myPrice: 4.99,
        images: []
      };
      
      expect(() => ValidatorFactory.collectionItemData(validSealedData, 'SealedProduct')).not.toThrow();
    });

    it('should reject invalid PSA grades', () => {
      const invalidPsaData = {
        cardId: new mongoose.Types.ObjectId(),
        grade: 11, // Invalid grade
        myPrice: 25.99
      };
      
      expect(() => ValidatorFactory.collectionItemData(invalidPsaData, 'PsaGradedCard')).toThrow(ValidationError);
    });

    it('should reject invalid conditions', () => {
      const invalidRawData = {
        cardId: new mongoose.Types.ObjectId(),
        condition: 'Invalid Condition',
        myPrice: 10.99
      };
      
      expect(() => ValidatorFactory.collectionItemData(invalidRawData, 'RawCard')).toThrow(ValidationError);
    });

    it('should require entity-specific fields', () => {
      const missingGradeData = {
        cardId: new mongoose.Types.ObjectId(),
        myPrice: 25.99
      };
      
      expect(() => ValidatorFactory.collectionItemData(missingGradeData, 'PsaGradedCard')).toThrow(ValidationError);
    });
  });

  describe('Sale Details Validation', () => {
    it('should validate complete sale details', () => {
      const validSaleDetails = {
        actualSoldPrice: 15.99,
        paymentMethod: 'PayPal',
        deliveryMethod: 'Shipping',
        source: 'eBay',
        buyerFullName: 'John Doe',
        buyerEmail: 'john@example.com'
      };
      
      expect(() => ValidatorFactory.saleDetails(validSaleDetails)).not.toThrow();
    });

    it('should require essential sale fields', () => {
      const incompleteSaleDetails = {
        paymentMethod: 'PayPal'
        // Missing actualSoldPrice
      };
      
      expect(() => ValidatorFactory.saleDetails(incompleteSaleDetails)).toThrow(ValidationError);
    });

    it('should validate email format in buyer details', () => {
      const invalidEmailSale = {
        actualSoldPrice: 15.99,
        paymentMethod: 'PayPal',
        buyerEmail: 'invalid-email'
      };
      
      expect(() => ValidatorFactory.saleDetails(invalidEmailSale)).toThrow(ValidationError);
    });

    it('should validate payment methods', () => {
      const invalidPaymentSale = {
        actualSoldPrice: 15.99,
        paymentMethod: 'InvalidMethod'
      };
      
      expect(() => ValidatorFactory.saleDetails(invalidPaymentSale)).toThrow(ValidationError);
    });
  });

  describe('Search Query Validation', () => {
    it('should validate search queries', () => {
      expect(() => ValidatorFactory.searchQuery('Pikachu')).not.toThrow();
      expect(() => ValidatorFactory.searchQuery('Base Set Charizard')).not.toThrow();
    });

    it('should reject empty search queries', () => {
      expect(() => ValidatorFactory.searchQuery('')).toThrow(ValidationError);
      expect(() => ValidatorFactory.searchQuery('   ')).toThrow(ValidationError);
      expect(() => ValidatorFactory.searchQuery(null)).toThrow(ValidationError);
    });

    it('should validate search query length', () => {
      const tooLongQuery = 'a'.repeat(201);

      expect(() => ValidatorFactory.searchQuery(tooLongQuery)).toThrow(ValidationError);
    });

    it('should sanitize search queries', () => {
      const maliciousQuery = '<script>alert("xss")</script>';

      expect(() => ValidatorFactory.searchQuery(maliciousQuery)).toThrow(ValidationError);
    });
  });

  describe('Bulk Validation', () => {
    it('should validate arrays of items', () => {
      const validItems = [
        { cardId: new mongoose.Types.ObjectId(), myPrice: 10.99 },
        { cardId: new mongoose.Types.ObjectId(), myPrice: 15.99 }
      ];
      
      expect(() => ValidatorFactory.bulkItemData(validItems, 'RawCard')).not.toThrow();
    });

    it('should reject arrays with invalid items', () => {
      const mixedItems = [
        { cardId: new mongoose.Types.ObjectId(), myPrice: 10.99 },
        { cardId: 'invalid', myPrice: -5 } // Invalid item
      ];
      
      expect(() => ValidatorFactory.bulkItemData(mixedItems, 'RawCard')).toThrow(ValidationError);
    });

    it('should validate array size limits', () => {
      const tooManyItems = Array(101).fill({ cardId: new mongoose.Types.ObjectId(), myPrice: 10.99 });
      
      expect(() => ValidatorFactory.bulkItemData(tooManyItems, 'RawCard')).toThrow(ValidationError);
    });
  });

  describe('Integration with Services', () => {
    it('should integrate with CollectionService validation', () => {
      const validCardData = {
        cardId: new mongoose.Types.ObjectId(),
        condition: 'Near Mint',
        myPrice: 12.99,
        images: ['/uploads/images/test-card.jpg']
      };
      
      // This should work the same as calling from CollectionService
      expect(() => ValidatorFactory.collectionItemData(validCardData, 'RawCard')).not.toThrow();
    });

    it('should provide consistent error messages across services', () => {
      const invalidData = { myPrice: -10 };
      
      let error;

      try {
        ValidatorFactory.collectionItemData(invalidData, 'RawCard');
      } catch (e) {
        error = e;
      }
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('price');
    });
  });

  describe('Performance', () => {
    it('should validate large datasets efficiently', () => {
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        ValidatorFactory.price(Math.random() * 100);
        ValidatorFactory.objectId(new mongoose.Types.ObjectId());
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete 2000 validations in under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should not cause memory leaks with extensive validation', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      for (let i = 0; i < 10000; i++) {
        try {
          ValidatorFactory.collectionItemData({
            cardId: new mongoose.Types.ObjectId(),
            myPrice: Math.random() * 100,
            condition: 'Near Mint'
          }, 'RawCard');
        } catch (e) {
          // Ignore validation errors for this test
        }
      }
      
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be minimal
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024); // Less than 5MB
    });
  });
});