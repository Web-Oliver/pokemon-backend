const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const sealedProductsController = require('../../../controllers/sealedProductsController');
const SealedProduct = require('../../../models/SealedProduct');
const CardMarketReferenceProduct = require('../../../models/CardMarketReferenceProduct');
const { errorHandler } = require('../../../middleware/errorHandler');

describe('PUT /sealed-products/:id', () => {
  let app;
  let mongoServer;
  let testData;

  before(async () => {
    if (!mongoServer && mongoose.connection.readyState === 0) {
      mongoServer = await MongoMemoryServer.create();
      await mongoose.connect(mongoServer.getUri());
    }

    app = express();
    app.use(express.json());

    app.put('/sealed-products/:id', sealedProductsController.updateSealedProduct);
    app.post('/sealed-products/:id/mark-sold', sealedProductsController.markAsSold);
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

    const testReferenceProduct = await new CardMarketReferenceProduct({
      category: 'Booster-Boxes',
      setName: 'Base Set',
      name: 'Booster Box',
      price: '€120.00',
      available: 1,
      url: 'https://example.com/booster-box',
      scrapedAt: new Date(),
    }).save();

    const sealedProduct1 = await new SealedProduct({
      productId: testReferenceProduct._id,
      category: 'Booster-Boxes',
      setName: 'Base Set',
      name: 'Booster Box',
      availability: 1,
      cardMarketPrice: 120,
      myPrice: 150,
      priceHistory: [{ price: 150, dateUpdated: new Date() }],
      sold: false,
    }).save();

    testData = {
      sealedProduct1,
      testReferenceProduct,
    };
  });

  describe('when updating sealed product', () => {
    it('should update sealed product', async () => {
      const productId = testData.sealedProduct1._id;
      const updates = {
        myPrice: 160,
      };

      const res = await request(app)
        .put(`/sealed-products/${productId}`)
        .send(updates);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('myPrice', 160);
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const updates = { myPrice: 160 };

      const res = await request(app)
        .put(`/sealed-products/${fakeId}`)
        .send(updates);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('success', false);
    });
  });

  describe('when marking product as sold', () => {
    it('should mark product as sold', async () => {
      const productId = testData.sealedProduct1._id;
      const saleData = {
        paymentMethod: 'Mobilepay',
        actualSoldPrice: 180,
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
      };

      const res = await request(app)
        .post(`/sealed-products/${productId}/mark-sold`)
        .send(saleData);

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('success', true);
      expect(res.body.data).to.have.property('sold', true);
      expect(res.body.data.saleDetails).to.have.property('actualSoldPrice', 180);
      expect(res.body.data.saleDetails).to.have.property('paymentMethod', 'Mobilepay');
    });

    it('should return 404 for non-existent product', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const saleData = {
        paymentMethod: 'Mobilepay',
        actualSoldPrice: 180,
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
      };

      const res = await request(app)
        .post(`/sealed-products/${fakeId}/mark-sold`)
        .send(saleData);

      expect(res.status).to.equal(404);
      expect(res.body).to.have.property('success', false);
    });
  });
});
