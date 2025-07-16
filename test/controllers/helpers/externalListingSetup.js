const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const externalListingController = require('../../../controllers/externalListingController');
const SealedProduct = require('../../../models/SealedProduct');
const PsaGradedCard = require('../../../models/PsaGradedCard');
const RawCard = require('../../../models/RawCard');
const Card = require('../../../models/Card');
const Set = require('../../../models/Set');
const { errorHandler } = require('../../../middleware/errorHandler');

let mongoServer;

async function setupExternalListingApp() {
  if (!mongoServer && mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }

  const app = express();

  app.use(express.json());

  app.post('/api/generate-facebook-post', externalListingController.generateFacebookPost);
  app.post('/api/generate-dba-title', externalListingController.generateDbaTitle);

  app.use(errorHandler);

  return app;
}

async function setupExternalListingData() {
  await SealedProduct.deleteMany({});
  await PsaGradedCard.deleteMany({});
  await RawCard.deleteMany({});
  await Card.deleteMany({});
  await Set.deleteMany({});

  const testSet = await new Set({
    setName: 'Base Set',
    year: 1998,
    setUrl: 'https://example.com',
    totalCardsInSet: 102,
    totalPsaPopulation: 50000,
    releaseYear: 1998,
  }).save();

  const testCard = await new Card({
    cardName: 'Pikachu',
    pokemonNumber: '25',
    setId: testSet._id,
    baseName: 'Pikachu',
    psaTotalGradedForCard: 1000,
    variety: 'Normal',
  }).save();

  const sealedProduct = await new SealedProduct({
    name: 'Booster Pack',
    setName: 'Base Set',
    category: 'Boosters',
    availability: 1,
    cardMarketPrice: 120,
    myPrice: 150,
    sold: false,
  }).save();

  const psaCard = await new PsaGradedCard({
    cardId: testCard._id,
    grade: 10,
    myPrice: 500,
    sold: false,
  }).save();

  const rawCard = await new RawCard({
    cardId: testCard._id,
    myPrice: 50,
    sold: false,
  }).save();

  return {
    testSet,
    testCard,
    sealedProduct,
    psaCard,
    rawCard,
  };
}

async function cleanupExternalListingData() {
  await SealedProduct.deleteMany({});
  await PsaGradedCard.deleteMany({});
  await RawCard.deleteMany({});
  await Card.deleteMany({});
  await Set.deleteMany({});
}

async function closeExternalListingDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

module.exports = {
  setupExternalListingApp,
  setupExternalListingData,
  cleanupExternalListingData,
  closeExternalListingDatabase,
};
