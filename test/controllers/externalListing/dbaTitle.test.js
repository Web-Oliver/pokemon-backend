const { expect } = require('chai');
const request = require('supertest');
const {
  setupExternalListingApp,
  setupExternalListingData,
  cleanupExternalListingData,
} = require('../helpers/externalListingSetup');

describe('POST /api/generate-dba-title', () => {
  let app;
  let testData;

  before(async () => {
    app = await setupExternalListingApp();
  });

  beforeEach(async () => {
    testData = await setupExternalListingData();
  });

  afterEach(async () => {
    await cleanupExternalListingData();
  });

  describe('when given valid items', () => {
    it('should generate DBA title for sealed product', async () => {
      const res = await request(app).post('/api/generate-dba-title').send({
        itemId: testData.sealedProduct._id,
        itemCategory: 'SealedProduct',
      });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('status', 'success');
      expect(res.body.data).to.have.property('dbaTitle');
      expect(res.body.data.dbaTitle).to.include('Pokemon');
      expect(res.body.data.dbaTitle).to.include('Booster Pack');
    });

    it('should generate DBA title for PSA graded card', async () => {
      const res = await request(app).post('/api/generate-dba-title').send({
        itemId: testData.psaCard._id,
        itemCategory: 'PsaGradedCard',
      });

      expect(res.status).to.equal(200);
      expect(res.body.data.dbaTitle).to.include('Pokemon');
      expect(res.body.data.dbaTitle).to.include('10');
    });

    it('should generate DBA title for raw card', async () => {
      const res = await request(app).post('/api/generate-dba-title').send({
        itemId: testData.rawCard._id,
        itemCategory: 'RawCard',
      });

      expect(res.status).to.equal(200);
      expect(res.body.data.dbaTitle).to.include('Pokemon');
    });
  });

  describe('when given invalid input', () => {
    it('should return 400 for missing itemId', async () => {
      const res = await request(app).post('/api/generate-dba-title').send({
        itemCategory: 'SealedProduct',
      });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('success', false);
      expect(res.body.message).to.include('Both itemId and itemCategory are required');
    });

    it('should return 400 for invalid itemCategory', async () => {
      const res = await request(app).post('/api/generate-dba-title').send({
        itemId: testData.sealedProduct._id,
        itemCategory: 'InvalidCategory',
      });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('Invalid itemCategory');
    });

    it('should return 400 for invalid ObjectId', async () => {
      const res = await request(app).post('/api/generate-dba-title').send({
        itemId: 'invalid-id',
        itemCategory: 'SealedProduct',
      });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('Invalid itemId format');
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app).post('/api/generate-dba-title').send({
        itemId: fakeId,
        itemCategory: 'SealedProduct',
      });

      expect(res.status).to.equal(404);
      expect(res.body.message).to.include('Item not found');
    });
  });
});
