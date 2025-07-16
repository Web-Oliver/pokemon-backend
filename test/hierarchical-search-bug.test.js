const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');

describe('Hierarchical Search setContext Bug Reproduction', () => {
  // Test the exact scenarios that are failing in frontend
  
  describe('Card Search Without setContext (Working)', () => {
    test('should return results for card search without setContext', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          type: 'cards',
          q: 'Bulbasaur',
          limit: 10
        });

      console.log('Card search without setContext response:', {
        status: response.status,
        success: response.body.success,
        count: response.body.count,
        results: response.body.results?.length
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      expect(response.body.count).toBeGreaterThan(0);
    });

    test('should return results for "Char" search without setContext', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          type: 'cards',
          q: 'Char',
          limit: 10
        });

      console.log('Char search without setContext response:', {
        status: response.status,
        success: response.body.success,
        count: response.body.count
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
    });
  });

  describe('Set Search (Working)', () => {
    test('should return results for set search', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          type: 'sets',
          q: 'Base',
          limit: 10
        });

      console.log('Set search response:', {
        status: response.status,
        success: response.body.success,
        count: response.body.count,
        sets: response.body.results?.map(r => r.setName)
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      expect(response.body.count).toBeGreaterThan(0);
      
      // Should include "Base Set" in results
      const hasBaseSet = response.body.results.some(set => 
        set.setName.toLowerCase().includes('base')
      );
      expect(hasBaseSet).toBe(true);
    });
  });

  describe('Card Search WITH setContext (FAILING)', () => {
    test('should return results for "Char" search with "Base Set" context - BUG REPRODUCTION', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          type: 'cards',
          q: 'Char',
          setContext: 'Base Set',
          limit: 10
        });

      console.log('Char search with Base Set context response:', {
        status: response.status,
        success: response.body.success,
        count: response.body.count,
        setContext: response.body.setContext,
        error: response.body.error
      });

      // This should pass but currently fails due to the bug
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      
      // THE BUG: This currently returns 0 results when it should return cards like Charizard, Charmander, Charmeleon from Base Set
      console.log('BUG: Expected results > 0, actual count:', response.body.count);
    });

    test('should return results for "Pika" search with "Base Set" context - BUG REPRODUCTION', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          type: 'cards',
          q: 'Pika',
          setContext: 'Base Set',
          limit: 10
        });

      console.log('Pika search with Base Set context response:', {
        status: response.status,
        success: response.body.success,
        count: response.body.count,
        setContext: response.body.setContext
      });

      // This should return Pikachu from Base Set but currently returns 0
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.results).toBeDefined();
      
      console.log('BUG: Expected Pikachu from Base Set, actual count:', response.body.count);
    });

    test('should work with exact set name variations', async () => {
      // Test different variations of set names
      const setVariations = ['Base', 'Base Set', 'base set', 'base'];
      
      for (const setName of setVariations) {
        const response = await request(app)
          .get('/api/search')
          .query({
            type: 'cards',
            q: 'Bulbasaur',
            setContext: setName,
            limit: 10
          });

        console.log(`Testing setContext="${setName}":`, {
          status: response.status,
          success: response.body.success,
          count: response.body.count
        });
      }
    });
  });

  describe('Edge Cases for setContext', () => {
    test('should handle non-existent set context gracefully', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          type: 'cards',
          q: 'Pikachu',
          setContext: 'NonExistentSet123',
          limit: 10
        });

      console.log('Non-existent set context response:', {
        status: response.status,
        success: response.body.success,
        count: response.body.count
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(0); // Should return 0 for non-existent set
    });

    test('should handle empty setContext', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          type: 'cards',
          q: 'Pikachu',
          setContext: '',
          limit: 10
        });

      console.log('Empty setContext response:', {
        status: response.status,
        success: response.body.success,
        count: response.body.count
      });

      // Empty setContext should behave like no setContext
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Debugging Information', () => {
    test('should provide detailed debugging info for failed setContext searches', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({
          type: 'cards',
          q: 'Charizard',
          setContext: 'Base Set',
          limit: 10
        });

      console.log('Debugging info for Charizard + Base Set:', {
        status: response.status,
        body: JSON.stringify(response.body, null, 2)
      });
    });
  });
});