const { expect } = require('chai');
const request = require('supertest');
const mongoose = require('mongoose');
const { setupTestApp, teardownTest, cleanupData, CardMarketReferenceProduct } = require('./setup');

describe('GET /cardmarket/:id', () => {
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

  it('should return specific product', async () => {
    const product = await new CardMarketReferenceProduct({
      name: 'Test Card',
      setName: 'Test Set',
      available: 2,
      price: '15.00',
      category: 'Singles',
      url: 'https://example.com',
      scrapedAt: new Date(),
    }).save();

    const res = await request(app).get(`/cardmarket/${product._id}`);

    expect(res.status).to.equal(200);
    expect(res.body.name).to.equal('Test Card');
  });

  it('should return 404 for non-existent product', async () => {
    const res = await request(app).get(`/cardmarket/${new mongoose.Types.ObjectId()}`);

    expect(res.status).to.equal(404);
  });

  it('should return 400 for invalid ObjectId', async () => {
    const res = await request(app).get('/cardmarket/invalid-id');

    expect(res.status).to.equal(400);
  });
});
