const generateVerificationReport = (expectedCounts, actualCounts, importResults) => {
  console.log('='.repeat(80));
  console.log('VERIFICATION REPORT');
  console.log('='.repeat(80));

  let overallStatus = 'PASS';

  // Set verification
  console.log('SET COLLECTION:');
  console.log(`  Expected Count from JSON: ${expectedCounts.expectedSets}`);
  console.log(`  Actual Count in Database: ${actualCounts.actualSets}`);
  if (expectedCounts.expectedSets === actualCounts.actualSets) {
    console.log('  Verification Status: PASS');
  } else {
    console.log(
      '  Verification Status: FAIL (Discrepancy: '
      + `${Math.abs(expectedCounts.expectedSets - actualCounts.actualSets)})`,
    );
    overallStatus = 'FAIL';
  }
  console.log('');

  // Card verification
  console.log('CARD COLLECTION:');
  console.log(`  Expected Count from JSON: ${expectedCounts.expectedCards}`);
  console.log(`  Actual Count in Database: ${actualCounts.actualCards}`);
  if (expectedCounts.expectedCards === actualCounts.actualCards) {
    console.log('  Verification Status: PASS');
  } else {
    console.log(
      '  Verification Status: FAIL (Discrepancy: '
      + `${Math.abs(expectedCounts.expectedCards - actualCounts.actualCards)})`,
    );
    overallStatus = 'FAIL';
  }
  console.log('');

  // CardMarket Reference Product verification
  console.log('CARDMARKET REFERENCE PRODUCT COLLECTION:');
  console.log(`  Expected Count from JSON: ${expectedCounts.expectedCardMarketProducts}`);
  console.log(`  Actual Count in Database: ${actualCounts.actualCardMarketProducts}`);
  if (expectedCounts.expectedCardMarketProducts === actualCounts.actualCardMarketProducts) {
    console.log('  Verification Status: PASS');
  } else {
    console.log(
      '  Verification Status: FAIL (Discrepancy: '
      + `${Math.abs(expectedCounts.expectedCardMarketProducts - actualCounts.actualCardMarketProducts)})`,
    );
    overallStatus = 'FAIL';
  }
  console.log('');

  // Overall status
  console.log('='.repeat(80));
  console.log(`OVERALL VERIFICATION STATUS: ${overallStatus}`);
  console.log('='.repeat(80));

  // Display any import errors
  if (importResults.errors && importResults.errors.length > 0) {
    console.log('\nIMPORT ERRORS ENCOUNTERED:');
    importResults.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  }

  // Summary statistics
  console.log('\nIMPORT SUMMARY:');
  console.log(`  PSA Files Processed: ${importResults.psaFiles || 0}`);
  console.log(`  CardMarket Files Processed: ${importResults.cardMarketFiles || 0}`);
  console.log(`  Sets Imported: ${importResults.setsProcessed || 0}`);
  console.log(`  Cards Imported: ${importResults.cardsProcessed || 0}`);
  console.log(`  Products Imported: ${importResults.productsProcessed || 0}`);
  console.log(`  Total Errors: ${(importResults.errors || []).length}`);

  return overallStatus === 'PASS';
};

const displayProcessedFiles = (processedFiles) => {
  console.log('Processed JSON files:');
  processedFiles.forEach((file) => {
    console.log(`  - ${file}`);
  });
  console.log('');
};

module.exports = {
  generateVerificationReport,
  displayProcessedFiles,
};
