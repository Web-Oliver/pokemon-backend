const mongoose = require('mongoose');
const Set = require('./models/Set');
const Card = require('./models/Card');

mongoose.connect('mongodb://localhost:27017/pokemon_collection_db').then(async () => {
  console.log('Connected to MongoDB');

  // Phase 3: Update totalCardsInSet for all sets based on actual card count
  console.log('Phase 3: Updating totalCardsInSet for all sets...');

  const allSets = await Set.find({});
  let setsUpdatedCount = 0;

  for (const set of allSets) {
    const cardCount = await Card.countDocuments({ setId: set._id });

    if (cardCount !== set.totalCardsInSet) {
      await Set.findByIdAndUpdate(set._id, { totalCardsInSet: cardCount });
      console.log(`Updated ${set.setName}: ${set.totalCardsInSet} -> ${cardCount} cards`);
      setsUpdatedCount++;
    }
  }

  console.log(`Phase 3 completed: ${setsUpdatedCount} sets updated with correct card counts`);

  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
