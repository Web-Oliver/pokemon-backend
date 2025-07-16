const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const psaGradedCardsController = require('../../../controllers/psaGradedCardsController');
const PsaGradedCard = require('../../../models/PsaGradedCard');
const Card = require('../../../models/Card');
const Set = require('../../../models/Set');
const { errorHandler } = require('../../../middleware/errorHandler');

let mongoServer;

async function setupPsaTestApp() {
  if (!mongoServer && mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  }

  const app = express();

  app.use(express.json());

  app.get('/psa-graded-cards', psaGradedCardsController.getAllPsaGradedCards);
  app.get('/psa-graded-cards/:id', psaGradedCardsController.getPsaGradedCardById);
  app.post('/psa-graded-cards', psaGradedCardsController.createPsaGradedCard);
  app.put('/psa-graded-cards/:id', psaGradedCardsController.updatePsaGradedCard);
  app.put('/psa-graded-cards/:id/sell', psaGradedCardsController.markAsSold);
  app.delete('/psa-graded-cards/:id', psaGradedCardsController.deletePsaGradedCard);

  app.use(errorHandler);

  return app;
}

async function setupPsaTestData() {
  await PsaGradedCard.deleteMany({});
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

  const psaCard1 = await new PsaGradedCard({
    cardId: testCard._id,
    grade: 10,
    myPrice: 500,
    sold: false,
  }).save();

  const psaCard2 = await new PsaGradedCard({
    cardId: testCard._id,
    grade: 9,
    myPrice: 300,
    sold: false,
  }).save();

  return {
    testSet,
    testCard,
    psaCard1,
    psaCard2,
  };
}

async function cleanupPsaTestData() {
  await PsaGradedCard.deleteMany({});
  await Card.deleteMany({});
  await Set.deleteMany({});
}

async function closePsaTestDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
    mongoServer = null;
  }
}

module.exports = {
  setupPsaTestApp,
  setupPsaTestData,
  cleanupPsaTestData,
  closePsaTestDatabase,
};
