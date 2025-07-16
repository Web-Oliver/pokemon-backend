const mongoose = require('mongoose');
const Set = require('./models/Set');
const Card = require('./models/Card');

mongoose.connect('mongodb://localhost:27017/pokemon_collection_db').then(async () => {
  console.log('Connected to MongoDB');

  const set = await Set.findOne({ setName: 'Pokemon Play! Pokemon Prize Pack' });

  if (!set) {
    console.log('Set not found');
    process.exit(1);
  }

  console.log('Set found:', set.setName);
  console.log('Current totalCardsInSet:', set.totalCardsInSet);

  const cardCount = await Card.countDocuments({ setId: set._id });

  console.log('Actual card count:', cardCount);

  if (cardCount !== set.totalCardsInSet) {
    await Set.findByIdAndUpdate(set._id, { totalCardsInSet: cardCount });
    console.log('Updated totalCardsInSet to:', cardCount);
  }

  process.exit(0);
}).catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
