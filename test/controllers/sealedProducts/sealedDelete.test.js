const { expect } = require('chai');
const request = require('supertest');
const { setupSealedTestApp, setupSealedTestData, cleanupSealedTestData } = require('../helpers/sealedTestSetup');

describe('DELETE /sealed-products/:id', () => {
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

  describe('when deleting sealed product', () => {
    it('should delete sealed product', async () => {
      const productId = testData.sealedProduct1._id;

      const res = await request(app).delete(`/sealed-products/${productId}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body).to.have.property('message', 'Sealed product deleted successfully');

      // Verify product is actually deleted
      const getRes = await request(app).get(`/sealed-products/${productId}`);

      expect(getRes.status).to.equal(404);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app).delete(`/sealed-products/${fakeId}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('success', false);
    });
  });
});
