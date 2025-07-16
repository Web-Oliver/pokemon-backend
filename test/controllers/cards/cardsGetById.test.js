const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, setupTestData, cleanupTestData } = require('../helpers/testSetup');

describe('GET /cards/:id', () => {
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

  it('should return specific card', async () => {
    const cards = await request(app).get('/cards');
    const cardId = cards.body.data[0]._id;

    const res = await request(app).get(`/cards/${cardId}`);

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('success', true);
    expect(res.body.data).to.have.property('_id', cardId);
    expect(res.body.data).to.have.property('cardName');
  });

  it('should return 404 for non-existent card', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await request(app).get(`/cards/${fakeId}`);

    expect(res.status).to.equal(404);
    expect(res.body).to.have.property('success', false);
    expect(res.body).to.have.property('message');
  });
});
