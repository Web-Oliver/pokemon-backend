const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { withDatabase, createTestData } = require('../helpers/database.helper');
const { createMockPsaGradedCard, createMockSealedProduct, createMockSet } = require('../helpers/real-mock-data.helper');

/**
 * Card Collection Workflow Integration Tests
 * 
 * Tests the complete workflow of managing a Pokemon card collection:
 * 1. Adding new cards to collection
 * 2. Searching and filtering cards
 * 3. Updating card information
 * 4. Marking cards as sold
 * 5. Viewing collection statistics
 */
describe('Card Collection Workflow Integration Tests', () => {
  withDatabase();

  let testSet;
  let testCard;
  let createdCardId;

  beforeEach(async () => {
    // Create test set data
    testSet = createMockSet();
    await createTestData('sets', testSet);

    // Create test card data
    testCard = createMockPsaGradedCard();
    testCard.cardId = new mongoose.Types.ObjectId(); // Reference to Card model
  });

  describe('Complete Card Collection Workflow', () => {
    test('should successfully complete full card lifecycle', async () => {
      // Step 1: Add a new PSA graded card to collection
      console.log('🔄 Step 1: Adding new PSA graded card...');
      const cardData = {
        cardId: testCard.cardId,
        grade: 'PSA 10',
        myPrice: 500.00,
        images: ['test-image-1.jpg'],
        condition: 'Mint',
        dateAdded: new Date(),
      };

      const createResponse = await request(app)
        .post('/api/psa-graded-cards')
        .send(cardData)
        .expect(201);

      expect(createResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            _id: expect.any(String),
            grade: 'PSA 10',
            myPrice: expect.any(Number),
            sold: false,
          }),
        })
      );

      createdCardId = createResponse.body.data._id;
      console.log('✅ Card created successfully with ID:', createdCardId);

      // Step 2: Retrieve the card by ID
      console.log('🔄 Step 2: Retrieving card by ID...');
      const getResponse = await request(app)
        .get(`/api/psa-graded-cards/${createdCardId}`)
        .expect(200);

      expect(getResponse.body.data._id).toBe(createdCardId);
      expect(getResponse.body.data.grade).toBe('PSA 10');
      console.log('✅ Card retrieved successfully');

      // Step 3: Update card information
      console.log('🔄 Step 3: Updating card price...');
      const updateData = {
        myPrice: 750.00,
        images: ['test-image-1.jpg', 'test-image-2.jpg'],
      };

      const updateResponse = await request(app)
        .put(`/api/psa-graded-cards/${createdCardId}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.data.myPrice).toBe(750.00);
      expect(updateResponse.body.data.images).toHaveLength(2);
      console.log('✅ Card updated successfully');

      // Step 4: Search for cards in collection
      console.log('🔄 Step 4: Searching collection...');
      const searchResponse = await request(app)
        .get('/api/psa-graded-cards')
        .query({ limit: 10, page: 1 })
        .expect(200);

      expect(searchResponse.body.data).toBeInstanceOf(Array);
      expect(searchResponse.body.count).toBeGreaterThan(0);
      expect(searchResponse.body.data.some(card => card._id === createdCardId)).toBe(true);
      console.log('✅ Card found in collection search');

      // Step 5: Mark card as sold
      console.log('🔄 Step 5: Marking card as sold...');
      const saleDetails = {
        paymentMethod: 'PAYPAL',
        actualSoldPrice: 800.00,
        deliveryMethod: 'Shipping',
        source: 'eBay',
        buyerFullName: 'John Doe',
        buyerEmail: 'john.doe@example.com',
        dateSold: new Date(),
      };

      const saleResponse = await request(app)
        .patch(`/api/psa-graded-cards/${createdCardId}/mark-sold`)
        .send(saleDetails)
        .expect(200);

      expect(saleResponse.body.data.sold).toBe(true);
      expect(saleResponse.body.data.saleDetails.actualSoldPrice).toBe(800.00);
      expect(saleResponse.body.data.saleDetails.paymentMethod).toBe('PAYPAL');
      console.log('✅ Card marked as sold successfully');

      // Step 6: Verify sold card in collection
      console.log('🔄 Step 6: Verifying sold card status...');
      const soldCardResponse = await request(app)
        .get(`/api/psa-graded-cards/${createdCardId}`)
        .expect(200);

      expect(soldCardResponse.body.data.sold).toBe(true);
      expect(soldCardResponse.body.data.saleDetails).toBeDefined();
      console.log('✅ Sold card status verified');

      console.log('🎉 Complete card collection workflow successful!');
    });

    test('should handle collection filtering and sorting', async () => {
      // Create multiple test cards with different grades
      const cardDataset = [
        { cardId: new mongoose.Types.ObjectId(), grade: 'PSA 10', myPrice: 1000.00 },
        { cardId: new mongoose.Types.ObjectId(), grade: 'PSA 9', myPrice: 500.00 },
        { cardId: new mongoose.Types.ObjectId(), grade: 'PSA 8', myPrice: 250.00 },
      ];

      console.log('🔄 Creating multiple cards for filtering test...');
      const createdCards = [];

      for (const cardData of cardDataset) {
        const response = await request(app)
          .post('/api/psa-graded-cards')
          .send(cardData)
          .expect(201);

        createdCards.push(response.body.data);
      }

      // Test filtering by price range
      console.log('🔄 Testing price range filtering...');
      const priceFilterResponse = await request(app)
        .get('/api/psa-graded-cards')
        .query({ 
          minPrice: 400,
          maxPrice: 600,
          limit: 10 
        })
        .expect(200);

      expect(priceFilterResponse.body.data).toBeInstanceOf(Array);
      expect(priceFilterResponse.body.data.length).toBe(1);
      expect(priceFilterResponse.body.data[0].grade).toBe('PSA 9');
      console.log('✅ Price filtering working correctly');

      // Test sorting by price descending
      console.log('🔄 Testing price sorting...');
      const sortResponse = await request(app)
        .get('/api/psa-graded-cards')
        .query({ 
          sort: JSON.stringify({ myPrice: -1 }),
          limit: 10 
        })
        .expect(200);

      expect(sortResponse.body.data).toBeInstanceOf(Array);
      expect(sortResponse.body.data.length).toBeGreaterThanOrEqual(3);
      
      // Verify descending order
      for (let i = 0; i < sortResponse.body.data.length - 1; i++) {
        expect(sortResponse.body.data[i].myPrice).toBeGreaterThanOrEqual(
          sortResponse.body.data[i + 1].myPrice
        );
      }
      console.log('✅ Price sorting working correctly');
    });

    test('should handle collection statistics and aggregation', async () => {
      // Create test cards with known values
      const cardDataset = [
        { cardId: new mongoose.Types.ObjectId(), grade: 'PSA 10', myPrice: 1000.00, sold: false },
        { cardId: new mongoose.Types.ObjectId(), grade: 'PSA 9', myPrice: 500.00, sold: false },
        { cardId: new mongoose.Types.ObjectId(), grade: 'PSA 8', myPrice: 250.00, sold: true },
      ];

      console.log('🔄 Creating cards for statistics test...');
      for (const cardData of cardDataset) {
        await request(app)
          .post('/api/psa-graded-cards')
          .send(cardData)
          .expect(201);
      }

      // Get collection statistics
      console.log('🔄 Testing collection statistics...');
      const statsResponse = await request(app)
        .get('/api/psa-graded-cards/stats')
        .expect(200);

      expect(statsResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            totalCards: expect.any(Number),
            totalValue: expect.any(Number),
            averagePrice: expect.any(Number),
          }),
        })
      );

      console.log('✅ Collection statistics retrieved successfully');
    });
  });

  describe('Error Handling in Collection Workflow', () => {
    test('should handle invalid card creation gracefully', async () => {
      console.log('🔄 Testing invalid card creation...');
      const invalidCardData = {
        // Missing required fields
        grade: 'INVALID_GRADE',
      };

      await request(app)
        .post('/api/psa-graded-cards')
        .send(invalidCardData)
        .expect(400);

      console.log('✅ Invalid card creation handled correctly');
    });

    test('should handle non-existent card operations', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      console.log('🔄 Testing operations on non-existent card...');
      
      // Test get non-existent card
      await request(app)
        .get(`/api/psa-graded-cards/${nonExistentId}`)
        .expect(404);

      // Test update non-existent card
      await request(app)
        .put(`/api/psa-graded-cards/${nonExistentId}`)
        .send({ myPrice: 100 })
        .expect(404);

      // Test delete non-existent card
      await request(app)
        .delete(`/api/psa-graded-cards/${nonExistentId}`)
        .expect(404);

      console.log('✅ Non-existent card operations handled correctly');
    });

    test('should validate sale details when marking as sold', async () => {
      // First create a card
      const cardData = {
        cardId: new mongoose.Types.ObjectId(),
        grade: 'PSA 10',
        myPrice: 500.00,
      };

      const createResponse = await request(app)
        .post('/api/psa-graded-cards')
        .send(cardData)
        .expect(201);

      const cardId = createResponse.body.data._id;

      console.log('🔄 Testing invalid sale details...');
      
      // Test with missing required sale fields
      const invalidSaleDetails = {
        paymentMethod: 'PAYPAL',
        // Missing actualSoldPrice, deliveryMethod, source
      };

      await request(app)
        .patch(`/api/psa-graded-cards/${cardId}/mark-sold`)
        .send(invalidSaleDetails)
        .expect(400);

      console.log('✅ Invalid sale details validation working correctly');
    });
  });

  describe('Collection Pagination and Performance', () => {
    test('should handle large collection pagination', async () => {
      // Create multiple cards for pagination testing
      console.log('🔄 Creating cards for pagination test...');
      const cardPromises = [];

      for (let i = 0; i < 25; i++) {
        const cardData = {
          cardId: new mongoose.Types.ObjectId(),
          grade: `PSA ${(i % 10) + 1}`,
          myPrice: (i + 1) * 10,
        };

        cardPromises.push(
          request(app)
            .post('/api/psa-graded-cards')
            .send(cardData)
        );
      }

      await Promise.all(cardPromises);
      console.log('✅ Created 25 test cards');

      // Test first page
      const page1Response = await request(app)
        .get('/api/psa-graded-cards')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(page1Response.body.data).toHaveLength(10);
      expect(page1Response.body.pagination.currentPage).toBe(1);
      expect(page1Response.body.pagination.totalPages).toBeGreaterThanOrEqual(3);

      // Test second page
      const page2Response = await request(app)
        .get('/api/psa-graded-cards')
        .query({ page: 2, limit: 10 })
        .expect(200);

      expect(page2Response.body.data).toHaveLength(10);
      expect(page2Response.body.pagination.currentPage).toBe(2);

      // Verify different data on different pages
      const page1Ids = page1Response.body.data.map(card => card._id);
      const page2Ids = page2Response.body.data.map(card => card._id);

      expect(page1Ids).not.toEqual(page2Ids);

      console.log('✅ Pagination working correctly');
    });
  });
});