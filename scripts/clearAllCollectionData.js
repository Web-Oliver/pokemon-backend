/**
 * Clear All Collection Data Script
 * This script will remove all collection data from the database
 */

const mongoose = require('mongoose');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const SealedProduct = require('../models/SealedProduct');
require('dotenv').config();

const clearAllCollectionData = async () => {
  try {
    console.log('🔥 Starting complete collection cleanup...');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_collection';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Count existing items
    const [psaCount, rawCount, sealedCount] = await Promise.all([
      PsaGradedCard.countDocuments(),
      RawCard.countDocuments(),
      SealedProduct.countDocuments(),
    ]);

    console.log(`📊 Found ${psaCount} PSA graded cards`);
    console.log(`📊 Found ${rawCount} raw cards`);
    console.log(`📊 Found ${sealedCount} sealed products`);

    const totalCount = psaCount + rawCount + sealedCount;

    if (totalCount === 0) {
      console.log('✨ No collection data to clear');
      return;
    }

    // Delete all collection data
    const [psaResult, rawResult, sealedResult] = await Promise.all([
      PsaGradedCard.deleteMany({}),
      RawCard.deleteMany({}),
      SealedProduct.deleteMany({}),
    ]);

    console.log(`🗑️  Deleted ${psaResult.deletedCount} PSA graded cards`);
    console.log(`🗑️  Deleted ${rawResult.deletedCount} raw cards`);
    console.log(`🗑️  Deleted ${sealedResult.deletedCount} sealed products`);

    // Verify deletion
    const [finalPsaCount, finalRawCount, finalSealedCount] = await Promise.all([
      PsaGradedCard.countDocuments(),
      RawCard.countDocuments(),
      SealedProduct.countDocuments(),
    ]);

    console.log(`📊 Remaining PSA graded cards: ${finalPsaCount}`);
    console.log(`📊 Remaining raw cards: ${finalRawCount}`);
    console.log(`📊 Remaining sealed products: ${finalSealedCount}`);

    const finalTotal = finalPsaCount + finalRawCount + finalSealedCount;

    if (finalTotal === 0) {
      console.log('✅ All collection data has been successfully cleared!');
    } else {
      console.log('⚠️  Some collection data may still remain');
    }
  } catch (error) {
    console.error('❌ Error clearing collection data:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
clearAllCollectionData();
