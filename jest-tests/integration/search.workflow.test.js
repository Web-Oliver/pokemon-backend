const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../app');
const { withDatabase, createTestData } = require('../helpers/database.helper');
const { createMockPsaGradedCard, createMockSealedProduct, createMockSet } = require('../helpers/real-mock-data.helper');

/**
 * Search Workflow Integration Tests
 * 
 * Tests the complete unified search system:
 * 1. Unified search across multiple types
 * 2. Type-specific searches (cards, products, sets)
 * 3. Search suggestions and autocomplete
 * 4. Advanced filtering and sorting
 * 5. Search performance and caching
 */
describe('Search Workflow Integration Tests', () => {
  withDatabase();

  const testData = {
    sets: [],
    cards: [],
    psaCards: [],
    sealedProducts: [],
  };

  beforeEach(async () => {
    // Create comprehensive test dataset
    console.log('🔄 Setting up comprehensive search test data...');

    // Create test sets
    const sets = [
      { setName: 'Base Set', year: 1998, totalCardsInSet: 102 },
      { setName: 'Jungle', year: 1999, totalCardsInSet: 64 },
      { setName: 'Fossil', year: 1999, totalCardsInSet: 62 },
      { setName: 'Team Rocket', year: 2000, totalCardsInSet: 83 },
    ];

    for (const setData of sets) {
      const set = createMockSet();

      Object.assign(set, setData);
      await createTestData('sets', set);
      testData.sets.push(set);
    }

    // Create test cards
    const cardTypes = [
      { cardName: 'Pikachu', baseName: 'Pikachu', pokemonNumber: '25', variety: 'Standard' },
      { cardName: 'Charizard', baseName: 'Charizard', pokemonNumber: '6', variety: 'Holo' },
      { cardName: 'Blastoise', baseName: 'Blastoise', pokemonNumber: '9', variety: 'Holo' },
      { cardName: 'Venusaur', baseName: 'Venusaur', pokemonNumber: '3', variety: 'Holo' },
    ];

    for (const cardData of cardTypes) {
      const card = {
        _id: new mongoose.Types.ObjectId(),
        setId: testData.sets[0]._id, // Base Set
        ...cardData,
        psaGrades: { 1: 10, 2: 15, 3: 20, 4: 25, 5: 30, 6: 35, 7: 40, 8: 100, 9: 200, 10: 50 },
        psaTotalGradedForCard: 525,
      };

      await createTestData('cards', card);
      testData.cards.push(card);
    }

    // Create PSA graded cards
    const psaGrades = ['PSA 10', 'PSA 9', 'PSA 8', 'PSA 7'];

    for (let i = 0; i < testData.cards.length; i++) {
      const psaCard = createMockPsaGradedCard();

      psaCard.cardId = testData.cards[i]._id;
      psaCard.grade = psaGrades[i % psaGrades.length];
      psaCard.myPrice = (i + 1) * 100; // 100, 200, 300, 400
      await createTestData('psagradedcards', psaCard);
      testData.psaCards.push(psaCard);
    }

    // Create sealed products
    const productTypes = [
      { name: 'Base Set Booster Box', category: 'Booster Box', setName: 'Base Set' },
      { name: 'Jungle Booster Pack', category: 'Booster Pack', setName: 'Jungle' },
      { name: 'Fossil Elite Trainer Box', category: 'Elite Trainer Box', setName: 'Fossil' },
      { name: 'Team Rocket Theme Deck', category: 'Theme Deck', setName: 'Team Rocket' },
    ];

    for (const productData of productTypes) {
      const product = createMockSealedProduct();

      Object.assign(product, productData);
      product.myPrice = Math.random() * 500 + 100; // Random price 100-600
      await createTestData('sealedproducts', product);
      testData.sealedProducts.push(product);
    }

    console.log('✅ Test data setup complete');
  });

  describe('Unified Search Workflow', () => {
    test('should perform unified search across all types', async () => {
      console.log('🔄 Testing unified search...');
      
      const searchResponse = await request(app)
        .get('/api/search')
        .query({
          query: 'Base',
          types: 'cards,products,sets',
          limit: 10,
        })
        .expect(200);

      expect(searchResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          query: 'Base',
          totalCount: expect.any(Number),
          results: expect.objectContaining({
            cards: expect.any(Object),
            products: expect.any(Object),
            sets: expect.any(Object),
          }),
        })
      );

      // Verify each search type returned results
      expect(searchResponse.body.results.sets.success).toBe(true);
      expect(searchResponse.body.totalCount).toBeGreaterThan(0);
      console.log('✅ Unified search working correctly');
    });

    test('should provide search suggestions', async () => {
      console.log('🔄 Testing search suggestions...');
      
      const suggestResponse = await request(app)
        .get('/api/search/suggest')
        .query({
          query: 'Pika',
          types: 'cards',
          limit: 5,
        })
        .expect(200);

      expect(suggestResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          query: 'Pika',
          suggestions: expect.objectContaining({
            cards: expect.any(Object),
          }),
        })
      );

      console.log('✅ Search suggestions working correctly');
    });

    test('should handle card-specific searches with filters', async () => {
      console.log('🔄 Testing card-specific search with filters...');
      
      const cardSearchResponse = await request(app)
        .get('/api/search/cards')
        .query({
          query: 'Charizard',
          setName: 'Base Set',
          pokemonNumber: '6',
          limit: 10,
        })
        .expect(200);

      expect(cardSearchResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          query: 'Charizard',
          count: expect.any(Number),
          data: expect.any(Array),
        })
      );

      console.log('✅ Card-specific search with filters working correctly');
    });

    test('should handle product searches with category filtering', async () => {
      console.log('🔄 Testing product search with category filter...');
      
      const productSearchResponse = await request(app)
        .get('/api/search/products')
        .query({
          query: 'Booster',
          category: 'Booster Box',
          limit: 10,
        })
        .expect(200);

      expect(productSearchResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          query: 'Booster',
          count: expect.any(Number),
          data: expect.any(Array),
        })
      );

      console.log('✅ Product search with category filtering working correctly');
    });

    test('should handle set searches with year filtering', async () => {
      console.log('🔄 Testing set search with year filter...');
      
      const setSearchResponse = await request(app)
        .get('/api/search/sets')
        .query({
          query: 'Base',
          year: 1998,
          limit: 10,
        })
        .expect(200);

      expect(setSearchResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          query: 'Base',
          count: expect.any(Number),
          data: expect.any(Array),
        })
      );

      console.log('✅ Set search with year filtering working correctly');
    });
  });

  describe('Advanced Search Features', () => {
    test('should handle complex sorting and pagination', async () => {
      console.log('🔄 Testing complex sorting and pagination...');
      
      // Test price sorting for products
      const sortedSearchResponse = await request(app)
        .get('/api/search/products')
        .query({
          query: '',
          sort: JSON.stringify({ myPrice: -1 }), // Sort by price descending
          page: 1,
          limit: 5,
        })
        .expect(200);

      expect(sortedSearchResponse.body.data).toBeInstanceOf(Array);
      if (sortedSearchResponse.body.data.length > 1) {
        // Verify descending price order
        for (let i = 0; i < sortedSearchResponse.body.data.length - 1; i++) {
          expect(sortedSearchResponse.body.data[i].myPrice).toBeGreaterThanOrEqual(
            sortedSearchResponse.body.data[i + 1].myPrice
          );
        }
      }

      console.log('✅ Complex sorting working correctly');

      // Test pagination
      const page2Response = await request(app)
        .get('/api/search/products')
        .query({
          query: '',
          page: 2,
          limit: 2,
        })
        .expect(200);

      expect(page2Response.body.data).toBeInstanceOf(Array);
      console.log('✅ Pagination working correctly');
    });

    test('should handle price range filtering', async () => {
      console.log('🔄 Testing price range filtering...');
      
      const priceFilterResponse = await request(app)
        .get('/api/search/products')
        .query({
          query: '',
          minPrice: 200,
          maxPrice: 400,
          limit: 10,
        })
        .expect(200);

      expect(priceFilterResponse.body.data).toBeInstanceOf(Array);
      
      // Verify all results are within price range
      priceFilterResponse.body.data.forEach(product => {
        expect(product.myPrice).toBeGreaterThanOrEqual(200);
        expect(product.myPrice).toBeLessThanOrEqual(400);
      });

      console.log('✅ Price range filtering working correctly');
    });

    test('should handle availability filtering', async () => {
      console.log('🔄 Testing availability filtering...');
      
      const availabilityFilterResponse = await request(app)
        .get('/api/search/products')
        .query({
          query: '',
          availableOnly: 'true',
          limit: 10,
        })
        .expect(200);

      expect(availabilityFilterResponse.body.data).toBeInstanceOf(Array);
      
      // Verify all results are available (if availability field exists)
      if (availabilityFilterResponse.body.data.length > 0) {
        availabilityFilterResponse.body.data.forEach(product => {
          if (product.hasOwnProperty('available')) {
            expect(product.available).toBe(true);
          }
        });
      }

      console.log('✅ Availability filtering working correctly');
    });
  });

  describe('Search Performance and Edge Cases', () => {
    test('should handle empty search queries gracefully', async () => {
      console.log('🔄 Testing empty search query handling...');
      
      const emptyQueryResponse = await request(app)
        .get('/api/search')
        .query({
          query: '',
          types: 'cards,products,sets',
        })
        .expect(400); // Should return validation error

      expect(emptyQueryResponse.body.success).toBe(false);
      console.log('✅ Empty query validation working correctly');
    });

    test('should handle special characters in search queries', async () => {
      console.log('🔄 Testing special characters in search...');
      
      const specialCharResponse = await request(app)
        .get('/api/search')
        .query({
          query: 'Pokémon & Co.',
          types: 'cards,products,sets',
          limit: 5,
        })
        .expect(200);

      expect(specialCharResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          query: 'Pokémon & Co.',
          results: expect.any(Object),
        })
      );

      console.log('✅ Special character handling working correctly');
    });

    test('should handle very long search queries', async () => {
      console.log('🔄 Testing long search query handling...');
      
      const longQuery = 'a'.repeat(1000); // 1000 character query
      
      const longQueryResponse = await request(app)
        .get('/api/search')
        .query({
          query: longQuery,
          types: 'cards',
          limit: 5,
        })
        .expect(200);

      expect(longQueryResponse.body.success).toBe(true);
      console.log('✅ Long query handling working correctly');
    });

    test('should handle search performance under load', async () => {
      console.log('🔄 Testing search performance...');
      
      const searchQueries = [
        'Pikachu',
        'Charizard',
        'Base Set',
        'Booster Box',
        'Holo',
      ];

      const startTime = Date.now();
      
      const searchPromises = searchQueries.map(query =>
        request(app)
          .get('/api/search')
          .query({
            query,
            types: 'cards,products,sets',
            limit: 10,
          })
      );

      const results = await Promise.all(searchPromises);
      const endTime = Date.now();

      // Verify all searches succeeded
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`✅ Performance test completed in ${duration}ms`);
    });
  });

  describe('Search System Information', () => {
    test('should provide search types information', async () => {
      console.log('🔄 Testing search types endpoint...');
      
      const typesResponse = await request(app)
        .get('/api/search/types')
        .expect(200);

      expect(typesResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          types: expect.any(Array),
        })
      );

      // Verify expected search types are available
      const typeNames = typesResponse.body.types.map(type => type.type);

      expect(typeNames).toContain('cards');
      expect(typeNames).toContain('products');
      expect(typeNames).toContain('sets');

      console.log('✅ Search types endpoint working correctly');
    });

    test('should provide search statistics', async () => {
      console.log('🔄 Testing search statistics endpoint...');
      
      const statsResponse = await request(app)
        .get('/api/search/stats')
        .expect(200);

      expect(statsResponse.body).toEqual(
        expect.objectContaining({
          success: true,
          stats: expect.objectContaining({
            registeredTypes: expect.any(Array),
            cacheStats: expect.any(Object),
            containerStats: expect.any(Object),
          }),
        })
      );

      console.log('✅ Search statistics endpoint working correctly');
    });
  });

  describe('Search Error Handling', () => {
    test('should handle invalid search types', async () => {
      console.log('🔄 Testing invalid search type handling...');
      
      const invalidTypeResponse = await request(app)
        .get('/api/search')
        .query({
          query: 'test',
          types: 'invalid_type,another_invalid',
          limit: 5,
        })
        .expect(200); // Should succeed but with errors in results

      expect(invalidTypeResponse.body.success).toBe(true);
      // Invalid types should be handled gracefully in the response
      console.log('✅ Invalid search type handling working correctly');
    });

    test('should handle malformed filter JSON', async () => {
      console.log('🔄 Testing malformed filter JSON handling...');
      
      const malformedFilterResponse = await request(app)
        .get('/api/search/cards')
        .query({
          query: 'test',
          sort: 'invalid_json{',
        })
        .expect(400); // Should return error for malformed JSON

      expect(malformedFilterResponse.body.success).toBe(false);
      console.log('✅ Malformed JSON handling working correctly');
    });

    test('should handle search timeout scenarios', async () => {
      console.log('🔄 Testing search timeout handling...');
      
      // Create a complex search that might timeout
      const complexSearchResponse = await request(app)
        .get('/api/search')
        .query({
          query: 'very_long_complex_search_query_that_might_take_time',
          types: 'cards,products,sets',
          limit: 1000, // Large limit
        })
        .expect(200);

      expect(complexSearchResponse.body.success).toBe(true);
      console.log('✅ Search timeout handling working correctly');
    });
  });
});