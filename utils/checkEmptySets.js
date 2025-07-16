const mongoose = require('mongoose');

require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Set = require('./models/Set');
  const Card = require('./models/Card');

  console.log('=== CHECKING SETS WITH 0 CARDS ===');

  // Find sets with totalCardsInSet = 0
  const emptySets = await Set.find({ totalCardsInSet: 0 });

  console.log('Sets with 0 cards:', emptySets.length);

  if (emptySets.length > 0) {
    console.log('\nSets with 0 cards:');
    for (const set of emptySets) {
      const actualCards = await Card.countDocuments({ setId: set._id });

      console.log(`- Set: ${set.setName} | Year: ${set.year} | Actual cards: ${actualCards}`);
    }
  }

  // Also check if there are any sets where database count does not match actual count
  const allSets = await Set.find({});
  let mismatchCount = 0;
  const mismatches = [];

  console.log('\n=== CHECKING FOR CARD COUNT MISMATCHES ===');

  for (const set of allSets) {
    const actualCards = await Card.countDocuments({ setId: set._id });

    if (actualCards !== set.totalCardsInSet) {
      const mismatch = {
        setName: set.setName,
        year: set.year,
        dbCount: set.totalCardsInSet,
        actualCount: actualCards,
      };

      mismatches.push(mismatch);
      console.log(`MISMATCH - Set: ${set.setName} | DB Count: ${set.totalCardsInSet} | Actual: ${actualCards}`);
      mismatchCount++;
    }
  }

  console.log(`\nTotal sets with card count mismatches: ${mismatchCount}`);
  console.log(`Total sets checked: ${allSets.length}`);

  // Show summary of empty sets
  if (emptySets.length > 0) {
    console.log('\n=== SUMMARY OF EMPTY SETS ===');
    emptySets.forEach((set) => {
      console.log(`${set.setName} (${set.year}) - URL: ${set.setUrl}`);
    });
  }

  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
