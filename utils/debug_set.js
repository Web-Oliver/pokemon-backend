const mongoose = require('mongoose');
const Set = require('./models/Set');
const Card = require('./models/Card');

mongoose
  .connect('mongodb://localhost:27017/pokemon_collection_db')
  .then(async () => {
    console.log('Connected to MongoDB');

    const set = await Set.findOne({
      setName: 'Pokemon Play! Pokemon Prize Pack',
    });

    console.log('Set from DB:', {
      _id: set._id,
      setName: set.setName,
      totalCardsInSet: set.totalCardsInSet,
      totalPsaPopulation: set.totalPsaPopulation,
    });

    const cardCount = await Card.countDocuments({ setId: set._id });

    console.log('Actual card count in DB:', cardCount);

    console.log('Do they match?', cardCount === set.totalCardsInSet);

    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
