const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, setupTestData, cleanupTestData } = require('../helpers/testSetup');

describe('GET /cards/search/best-match', () => {
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

  it('should return best matches', async () => {
    const res = await request(app).get('/cards/search/best-match?cardName=Pikachu&pokemonNumber=25');

    expect(res.status).to.equal(200);
    expect(res.body.data).to.have.length.at.least(1);
    expect(res.body.data[0]).to.have.property('cardName');
    expect(res.body.data[0]).to.have.property('score');
  });

  it('should work without query parameters', async () => {
    const res = await request(app).get('/cards/search/best-match');

    expect(res.status).to.equal(200);
    expect(res.body.data).to.be.an('array');
  });
});
