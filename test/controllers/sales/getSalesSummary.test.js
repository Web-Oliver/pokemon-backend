const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, setupTestData, teardownTest, cleanupData, SealedProduct } = require('./setup');

describe('GET /sales/summary', () => {
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

  it('should return sales summary', async () => {
    await SealedProduct.create([
      {
        name: 'Product 1',
        setName: 'Base Set',
        category: 'Boosters',
        availability: 1,
        cardMarketPrice: 50,
        myPrice: 60,
        sold: true,
        saleDetails: { actualSoldPrice: 80, dateSold: new Date() },
      },
      {
        name: 'Product 2',
        setName: 'Base Set',
        category: 'Boosters',
        availability: 1,
        cardMarketPrice: 40,
        myPrice: 50,
        sold: true,
        saleDetails: { actualSoldPrice: 70, dateSold: new Date() },
      },
    ]);

    const res = await request(app).get('/sales/summary');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('success', true);
    expect(res.body.data.totalItems).to.equal(2);
    expect(res.body.data.totalRevenue).to.equal(150);
    expect(res.body.data.totalCost).to.equal(110);
    expect(res.body.data.totalProfit).to.equal(40);
  });

  it('should return zero summary for no sales', async () => {
    const res = await request(app).get('/sales/summary');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('success', true);
    expect(res.body.data.totalItems).to.equal(0);
    expect(res.body.data.totalRevenue).to.equal(0);
    expect(res.body.data.totalProfit).to.equal(0);
  });
});
