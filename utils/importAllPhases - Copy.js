const mongoose = require('mongoose');
const { importAllData } = require('./utils/importers');

require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('Connected to MongoDB');

  // Phase 0: Clear existing data
  console.log('Phase 0: Clearing existing data...');
  const setsResult = await mongoose.connection.db.collection('sets').deleteMany({});

  console.log(`  Deleted ${setsResult.deletedCount} sets`);

  const cardsResult = await mongoose.connection.db.collection('cards').deleteMany({});

  console.log(`  Deleted ${cardsResult.deletedCount} cards`);

  const cardMarketResult = await mongoose.connection.db.collection('cardmarketreferenceproducts').deleteMany({});

  console.log(`  Deleted ${cardMarketResult.deletedCount} card market products`);

  const sealedProductsResult = await mongoose.connection.db.collection('sealedproducts').deleteMany({});

  console.log(`  Deleted ${sealedProductsResult.deletedCount} sealed products`);

  // Wait a moment for database operations to complete
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Verify database is actually cleared
  const remainingSets = await mongoose.connection.db.collection('sets').countDocuments({});
  const remainingCards = await mongoose.connection.db.collection('cards').countDocuments({});

  console.log(`  Verification: ${remainingSets} sets, ${remainingCards} cards remaining`);

  console.log('Phase 0 completed: Database cleared');

  const result = await importAllData();

  console.log('Import completed:', result);

  // Additional debugging: Check specific sets after import
  console.log('\n=== POST-IMPORT DEBUGGING ===');
  const Set = require('./models/Set');
  const Card = require('./models/Card');

  // Check Pokemon Play Prize Pack specifically
  const prizePackSet = await Set.findOne({ setName: 'Pokemon Play! Pokemon Prize Pack' });

  if (prizePackSet) {
    const cardCount = await Card.countDocuments({ setId: prizePackSet._id });

    console.log('Pokemon Play Prize Pack DEBUG:');
    console.log(`  Database totalCardsInSet: ${prizePackSet.totalCardsInSet}`);
    console.log(`  Actual cards in database: ${cardCount}`);
    console.log(`  Set ID: ${prizePackSet._id}`);
  }

  // Check Pokemon Fossil specifically
  const fossilSet = await Set.findOne({ setName: 'Pokemon Fossil' });

  if (fossilSet) {
    const cardCount = await Card.countDocuments({ setId: fossilSet._id });

    console.log('Pokemon Fossil DEBUG:');
    console.log(`  Database totalCardsInSet: ${fossilSet.totalCardsInSet}`);
    console.log(`  Actual cards in database: ${cardCount}`);
    console.log(`  Set ID: ${fossilSet._id}`);
  }

  // Check a few random sets
  const randomSets = await Set.find({}).limit(5);

  console.log('\nRandom sets check:');
  for (const set of randomSets) {
    const cardCount = await Card.countDocuments({ setId: set._id });

    console.log(`  ${set.setName}: DB=${set.totalCardsInSet}, Actual=${cardCount}`);
  }

  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
