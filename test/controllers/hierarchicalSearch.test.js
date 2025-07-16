const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const Card = require('../../models/Card');
const Set = require('../../models/Set');
const CardMarketReferenceProduct = require('../../models/CardMarketReferenceProduct');

describe('Hierarchical Search Controller', () => {
  let testSetId;
  let testCardId;
  let testProductId;

  beforeAll(async () => {
    // Create test data
    const testSet = new Set({
      setName: 'Base Set',
      year: 1998,
      setUrl: 'https://example.com/base-set',
      totalCardsInSet: 102,
      totalPsaPopulation: 50000
    });
    await testSet.save();
    testSetId = testSet._id;

    const testCard = new Card({
      setId: testSetId,
      pokemonNumber: '006',
      cardName: 'Charizard',
      baseName: 'Charizard',
      variety: 'Holo Rare',
      psaGrades: { 10: 1000, 9: 2000, 8: 1500 },
      psaTotalGradedForCard: 4500
    });
    await testCard.save();
    testCardId = testCard._id;

    const testProduct = new CardMarketReferenceProduct({
      name: 'Base Set Booster Box',
      setName: 'Base Set',
      available: true,
      price: 15000.00,
      category: 'Booster Boxes',
      url: 'https://example.com/base-set-booster'
    });
    await testProduct.save();
    testProductId = testProduct._id;
  });

  afterAll(async () => {
    // Clean up test data
    await Card.findByIdAndDelete(testCardId);
    await Set.findByIdAndDelete(testSetId);
    await CardMarketReferenceProduct.findByIdAndDelete(testProductId);
  });

  describe('GET /api/search', () => {
    describe('Set Search', () => {
      test('should return set suggestions for valid query', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'sets',
            q: 'Base',
            limit: 5
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.type).toBe('sets');
        expect(response.body.query).toBe('Base');
        expect(Array.isArray(response.body.results)).toBe(true);
        expect(response.body.results.length).toBeGreaterThan(0);
        
        const result = response.body.results[0];
        expect(result).toHaveProperty('setName');
        expect(result).toHaveProperty('score');
        expect(result.setName).toContain('Base');
      });

      test('should prioritize exact matches', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'sets',
            q: 'Base Set',
            limit: 5
          })
          .expect(200);

        expect(response.body.results[0].isExactMatch).toBe(true);
        expect(response.body.results[0].setName).toBe('Base Set');
      });
    });

    describe('Card Search', () => {
      test('should return cards without set context', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'cards',
            q: 'Charizard',
            limit: 5
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.type).toBe('cards');
        expect(Array.isArray(response.body.results)).toBe(true);
        expect(response.body.results.length).toBeGreaterThan(0);
        
        const result = response.body.results[0];
        expect(result).toHaveProperty('cardName');
        expect(result).toHaveProperty('setInfo');
        expect(result.cardName).toContain('Charizard');
      });

      test('should filter cards by set context', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'cards',
            q: 'Charizard',
            setContext: 'Base Set',
            limit: 5
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.setContext).toBe('Base Set');
        expect(Array.isArray(response.body.results)).toBe(true);
        
        if (response.body.results.length > 0) {
          const result = response.body.results[0];
          expect(result.cardName).toContain('Charizard');
        }
      });
    });

    describe('Product Search', () => {
      test('should return products without set context', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'products',
            q: 'Booster',
            limit: 5
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.type).toBe('products');
        expect(Array.isArray(response.body.results)).toBe(true);
      });

      test('should filter products by set context', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'products',
            q: 'Booster',
            setContext: 'Base Set',
            limit: 5
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.setContext).toBe('Base Set');
        expect(Array.isArray(response.body.results)).toBe(true);
      });
    });

    describe('Validation', () => {
      test('should require type parameter', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            q: 'test'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('type and query parameters are required');
      });

      test('should require query parameter', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'sets'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('type and query parameters are required');
      });

      test('should validate type parameter', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'invalid',
            q: 'test'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });

      test('should validate query length', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'sets',
            q: 'a'.repeat(101) // Too long
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });

      test('should validate limit parameter', async () => {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'sets',
            q: 'test',
            limit: 100 // Too high
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.errors).toBeDefined();
      });
    });

    describe('Cache Functionality', () => {
      test('should cache search results', async () => {
        const query = { type: 'sets', q: 'Base' };
        
        // First request
        const response1 = await request(app)
          .get('/api/search')
          .query(query)
          .expect(200);

        // Second request (should be cached)
        const response2 = await request(app)
          .get('/api/search')
          .query(query)
          .expect(200);

        expect(response1.body).toEqual(response2.body);
      });
    });
  });
});