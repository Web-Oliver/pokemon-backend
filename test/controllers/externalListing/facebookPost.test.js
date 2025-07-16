const { expect } = require('chai');
const request = require('supertest');
const {
  setupExternalListingApp,
  setupExternalListingData,
  cleanupExternalListingData,
} = require('../helpers/externalListingSetup');

describe('POST /api/generate-facebook-post', () => {
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
    it('should generate Facebook post for sealed product', async () => {
      const items = [
        {
          itemId: testData.sealedProduct._id,
          itemCategory: 'SealedProduct',
        },
      ];

      const res = await request(app).post('/api/generate-facebook-post').send({
        items,
        topText: 'Check out these items!',
        bottomText: 'Contact me for more info!',
      });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('status', 'success');
      expect(res.body.data).to.have.property('facebookPost');
      expect(res.body.data.facebookPost).to.include('SEALED PRODUCTS:');
      expect(res.body.data.facebookPost).to.include('Booster Pack Sealed');
    });

    it('should generate Facebook post for PSA graded card', async () => {
      const items = [
        {
          itemId: testData.psaCard._id,
          itemCategory: 'PsaGradedCard',
        },
      ];

      const res = await request(app).post('/api/generate-facebook-post').send({
        items,
        topText: 'Amazing PSA cards!',
        bottomText: "Don't miss out!",
      });

      expect(res.status).to.equal(200);
      expect(res.body.data.facebookPost).to.include('PSA CARDS:');
      expect(res.body.data.facebookPost).to.include('PSA 10');
    });

    it('should generate Facebook post for raw card', async () => {
      const items = [
        {
          itemId: testData.rawCard._id,
          itemCategory: 'RawCard',
        },
      ];

      const res = await request(app).post('/api/generate-facebook-post').send({
        items,
        topText: 'Raw cards for sale!',
        bottomText: 'Get them while they last!',
      });

      expect(res.status).to.equal(200);
      expect(res.body.data.facebookPost).to.include('RAW CARDS:');
    });
  });

  describe('when given invalid input', () => {
    it('should return 400 for missing items', async () => {
      const res = await request(app).post('/api/generate-facebook-post').send({
        topText: 'Test',
        bottomText: 'Test',
      });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('success', false);
      expect(res.body.message).to.include('Items array is required');
    });

    it('should return 400 for missing topText', async () => {
      const res = await request(app)
        .post('/api/generate-facebook-post')
        .send({
          items: [
            {
              itemId: testData.sealedProduct._id,
              itemCategory: 'SealedProduct',
            },
          ],
          bottomText: 'Test',
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('Both topText and bottomText are required');
    });

    it('should return 400 for invalid itemCategory', async () => {
      const res = await request(app)
        .post('/api/generate-facebook-post')
        .send({
          items: [
            {
              itemId: testData.sealedProduct._id,
              itemCategory: 'InvalidCategory',
            },
          ],
          topText: 'Test',
          bottomText: 'Test',
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('Invalid itemCategory');
    });

    it('should return 400 for invalid ObjectId', async () => {
      const res = await request(app)
        .post('/api/generate-facebook-post')
        .send({
          items: [{ itemId: 'invalid-id', itemCategory: 'SealedProduct' }],
          topText: 'Test',
          bottomText: 'Test',
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.include('Invalid itemId format');
    });

    it('should return 404 for non-existent item', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post('/api/generate-facebook-post')
        .send({
          items: [{ itemId: fakeId, itemCategory: 'SealedProduct' }],
          topText: 'Test',
          bottomText: 'Test',
        });

      expect(res.status).to.equal(404);
      expect(res.body.message).to.include('Item not found');
    });
  });
});
