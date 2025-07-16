const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, teardownTest, cleanupData, CardMarketReferenceProduct } = require('./setup');

describe('GET /cardmarket', () => {
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

  it('should return all products', async () => {
    await new CardMarketReferenceProduct({
      name: 'Pikachu',
      setName: 'Base Set',
      available: 5,
      price: '10.00',
      category: 'Singles',
      url: 'https://example.com',
      scrapedAt: new Date(),
    }).save();

    const res = await request(app).get('/cardmarket');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(1);
    expect(res.body[0].name).to.equal('Pikachu');
  });

  it('should filter by name', async () => {
    await CardMarketReferenceProduct.create([
      {
        name: 'Pikachu',
        setName: 'Base Set',
        available: 5,
        price: '10.00',
        category: 'Singles',
        url: 'https://example.com',
        scrapedAt: new Date(),
      },
      {
        name: 'Charizard',
        setName: 'Base Set',
        available: 3,
        price: '50.00',
        category: 'Singles',
        url: 'https://example.com',
        scrapedAt: new Date(),
      },
    ]);

    const res = await request(app).get('/cardmarket?name=pika');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(1);
    expect(res.body[0].name).to.equal('Pikachu');
  });

  it('should filter by setName', async () => {
    await new CardMarketReferenceProduct({
      name: 'Card',
      setName: 'Special Set',
      available: 1,
      price: '5.00',
      category: 'Singles',
      url: 'https://example.com',
      scrapedAt: new Date(),
    }).save();

    const res = await request(app).get('/cardmarket?setName=special');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(1);
  });

  it('should filter by category', async () => {
    await new CardMarketReferenceProduct({
      name: 'Booster Pack',
      setName: 'Modern Set',
      available: 10,
      price: '4.00',
      category: 'Boosters',
      url: 'https://example.com',
      scrapedAt: new Date(),
    }).save();

    const res = await request(app).get('/cardmarket?category=Boosters');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.length(1);
    expect(res.body[0].category).to.equal('Boosters');
  });
});
