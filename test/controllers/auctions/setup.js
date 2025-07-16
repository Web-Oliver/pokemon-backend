const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const auctionsController = require('../../../controllers/auctionsController');
const Auction = require('../../../models/Auction');
const SealedProduct = require('../../../models/SealedProduct');
const { errorHandler } = require('../../../middleware/errorHandler');

let mongoServer;

const setupTestApp = async () => {
  if (!mongoServer && mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }

  const app = express();

  app.use(express.json());

  app.get('/auctions', auctionsController.getAllAuctions);
  app.get('/auctions/:id', auctionsController.getAuctionById);
  app.post('/auctions', auctionsController.createAuction);
  app.put('/auctions/:id', auctionsController.updateAuction);
  app.delete('/auctions/:id', auctionsController.deleteAuction);
  app.post('/auctions/:id/items', auctionsController.addItemToAuction);
  app.delete('/auctions/:id/items', auctionsController.removeItemFromAuction);
  app.patch('/auctions/:id/items/sold', auctionsController.markItemAsSold);

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
  await Auction.deleteMany({});
  await SealedProduct.deleteMany({});
};

module.exports = {
  setupTestApp,
  teardownTest,
  cleanupData,
  Auction,
  SealedProduct,
};
