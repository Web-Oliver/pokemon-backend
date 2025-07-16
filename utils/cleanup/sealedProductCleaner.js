const SealedProduct = require('../../models/SealedProduct');

const analyzeSealedProducts = async () => {
  console.log('\n🔍 Analyzing Sealed Products...');

  const totalCount = await SealedProduct.countDocuments({});

  console.log(`Total sealed products: ${totalCount}`);

  const personalItems = await SealedProduct.find({
    $or: [
      { priceHistory: { $exists: true, $ne: [] } },
      { $expr: { $ne: ['$myPrice', '$cardMarketPrice'] } },
    ],
  });

  console.log(`Personal collection items found: ${personalItems.length}`);

  if (personalItems.length > 0) {
    console.log('\n📋 Personal collection items:');
    personalItems.forEach((item, index) => {
      console.log(
        `${index + 1}. ${item.name} - Set: ${item.setName} - `
        + `My Price: ${item.myPrice} - CM Price: ${item.cardMarketPrice}`,
      );
    });
  }

  const referenceItems = await SealedProduct.find({
    $and: [
      { $or: [{ priceHistory: { $exists: false } }, { priceHistory: [] }] },
      { $expr: { $eq: ['$myPrice', '$cardMarketPrice'] } },
    ],
  });

  console.log(`Reference data items found: ${referenceItems.length}`);

  return { personalItems, referenceItems, totalCount };
};

const cleanupSealedProductReferences = async (confirmDelete = false) => {
  const { personalItems, referenceItems, totalCount } = await analyzeSealedProducts();

  if (referenceItems.length === 0) {
    console.log('✅ No reference data items to clean up in Sealed Products.');
    return { deleted: 0, kept: personalItems.length };
  }

  if (confirmDelete) {
    console.log(`\n🗑️ Deleting ${referenceItems.length} reference data items...`);
    const deleteResult = await SealedProduct.deleteMany({
      _id: { $in: referenceItems.map((item) => item._id) },
    });

    console.log(`✅ Deleted ${deleteResult.deletedCount} reference data items from Sealed Products`);
    console.log(`✅ Kept ${personalItems.length} personal collection items`);

    return { deleted: deleteResult.deletedCount, kept: personalItems.length };
  }
  console.log(`\n⚠️ Would delete ${referenceItems.length} reference data items (use --confirm to actually delete)`);
  return { deleted: 0, kept: personalItems.length };
};

module.exports = {
  analyzeSealedProducts,
  cleanupSealedProductReferences,
};
