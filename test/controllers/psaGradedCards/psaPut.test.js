const { expect } = require('chai');
const request = require('supertest');
const { setupPsaTestApp, setupPsaTestData, cleanupPsaTestData } = require('../helpers/psaTestSetup');

describe('PUT /psa-graded-cards/:id', () => {
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

  describe('when updating PSA graded card', () => {
    it('should update PSA graded card', async () => {
      const cardId = testData.psaCard1._id;
      const updates = {
        myPrice: 600,
        condition: 'Near Mint',
      };

      const res = await request(app)
        .put(`/psa-graded-cards/${cardId}`)
        .send(updates);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('myPrice', 600);
    });

    it('should return 404 for non-existent card', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const updates = { myPrice: 600 };

      const res = await request(app)
        .put(`/psa-graded-cards/${fakeId}`)
        .send(updates);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('success', false);
    });
  });

  describe('when marking card as sold', () => {
    it('should mark card as sold', async () => {
      const cardId = testData.psaCard1._id;
      const saleData = {
        actualSoldPrice: 650,
        paymentMethod: 'Mobilepay',
        deliveryMethod: 'Sent',
        source: 'Facebook',
      };

      const res = await request(app)
        .put(`/psa-graded-cards/${cardId}/sell`)
        .send(saleData);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('sold', true);
      expect(res.body.data.saleDetails).to.have.property('actualSoldPrice', 650);
    });

    it('should return 404 for non-existent card', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const saleData = { actualSoldPrice: 650 };

      const res = await request(app)
        .put(`/psa-graded-cards/${fakeId}/sell`)
        .send(saleData);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('success', false);
    });
  });
});
