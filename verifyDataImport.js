const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('./config/db');
const { importAllData } = require('./utils/dataImporter');
const { calculateExpectedCounts } = require('./utils/dataVerification/countCalculator');
const { verifyDatabaseCounts } = require('./utils/dataVerification/dbVerifier');
const { generateVerificationReport, displayProcessedFiles } = require('./utils/dataVerification/verificationReporter');


// Main verification function
const verifyDataImport = async () => {
  console.log('='.repeat(80));
  console.log('DATABASE VERIFICATION STARTING');
  console.log('='.repeat(80));

  try {
    // Connect to database
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Database connection established.\n');

    // Trigger data import
    console.log('Triggering data import process...');
    const importResults = await importAllData();

    console.log('Data import process completed.\n');

    // Calculate expected counts from JSON files
    console.log('Calculating expected counts from JSON files...');
    const expectedCounts = calculateExpectedCounts();

    displayProcessedFiles(expectedCounts.processedFiles);

    // Get actual counts from database
    console.log('Querying database for actual counts...');
    const actualCounts = await verifyDatabaseCounts();

    // Generate verification report
    const success = generateVerificationReport(expectedCounts, actualCounts, importResults);

    return success;
  } catch (error) {
    console.error('VERIFICATION FAILED WITH ERROR:', error.message);
    console.log('='.repeat(80));
    console.log('OVERALL VERIFICATION STATUS: FAIL');
    console.log('='.repeat(80));
    return false;
  } finally {
    // Gracefully disconnect from database
    try {
      await mongoose.disconnect();
      console.log('\nDatabase connection closed.');
    } catch (error) {
      console.error('Error closing database connection:', error.message);
    }
  }
};

// Run verification if this script is executed directly
if (require.main === module) {
  verifyDataImport()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { verifyDataImport, calculateExpectedCounts };
