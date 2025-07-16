const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { setupTestApp, teardownTest, cleanupData, Auction, SealedProduct } = require('./setup');

describe('Auction items operations', () => {
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

  describe('POST /auctions/:id/items', () => {
    it('should add item to auction', async () => {
      const auction = await new Auction({ topText: 'Test', bottomText: 'Auction' }).save();
      const product = await new SealedProduct({
        name: 'Product',
        setName: 'Set',
        category: 'Boosters',
        availability: 1,
        cardMarketPrice: 50,
        myPrice: 60,
      }).save();

      const res = await request(app)
        .post(`/auctions/${auction._id}/items`)
        .send({ itemId: product._id, itemCategory: 'SealedProduct' });

      expect(res.status).to.equal(200);
      expect(res.body.items).to.have.length(1);
    });

    it('should return 400 for invalid category', async () => {
      const auction = await new Auction({ topText: 'Test', bottomText: 'Auction' }).save();

      const res = await request(app)
        .post(`/auctions/${auction._id}/items`)
        .send({ itemId: new mongoose.Types.ObjectId(), itemCategory: 'Invalid' });

      expect(res.status).to.equal(400);
    });
  });

  describe('DELETE /auctions/:id/items', () => {
    it('should remove item from auction', async () => {
      const product = await new SealedProduct({
        name: 'Product',
        setName: 'Set',
        category: 'Boosters',
        availability: 1,
        cardMarketPrice: 50,
        myPrice: 60,
      }).save();

      const auction = await new Auction({
        topText: 'Test',
        bottomText: 'Auction',
        items: [{ itemId: product._id, itemCategory: 'SealedProduct' }],
      }).save();

      const res = await request(app)
        .delete(`/auctions/${auction._id}/items`)
        .send({ itemId: product._id.toString(), itemCategory: 'SealedProduct' });

      expect(res.status).to.equal(200);
      expect(res.body.items).to.have.length(0);
    });
  });

  describe('PATCH /auctions/:id/items/sold', () => {
    it('should mark item as sold', async () => {
      const product = await new SealedProduct({
        name: 'Product',
        setName: 'Set',
        category: 'Boosters',
        availability: 1,
        cardMarketPrice: 50,
        myPrice: 60,
      }).save();

      const auction = await new Auction({
        topText: 'Test',
        bottomText: 'Auction',
        items: [{ itemId: product._id, itemCategory: 'SealedProduct' }],
      }).save();

      const res = await request(app)
        .patch(`/auctions/${auction._id}/items/sold`)
        .send({
          itemId: product._id.toString(),
          itemCategory: 'SealedProduct',
          soldPrice: 100,
        });

      expect(res.status).to.equal(200);
      expect(res.body.items[0].sold).to.be.true;
      expect(res.body.soldValue).to.equal(100);
    });
  });
});
