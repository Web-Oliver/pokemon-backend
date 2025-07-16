const { expect } = require('chai');
const request = require('supertest');
const Card = require('../../../models/Card');
const { setupTestApp, setupTestData, cleanupTestData } = require('../helpers/testSetup');

describe('GET /cards/search', () => {
  let app;
  let testSet;

  before(async () => {
    app = await setupTestApp();
  });

  beforeEach(async () => {
    testSet = await setupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  it('should search by cardName', async () => {
    const res = await request(app).get('/cards/search?q=Pika');

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.length(1);
    expect(res.body.data[0].cardName).to.include('Pikachu');
  });

  it('should search by pokemonNumber', async () => {
    const res = await request(app).get('/cards/search?q=25');

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.length.at.least(1);
  });

  it('should return 400 when no query provided', async () => {
    const res = await request(app).get('/cards/search');

    expect(res.status).to.equal(400);
    expect(res.body).to.have.property('success', false);
  });

  it('should limit results to 20', async () => {
    // Create 25 cards with similar names
    for (let i = 0; i < 25; i++) {
      await new Card({
        cardName: `Test Card ${i}`,
        pokemonNumber: `${100 + i}`,
        setId: testSet._id,
        baseName: `Test Card ${i}`,
        psaTotalGradedForCard: 100,
      }).save();
    }

    const res = await request(app).get('/cards/search?q=Test');

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.length(20);
  });
});
