const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, setupTestData, teardownTest, cleanupData, SealedProduct } = require('./setup');

describe('GET /sales/graph', () => {
  let app;

  before(async () => {
    app = await setupTestApp();
  });

  after(async () => {
    await teardownTest();
  });

  beforeEach(async () => {
    await cleanupData();
    await setupTestData();
  });

  it('should return graph data', async () => {
    await new SealedProduct({
      name: 'Booster Pack',
      setName: 'Base Set',
      category: 'Boosters',
      availability: 1,
      cardMarketPrice: 50,
      myPrice: 60,
      sold: true,
      saleDetails: {
        actualSoldPrice: 80,
        dateSold: new Date(),
        paymentMethod: 'Mobilepay',
      },
    }).save();

    const res = await request(app).get('/sales/graph');

    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
  });

  it('should filter by period', async () => {
    const res = await request(app).get('/sales/graph?period=7d');

    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
  });
});
