const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { importAllDataOptimized } = require('./utils/importers/optimizedImportCoordinator');

require('dotenv').config();

// --- START Custom Logging Setup ---
const logEntries = [];
const LOG_FILE_NAME = 'IMPORTALLPHASES.json';

/**
 * Custom logging function that also captures logs for JSON output.
 * @param {string} type - Log type (e.g., 'INFO', 'WARN', 'ERROR', 'DEBUG').
 * @param {string} message - The main log message.
 * @param {object} [details={}] - Optional object with additional details for the log entry.
 */
function logAndCapture(type, message, details = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: type.toUpperCase(),
    message,
    details,
  };

  logEntries.push(logEntry);

  // Also output to console for real-time feedback
  switch (type.toLowerCase()) {
    case 'error':
      console.error(`[${logEntry.type}] ${logEntry.message}`, Object.keys(details).length > 0 ? details : '');
      break;
    case 'warn':
      console.warn(`[${logEntry.type}] ${logEntry.message}`, Object.keys(details).length > 0 ? details : '');
      break;
    case 'debug':
      console.debug(`[${logEntry.type}] ${logEntry.message}`, Object.keys(details).length > 0 ? details : '');
      break;
    default:
      console.log(`[${logEntry.type}] ${logEntry.message}`, Object.keys(details).length > 0 ? details : '');
      break;
  }
}

function writeLogFile() {
  const logFilePath = path.join(__dirname, LOG_FILE_NAME);

  fs.writeFileSync(logFilePath, JSON.stringify(logEntries, null, 2), 'utf8');
  console.log(`\nImport log written to ${logFilePath}`);
}
// --- END Custom Logging Setup ---

mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    logAndCapture('INFO', 'Connected to MongoDB');

    // Phase 0: Clear existing data
    logAndCapture('INFO', 'Phase 0: Clearing existing data...');
    const setsResult = await mongoose.connection.db.collection('sets').deleteMany({});

    logAndCapture('INFO', `Deleted ${setsResult.deletedCount} sets`, {
      deletedCount: setsResult.deletedCount,
      collection: 'sets',
    });

    const cardsResult = await mongoose.connection.db.collection('cards').deleteMany({});

    logAndCapture('INFO', `Deleted ${cardsResult.deletedCount} cards`, {
      deletedCount: cardsResult.deletedCount,
      collection: 'cards',
    });

    const cardMarketResult = await mongoose.connection.db.collection('cardmarketreferenceproducts').deleteMany({});

    logAndCapture('INFO', `Deleted ${cardMarketResult.deletedCount} card market products`, {
      deletedCount: cardMarketResult.deletedCount,
      collection: 'cardmarketreferenceproducts',
    });

    const sealedProductsResult = await mongoose.connection.db.collection('sealedproducts').deleteMany({});

    logAndCapture('INFO', `Deleted ${sealedProductsResult.deletedCount} sealed products`, {
      deletedCount: sealedProductsResult.deletedCount,
      collection: 'sealedproducts',
    });

    // Wait a moment for database operations to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify database is actually cleared
    const remainingSets = await mongoose.connection.db.collection('sets').countDocuments({});
    const remainingCards = await mongoose.connection.db.collection('cards').countDocuments({});
    const remainingCardMarket = await mongoose.connection.db
      .collection('cardmarketreferenceproducts')
      .countDocuments({});
    const remainingSealedProducts = await mongoose.connection.db.collection('sealedproducts').countDocuments({});

    logAndCapture(
      'INFO',
      `Verification: ${remainingSets} sets, ${remainingCards} cards, ${remainingCardMarket} card market products, ${remainingSealedProducts} sealed products remaining`,
      {
        remainingSets,
        remainingCards,
        remainingCardMarket,
        remainingSealedProducts,
      },
    );

    logAndCapture('INFO', 'Phase 0 completed: Database cleared');

    const totalResults = await importAllDataOptimized();

    logAndCapture('INFO', 'All data import completed');
    logAndCapture('INFO', 'Summary:');
    logAndCapture('INFO', `  PSA Files Processed: ${totalResults.psaFiles}`);
    logAndCapture('INFO', `  Sets Created: ${totalResults.setsCreated}`);
    logAndCapture('INFO', `  Sets Updated: ${totalResults.setsUpdated}`);
    logAndCapture('INFO', `  Cards Processed: ${totalResults.cardsProcessed}`);
    logAndCapture('INFO', `  Sealed Products Processed: ${totalResults.sealedProductsProcessed}`);
    logAndCapture('INFO', `  Errors: ${totalResults.errors.length}`);
    logAndCapture('INFO', `  Total products across all sealed categories: ${totalResults.sealedProductsProcessed}`); // Added line for total sealed products

    // Phase 4: Comprehensive Card Count Verification
    logAndCapture('INFO', '\n=== Phase 4: Comprehensive Card Count Verification ===');

    const SetModel = require('./models/Set');
    const Card = require('./models/Card');

    let totalSetsChecked = 0;
    let setsWithDiscrepancies = 0;
    let setsWithZeroActualCards = 0;
    const discrepancyDetails = [];

    const allSets = await SetModel.find({});

    for (const set of allSets) {
      totalSetsChecked++;
      const actualCardCount = await Card.countDocuments({ setId: set._id });

      if (actualCardCount === 0 && set.totalCardsInSet > 0) {
        setsWithZeroActualCards++;
        discrepancyDetails.push({
          setName: set.setName,
          setId: set._id,
          expected: set.totalCardsInSet,
          actual: actualCardCount,
          issue: 'zero_cards_in_db',
        });
        logAndCapture(
          'ERROR',
          `Discrepancy found for set '${set.setName}' (ID: ${set._id}): Expected ${set.totalCardsInSet} cards, found ${actualCardCount}. (Zero actual cards in DB)`,
          {
            setName: set.setName,
            setId: set._id,
            databaseTotalCardsInSet: set.totalCardsInSet,
            actualCardsInDatabase: actualCardCount,
            match: false,
            issue: 'zero_cards_in_db',
          },
        );
      } else if (actualCardCount !== set.totalCardsInSet) {
        setsWithDiscrepancies++;
        discrepancyDetails.push({
          setName: set.setName,
          setId: set._id,
          expected: set.totalCardsInSet,
          actual: actualCardCount,
          issue: 'count_mismatch',
        });
        logAndCapture(
          'WARN',
          `Discrepancy found for set '${set.setName}' (ID: ${set._id}): Expected ${set.totalCardsInSet} cards, found ${actualCardCount}.`,
          {
            setName: set.setName,
            setId: set._id,
            databaseTotalCardsInSet: set.totalCardsInSet,
            actualCardsInDatabase: actualCardCount,
            match: false,
            issue: 'count_mismatch',
          },
        );
      } else {
        // Log successful matches as well for comprehensive output
        logAndCapture('INFO', `Set: ${set.setName}`, {
          setName: set.setName,
          databaseTotalCardsInSet: set.totalCardsInSet,
          actualCardsInDatabase: actualCardCount,
          match: true,
        });
        // You can uncomment this if you want to store all verified matches in discrepancyDetails
        // discrepancyDetails.push({
        //     setName: set.setName,
        //     setId: set._id,
        //     expected: set.totalCardsInSet,
        //     actual: actualCardCount,
        //     issue: 'verified_match'
        // });
      }
    }

    logAndCapture('INFO', '\nVerification Summary:');
    logAndCapture('INFO', `Total sets checked: ${totalSetsChecked}`, {
      totalSetsChecked,
    });
    if (setsWithZeroActualCards > 0) {
      logAndCapture('ERROR', `Sets with 0 actual cards in DB (but expected more): ${setsWithZeroActualCards}`, {
        count: setsWithZeroActualCards,
        type: 'zero_cards_error',
      });
    }
    if (setsWithDiscrepancies > 0) {
      logAndCapture(
        'WARN',
        `Sets with card count discrepancies (excluding zero-card errors): ${setsWithDiscrepancies}`,
        { count: setsWithDiscrepancies, type: 'discrepancy_error' },
      );
    }
    if (setsWithZeroActualCards === 0 && setsWithDiscrepancies === 0) {
      logAndCapture('INFO', 'All sets verified successfully with matching card counts.');
    } else {
      logAndCapture('WARN', 'Issues found during card count verification. Please review warnings/errors above.', {
        issuesFound: true,
      });
    }
    logAndCapture('INFO', 'Phase 4 completed: Comprehensive Card Count Verification.');

    // Phase 5: Final comprehensive integrity check with cleanup
    logAndCapture('INFO', '\n=== Phase 5: Final Integrity Check & Cleanup ===');

    // Remove any remaining empty sets
    const emptySets = await SetModel.find({ totalCardsInSet: 0 });

    if (emptySets.length > 0) {
      logAndCapture('INFO', `Found ${emptySets.length} empty sets to remove`);
      for (const emptySet of emptySets) {
        await SetModel.findByIdAndDelete(emptySet._id);
        logAndCapture('INFO', `Removed empty set: ${emptySet.setName} (${emptySet.year})`);
      }
    }

    // Final count verification
    const finalSets = await SetModel.find({});
    const finalCards = await Card.find({});

    logAndCapture('INFO', `Final counts: ${finalSets.length} sets, ${finalCards.length} cards`);

    // Check for any remaining orphaned cards
    const finalValidSetIds = new Set();

    finalSets.forEach((setDoc) => finalValidSetIds.add(setDoc._id.toString()));

    let finalOrphanedCount = 0;

    for (const card of finalCards) {
      if (!finalValidSetIds.has(card.setId.toString())) {
        finalOrphanedCount++;
      }
    }

    if (finalOrphanedCount > 0) {
      logAndCapture('ERROR', `Found ${finalOrphanedCount} orphaned cards after cleanup`);
    } else {
      logAndCapture('INFO', 'No orphaned cards found - data integrity perfect!');
    }

    logAndCapture('INFO', 'Phase 5 completed: Final integrity check finished');

    console.log('\n🎉 IMPORT COMPLETED SUCCESSFULLY!');
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    logAndCapture('ERROR', 'Error during import process:', {
      error: err.message,
      stack: err.stack,
    });
    console.log('\n❌ IMPORT FAILED!');
    await mongoose.disconnect();
    process.exit(1);
  })
  .finally(() => {
    writeLogFile();
  });
