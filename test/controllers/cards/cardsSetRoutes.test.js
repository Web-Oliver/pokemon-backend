const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, setupTestData, cleanupTestData } = require('../helpers/testSetup');

describe('GET /sets/:setId/cards', () => {
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

  it('should return cards for specific set', async () => {
    const res = await request(app).get(`/sets/${testSet._id}/cards`);

    expect(res.status).to.equal(200);
    expect(res.body.data.cards).to.have.length(2);
    expect(res.body.data.setId).to.equal(testSet._id.toString());
  });

  it('should filter cards by query', async () => {
    const res = await request(app).get(`/sets/${testSet._id}/cards?q=pika`);

    expect(res.status).to.equal(200);
    expect(res.body.data.cards).to.have.length(1);
    expect(res.body.data.cards[0].cardName.toLowerCase()).to.include('pikachu');
  });

  it('should paginate results', async () => {
    const res = await request(app).get(`/sets/${testSet._id}/cards?page=1&limit=1`);

    expect(res.status).to.equal(200);
    expect(res.body.data.cards).to.have.length(1);
    expect(res.body.data.currentPage).to.equal(1);
    expect(res.body.data.totalPages).to.equal(2);
    expect(res.body.data.totalCards).to.equal(2);
  });
});
