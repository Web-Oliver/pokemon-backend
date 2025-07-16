const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const sealedProductsController = require('../../../controllers/sealedProductsController');
const SealedProduct = require('../../../models/SealedProduct');
const { errorHandler } = require('../../../middleware/errorHandler');

let mongoServer;

async function setupSealedTestApp() {
  if (!mongoServer && mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }

  const app = express();

  app.use(express.json());

  app.get('/sealed-products', sealedProductsController.getAllSealedProducts);
  app.get('/sealed-products/:id', sealedProductsController.getSealedProductById);
  app.post('/sealed-products', sealedProductsController.createSealedProduct);
  app.put('/sealed-products/:id', sealedProductsController.updateSealedProduct);
  app.post('/sealed-products/:id/mark-sold', sealedProductsController.markAsSold);
  app.delete('/sealed-products/:id', sealedProductsController.deleteSealedProduct);

  app.use(errorHandler);

  return app;
}

async function setupSealedTestData() {
  await SealedProduct.deleteMany({});
  const CardMarketReferenceProduct = require('../../../models/CardMarketReferenceProduct');

  await CardMarketReferenceProduct.deleteMany({});

  const testReferenceProduct1 = await new CardMarketReferenceProduct({
    category: 'Booster-Boxes',
    setName: 'Base Set',
    name: 'Booster Box',
    price: '€120.00',
    available: 1,
    url: 'https://example.com/booster-box',
    scrapedAt: new Date(),
  }).save();

  const testReferenceProduct2 = await new CardMarketReferenceProduct({
    category: 'Boosters',
    setName: 'Base Set',
    name: 'Booster Pack',
    price: '€4.00',
    available: 10,
    url: 'https://example.com/booster-pack',
    scrapedAt: new Date(),
  }).save();

  const sealedProduct1 = await new SealedProduct({
    productId: testReferenceProduct1._id,
    name: 'Booster Box',
    setName: 'Base Set',
    category: 'Booster-Boxes',
    availability: 1,
    cardMarketPrice: 120,
    myPrice: 150,
    priceHistory: [{ price: 150, dateUpdated: new Date() }],
    sold: false,
  }).save();

  const sealedProduct2 = await new SealedProduct({
    productId: testReferenceProduct2._id,
    name: 'Booster Pack',
    setName: 'Base Set',
    category: 'Boosters',
    availability: 10,
    cardMarketPrice: 4,
    myPrice: 5,
    priceHistory: [{ price: 5, dateUpdated: new Date() }],
    sold: false,
  }).save();

  return {
    sealedProduct1,
    sealedProduct2,
    testReferenceProduct1,
    testReferenceProduct2,
  };
}

async function cleanupSealedTestData() {
  await SealedProduct.deleteMany({});
  const CardMarketReferenceProduct = require('../../../models/CardMarketReferenceProduct');

  await CardMarketReferenceProduct.deleteMany({});
}

async function closeSealedTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

module.exports = {
  setupSealedTestApp,
  setupSealedTestData,
  cleanupSealedTestData,
  closeSealedTestDatabase,
};
