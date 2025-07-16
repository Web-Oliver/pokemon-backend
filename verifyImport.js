const mongoose = require('mongoose');

async function verifyImport() {
  try {
    // Connect to local MongoDB (not the in-memory one)
    await mongoose.connect('mongodb://localhost:27017/pokemon_collection');
    console.log('Connected to MongoDB');

    // Get all collection names
    const collections = await mongoose.connection.db.listCollections().toArray();

    console.log('Available collections:', collections.map((c) => c.name));

    // Count documents in each collection
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();

      console.log(`${collection.name}: ${count} documents`);
    }

    await mongoose.disconnect();
    console.log('Verification complete');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verifyImport();
