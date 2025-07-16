const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const cardsController = require('../../../controllers/cardsController');
const Card = require('../../../models/Card');
const Set = require('../../../models/Set');
const { errorHandler } = require('../../../middleware/errorHandler');

let mongoServer;

async function setupTestApp() {
  if (!mongoServer && mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }

  const app = express();

  app.use(express.json());

  app.get('/cards', cardsController.getAllCards);
  app.get('/cards/search', cardsController.searchCards);
  app.get('/cards/search/best-match', cardsController.searchBestMatch);
  app.get('/cards/:id', cardsController.getCardById);
  app.get('/sets/:setId/cards', cardsController.getCardsBySetId);

  app.use(errorHandler);

  return app;
}

async function setupTestData() {
  await Card.deleteMany({});
  await Set.deleteMany({});

  const testSet = await new Set({
    setName: 'Base Set',
    year: 1998,
    setUrl: 'https://example.com',
    totalCardsInSet: 102,
    totalPsaPopulation: 50000,
  }).save();

  await new Card({
    cardName: 'Pikachu',
    pokemonNumber: '25',
    setId: testSet._id,
    baseName: 'Pikachu',
    psaTotalGradedForCard: 1000,
  }).save();

  await new Card({
    cardName: 'Charizard',
    pokemonNumber: '6',
    setId: testSet._id,
    baseName: 'Charizard',
    psaTotalGradedForCard: 500,
  }).save();

  return testSet;
}

async function cleanupTestData() {
  await Card.deleteMany({});
  await Set.deleteMany({});
}

async function closeTestDatabase() {
  if (mongoServer) {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
  }
}

module.exports = {
  setupTestApp,
  setupTestData,
  cleanupTestData,
  closeTestDatabase,
};
