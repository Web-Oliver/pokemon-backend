const Set = require('../../models/Set');
const Card = require('../../models/Card');
const CardMarketReferenceProduct = require('../../models/CardMarketReferenceProduct');

const verifyDatabaseCounts = async () => {
  console.log('\n📊 Verifying database contents...');

  const actualSets = await Set.countDocuments();
  const actualCards = await Card.countDocuments();
  const actualCardMarketProducts = await CardMarketReferenceProduct.countDocuments();

  console.log('\n📈 Actual database counts:');
  console.log(`   Sets: ${actualSets}`);
  console.log(`   Cards: ${actualCards}`);
  console.log(`   CardMarket Products: ${actualCardMarketProducts}`);

  return {
    actualSets,
    actualCards,
    actualCardMarketProducts,
  };
};

const compareCountsAndReport = (expected, actual) => {
  console.log('\n🔍 Comparison results:');

  const setsDiff = actual.actualSets - expected.expectedSets;
  const cardsDiff = actual.actualCards - expected.expectedCards;
  const cardMarketDiff = actual.actualCardMarketProducts - expected.expectedCardMarketProducts;

  console.log(
    `   Sets: Expected ${expected.expectedSets}, Got ${actual.actualSets} ` +
      `(${setsDiff >= 0 ? '+' : ''}${setsDiff})`,
  );
  console.log(
    `   Cards: Expected ${expected.expectedCards}, Got ${actual.actualCards} ` +
      `(${cardsDiff >= 0 ? '+' : ''}${cardsDiff})`,
  );
  console.log(
    `   CardMarket Products: Expected ${expected.expectedCardMarketProducts}, ` +
      `Got ${actual.actualCardMarketProducts} (${cardMarketDiff >= 0 ? '+' : ''}${cardMarketDiff})`,
  );

  const allMatching =
    actual.actualSets === expected.expectedSets &&
    actual.actualCards === expected.expectedCards &&
    actual.actualCardMarketProducts === expected.expectedCardMarketProducts;

  if (allMatching) {
    console.log('\n✅ All counts match! Data import verification successful.');
    return true;
  }
  console.log('\n❌ Some counts do not match. Please check the import process.');
  return false;
};

module.exports = {
  verifyDatabaseCounts,
  compareCountsAndReport,
};
