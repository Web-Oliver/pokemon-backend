const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const sealedProductsController = require('../../../controllers/sealedProductsController');
const SealedProduct = require('../../../models/SealedProduct');
const CardMarketReferenceProduct = require('../../../models/CardMarketReferenceProduct');
const { errorHandler } = require('../../../middleware/errorHandler');

describe('POST /sealed-products', () => {
  let app;
  let mongoServer;
  let testReferenceProduct;

  before(async () => {
    if (!mongoServer && mongoose.connection.readyState === 0) {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
    }

    app = express();
    app.use(express.json());

    app.post('/sealed-products', sealedProductsController.createSealedProduct);
    app.use(errorHandler);
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
    await SealedProduct.deleteMany({});
    await CardMarketReferenceProduct.deleteMany({});

    testReferenceProduct = await new CardMarketReferenceProduct({
      category: 'Elite-Trainer-Boxes',
      setName: 'Sword & Shield',
      name: 'Elite Trainer Box',
      price: '€45.00',
      available: 1,
      url: 'https://example.com/elite-trainer-box',
      scrapedAt: new Date(),
    }).save();
  });

  describe('when creating sealed product', () => {
    it('should create sealed product with valid reference data', async () => {
      const newProduct = {
        category: testReferenceProduct.category,
        setName: testReferenceProduct.setName,
        name: testReferenceProduct.name,
        myPrice: 45,
        images: [],
      };

      const res = await request(app).post('/sealed-products').send(newProduct);

      expect(res.status).to.equal(201);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('name', 'Elite Trainer Box');
      expect(res.body.data).to.have.property('myPrice', 45);
      expect(res.body.data).to.have.property('productId');
      expect(res.body.data.productId).to.have.property('name', testReferenceProduct.name);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteProduct = {
        name: 'Booster Box',
        // Missing setName, category, and myPrice
      };

      const res = await request(app).post('/sealed-products').send(incompleteProduct);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('success', false);
    });

    it('should return 400 for invalid reference data', async () => {
      const invalidProduct = {
        category: 'Invalid-Category',
        setName: 'Invalid Set Name',
        name: 'Invalid Product Name',
        myPrice: 45,
        images: [],
      };

      const res = await request(app).post('/sealed-products').send(invalidProduct);

      expect(res.status).to.equal(400);
      expect(res.body).to.have.property('success', false);
      expect(res.body.message).to.include('not found');
    });
  });
});
