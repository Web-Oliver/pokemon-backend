const { expect } = require('chai');
const request = require('supertest');
const { setupPsaTestApp, setupPsaTestData, cleanupPsaTestData } = require('../helpers/psaTestSetup');

describe('GET /psa-graded-cards', () => {
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

  describe('when getting all PSA graded cards', () => {
    it('should return all PSA graded cards', async () => {
      const res = await request(app).get('/psa-graded-cards');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.be.an('array');
      expect(res.body.data).to.have.length(2);
    });

    it('should filter by grade', async () => {
      const res = await request(app).get('/psa-graded-cards?grade=10');

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.length(1);
      expect(res.body.data[0].grade).to.equal('10');
    });

    it('should filter by sold status', async () => {
      const res = await request(app).get('/psa-graded-cards?sold=false');

      expect(res.status).to.equal(200);
      expect(res.body.data).to.have.length(2);
      res.body.data.forEach((card) => {
        expect(card.sold).to.equal(false);
      });
    });
  });

  describe('when getting PSA graded card by ID', () => {
    it('should return specific PSA graded card', async () => {
      const cardId = testData.psaCard1._id;
      const res = await request(app).get(`/psa-graded-cards/${cardId}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('_id', cardId.toString());
      expect(res.body.data).to.have.property('grade');
    });

    it('should return 404 for non-existent card', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app).get(`/psa-graded-cards/${fakeId}`);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('success', false);
    });
  });
});
