const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const rawCardsController = require('../../controllers/rawCardsController');
const RawCard = require('../../models/RawCard');
const Card = require('../../models/Card');
const Set = require('../../models/Set');

describe('Raw Cards Controller', () => {
  let app;
  let mongoServer;
  let testSet;
  let testCard;

  before(async () => {
    if (!mongoServer && mongoose.connection.readyState === 0) {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
    }

    app = express();
    app.use(express.json());

    app.get('/raw-cards', rawCardsController.getAllRawCards);
    app.get('/raw-cards/:id', rawCardsController.getRawCardById);
    app.post('/raw-cards', rawCardsController.createRawCard);
    app.put('/raw-cards/:id', rawCardsController.updateRawCard);
    app.delete('/raw-cards/:id', rawCardsController.deleteRawCard);
    app.post('/raw-cards/:id/mark-sold', rawCardsController.markAsSold);
  });

  after(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
  });

  beforeEach(async () => {
    await RawCard.deleteMany({});
    await Card.deleteMany({});
    await Set.deleteMany({});

    testSet = await new Set({
      setName: 'Base Set',
      year: 1998,
      setUrl: 'https://example.com',
      totalCardsInSet: 102,
      totalPsaPopulation: 50000,
    }).save();

    testCard = await new Card({
      setId: testSet._id,
      pokemonNumber: '25',
      cardName: 'Pikachu',
      baseName: 'Pikachu',
      psaTotalGradedForCard: 100,
    }).save();
  });

  describe('GET /raw-cards', () => {
    it('should return all raw cards', async () => {
      await new RawCard({
        cardId: testCard._id,
        condition: 'Near Mint',
        myPrice: 100,
      }).save();

      const res = await request(app).get('/raw-cards');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.length(1);
    });

    it('should filter by sold status', async () => {
      await RawCard.create([
        {
          cardId: testCard._id,
          condition: 'Near Mint',
          myPrice: 100,
          sold: true,
        },
        {
          cardId: testCard._id,
          condition: 'Lightly Played',
          myPrice: 200,
          sold: false,
        },
      ]);

      const res = await request(app).get('/raw-cards?sold=true');

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.length(1);
      expect(res.body.data[0].sold).to.be.true;
    });
  });

  describe('GET /raw-cards/:id', () => {
    it('should return specific raw card', async () => {
      const card = await new RawCard({
        cardId: testCard._id,
        condition: 'Near Mint',
        myPrice: 100,
      }).save();

      const res = await request(app).get(`/raw-cards/${card._id}`);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data.myPrice).to.equal(100);
    });

    it('should return 404 for non-existent card', async () => {
      const res = await request(app).get(`/raw-cards/${new mongoose.Types.ObjectId()}`);

      expect(res.status).to.equal(404);
    });
  });

  describe('POST /raw-cards', () => {
    it('should create raw card with valid reference data', async () => {
      const res = await request(app)
        .post('/raw-cards')
        .send({
          cardName: testCard.cardName,
          setName: testSet.setName,
          pokemonNumber: testCard.pokemonNumber,
          variety: testCard.variety,
          baseName: testCard.baseName,
          year: testSet.year,
          psaTotalGraded: testCard.psaTotalGradedForCard,
          condition: 'Near Mint',
          myPrice: 100,
          images: [],
        });

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data.myPrice).to.equal(100);
      expect(res.body.data).to.have.property('condition', 'Near Mint');
      expect(res.body.data.priceHistory).to.have.length(1);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/raw-cards')
        .send({
          cardName: testCard.cardName,
          // Missing setName, condition, and myPrice
        });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('success', false);
    });

    it('should return 400 for invalid reference data', async () => {
      const res = await request(app)
        .post('/raw-cards')
        .send({
          cardName: 'Invalid Card Name',
          setName: 'Invalid Set Name',
          condition: 'Near Mint',
          myPrice: 100,
          images: [],
        });

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('success', false);
      expect(res.body.message).to.include('not found');
    });
  });

  describe('PUT /raw-cards/:id', () => {
    it('should update raw card', async () => {
      const card = await new RawCard({
        cardId: testCard._id,
        condition: 'Near Mint',
        myPrice: 100,
      }).save();

      const res = await request(app)
        .put(`/raw-cards/${card._id}`)
        .send({ myPrice: 150 });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data.myPrice).to.equal(150);
    });

    it('should return 404 for non-existent card', async () => {
      const res = await request(app)
        .put(`/raw-cards/${new mongoose.Types.ObjectId()}`)
        .send({ myPrice: 150 });

      expect(res.status).to.equal(404);
    });
  });

  describe('DELETE /raw-cards/:id', () => {
    it('should delete raw card', async () => {
      const card = await new RawCard({
        cardId: testCard._id,
        condition: 'Near Mint',
        myPrice: 100,
      }).save();

      const res = await request(app).delete(`/raw-cards/${card._id}`);

      expect(res.status).to.equal(200);
      expect(res.body.message).to.include('deleted');
    });
  });

  describe('POST /raw-cards/:id/mark-sold', () => {
    it('should mark card as sold', async () => {
      const card = await new RawCard({
        cardId: testCard._id,
        condition: 'Near Mint',
        myPrice: 100,
      }).save();

      const res = await request(app)
        .post(`/raw-cards/${card._id}/mark-sold`)
        .send({
          paymentMethod: 'Mobilepay',
          actualSoldPrice: 120,
          deliveryMethod: 'Sent',
          source: 'Facebook',
          buyerFullName: 'John Doe',
          buyerAddress: {
            streetName: '123 Main St',
            postnr: '12345',
            city: 'Test City',
          },
          buyerPhoneNumber: '123-456-7890',
          buyerEmail: 'john@example.com',
          trackingNumber: 'TRACK123',
        });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data.sold).to.be.true;
      expect(res.body.data.saleDetails.paymentMethod).to.equal('Mobilepay');
    });
  });
});
