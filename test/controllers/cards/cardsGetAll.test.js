const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, setupTestData, cleanupTestData } = require('../helpers/testSetup');

describe('GET /cards', () => {
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

  it('should return all cards', async () => {
    const res = await request(app).get('/cards');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('success', true);
    expect(res.body.data).to.be.an('array');
    expect(res.body.data).to.have.length(2);
  });

  it('should filter by setId', async () => {
    const res = await request(app).get(`/cards?setId=${testSet._id}`);

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.length(2);
    expect(res.body.data[0].setId._id.toString()).to.equal(testSet._id.toString());
  });

  it('should filter by cardName', async () => {
    const res = await request(app).get('/cards?cardName=Pikachu');

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.length(1);
    expect(res.body.data[0].cardName).to.equal('Pikachu');
  });
});
