const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { setupTestApp, teardownTest, cleanupData, Auction } = require('./setup');

describe('Auctions GET operations', () => {
  let app;

  before(async () => {
    app = await setupTestApp();
  });

  after(async () => {
    await teardownTest();
  });

  beforeEach(async () => {
    await cleanupData();
  });

  describe('GET /auctions', () => {
    it('should return all auctions', async () => {
      await new Auction({ topText: 'Test', bottomText: 'Auction' }).save();

      const res = await request(app).get('/auctions');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.length(1);
    });

    it('should filter by isActive', async () => {
      await new Auction({
        topText: 'Active',
        bottomText: 'Auction',
        isActive: true,
      }).save();
      await new Auction({
        topText: 'Inactive',
        bottomText: 'Auction',
        isActive: false,
      }).save();

      const res = await request(app).get('/auctions?isActive=true');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.length(1);
      expect(res.body[0].isActive).to.be.true;
    });
  });

  describe('GET /auctions/:id', () => {
    it('should return specific auction', async () => {
      const auction = await new Auction({
        topText: 'Test',
        bottomText: 'Auction',
      }).save();

      const res = await request(app).get(`/auctions/${auction._id}`);

      expect(res.status).to.equal(200);
      expect(res.body.topText).to.equal('Test');
    });

    it('should return 404 for non-existent auction', async () => {
      const res = await request(app).get(`/auctions/${new mongoose.Types.ObjectId()}`);

      expect(res.status).to.equal(404);
    });

    it('should return 400 for invalid ObjectId', async () => {
      const res = await request(app).get('/auctions/invalid-id');

      expect(res.status).to.equal(400);
    });
  });
});
