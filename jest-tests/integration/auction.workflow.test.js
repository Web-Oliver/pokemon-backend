const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { withDatabase, createTestData } = require('../helpers/database.helper');
const { createMockPsaGradedCard, createMockSealedProduct } = require('../helpers/real-mock-data.helper');

/**
 * Auction Workflow Integration Tests
 * 
 * Tests the complete workflow of managing auctions:
 * 1. Creating auctions
 * 2. Adding items to auctions
 * 3. Managing auction lifecycle (draft -> active -> sold/expired)
 * 4. Marking auction items as sold
 * 5. Calculating auction values
 */
describe('Auction Workflow Integration Tests', () => {
  withDatabase();

  let testPsaCard;
  let testSealedProduct;
  let createdAuctionId;

  beforeEach(async () => {
    // Create test collection items first
    testPsaCard = createMockPsaGradedCard();
    testSealedProduct = createMockSealedProduct();

    // Store items in database for auction references
    await createTestData('psagradedcards', testPsaCard);
    await createTestData('sealedproducts', testSealedProduct);
  });

  describe('Complete Auction Lifecycle Workflow', () => {
    test('should successfully complete full auction lifecycle', async () => {
      // Step 1: Create a new auction
      console.log('🔄 Step 1: Creating new auction...');
      const auctionData = {
        topText: 'Pokemon Card Collection Auction #1',
        bottomText: 'High-grade cards and sealed products',
        status: 'draft',
        items: [],
        totalValue: 0,
      };

      const createAuctionResponse = await request(app)
        .post('/api/auctions')
        .send(auctionData)
        .expect(201);

      expect(createAuctionResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            _id: expect.any(String),
            topText: 'Pokemon Card Collection Auction #1',
            status: 'draft',
            items: [],
            totalValue: 0,
          }),
        })
      );

      createdAuctionId = createAuctionResponse.body.data._id;
      console.log('✅ Auction created successfully with ID:', createdAuctionId);

      // Step 2: Add PSA graded card to auction
      console.log('🔄 Step 2: Adding PSA card to auction...');
      const addPsaCardData = {
        itemId: testPsaCard._id.toString(),
        itemCategory: 'PsaGradedCard',
      };

      const addPsaCardResponse = await request(app)
        .post(`/api/auctions/${createdAuctionId}/items`)
        .send(addPsaCardData)
        .expect(200);

      expect(addPsaCardResponse.body.data.items).toHaveLength(1);
      expect(addPsaCardResponse.body.data.items[0].itemCategory).toBe('PsaGradedCard');
      console.log('✅ PSA card added to auction successfully');

      // Step 3: Add sealed product to auction
      console.log('🔄 Step 3: Adding sealed product to auction...');
      const addSealedProductData = {
        itemId: testSealedProduct._id.toString(),
        itemCategory: 'SealedProduct',
      };

      const addSealedProductResponse = await request(app)
        .post(`/api/auctions/${createdAuctionId}/items`)
        .send(addSealedProductData)
        .expect(200);

      expect(addSealedProductResponse.body.data.items).toHaveLength(2);
      expect(addSealedProductResponse.body.data.totalValue).toBeGreaterThan(0);
      console.log('✅ Sealed product added to auction successfully');

      // Step 4: Retrieve auction with populated items
      console.log('🔄 Step 4: Retrieving auction with items...');
      const getAuctionResponse = await request(app)
        .get(`/api/auctions/${createdAuctionId}`)
        .expect(200);

      expect(getAuctionResponse.body.data.items).toHaveLength(2);
      expect(getAuctionResponse.body.data.totalValue).toBeGreaterThan(0);
      console.log('✅ Auction retrieved with populated items');

      // Step 5: Update auction status to active
      console.log('🔄 Step 5: Activating auction...');
      const updateAuctionData = {
        status: 'active',
        auctionDate: new Date(),
      };

      const updateAuctionResponse = await request(app)
        .put(`/api/auctions/${createdAuctionId}`)
        .send(updateAuctionData)
        .expect(200);

      expect(updateAuctionResponse.body.data.status).toBe('active');
      expect(updateAuctionResponse.body.data.auctionDate).toBeDefined();
      console.log('✅ Auction activated successfully');

      // Step 6: Mark an auction item as sold
      console.log('🔄 Step 6: Marking auction item as sold...');
      const saleDetails = {
        itemId: testPsaCard._id.toString(),
        itemCategory: 'PsaGradedCard',
        saleDetails: {
          paymentMethod: 'CASH',
          actualSoldPrice: 850.00,
          deliveryMethod: 'Local Meetup',
          source: 'Auction',
          buyerFullName: 'Jane Smith',
          dateSold: new Date(),
        },
      };

      const markSoldResponse = await request(app)
        .patch(`/api/auctions/${createdAuctionId}/items/sold`)
        .send(saleDetails)
        .expect(200);

      expect(markSoldResponse.body.success).toBe(true);
      console.log('✅ Auction item marked as sold successfully');

      // Step 7: Update auction status to sold
      console.log('🔄 Step 7: Marking auction as sold...');
      const markAuctionSoldData = {
        status: 'sold',
        soldValue: 1500.00,
      };

      const markAuctionSoldResponse = await request(app)
        .put(`/api/auctions/${createdAuctionId}`)
        .send(markAuctionSoldData)
        .expect(200);

      expect(markAuctionSoldResponse.body.data.status).toBe('sold');
      expect(markAuctionSoldResponse.body.data.soldValue).toBe(1500.00);
      console.log('✅ Auction marked as sold successfully');

      console.log('🎉 Complete auction workflow successful!');
    });

    test('should handle auction item management operations', async () => {
      // Create auction first
      const auctionData = {
        topText: 'Test Auction for Item Management',
        bottomText: 'Testing add/remove operations',
        status: 'draft',
      };

      const createResponse = await request(app)
        .post('/api/auctions')
        .send(auctionData)
        .expect(201);

      const auctionId = createResponse.body.data._id;

      // Add multiple items
      console.log('🔄 Adding multiple items to auction...');
      const addItem1 = await request(app)
        .post(`/api/auctions/${auctionId}/items`)
        .send({
          itemId: testPsaCard._id.toString(),
          itemCategory: 'PsaGradedCard',
        })
        .expect(200);

      const addItem2 = await request(app)
        .post(`/api/auctions/${auctionId}/items`)
        .send({
          itemId: testSealedProduct._id.toString(),
          itemCategory: 'SealedProduct',
        })
        .expect(200);

      expect(addItem2.body.data.items).toHaveLength(2);
      console.log('✅ Multiple items added successfully');

      // Remove an item
      console.log('🔄 Removing item from auction...');
      const removeItemResponse = await request(app)
        .delete(`/api/auctions/${auctionId}/remove-item`)
        .send({
          itemId: testPsaCard._id.toString(),
          itemCategory: 'PsaGradedCard',
        })
        .expect(200);

      expect(removeItemResponse.body.data.items).toHaveLength(1);
      expect(removeItemResponse.body.data.items[0].itemCategory).toBe('SealedProduct');
      console.log('✅ Item removed successfully');

      // Verify total value recalculation
      expect(removeItemResponse.body.data.totalValue).toBeGreaterThan(0);
      console.log('✅ Total value recalculated correctly');
    });

    test('should handle auction search and filtering', async () => {
      // Create multiple auctions with different statuses
      const auctionDataset = [
        { topText: 'Draft Auction 1', status: 'draft', totalValue: 500 },
        { topText: 'Active Auction 1', status: 'active', totalValue: 1000 },
        { topText: 'Sold Auction 1', status: 'sold', totalValue: 1500 },
        { topText: 'Active Auction 2', status: 'active', totalValue: 2000 },
      ];

      console.log('🔄 Creating multiple auctions for filtering test...');
      const createdAuctions = [];

      for (const auctionData of auctionDataset) {
        const response = await request(app)
          .post('/api/auctions')
          .send(auctionData)
          .expect(201);

        createdAuctions.push(response.body.data);
      }

      // Test getting all auctions
      console.log('🔄 Testing auction retrieval...');
      const allAuctionsResponse = await request(app)
        .get('/api/auctions')
        .expect(200);

      expect(allAuctionsResponse.body.data).toBeInstanceOf(Array);
      expect(allAuctionsResponse.body.data.length).toBeGreaterThanOrEqual(4);
      console.log('✅ All auctions retrieved successfully');

      // Test filtering by status (if supported)
      console.log('🔄 Testing auction filtering...');
      const activeAuctionsResponse = await request(app)
        .get('/api/auctions')
        .query({ status: 'active' })
        .expect(200);

      // Verify all returned auctions have 'active' status
      if (activeAuctionsResponse.body.data.length > 0) {
        activeAuctionsResponse.body.data.forEach(auction => {
          expect(auction.status).toBe('active');
        });
        console.log('✅ Auction filtering working correctly');
      }
    });
  });

  describe('Auction Error Handling', () => {
    test('should handle invalid auction creation', async () => {
      console.log('🔄 Testing invalid auction creation...');
      const invalidAuctionData = {
        // Missing required fields like topText
        status: 'invalid_status',
      };

      await request(app)
        .post('/api/auctions')
        .send(invalidAuctionData)
        .expect(400);

      console.log('✅ Invalid auction creation handled correctly');
    });

    test('should handle adding non-existent items to auction', async () => {
      // Create a valid auction first
      const auctionData = {
        topText: 'Test Auction',
        status: 'draft',
      };

      const createResponse = await request(app)
        .post('/api/auctions')
        .send(auctionData)
        .expect(201);

      const auctionId = createResponse.body.data._id;

      console.log('🔄 Testing adding non-existent item...');
      const nonExistentItemData = {
        itemId: new mongoose.Types.ObjectId().toString(),
        itemCategory: 'PsaGradedCard',
      };

      await request(app)
        .post(`/api/auctions/${auctionId}/items`)
        .send(nonExistentItemData)
        .expect(404);

      console.log('✅ Non-existent item addition handled correctly');
    });

    test('should handle invalid item categories', async () => {
      // Create a valid auction first
      const auctionData = {
        topText: 'Test Auction',
        status: 'draft',
      };

      const createResponse = await request(app)
        .post('/api/auctions')
        .send(auctionData)
        .expect(201);

      const auctionId = createResponse.body.data._id;

      console.log('🔄 Testing invalid item category...');
      const invalidCategoryData = {
        itemId: testPsaCard._id.toString(),
        itemCategory: 'InvalidCategory',
      };

      await request(app)
        .post(`/api/auctions/${auctionId}/items`)
        .send(invalidCategoryData)
        .expect(400);

      console.log('✅ Invalid item category handled correctly');
    });

    test('should handle operations on non-existent auctions', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();

      console.log('🔄 Testing operations on non-existent auction...');

      // Test get non-existent auction
      await request(app)
        .get(`/api/auctions/${nonExistentId}`)
        .expect(404);

      // Test update non-existent auction
      await request(app)
        .put(`/api/auctions/${nonExistentId}`)
        .send({ status: 'active' })
        .expect(404);

      // Test delete non-existent auction
      await request(app)
        .delete(`/api/auctions/${nonExistentId}`)
        .expect(404);

      console.log('✅ Non-existent auction operations handled correctly');
    });
  });

  describe('Auction Performance and Concurrency', () => {
    test('should handle concurrent auction operations', async () => {
      // Create auction
      const auctionData = {
        topText: 'Concurrent Test Auction',
        status: 'draft',
      };

      const createResponse = await request(app)
        .post('/api/auctions')
        .send(auctionData)
        .expect(201);

      const auctionId = createResponse.body.data._id;

      console.log('🔄 Testing concurrent item additions...');

      // Attempt to add items concurrently
      const concurrentOperations = [
        request(app)
          .post(`/api/auctions/${auctionId}/items`)
          .send({
            itemId: testPsaCard._id.toString(),
            itemCategory: 'PsaGradedCard',
          }),
        request(app)
          .post(`/api/auctions/${auctionId}/items`)
          .send({
            itemId: testSealedProduct._id.toString(),
            itemCategory: 'SealedProduct',
          }),
      ];

      const results = await Promise.allSettled(concurrentOperations);
      
      // At least one operation should succeed
      const successfulOps = results.filter(result => 
        result.status === 'fulfilled' && result.value.status === 200
      );
      
      expect(successfulOps.length).toBeGreaterThan(0);
      console.log('✅ Concurrent operations handled appropriately');
    });

    test('should handle bulk auction operations efficiently', async () => {
      console.log('🔄 Testing bulk auction creation...');
      
      // Create multiple auctions
      const bulkCreatePromises = [];

      for (let i = 0; i < 10; i++) {
        const auctionData = {
          topText: `Bulk Auction ${i + 1}`,
          bottomText: `Test auction number ${i + 1}`,
          status: 'draft',
        };

        bulkCreatePromises.push(
          request(app)
            .post('/api/auctions')
            .send(auctionData)
        );
      }

      const startTime = Date.now();
      const results = await Promise.all(bulkCreatePromises);
      const endTime = Date.now();

      // Verify all auctions were created successfully
      results.forEach(result => {
        expect(result.status).toBe(201);
      });

      // Basic performance check (should complete within reasonable time)
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // 5 seconds max

      console.log(`✅ Bulk creation completed in ${duration}ms`);
    });
  });
});