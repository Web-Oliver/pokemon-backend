const { expect } = require('chai');
const request = require('supertest');
const { setupPsaTestApp, setupPsaTestData, cleanupPsaTestData } = require('../helpers/psaTestSetup');

describe('DELETE /psa-graded-cards/:id', () => {
  let app;
  let testData;

  before(async () => {
    app = await setupPsaTestApp();
  });

  beforeEach(async () => {
    testData = await setupPsaTestData();
  });

  afterEach(async () => {
    await cleanupPsaTestData();
  });

  describe('when deleting PSA graded card', () => {
    it('should delete PSA graded card', async () => {
      const cardId = testData.psaCard1._id;

      const res = await request(app).delete(`/psa-graded-cards/${cardId}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body).to.have.property('message', 'PSA graded card deleted successfully');

      // Verify card is actually deleted
      const getRes = await request(app).get(`/psa-graded-cards/${cardId}`);

      expect(getRes.status).to.equal(404);
    });

    it('should return 404 for non-existent card', async () => {
      const fakeId = '507f1f77bcf86cd799439011';

      const res = await request(app).delete(`/psa-graded-cards/${fakeId}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('success', false);
    });
  });
});
