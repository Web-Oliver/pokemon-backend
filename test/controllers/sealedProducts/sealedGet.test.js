const { expect } = require('chai');
const request = require('supertest');
const { setupSealedTestApp, setupSealedTestData, cleanupSealedTestData } = require('../helpers/sealedTestSetup');

describe('GET /sealed-products', () => {
  let app;
  let testData;

  before(async () => {
    app = await setupSealedTestApp();
  });

  beforeEach(async () => {
    testData = await setupSealedTestData();
  });

  afterEach(async () => {
    await cleanupSealedTestData();
  });

  describe('when getting all sealed products', () => {
    it('should return all sealed products', async () => {
      const res = await request(app).get('/sealed-products');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.length(2);
    });

    it('should filter by setName', async () => {
      const res = await request(app).get('/sealed-products?setName=Base Set');

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.length(2);
      res.body.data.forEach((product) => {
        expect(product.setName).to.equal('Base Set');
      });
    });

    it('should filter by sold status', async () => {
      const res = await request(app).get('/sealed-products?sold=false');

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.length(2);
      res.body.data.forEach((product) => {
        expect(product.sold).to.equal(false);
      });
    });
  });

  describe('when getting sealed product by ID', () => {
    it('should return specific sealed product', async () => {
      const productId = testData.sealedProduct1._id;
      const res = await request(app).get(`/sealed-products/${productId}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('_id', productId.toString());
      expect(res.body.data).to.have.property('name');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/sealed-products/${fakeId}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('success', false);
    });
  });
});
