const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { setupTestApp, teardownTest, cleanupData, Auction } = require('./setup');

describe('Auctions PUT/DELETE operations', () => {
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

  describe('PUT /auctions/:id', () => {
    it('should update auction', async () => {
      const auction = await new Auction({
        topText: 'Original',
        bottomText: 'Auction',
      }).save();

      const res = await request(app).put(`/auctions/${auction._id}`).send({ topText: 'Updated' });

      expect(res.status).to.equal(200);
      expect(res.body.topText).to.equal('Updated');
    });

    it('should return 404 for non-existent auction', async () => {
      const res = await request(app).put(`/auctions/${new mongoose.Types.ObjectId()}`).send({ topText: 'Updated' });

      expect(res.status).to.equal(404);
    });
  });

  describe('DELETE /auctions/:id', () => {
    it('should delete auction', async () => {
      const auction = await new Auction({
        topText: 'Delete',
        bottomText: 'Me',
      }).save();

      const res = await request(app).delete(`/auctions/${auction._id}`);

      expect(res.status).to.equal(200);
      expect(res.body.message).to.include('deleted');
    });
  });
});
