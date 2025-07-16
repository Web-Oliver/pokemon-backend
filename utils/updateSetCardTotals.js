const mongoose = require('mongoose');
const Set = require('./models/Set');
const Card = require('./models/Card');

require('dotenv').config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    // Phase 3: Update totalCardsInSet for all sets based on actual card count
    console.log('Updating totalCardsInSet for all sets...');

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

    console.log(`Completed: ${setsUpdatedCount} sets updated with correct card counts`);

    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
