const Set = require('../../models/Set');
const Card = require('../../models/Card');

const validateDataIntegrity = async () => {
  console.log('\n🔎 Performing data integrity checks...');

  const checks = [];

  try {
    const duplicateCardNames = await Card.aggregate([
      {
        $group: {
          _id: { setId: '$setId', cardName: '$cardName' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $limit: 5 },
    ]);

    if (duplicateCardNames.length > 0) {
      console.log(`   ⚠️  Found ${duplicateCardNames.length} duplicate card names in same sets`);
      checks.push({ type: 'warning', message: `${duplicateCardNames.length} duplicate card names found` });
    } else {
      console.log('   ✅ No duplicate card names in same sets');
    }

    const cardsWithoutSets = await Card.countDocuments({ setId: { $exists: false } });

    if (cardsWithoutSets > 0) {
      console.log(`   ❌ Found ${cardsWithoutSets} cards without associated sets`);
      checks.push({ type: 'error', message: `${cardsWithoutSets} cards without sets` });
    } else {
      console.log('   ✅ All cards have associated sets');
    }

    const cardsWithInvalidSets = await Card.aggregate([
      {
        $lookup: {
          from: 'sets',
          localField: 'setId',
          foreignField: '_id',
          as: 'set',
        },
      },
      { $match: { set: { $size: 0 } } },
      { $count: 'invalidCards' },
    ]);

    const invalidSetCount = cardsWithInvalidSets[0]?.invalidCards || 0;

    if (invalidSetCount > 0) {
      console.log(`   ❌ Found ${invalidSetCount} cards referencing non-existent sets`);
      checks.push({ type: 'error', message: `${invalidSetCount} cards with invalid set references` });
    } else {
      console.log('   ✅ All card set references are valid');
    }

    const setsWithoutCards = await Set.aggregate([
      {
        $lookup: {
          from: 'cards',
          localField: '_id',
          foreignField: 'setId',
          as: 'cards',
        },
      },
      { $match: { cards: { $size: 0 } } },
      { $count: 'emptySets' },
    ]);

    const emptySetCount = setsWithoutCards[0]?.emptySets || 0;

    if (emptySetCount > 0) {
      console.log(`   ⚠️  Found ${emptySetCount} sets without any cards`);
      checks.push({ type: 'warning', message: `${emptySetCount} empty sets found` });
    } else {
      console.log('   ✅ All sets have cards');
    }
  } catch (error) {
    console.error('   ❌ Error during data integrity checks:', error);
    checks.push({ type: 'error', message: `Integrity check failed: ${error.message}` });
  }

  const hasErrors = checks.some((check) => check.type === 'error');
  const hasWarnings = checks.some((check) => check.type === 'warning');

  if (!hasErrors && !hasWarnings) {
    console.log('\n✅ All data integrity checks passed!');
  } else if (hasErrors) {
    console.log('\n❌ Data integrity issues found. Please review the errors above.');
  } else {
    console.log('\n⚠️  Data integrity warnings found. Review recommended.');
  }

  return {
    checks,
    hasErrors,
    hasWarnings,
  };
};

module.exports = {
  validateDataIntegrity,
};
