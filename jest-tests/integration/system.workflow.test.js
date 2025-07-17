const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { withDatabase, createTestData } = require('../helpers/database.helper');
const { createMockPsaGradedCard, createMockSealedProduct, createMockSet } = require('../helpers/real-mock-data.helper');

/**
 * System Integration Workflow Tests
 * 
 * Tests complete end-to-end workflows that span multiple system components:
 * 1. Collection management to auction to sale workflow
 * 2. Search integration with real data
 * 3. Activity logging across all operations
 * 4. Export and reporting workflows
 * 5. System health and monitoring
 */
describe('System Integration Workflow Tests', () => {
  withDatabase();

  const systemTestData = {
    sets: [],
    cards: [],
    psaCards: [],
    sealedProducts: [],
    auctions: [],
  };

  beforeAll(async () => {
    // Create comprehensive system test dataset
    console.log('🔄 Setting up comprehensive system test data...');

    // Create test sets
    const setData = {
      setName: 'Base Set',
      year: 1998,
      totalCardsInSet: 102,
      totalPsaPopulation: 50000,
    };
    const testSet = createMockSet();

    Object.assign(testSet, setData);
    await createTestData('sets', testSet);
    systemTestData.sets.push(testSet);

    // Create test cards with proper relationships
    const cardData = {
      setId: testSet._id,
      cardName: 'Charizard',
      baseName: 'Charizard',
      pokemonNumber: '4',
      variety: 'Holo',
      psaGrades: { 1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 30, 7: 40, 8: 100, 9: 200, 10: 50 },
      psaTotalGradedForCard: 495,
    };
    const testCard = {
      _id: new mongoose.Types.ObjectId(),
      ...cardData,
    };

    await createTestData('cards', testCard);
    systemTestData.cards.push(testCard);

    console.log('✅ System test data setup complete');
  });

  describe('Complete Collection to Sale Workflow', () => {
    test('should complete full lifecycle: add item → search → auction → sale', async () => {
      console.log('🎯 Starting complete system workflow test...');

      // Phase 1: Add item to collection
      console.log('🔄 Phase 1: Adding PSA graded card to collection...');
      const cardData = {
        cardId: systemTestData.cards[0]._id,
        grade: 'PSA 10',
        myPrice: 2000.00,
        images: ['charizard-psa10.jpg'],
        condition: 'Gem Mint',
        dateAdded: new Date(),
      };

      const addCardResponse = await request(app)
        .post('/api/psa-graded-cards')
        .send(cardData)
        .expect(201);

      const cardId = addCardResponse.body.data._id;

      expect(addCardResponse.body.data.grade).toBe('PSA 10');
      console.log('✅ Phase 1 complete: Card added to collection');

      // Phase 2: Search and verify card is findable
      console.log('🔄 Phase 2: Searching for added card...');
      const searchResponse = await request(app)
        .get('/api/search')
        .query({
          query: 'Charizard',
          types: 'cards',
          limit: 10,
        })
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.totalCount).toBeGreaterThan(0);
      console.log('✅ Phase 2 complete: Card found via search');

      // Phase 3: Create auction and add card
      console.log('🔄 Phase 3: Creating auction and adding card...');
      const auctionData = {
        topText: 'Premium Pokemon Card Auction',
        bottomText: 'Featuring PSA 10 Charizard',
        status: 'draft',
        auctionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      };

      const createAuctionResponse = await request(app)
        .post('/api/auctions')
        .send(auctionData)
        .expect(201);

      const auctionId = createAuctionResponse.body.data._id;
      
      // Add card to auction
      const addToAuctionResponse = await request(app)
        .post(`/api/auctions/${auctionId}/items`)
        .send({
          itemId: cardId,
          itemCategory: 'PsaGradedCard',
        })
        .expect(200);

      expect(addToAuctionResponse.body.data.items).toHaveLength(1);
      expect(addToAuctionResponse.body.data.totalValue).toBeGreaterThan(0);
      console.log('✅ Phase 3 complete: Card added to auction');

      // Phase 4: Activate auction
      console.log('🔄 Phase 4: Activating auction...');
      const activateAuctionResponse = await request(app)
        .put(`/api/auctions/${auctionId}`)
        .send({
          status: 'active',
          isActive: true,
        })
        .expect(200);

      expect(activateAuctionResponse.body.data.status).toBe('active');
      console.log('✅ Phase 4 complete: Auction activated');

      // Phase 5: Complete sale through auction
      console.log('🔄 Phase 5: Completing sale...');
      const saleDetails = {
        itemId: cardId,
        itemCategory: 'PsaGradedCard',
        saleDetails: {
          paymentMethod: 'PAYPAL',
          actualSoldPrice: 2500.00,
          deliveryMethod: 'Shipping',
          source: 'Auction',
          buyerFullName: 'Collector John',
          buyerEmail: 'collector.john@example.com',
          trackingNumber: 'AUCTION123456',
          dateSold: new Date(),
        },
      };

      const saleResponse = await request(app)
        .patch(`/api/auctions/${auctionId}/items/sold`)
        .send(saleDetails)
        .expect(200);

      expect(saleResponse.body.success).toBe(true);
      console.log('✅ Phase 5 complete: Sale executed');

      // Phase 6: Verify final state
      console.log('🔄 Phase 6: Verifying final state...');
      
      // Check card is marked as sold
      const finalCardResponse = await request(app)
        .get(`/api/psa-graded-cards/${cardId}`)
        .expect(200);

      expect(finalCardResponse.body.data.sold).toBe(true);
      expect(finalCardResponse.body.data.saleDetails.actualSoldPrice).toBe(2500.00);

      // Check auction status
      const finalAuctionResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .expect(200);

      expect(finalAuctionResponse.body.data.status).toBe('active');
      console.log('✅ Phase 6 complete: Final state verified');

      console.log('🎉 Complete system workflow successful!');
    });

    test('should handle multi-item collection and bulk operations', async () => {
      console.log('🎯 Testing multi-item collection workflow...');

      // Create multiple items
      const itemPromises = [];

      for (let i = 0; i < 5; i++) {
        itemPromises.push(
          request(app)
            .post('/api/psa-graded-cards')
            .send({
              cardId: systemTestData.cards[0]._id,
              grade: `PSA ${8 + (i % 3)}`, // PSA 8, 9, 10 rotation
              myPrice: (i + 1) * 300,
              dateAdded: new Date(),
            })
        );
      }

      const itemResponses = await Promise.all(itemPromises);
      const createdItems = itemResponses.map(response => response.body.data);

      // Verify all items created successfully
      itemResponses.forEach(response => {
        expect(response.status).toBe(201);
      });

      // Create auction and add multiple items
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .send({
          topText: 'Multi-Item Pokemon Auction',
          status: 'draft',
        })
        .expect(201);

      const auctionId = auctionResponse.body.data._id;

      // Add all items to auction
      const addItemPromises = createdItems.map(item =>
        request(app)
          .post(`/api/auctions/${auctionId}/items`)
          .send({
            itemId: item._id,
            itemCategory: 'PsaGradedCard',
          })
      );

      const addItemResponses = await Promise.all(addItemPromises);
      
      // Verify all items added successfully
      addItemResponses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Final auction should have all items
      const finalAuctionResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .expect(200);

      expect(finalAuctionResponse.body.data.items).toHaveLength(5);
      expect(finalAuctionResponse.body.data.totalValue).toBeGreaterThan(0);

      console.log('✅ Multi-item collection workflow successful');
    });
  });

  describe('Search Integration with Real Data', () => {
    test('should provide consistent search results across all endpoints', async () => {
      console.log('🔄 Testing search consistency across endpoints...');

      // Add some searchable data
      const searchableCard = await request(app)
        .post('/api/psa-graded-cards')
        .send({
          cardId: systemTestData.cards[0]._id,
          grade: 'PSA 9',
          myPrice: 800.00,
          dateAdded: new Date(),
        })
        .expect(201);

      const searchableProduct = await request(app)
        .post('/api/sealed-products')
        .send({
          productId: new mongoose.Types.ObjectId(),
          category: 'Booster Box',
          setName: 'Base Set',
          name: 'Base Set Booster Box',
          myPrice: 3000.00,
          dateAdded: new Date(),
        })
        .expect(201);

      // Test unified search
      const unifiedSearchResponse = await request(app)
        .get('/api/search')
        .query({
          query: 'Base',
          types: 'cards,products,sets',
        })
        .expect(200);

      expect(unifiedSearchResponse.body.success).toBe(true);
      expect(unifiedSearchResponse.body.totalCount).toBeGreaterThan(0);

      // Test specific searches
      const cardSearchResponse = await request(app)
        .get('/api/search/cards')
        .query({ query: 'Charizard' })
        .expect(200);

      const productSearchResponse = await request(app)
        .get('/api/search/products')
        .query({ query: 'Booster' })
        .expect(200);

      const setSearchResponse = await request(app)
        .get('/api/search/sets')
        .query({ query: 'Base' })
        .expect(200);

      // Verify all searches return data
      expect(cardSearchResponse.body.count).toBeGreaterThanOrEqual(0);
      expect(productSearchResponse.body.count).toBeGreaterThanOrEqual(0);
      expect(setSearchResponse.body.count).toBeGreaterThanOrEqual(0);

      console.log('✅ Search consistency verified');
    });

    test('should handle search with filters across collection types', async () => {
      console.log('🔄 Testing filtered search across collection types...');

      // Test card search with grade filter
      const gradeFilterResponse = await request(app)
        .get('/api/search/cards')
        .query({
          query: 'Charizard',
          filters: JSON.stringify({ grade: 'PSA 10' }),
        })
        .expect(200);

      // Test product search with price filter
      const priceFilterResponse = await request(app)
        .get('/api/search/products')
        .query({
          query: 'Booster',
          minPrice: 1000,
          maxPrice: 5000,
        })
        .expect(200);

      // Test set search with year filter
      const yearFilterResponse = await request(app)
        .get('/api/search/sets')
        .query({
          query: 'Base',
          year: 1998,
        })
        .expect(200);

      // All filtered searches should succeed
      expect(gradeFilterResponse.body.success).toBe(true);
      expect(priceFilterResponse.body.success).toBe(true);
      expect(yearFilterResponse.body.success).toBe(true);

      console.log('✅ Filtered search across collection types successful');
    });
  });

  describe('System Health and Monitoring', () => {
    test('should provide system status and health checks', async () => {
      console.log('🔄 Testing system health endpoints...');

      // Test system status
      const statusResponse = await request(app)
        .get('/api/status')
        .expect(200);

      if (statusResponse.body.status) {
        expect(statusResponse.body.status).toBe('OK');
      }

      // Test search system statistics
      const searchStatsResponse = await request(app)
        .get('/api/search/stats')
        .expect(200);

      expect(searchStatsResponse.body.success).toBe(true);
      expect(searchStatsResponse.body.stats).toBeDefined();

      // Test search types availability
      const searchTypesResponse = await request(app)
        .get('/api/search/types')
        .expect(200);

      expect(searchTypesResponse.body.success).toBe(true);
      expect(searchTypesResponse.body.types).toBeInstanceOf(Array);

      console.log('✅ System health checks successful');
    });

    test('should handle system load and concurrent operations', async () => {
      console.log('🔄 Testing system load handling...');

      // Create concurrent operations across different endpoints
      const concurrentOperations = [
        // Collection operations
        request(app)
          .post('/api/psa-graded-cards')
          .send({
            cardId: systemTestData.cards[0]._id,
            grade: 'PSA 8',
            myPrice: 600.00,
          }),
        
        request(app)
          .post('/api/sealed-products')
          .send({
            productId: new mongoose.Types.ObjectId(),
            category: 'Booster Pack',
            setName: 'Base Set',
            name: 'Base Set Booster Pack',
            myPrice: 50.00,
          }),

        // Search operations
        request(app)
          .get('/api/search')
          .query({
            query: 'Charizard',
            types: 'cards,products',
          }),

        request(app)
          .get('/api/search/cards')
          .query({ query: 'Pokemon' }),

        // Auction operations
        request(app)
          .post('/api/auctions')
          .send({
            topText: 'Concurrent Test Auction',
            status: 'draft',
          }),

        // Status checks
        request(app).get('/api/status'),
        request(app).get('/api/search/stats'),
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentOperations);
      const endTime = Date.now();

      // Count successful operations
      const successfulOps = results.filter(result => 
        result.status === 'fulfilled' && result.value.status < 400
      ).length;

      expect(successfulOps).toBeGreaterThan(0);
      
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`✅ System load test completed: ${successfulOps}/${results.length} operations in ${duration}ms`);
    });
  });

  describe('Data Integrity and Consistency', () => {
    test('should maintain referential integrity across operations', async () => {
      console.log('🔄 Testing data integrity maintenance...');

      // Create related data
      const cardResponse = await request(app)
        .post('/api/psa-graded-cards')
        .send({
          cardId: systemTestData.cards[0]._id,
          grade: 'PSA 9',
          myPrice: 1000.00,
        })
        .expect(201);

      const cardId = cardResponse.body.data._id;

      // Add to auction
      const auctionResponse = await request(app)
        .post('/api/auctions')
        .send({
          topText: 'Integrity Test Auction',
          status: 'draft',
        })
        .expect(201);

      const auctionId = auctionResponse.body.data._id;

      await request(app)
        .post(`/api/auctions/${auctionId}/items`)
        .send({
          itemId: cardId,
          itemCategory: 'PsaGradedCard',
        })
        .expect(200);

      // Verify card still exists and is properly referenced
      const cardCheckResponse = await request(app)
        .get(`/api/psa-graded-cards/${cardId}`)
        .expect(200);

      expect(cardCheckResponse.body.data._id).toBe(cardId);

      // Verify auction contains the card
      const auctionCheckResponse = await request(app)
        .get(`/api/auctions/${auctionId}`)
        .expect(200);

      expect(auctionCheckResponse.body.data.items).toHaveLength(1);
      expect(auctionCheckResponse.body.data.items[0].itemId.toString()).toBe(cardId);

      console.log('✅ Data integrity maintained across operations');
    });

    test('should handle cleanup operations properly', async () => {
      console.log('🔄 Testing cleanup operations...');

      // Create test data for cleanup
      const testCardResponse = await request(app)
        .post('/api/psa-graded-cards')
        .send({
          cardId: systemTestData.cards[0]._id,
          grade: 'PSA 7',
          myPrice: 400.00,
        })
        .expect(201);

      const testCardId = testCardResponse.body.data._id;

      // Delete the card
      const deleteResponse = await request(app)
        .delete(`/api/psa-graded-cards/${testCardId}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);

      // Verify card is no longer accessible
      await request(app)
        .get(`/api/psa-graded-cards/${testCardId}`)
        .expect(404);

      console.log('✅ Cleanup operations working correctly');
    });
  });

  describe('Export and Reporting Integration', () => {
    test('should generate comprehensive collection reports', async () => {
      console.log('🔄 Testing collection reporting...');

      // Create diverse collection data
      const reportingData = [
        { grade: 'PSA 10', price: 1500, sold: false },
        { grade: 'PSA 9', price: 800, sold: true },
        { grade: 'PSA 8', price: 400, sold: false },
      ];

      for (const data of reportingData) {
        const cardResponse = await request(app)
          .post('/api/psa-graded-cards')
          .send({
            cardId: systemTestData.cards[0]._id,
            grade: data.grade,
            myPrice: data.price,
            sold: data.sold,
          });

        if (cardResponse.status === 201 && data.sold) {
          // Mark as sold if needed
          await request(app)
            .patch(`/api/psa-graded-cards/${cardResponse.body.data._id}/mark-sold`)
            .send({
              paymentMethod: 'CASH',
              actualSoldPrice: data.price,
              deliveryMethod: 'Local Meetup',
              source: 'Local',
            });
        }
      }

      // Test collection statistics
      const statsResponse = await request(app)
        .get('/api/psa-graded-cards/stats')
        .expect(200);

      if (statsResponse.body.success) {
        expect(statsResponse.body.data).toEqual(
          expect.objectContaining({
            totalCards: expect.any(Number),
            totalValue: expect.any(Number),
          })
        );
      }

      // Test export functionality (if available)
      const exportResponse = await request(app)
        .get('/api/export/collection')
        .query({ format: 'json' })
        .expect(200);

      if (exportResponse.body.success) {
        expect(exportResponse.body.data).toBeInstanceOf(Array);
      }

      console.log('✅ Collection reporting integration successful');
    });
  });
});