const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, teardownTest, cleanupData, CardMarketReferenceProduct } = require('./setup');

describe('GET /cardmarket/search', () => {
  let app;

  before(async () => {
    app = await setupTestApp();
  });

  after(async () => {
    await teardownTest();
  });

  beforeEach(async () => {
    await cleanupData();
    await CardMarketReferenceProduct.create([
      {
        name: 'Pikachu V',
        setName: 'Vivid Voltage',
        available: 5,
        price: '20.00',
        category: 'Singles',
        url: 'https://example.com',
        scrapedAt: new Date(),
      },
      {
        name: 'Charizard VMAX',
        setName: 'Champions Path',
        available: 2,
        price: '100.00',
        category: 'Singles',
        url: 'https://example.com',
        scrapedAt: new Date(),
      },
      {
        name: 'Booster Pack',
        setName: 'Vivid Voltage',
        available: 10,
        price: '4.00',
        category: 'Boosters',
        url: 'https://example.com',
        scrapedAt: new Date(),
      },
    ]);
  });

  it('should search by name', async () => {
    const res = await request(app).get('/cardmarket/search?q=pikachu');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(1);
    expect(res.body[0].name).to.include('Pikachu');
  });

  it('should search by setName', async () => {
    const res = await request(app).get('/cardmarket/search?q=vivid');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(2);
  });

  it('should filter by category', async () => {
    const res = await request(app).get('/cardmarket/search?category=Boosters');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(1);
    expect(res.body[0].category).to.equal('Boosters');
  });

  it('should combine search and category filter', async () => {
    const res = await request(app).get('/cardmarket/search?q=vivid&category=Boosters');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(1);
    expect(res.body[0].category).to.equal('Boosters');
  });

  it('should return 400 when no query parameters provided', async () => {
    const res = await request(app).get('/cardmarket/search');

    expect(res.status).to.equal(400);
    expect(res.body.message).to.include('required');
  });

  it('should limit results to 20', async () => {
    // Create 25 products
    const products = Array.from({ length: 25 }, (_, i) => ({
      name: `Card ${i}`,
      setName: 'Test Set',
      available: 1,
      price: '1.00',
      category: 'Singles',
      url: 'https://example.com',
      scrapedAt: new Date(),
    }));

    await CardMarketReferenceProduct.create(products);

    const res = await request(app).get('/cardmarket/search?q=card');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(20);
  });
});
