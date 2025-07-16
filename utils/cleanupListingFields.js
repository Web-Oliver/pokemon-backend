const mongoose = require('mongoose');

require('dotenv').config();

// Import models
const PsaGradedCard = require('./models/PsaGradedCard');
const RawCard = require('./models/RawCard');
const SealedProduct = require('./models/SealedProduct');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-collection';

async function cleanupListingFields() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');

    // Clean PSA Graded Cards
    console.log('\n--- Cleaning PSA Graded Cards ---');
    const psaResult = await PsaGradedCard.updateMany(
      {},
      {
        $unset: {
          'saleDetails.source': '',
          facebookListing: '',
          dbaListing: '',
          // Add any other Facebook/DBA listing fields that might exist
        },
      },
    );

    console.log(`PSA Graded Cards updated: ${psaResult.modifiedCount} documents`);

    // Clean Raw Cards
    console.log('\n--- Cleaning Raw Cards ---');
    const rawResult = await RawCard.updateMany(
      {},
      {
        $unset: {
          'saleDetails.source': '',
          facebookListing: '',
          dbaListing: '',
          // Add any other Facebook/DBA listing fields that might exist
        },
      },
    );

    console.log(`Raw Cards updated: ${rawResult.modifiedCount} documents`);

    // Clean Sealed Products
    console.log('\n--- Cleaning Sealed Products ---');
    const sealedResult = await SealedProduct.updateMany(
      {},
      {
        $unset: {
          'saleDetails.source': '',
          facebookListing: '',
          dbaListing: '',
          // Add any other Facebook/DBA listing fields that might exist
        },
      },
    );

    console.log(`Sealed Products updated: ${sealedResult.modifiedCount} documents`);

    // Summary
    const totalCleaned = psaResult.modifiedCount + rawResult.modifiedCount + sealedResult.modifiedCount;

    console.log('\n✅ Cleanup completed successfully!');
    console.log(`Total documents cleaned: ${totalCleaned}`);
    console.log('- PSA Graded Cards:', psaResult.modifiedCount);
    console.log('- Raw Cards:', rawResult.modifiedCount);
    console.log('- Sealed Products:', sealedResult.modifiedCount);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the cleanup
cleanupListingFields();
