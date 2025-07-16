const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, setupTestData, teardownTest, cleanupData, SealedProduct, PsaGradedCard } = require('./setup');

describe('GET /sales', () => {
  let app;
  let testCard;

  before(async () => {
    app = await setupTestApp();
  });

  after(async () => {
    await teardownTest();
  });

  beforeEach(async () => {
    await cleanupData();
    const { testCard: card } = await setupTestData();

    testCard = card;
  });

  it('should return all sales', async () => {
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

    const res = await request(app).get('/sales');

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.count).to.equal(1);
    expect(res.body.data).to.have.length(1);
    expect(res.body.data[0].category).to.equal('Sealed Product');
  });

  it('should filter by category', async () => {
    await SealedProduct.create([
      {
        name: 'Booster Pack',
        setName: 'Base Set',
        category: 'Boosters',
        availability: 1,
        cardMarketPrice: 50,
        myPrice: 60,
        sold: true,
        saleDetails: { actualSoldPrice: 80, dateSold: new Date() },
      },
    ]);

    await PsaGradedCard.create([
      {
        cardId: testCard._id,
        grade: '10',
        myPrice: 500,
        sold: true,
        saleDetails: { actualSoldPrice: 600, dateSold: new Date() },
      },
    ]);

    const res = await request(app).get('/sales?category=sealedProducts');

    expect(res.status).to.equal(200);
    expect(res.body.success).to.equal(true);
    expect(res.body.count).to.equal(1);
    expect(res.body.data).to.have.length(1);
    expect(res.body.data[0].category).to.equal('Sealed Product');
  });

  it('should filter by date range', async () => {
    const oldDate = new Date('2023-01-01');
    const newDate = new Date();

    await SealedProduct.create([
      {
        name: 'Old Sale',
        setName: 'Base Set',
        category: 'Boosters',
        availability: 1,
        cardMarketPrice: 50,
        myPrice: 60,
        sold: true,
        saleDetails: { actualSoldPrice: 80, dateSold: oldDate },
      },
      {
        name: 'New Sale',
        setName: 'Base Set',
        category: 'Boosters',
        availability: 1,
        cardMarketPrice: 50,
        myPrice: 60,
        sold: true,
        saleDetails: { actualSoldPrice: 80, dateSold: newDate },
      },
    ]);

    const startDate = '2024-01-01';
    const res = await request(app).get(`/sales?startDate=${startDate}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('success', true);
    expect(res.body.data).to.have.length(1);
    expect(res.body.data[0].name).to.equal('New Sale');
  });
});
