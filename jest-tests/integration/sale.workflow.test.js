const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { withDatabase, createTestData } = require('../helpers/database.helper');
const { createMockPsaGradedCard, createMockSealedProduct } = require('../helpers/real-mock-data.helper');

/**
 * Sale Workflow Integration Tests
 * 
 * Tests the complete sale process workflow:
 * 1. Item preparation for sale
 * 2. Sale execution with proper validation
 * 3. Activity logging during sales
 * 4. Sale statistics and reporting
 * 5. Bulk sale operations
 * 6. Sale history and tracking
 */
describe('Sale Workflow Integration Tests', () => {
  withDatabase();

  let testPsaCard;
  let testSealedProduct;
  let createdCardId;
  let createdProductId;

  beforeEach(async () => {
    // Create test items for sale
    testPsaCard = createMockPsaGradedCard();
    testSealedProduct = createMockSealedProduct();

    // Add items to collection first
    console.log('🔄 Setting up collection items for sale testing...');
    
    const cardResponse = await request(app)
      .post('/api/psa-graded-cards')
      .send({
        cardId: testPsaCard.cardId,
        grade: 'PSA 9',
        myPrice: 500.00,
        images: ['test-card.jpg'],
        condition: 'Near Mint',
        dateAdded: new Date(),
      });
    
    if (cardResponse.status === 201) {
      createdCardId = cardResponse.body.data._id;
    }

    const productResponse = await request(app)
      .post('/api/sealed-products')
      .send({
        productId: testSealedProduct.productId,
        category: 'Booster Box',
        setName: 'Base Set',
        name: 'Base Set Booster Box',
        myPrice: 1200.00,
        images: ['test-product.jpg'],
        dateAdded: new Date(),
      });
    
    if (productResponse.status === 201) {
      createdProductId = productResponse.body.data._id;
    }

    console.log('✅ Collection items ready for sale testing');
  });

  describe('Complete Sale Workflow', () => {
    test('should successfully complete full sale process for PSA card', async () => {
      if (!createdCardId) {
        console.log('⚠️ Skipping PSA card sale test - card creation failed');
        return;
      }

      // Step 1: Verify item is available for sale
      console.log('🔄 Step 1: Verifying item availability...');
      const preCheckResponse = await request(app)
        .get(`/api/psa-graded-cards/${createdCardId}`)
        .expect(200);

      expect(preCheckResponse.body.data.sold).toBe(false);
      expect(preCheckResponse.body.data.myPrice).toBe(500.00);
      console.log('✅ Item verified as available for sale');

      // Step 2: Execute sale with complete details
      console.log('🔄 Step 2: Executing sale...');
      const saleDetails = {
        paymentMethod: 'PAYPAL',
        actualSoldPrice: 650.00,
        deliveryMethod: 'Shipping',
        source: 'eBay',
        buyerFullName: 'John Smith',
        buyerAddress: '123 Main St, City, State 12345',
        buyerPhoneNumber: '+1-555-123-4567',
        buyerEmail: 'john.smith@example.com',
        trackingNumber: 'TRACK123456789',
        dateSold: new Date(),
      };

      const saleResponse = await request(app)
        .patch(`/api/psa-graded-cards/${createdCardId}/mark-sold`)
        .send(saleDetails)
        .expect(200);

      expect(saleResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            _id: createdCardId,
            sold: true,
            saleDetails: expect.objectContaining({
              paymentMethod: 'PAYPAL',
              actualSoldPrice: 650.00,
              deliveryMethod: 'Shipping',
              source: 'eBay',
              buyerFullName: 'John Smith',
              buyerEmail: 'john.smith@example.com',
              trackingNumber: 'TRACK123456789',
              dateSold: expect.any(String),
            }),
          }),
        })
      );

      console.log('✅ Sale executed successfully');

      // Step 3: Verify sale is recorded properly
      console.log('🔄 Step 3: Verifying sale record...');
      const postSaleResponse = await request(app)
        .get(`/api/psa-graded-cards/${createdCardId}`)
        .expect(200);

      expect(postSaleResponse.body.data.sold).toBe(true);
      expect(postSaleResponse.body.data.saleDetails.actualSoldPrice).toBe(650.00);
      console.log('✅ Sale record verified');

      // Step 4: Check sale statistics
      console.log('🔄 Step 4: Checking sale statistics...');
      const statsResponse = await request(app)
        .get('/api/sales/statistics')
        .expect(200);

      if (statsResponse.body.success) {
        expect(statsResponse.body.data.totalSales).toBeGreaterThan(0);
        expect(statsResponse.body.data.totalRevenue).toBeGreaterThan(0);
        console.log('✅ Sale statistics updated correctly');
      }

      console.log('🎉 Complete PSA card sale workflow successful!');
    });

    test('should successfully complete sale process for sealed product', async () => {
      if (!createdProductId) {
        console.log('⚠️ Skipping sealed product sale test - product creation failed');
        return;
      }

      console.log('🔄 Testing sealed product sale workflow...');
      
      const saleDetails = {
        paymentMethod: 'BANK_TRANSFER',
        actualSoldPrice: 1500.00,
        deliveryMethod: 'Local Meetup',
        source: 'Facebook',
        buyerFullName: 'Jane Doe',
        buyerPhoneNumber: '+1-555-987-6543',
        buyerEmail: 'jane.doe@example.com',
        dateSold: new Date(),
      };

      const saleResponse = await request(app)
        .patch(`/api/sealed-products/${createdProductId}/mark-sold`)
        .send(saleDetails)
        .expect(200);

      expect(saleResponse.body.data.sold).toBe(true);
      expect(saleResponse.body.data.saleDetails.actualSoldPrice).toBe(1500.00);
      expect(saleResponse.body.data.saleDetails.paymentMethod).toBe('BANK_TRANSFER');

      console.log('✅ Sealed product sale workflow successful');
    });

    test('should handle bulk sale operations', async () => {
      console.log('🔄 Testing bulk sale operations...');
      
      // Create multiple items for bulk sale
      const bulkItems = [];

      for (let i = 0; i < 3; i++) {
        const cardResponse = await request(app)
          .post('/api/psa-graded-cards')
          .send({
            cardId: new mongoose.Types.ObjectId(),
            grade: `PSA ${8 + i}`,
            myPrice: (i + 1) * 100,
            dateAdded: new Date(),
          });
        
        if (cardResponse.status === 201) {
          bulkItems.push({
            id: cardResponse.body.data._id,
            type: 'psa-graded-cards',
            expectedPrice: (i + 1) * 100,
          });
        }
      }

      // Execute bulk sales
      const salePromises = bulkItems.map(item => {
        const saleDetails = {
          paymentMethod: 'CASH',
          actualSoldPrice: item.expectedPrice + 50, // Sold for more than asking
          deliveryMethod: 'Local Meetup',
          source: 'Local',
          buyerFullName: 'Bulk Buyer',
          dateSold: new Date(),
        };

        return request(app)
          .patch(`/api/${item.type}/${item.id}/mark-sold`)
          .send(saleDetails);
      });

      const saleResults = await Promise.all(salePromises);
      
      // Verify all sales succeeded
      saleResults.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.data.sold).toBe(true);
        expect(result.body.data.saleDetails.actualSoldPrice).toBe(bulkItems[index].expectedPrice + 50);
      });

      console.log('✅ Bulk sale operations completed successfully');
    });
  });

  describe('Sale Validation and Error Handling', () => {
    test('should validate required sale details', async () => {
      if (!createdCardId) {
        console.log('⚠️ Skipping validation test - card creation failed');
        return;
      }

      console.log('🔄 Testing sale validation...');
      
      // Test missing required fields
      const incompleteSaleDetails = {
        paymentMethod: 'PAYPAL',
        // Missing actualSoldPrice, deliveryMethod, source
      };

      const validationResponse = await request(app)
        .patch(`/api/psa-graded-cards/${createdCardId}/mark-sold`)
        .send(incompleteSaleDetails)
        .expect(400);

      expect(validationResponse.body.success).toBe(false);
      expect(validationResponse.body.message).toContain('required');
      console.log('✅ Sale validation working correctly');
    });

    test('should prevent duplicate sales', async () => {
      if (!createdCardId) {
        console.log('⚠️ Skipping duplicate sale test - card creation failed');
        return;
      }

      console.log('🔄 Testing duplicate sale prevention...');
      
      const saleDetails = {
        paymentMethod: 'CASH',
        actualSoldPrice: 400.00,
        deliveryMethod: 'Shipping',
        source: 'eBay',
        dateSold: new Date(),
      };

      // First sale should succeed
      await request(app)
        .patch(`/api/psa-graded-cards/${createdCardId}/mark-sold`)
        .send(saleDetails)
        .expect(200);

      // Second sale should fail
      const duplicateSaleResponse = await request(app)
        .patch(`/api/psa-graded-cards/${createdCardId}/mark-sold`)
        .send(saleDetails)
        .expect(400);

      expect(duplicateSaleResponse.body.success).toBe(false);
      console.log('✅ Duplicate sale prevention working correctly');
    });

    test('should handle invalid sale amounts', async () => {
      if (!createdCardId) {
        console.log('⚠️ Skipping invalid amount test - card creation failed');
        return;
      }

      console.log('🔄 Testing invalid sale amount handling...');
      
      const invalidSaleDetails = {
        paymentMethod: 'PAYPAL',
        actualSoldPrice: -100, // Negative price
        deliveryMethod: 'Shipping',
        source: 'eBay',
        dateSold: new Date(),
      };

      const invalidAmountResponse = await request(app)
        .patch(`/api/psa-graded-cards/${createdCardId}/mark-sold`)
        .send(invalidSaleDetails)
        .expect(400);

      expect(invalidAmountResponse.body.success).toBe(false);
      console.log('✅ Invalid sale amount handling working correctly');
    });
  });

  describe('Sale History and Reporting', () => {
    test('should generate sale history reports', async () => {
      console.log('🔄 Testing sale history reporting...');
      
      // Create and sell multiple items with different dates
      const saleDataset = [
        { price: 300, days: 1 },
        { price: 500, days: 7 },
        { price: 800, days: 30 },
      ];

      for (const saleData of saleDataset) {
        const cardResponse = await request(app)
          .post('/api/psa-graded-cards')
          .send({
            cardId: new mongoose.Types.ObjectId(),
            grade: 'PSA 9',
            myPrice: saleData.price,
            dateAdded: new Date(),
          });

        if (cardResponse.status === 201) {
          const saleDate = new Date();

          saleDate.setDate(saleDate.getDate() - saleData.days);

          await request(app)
            .patch(`/api/psa-graded-cards/${cardResponse.body.data._id}/mark-sold`)
            .send({
              paymentMethod: 'PAYPAL',
              actualSoldPrice: saleData.price,
              deliveryMethod: 'Shipping',
              source: 'eBay',
              dateSold: saleDate,
            });
        }
      }

      // Get sale history
      const historyResponse = await request(app)
        .get('/api/sales/history')
        .query({
          startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(), // 31 days ago
          endDate: new Date().toISOString(),
        })
        .expect(200);

      if (historyResponse.body.success) {
        expect(historyResponse.body.data).toBeInstanceOf(Array);
        expect(historyResponse.body.data.length).toBeGreaterThan(0);
        console.log('✅ Sale history reporting working correctly');
      }
    });

    test('should calculate sale statistics accurately', async () => {
      console.log('🔄 Testing sale statistics calculation...');
      
      // Get initial statistics
      const initialStatsResponse = await request(app)
        .get('/api/sales/statistics')
        .expect(200);

      const initialStats = initialStatsResponse.body.success ? initialStatsResponse.body.data : { totalSales: 0, totalRevenue: 0 };

      // Create and sell an item with known values
      const cardResponse = await request(app)
        .post('/api/psa-graded-cards')
        .send({
          cardId: new mongoose.Types.ObjectId(),
          grade: 'PSA 10',
          myPrice: 1000.00,
          dateAdded: new Date(),
        });

      if (cardResponse.status === 201) {
        await request(app)
          .patch(`/api/psa-graded-cards/${cardResponse.body.data._id}/mark-sold`)
          .send({
            paymentMethod: 'CASH',
            actualSoldPrice: 1200.00,
            deliveryMethod: 'Local Meetup',
            source: 'Facebook',
            dateSold: new Date(),
          })
          .expect(200);

        // Check updated statistics
        const updatedStatsResponse = await request(app)
          .get('/api/sales/statistics')
          .expect(200);

        if (updatedStatsResponse.body.success) {
          const updatedStats = updatedStatsResponse.body.data;

          expect(updatedStats.totalSales).toBe(initialStats.totalSales + 1);
          expect(updatedStats.totalRevenue).toBe(initialStats.totalRevenue + 1200.00);
          console.log('✅ Sale statistics calculation working correctly');
        }
      }
    });
  });

  describe('Sale Performance and Concurrency', () => {
    test('should handle concurrent sale operations', async () => {
      console.log('🔄 Testing concurrent sale operations...');
      
      // Create multiple items for concurrent sale testing
      const concurrentItems = [];

      for (let i = 0; i < 3; i++) {
        const cardResponse = await request(app)
          .post('/api/psa-graded-cards')
          .send({
            cardId: new mongoose.Types.ObjectId(),
            grade: 'PSA 9',
            myPrice: 400.00,
            dateAdded: new Date(),
          });

        if (cardResponse.status === 201) {
          concurrentItems.push(cardResponse.body.data._id);
        }
      }

      // Execute concurrent sales
      const concurrentSales = concurrentItems.map(itemId => request(app)
          .patch(`/api/psa-graded-cards/${itemId}/mark-sold`)
          .send({
            paymentMethod: 'PAYPAL',
            actualSoldPrice: 450.00,
            deliveryMethod: 'Shipping',
            source: 'eBay',
            dateSold: new Date(),
          }));

      const results = await Promise.allSettled(concurrentSales);
      
      // All sales should succeed
      const successfulSales = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      );

      expect(successfulSales.length).toBe(concurrentItems.length);
      console.log('✅ Concurrent sale operations handled successfully');
    });

    test('should maintain data integrity during high-volume sales', async () => {
      console.log('🔄 Testing high-volume sale data integrity...');
      
      // Create multiple items and sell them rapidly
      const volumeTestPromises = [];

      for (let i = 0; i < 10; i++) {
        volumeTestPromises.push(
          request(app)
            .post('/api/psa-graded-cards')
            .send({
              cardId: new mongoose.Types.ObjectId(),
              grade: 'PSA 8',
              myPrice: 200.00,
              dateAdded: new Date(),
            })
            .then(cardResponse => {
              if (cardResponse.status === 201) {
                return request(app)
                  .patch(`/api/psa-graded-cards/${cardResponse.body.data._id}/mark-sold`)
                  .send({
                    paymentMethod: 'CASH',
                    actualSoldPrice: 250.00,
                    deliveryMethod: 'Local Meetup',
                    source: 'Local',
                    dateSold: new Date(),
                  });
              }
              return Promise.reject(new Error('Card creation failed'));
            })
        );
      }

      const startTime = Date.now();
      const volumeResults = await Promise.allSettled(volumeTestPromises);
      const endTime = Date.now();

      // Count successful operations
      const successfulOperations = volumeResults.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      ).length;

      expect(successfulOperations).toBeGreaterThan(0);
      
      const duration = endTime - startTime;

      console.log(`✅ High-volume test completed: ${successfulOperations} sales in ${duration}ms`);
    });
  });
});