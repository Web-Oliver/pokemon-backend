const { expect } = require('chai');
const request = require('supertest');
const { setupTestApp, teardownTest, cleanupData } = require('./setup');

describe('POST /auctions', () => {
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

  it('should create auction with required fields', async () => {
    const res = await request(app).post('/auctions').send({ topText: 'New', bottomText: 'Auction' });

    expect(res.status).to.equal(201);
    expect(res.body.topText).to.equal('New');
    expect(res.body.status).to.equal('draft');
  });

  it('should return 400 for missing required fields', async () => {
    const res = await request(app).post('/auctions').send({ topText: 'Only top' });

    expect(res.status).to.equal(400);
  });
});
