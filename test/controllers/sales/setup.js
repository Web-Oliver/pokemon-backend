const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const salesController = require('../../../controllers/salesController');
const SealedProduct = require('../../../models/SealedProduct');
const PsaGradedCard = require('../../../models/PsaGradedCard');
const RawCard = require('../../../models/RawCard');
const Card = require('../../../models/Card');
const Set = require('../../../models/Set');

let mongoServer;
let testSet;
let testCard;

const setupTestApp = async () => {
  if (!mongoServer && mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }

  const app = express();

  app.use(express.json());

  app.get('/sales', salesController.getSales);
  app.get('/sales/summary', salesController.getSalesSummary);
  app.get('/sales/graph', salesController.getSalesGraphData);

  return app;
};

const setupTestData = async () => {
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

  return { testSet, testCard };
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
  await SealedProduct.deleteMany({});
  await PsaGradedCard.deleteMany({});
  await RawCard.deleteMany({});
  await Card.deleteMany({});
  await Set.deleteMany({});
};

module.exports = {
  setupTestApp,
  setupTestData,
  teardownTest,
  cleanupData,
  SealedProduct,
  PsaGradedCard,
  RawCard,
  Card,
  Set,
};
