const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const cardMarketRefProductsController = require('../../../controllers/cardMarketRefProductsController');
const CardMarketReferenceProduct = require('../../../models/CardMarketReferenceProduct');
const { errorHandler } = require('../../../middleware/errorHandler');

let mongoServer;

const setupTestApp = async () => {
  if (!mongoServer && mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }

  const app = express();

  app.use(express.json());

  app.get('/cardmarket', cardMarketRefProductsController.getAllCardMarketRefProducts);
  app.get('/cardmarket/search', cardMarketRefProductsController.searchCardMarketRefProducts);
  app.get('/cardmarket/:id', cardMarketRefProductsController.getCardMarketRefProductById);

  app.use(errorHandler);
  return app;
};

const teardownTest = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
};

const cleanupData = async () => {
  await CardMarketReferenceProduct.deleteMany({});
};

module.exports = {
  setupTestApp,
  teardownTest,
  cleanupData,
  CardMarketReferenceProduct,
};
