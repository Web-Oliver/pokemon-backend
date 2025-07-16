const { expect } = require('chai');
const request = require('supertest');
const { setupPsaTestApp, setupPsaTestData, cleanupPsaTestData } = require('../helpers/psaTestSetup');

describe('POST /psa-graded-cards', () => {
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

  describe('when creating PSA graded card', () => {
    it('should create PSA graded card with valid reference data', async () => {
      const newCard = {
        cardName: testData.testCard.cardName,
        setName: testData.testSet.setName,
        pokemonNumber: testData.testCard.pokemonNumber,
        variety: testData.testCard.variety,
        baseName: testData.testCard.baseName,
        year: testData.testSet.year,
        psaTotalGraded: testData.testCard.psaTotalGradedForCard,
        grade: '9',
        myPrice: 400,
        images: [],
      };

      const res = await request(app).post('/psa-graded-cards').send(newCard);

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('grade', '9');
      expect(res.body.data).to.have.property('myPrice', 400);
      expect(res.body.data).to.have.property('cardId');
      expect(res.body.data.cardId).to.have.property('cardName', testData.testCard.cardName);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteCard = {
        grade: '9',
        // Missing cardName, setName, and myPrice
      };

      const res = await request(app).post('/psa-graded-cards').send(incompleteCard);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('success', false);
    });

    it('should return 400 for invalid reference data', async () => {
      const invalidCard = {
        cardName: 'Invalid Card Name',
        setName: 'Invalid Set Name',
        grade: '9',
        myPrice: 400,
        images: [],
      };

      const res = await request(app).post('/psa-graded-cards').send(invalidCard);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('success', false);
      expect(res.body.message).to.include('not found');
    });
  });
});
