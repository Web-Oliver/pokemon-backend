const { importSetMetadata, importCardData } = require('./psaDataImporter');
const { importCardMarketData } = require('./cardMarketImporter');
const { getAllPsaFiles, getAllPsaMetadataFiles, getAllPsaIndividualFiles, getAllSealedProductFiles } = require('./fileUtils');

const importAllData = async (options = {}) => {
  const {
    includePsa = true,
    includeSealedProducts = true,
    includeCardMarket = true,
    limitPsaFiles = null,
    limitSealedProductFiles = null,
  } = options;

  const totalResults = {
    psaFiles: 0,
    sealedProductFiles: 0,
    setsCreated: 0,
    setsUpdated: 0,
    cardsProcessed: 0,
    sealedProductsProcessed: 0,
    errors: [],
  };

  try {
    // Import PSA data using two-phase approach
    if (includePsa) {
      console.log('Starting PSA data import...');

      // Get metadata files and individual files separately
      let metadataFiles = getAllPsaMetadataFiles();
      let individualFiles = getAllPsaIndividualFiles();

      if (limitPsaFiles) {
        metadataFiles = metadataFiles.slice(0, Math.min(limitPsaFiles, metadataFiles.length));
        const remainingLimit = limitPsaFiles - metadataFiles.length;

        if (remainingLimit > 0) {
          individualFiles = individualFiles.slice(0, remainingLimit);
        } else {
          individualFiles = [];
        }
      }

      const totalPsaFiles = metadataFiles.length + individualFiles.length;

      console.log(`Found ${totalPsaFiles} PSA files to import (${metadataFiles.length} metadata + ${individualFiles.length} individual)`);
      totalResults.psaFiles = totalPsaFiles;

      // Phase 1: Import set metadata from *_all_sets.json files
      console.log('Phase 1: Importing set metadata from summary files...');
      console.log(`Found ${metadataFiles.length} metadata files`);

      const metadataPromises = metadataFiles.map(async (filePath) => {
        const result = await importSetMetadata(filePath);

        if (result.success) {
          return {
            success: true,
            setsProcessed: result.setsProcessed,
          };
        }

        return {
          success: false,
          error: `Set Metadata Import Error - ${filePath}: ${result.error}`,
        };
      });

      const metadataResults = await Promise.all(metadataPromises);

      metadataResults.forEach((result) => {
        if (result.success) {
          totalResults.setsCreated += result.setsProcessed;
        } else {
          totalResults.errors.push(result.error);
        }
      });

      console.log(`Phase 1 completed: ${totalResults.setsCreated} sets created`);

      // Phase 2: Import card data from individual set files
      console.log('Phase 2: Importing card data from individual set files...');
      console.log(`Found ${individualFiles.length} individual set files`);

      const cardDataPromises = individualFiles.map(async (filePath) => {
        const result = await importCardData(filePath);

        if (result.success) {
          return {
            success: true,
            setsUpdated: result.setsUpdated || 0,
            cardsProcessed: result.cardsProcessed || 0,
          };
        }

        return {
          success: false,
          error: `Card Data Import Error - ${filePath}: ${result.error}`,
        };
      });

      const cardDataResults = await Promise.all(cardDataPromises);

      cardDataResults.forEach((result) => {
        if (result.success) {
          totalResults.setsUpdated += result.setsUpdated;
          totalResults.cardsProcessed += result.cardsProcessed;
        } else {
          totalResults.errors.push(result.error);
        }
      });

      console.log(`Phase 2 completed: ${totalResults.setsUpdated} sets updated, ${totalResults.cardsProcessed} cards processed`);
    }

    // Import Sealed Product data as CardMarket reference products
    if (includeSealedProducts || includeCardMarket) {
      console.log('Starting Sealed Product data import...');
      let sealedProductFiles = getAllSealedProductFiles();

      if (limitSealedProductFiles) {
        sealedProductFiles = sealedProductFiles.slice(0, limitSealedProductFiles);
      }

      console.log(`Found ${sealedProductFiles.length} Sealed Product files to import`);
      totalResults.sealedProductFiles = sealedProductFiles.length;

      const sealedProductPromises = sealedProductFiles.map(async (filePath) => {
        // Import as CardMarket reference products (for autocomplete)
        const cardMarketResult = await importCardMarketData(filePath);

        if (cardMarketResult.success) {
          return {
            success: true,
            productsProcessed: cardMarketResult.productsProcessed,
          };
        }

        return {
          success: false,
          error: `CardMarket Reference Import Error - ${filePath}: ${cardMarketResult.error}`,
        };
      });

      const sealedProductResults = await Promise.all(sealedProductPromises);

      sealedProductResults.forEach((result) => {
        if (result.success) {
          totalResults.sealedProductsProcessed += result.productsProcessed;
        } else {
          totalResults.errors.push(result.error);
        }
      });
    }

    // Phase 3: Update totalCardsInSet for all sets based on actual card count
    console.log('Phase 3: Updating totalCardsInSet for all sets...');
    const Set = require('../../models/Set');
    const Card = require('../../models/Card');

    const allSets = await Set.find({});
    let setsUpdatedCount = 0;

    console.log(`Found ${allSets.length} sets to check`);

    for (const set of allSets) {
      const cardCount = await Card.countDocuments({ setId: set._id });

      console.log(`DEBUG: Set "${set.setName}" (ID: ${set._id})`);
      console.log(`  Current totalCardsInSet: ${set.totalCardsInSet}`);
      console.log(`  Actual card count: ${cardCount}`);
      console.log(`  Cards match: ${cardCount === set.totalCardsInSet}`);

      if (cardCount !== set.totalCardsInSet) {
        console.log(`  UPDATING: ${set.totalCardsInSet} -> ${cardCount}`);
        const updateResult = await Set.findByIdAndUpdate(set._id, { totalCardsInSet: cardCount }, { new: true });

        console.log(`  Update result: ${updateResult.totalCardsInSet}`);
        setsUpdatedCount++;
      } else {
        console.log('  SKIPPING: No update needed');
      }
      console.log('');
    }

    console.log(`Phase 3 completed: ${setsUpdatedCount} sets updated with correct card counts`);

    // Phase 3.5: Multiple verification passes to ensure all cards are properly assigned
    console.log('\nPhase 3.5: Running multiple verification passes...');

    for (let pass = 1; pass <= 3; pass++) {
      console.log(`\n--- Verification Pass ${pass}/3 ---`);

      // Re-check all sets and cards
      const allSetsRecheck = await Set.find({});
      let issuesFound = 0;

      for (const set of allSetsRecheck) {
        const cardCount = await Card.countDocuments({ setId: set._id });

        if (cardCount !== set.totalCardsInSet) {
          console.log(`Pass ${pass} - Fixing: ${set.setName} (${set.totalCardsInSet} -> ${cardCount})`);
          await Set.findByIdAndUpdate(set._id, { totalCardsInSet: cardCount });
          issuesFound++;
        }
      }

      // Check for orphaned cards
      const allCards = await Card.find({});
      const validSetIds = new Set();

      allSetsRecheck.forEach((setDoc) => validSetIds.add(setDoc._id.toString()));

      let orphanedCount = 0;

      for (const card of allCards) {
        if (!validSetIds.has(card.setId.toString())) {
          orphanedCount++;
        }
      }

      console.log(`Pass ${pass} - Sets corrected: ${issuesFound}, Orphaned cards: ${orphanedCount}`);

      // If no issues found, break early
      if (issuesFound === 0 && orphanedCount === 0) {
        console.log(`Pass ${pass} - All checks passed! Data integrity verified.`);
        break;
      }
    }

    console.log('Phase 3.5 completed: Multiple verification passes finished');

    console.log('\nAll data import completed');
    console.log('Summary:');
    console.log(`  PSA Files Processed: ${totalResults.psaFiles}`);
    console.log(`  Sets Created: ${totalResults.setsCreated}`);
    console.log(`  Sets Updated: ${totalResults.setsUpdated}`);
    console.log(`  Cards Processed: ${totalResults.cardsProcessed}`);
    console.log(`  Sealed Products Processed: ${totalResults.sealedProductsProcessed}`);
    console.log(`  Errors: ${totalResults.errors.length}`);
    return totalResults;
  } catch (error) {
    console.error('Error during data import:', error.message);
    totalResults.errors.push(`General Error: ${error.message}`);
    return totalResults;
  }
};

module.exports = {
  importAllData,
};
