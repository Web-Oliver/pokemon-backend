const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const setsController = require('../../controllers/setsController');
const Set = require('../../models/Set');
const { errorHandler } = require('../../middleware/errorHandler');

describe('Sets Controller', () => {
  let app;
  let mongoServer;

  before(async () => {
    if (!mongoServer && mongoose.connection.readyState === 0) {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
    }

    app = express();
    app.use(express.json());

    app.get('/sets', setsController.getAllSets);
    app.get('/sets/paginated', setsController.getSetsWithPagination);
    app.get('/sets/:id', setsController.getSetById);

    // Add error handling middleware
    app.use(errorHandler);
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
  });

  beforeEach(async () => {
    await Set.deleteMany({});
  });

  describe('GET /sets', () => {
    it('should return all sets', async () => {
      await Set.create([
        {
          setName: 'Base Set',
          year: 1998,
          setUrl: 'https://example.com/base',
          totalCardsInSet: 102,
          totalPsaPopulation: 50000,
        },
        {
          setName: 'Jungle',
          year: 1999,
          setUrl: 'https://example.com/jungle',
          totalCardsInSet: 64,
          totalPsaPopulation: 30000,
        },
      ]);

      const res = await request(app).get('/sets');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.length(2);
      expect(res.body.map((s) => s.setName)).to.include.members(['Base Set', 'Jungle']);
    });

    it('should return empty array when no sets exist', async () => {
      const res = await request(app).get('/sets');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.length(0);
    });
  });

  describe('GET /sets/paginated', () => {
    beforeEach(async () => {
      await Set.create([
        {
          setName: 'Base Set',
          year: 1998,
          setUrl: 'https://example.com/base',
          totalCardsInSet: 102,
          totalPsaPopulation: 50000,
        },
        {
          setName: 'Jungle',
          year: 1999,
          setUrl: 'https://example.com/jungle',
          totalCardsInSet: 64,
          totalPsaPopulation: 30000,
        },
        {
          setName: 'Fossil',
          year: 1999,
          setUrl: 'https://example.com/fossil',
          totalCardsInSet: 62,
          totalPsaPopulation: 25000,
        },
      ]);
    });

    it('should return paginated sets', async () => {
      const res = await request(app).get('/sets/paginated?page=1&limit=2');

      expect(res.status).to.equal(200);
      expect(res.body.sets).to.have.length(2);
      expect(res.body.currentPage).to.equal(1);
      expect(res.body.totalPages).to.equal(2);
      expect(res.body.totalSets).to.equal(3);
      expect(res.body.hasNextPage).to.be.true;
      expect(res.body.hasPrevPage).to.be.false;
    });

    it('should filter by set name', async () => {
      const res = await request(app).get('/sets/paginated?q=base');

      expect(res.status).to.equal(200);
      expect(res.body.sets).to.have.length(1);
      expect(res.body.sets[0].setName).to.equal('Base Set');
    });

    it('should filter by year', async () => {
      const res = await request(app).get('/sets/paginated?year=1999');

      expect(res.status).to.equal(200);
      expect(res.body.sets).to.have.length(2);
      expect(res.body.sets[0].year).to.equal(1999);
      expect(res.body.sets[1].year).to.equal(1999);
    });

    it('should handle second page', async () => {
      const res = await request(app).get('/sets/paginated?page=2&limit=2');

      expect(res.status).to.equal(200);
      expect(res.body.sets).to.have.length(1);
      expect(res.body.currentPage).to.equal(2);
      expect(res.body.hasNextPage).to.be.false;
      expect(res.body.hasPrevPage).to.be.true;
    });
  });

  describe('GET /sets/:id', () => {
    it('should return specific set', async () => {
      const set = await new Set({
        setName: 'Base Set',
        year: 1998,
        setUrl: 'https://example.com/base',
        totalCardsInSet: 102,
        totalPsaPopulation: 50000,
      }).save();

      const res = await request(app).get(`/sets/${set._id}`);

      expect(res.status).to.equal(200);
      expect(res.body.setName).to.equal('Base Set');
      expect(res.body.year).to.equal(1998);
    });

    it('should return 404 for non-existent set', async () => {
      const res = await request(app).get(`/sets/${new mongoose.Types.ObjectId()}`);

      expect(res.status).to.equal(404);
      expect(res.body.message).to.equal('Set not found');
    });
  });
});
