#!/usr/bin/env node

// Script to clean up personal collection by removing reference data that was incorrectly imported

const mongoose = require('mongoose');

require('dotenv').config();

// Import models
const SealedProduct = require('./models/SealedProduct');
const PsaGradedCard = require('./models/PsaGradedCard');
const RawCard = require('./models/RawCard');

async function connectToDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_collection');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

async function cleanupSealedProducts() {
  console.log('\n🔍 Analyzing Sealed Products...');

  const totalCount = await SealedProduct.countDocuments({});

  console.log(`Total sealed products: ${totalCount}`);

  // Find items that are likely personal collection items (have price history or different prices)
  const personalItems = await SealedProduct.find({
    $or: [{ priceHistory: { $exists: true, $ne: [] } }, { $expr: { $ne: ['$myPrice', '$cardMarketPrice'] } }],
  });

  console.log(`Personal collection items found: ${personalItems.length}`);

  if (personalItems.length > 0) {
    console.log('\n📋 Personal collection items:');
    personalItems.forEach((item, index) => {
      console.log(
        `${index + 1}. ${item.name} - Set: ${item.setName} - My Price: ${item.myPrice} - CM Price: ${item.cardMarketPrice}`,
      );
    });
  }

  // Find items that are likely reference data (no price history and same prices)
  const referenceItems = await SealedProduct.find({
    $and: [{ priceHistory: { $size: 0 } }, { $expr: { $eq: ['$myPrice', '$cardMarketPrice'] } }],
  });

  console.log(`Reference data items found: ${referenceItems.length}`);

  if (referenceItems.length > 0) {
    console.log('\n⚠️  WARNING: About to delete reference data items from personal collection');
    console.log(
      'This will remove items that appear to be reference data incorrectly imported into personal collection.',
    );

    // Delete reference data items
    const deleteResult = await SealedProduct.deleteMany({
      $and: [{ priceHistory: { $size: 0 } }, { $expr: { $eq: ['$myPrice', '$cardMarketPrice'] } }],
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} reference data items from SealedProduct collection`);
  }

  const finalCount = await SealedProduct.countDocuments({});

  console.log(`Final sealed products count: ${finalCount}`);
}

async function cleanupPsaGradedCards() {
  console.log('\n🔍 Analyzing PSA Graded Cards...');

  const totalCount = await PsaGradedCard.countDocuments({});

  console.log(`Total PSA graded cards: ${totalCount}`);

  // Find items that are likely personal collection items
  const personalItems = await PsaGradedCard.find({
    $or: [{ priceHistory: { $exists: true, $ne: [] } }, { myPrice: { $exists: true } }],
  });

  console.log(`Personal collection items found: ${personalItems.length}`);

  if (personalItems.length > 0) {
    console.log('\n📋 Personal PSA graded cards:');
    personalItems.forEach((item, index) => {
      console.log(
        `${index + 1}. ${item.cardId?.cardName || 'Unknown'} - Grade: ${item.grade} - My Price: ${item.myPrice}`,
      );
    });
  }

  // Check if there are items without myPrice (likely reference data)
  const referenceItems = await PsaGradedCard.find({
    $and: [{ priceHistory: { $size: 0 } }, { myPrice: { $exists: false } }],
  });

  console.log(`Potential reference data items: ${referenceItems.length}`);

  if (referenceItems.length > 0) {
    const deleteResult = await PsaGradedCard.deleteMany({
      $and: [{ priceHistory: { $size: 0 } }, { myPrice: { $exists: false } }],
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} reference data items from PsaGradedCard collection`);
  }

  const finalCount = await PsaGradedCard.countDocuments({});

  console.log(`Final PSA graded cards count: ${finalCount}`);
}

async function cleanupRawCards() {
  console.log('\n🔍 Analyzing Raw Cards...');

  const totalCount = await RawCard.countDocuments({});

  console.log(`Total raw cards: ${totalCount}`);

  // Find items that are likely personal collection items
  const personalItems = await RawCard.find({
    $or: [{ priceHistory: { $exists: true, $ne: [] } }, { myPrice: { $exists: true } }],
  });

  console.log(`Personal collection items found: ${personalItems.length}`);

  if (personalItems.length > 0) {
    console.log('\n📋 Personal raw cards:');
    personalItems.forEach((item, index) => {
      console.log(
        `${index + 1}. ${item.cardId?.cardName || 'Unknown'} - Condition: ${item.condition} - My Price: ${item.myPrice}`,
      );
    });
  }

  // Check if there are items without myPrice (likely reference data)
  const referenceItems = await RawCard.find({
    $and: [{ priceHistory: { $size: 0 } }, { myPrice: { $exists: false } }],
  });

  console.log(`Potential reference data items: ${referenceItems.length}`);

  if (referenceItems.length > 0) {
    const deleteResult = await RawCard.deleteMany({
      $and: [{ priceHistory: { $size: 0 } }, { myPrice: { $exists: false } }],
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} reference data items from RawCard collection`);
  }

  const finalCount = await RawCard.countDocuments({});

  console.log(`Final raw cards count: ${finalCount}`);
}

async function main() {
  console.log('🧹 Starting Personal Collection Cleanup');
  console.log('======================================');

  await connectToDatabase();

  try {
    await cleanupSealedProducts();
    await cleanupPsaGradedCards();
    await cleanupRawCards();

    console.log('\n✅ Personal collection cleanup completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- Removed reference data that was incorrectly imported into personal collection');
    console.log('- Kept only items with price history or personal pricing');
    console.log('- Personal collection now contains only user-added items');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the cleanup if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
