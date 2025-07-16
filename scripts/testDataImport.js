const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { importAllData, getAllPsaFiles, getAllCardMarketFiles } = require('../utils/dataImporter');
const Set = require('../models/Set');
const Card = require('../models/Card');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');

async function testDataImport() {
  let mongoServer;

  try {
    // Start in-memory MongoDB
    console.log('🚀 Starting in-memory MongoDB...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to in-memory MongoDB');

    console.log('🔍 Testing file discovery...');
    const psaFiles = getAllPsaFiles();
    const cardMarketFiles = getAllCardMarketFiles();

    console.log(`Found ${psaFiles.length} PSA files`);
    console.log(`Found ${cardMarketFiles.length} CardMarket files`);

    if (psaFiles.length > 0) {
      console.log('Sample PSA files:');
      psaFiles.slice(0, 3).forEach((file) => console.log(`  - ${file}`));
    }

    if (cardMarketFiles.length > 0) {
      console.log('Sample CardMarket files:');
      cardMarketFiles.slice(0, 3).forEach((file) => console.log(`  - ${file}`));
    }

    // Clear existing data
    console.log('\n🧹 Clearing existing test data...');
    await Set.deleteMany({});
    await Card.deleteMany({});
    await CardMarketReferenceProduct.deleteMany({});

    // Test limited PSA import
    console.log('\n📦 Testing PSA data import (limited to 1 file)...');
    const psaResults = await importAllData({
      includePsa: true,
      includeCardMarket: false,
      limitPsaFiles: 1,
    });

    console.log('PSA Import Results:', {
      success: psaResults.errors.length === 0,
      files: psaResults.psaFiles,
      sets: psaResults.setsProcessed,
      cards: psaResults.cardsProcessed,
      errors: psaResults.errors.length > 0 ? psaResults.errors.slice(0, 3) : [],
    });

    // Test limited CardMarket import
    console.log('\n🛒 Testing CardMarket data import (limited to 1 file)...');
    const cardMarketResults = await importAllData({
      includePsa: false,
      includeCardMarket: true,
      limitCardMarketFiles: 1,
    });

    console.log('CardMarket Import Results:', {
      success: cardMarketResults.errors.length === 0,
      files: cardMarketResults.cardMarketFiles,
      products: cardMarketResults.productsProcessed,
      errors: cardMarketResults.errors.length > 0 ? cardMarketResults.errors.slice(0, 3) : [],
    });

    // Verify data in database
    console.log('\n📊 Verifying data in database...');
    const setCount = await Set.countDocuments();
    const cardCount = await Card.countDocuments();
    const productCount = await CardMarketReferenceProduct.countDocuments();

    console.log('Database contains:');
    console.log(`  - ${setCount} sets`);
    console.log(`  - ${cardCount} cards`);
    console.log(`  - ${productCount} products`);

    // Show sample data
    if (setCount > 0) {
      const sampleSet = await Set.findOne();

      console.log('\nSample set:');
      console.log(`  - Name: ${sampleSet.setName}`);
      console.log(`  - Year: ${sampleSet.year}`);
      console.log(`  - Total cards: ${sampleSet.totalCardsInSet}`);
      console.log(`  - PSA population: ${sampleSet.totalPsaPopulation}`);
    }

    if (cardCount > 0) {
      const sampleCard = await Card.findOne().populate('setId');

      console.log('\nSample card:');
      console.log(`  - Name: ${sampleCard.cardName}`);
      console.log(`  - Pokemon #: ${sampleCard.pokemonNumber}`);
      console.log(`  - Set: ${sampleCard.setId.setName}`);
      console.log(`  - PSA Total: ${sampleCard.psaTotalGradedForCard}`);
    }

    if (productCount > 0) {
      const sampleProduct = await CardMarketReferenceProduct.findOne();

      console.log('\nSample product:');
      console.log(`  - Name: ${sampleProduct.name}`);
      console.log(`  - Set: ${sampleProduct.setName}`);
      console.log(`  - Category: ${sampleProduct.category}`);
      console.log(`  - Price: ${sampleProduct.price}`);
      console.log(`  - Available: ${sampleProduct.available}`);
    }

    console.log('\n✅ Data import test completed successfully!');
  } catch (error) {
    console.error('❌ Data import test failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    if (mongoServer) {
      await mongoServer.stop();
    }
    process.exit(0);
  }
}

// Run the test
testDataImport();
