const mongoose = require('mongoose');
const { importAllData } = require('./utils/dataImporter');

const populateLocalDatabase = async () => {
  console.log('='.repeat(80));
  console.log('POPULATING LOCAL MONGODB WITH DATA');
  console.log('='.repeat(80));

  try {
    // Connect to local MongoDB
    console.log('Connecting to local MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/pokemon_collection');
    console.log('Connected to local MongoDB');

    // Import all data
    console.log('\nStarting data import...');
    const importResults = await importAllData();

    console.log(`\n${'='.repeat(80)}`);
    console.log('IMPORT COMPLETED');
    console.log('='.repeat(80));

    console.log('Summary:');
    console.log(`- PSA Files Processed: ${importResults.psaFiles || 0}`);
    console.log(`- Sealed Product Files Processed: ${importResults.sealedProductFiles || 0}`);
    console.log(`- Sets Imported: ${importResults.setsProcessed || 0}`);
    console.log(`- Cards Imported: ${importResults.cardsProcessed || 0}`);
    console.log(`- Sealed Products Imported: ${importResults.sealedProductsProcessed || 0}`);
    console.log(`- Total Errors: ${(importResults.errors || []).length}`);

    if (importResults.errors && importResults.errors.length > 0) {
      console.log('\nErrors encountered:');
      importResults.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('LOCAL DATABASE IS NOW POPULATED');
    console.log('MongoDB URI: mongodb://localhost:27017/pokemon_collection');
    console.log('='.repeat(80));

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error populating database:', error);
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

// Run if this script is executed directly
if (require.main === module) {
  populateLocalDatabase();
}

module.exports = { populateLocalDatabase };
