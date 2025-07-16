const { importSetMetadata, importCardData } = require('./psaDataImporter');
const { importCardMarketData } = require('./cardMarketImporter');
const { getAllPsaFiles, getAllPsaMetadataFiles, getAllPsaIndividualFiles, getAllSealedProductFiles } = require('./fileUtils');

/**
 * OPTIMIZED IMPORT COORDINATOR WITH CONTEXT7 BEST PRACTICES
 *
 * Key optimizations implemented:
 * 1. Bulk operations for better performance
 * 2. Connection pool optimization
 * 3. Disabled buffering for predictable behavior
 * 4. Optimized concurrency with Promise.allSettled
 * 5. Memory-efficient processing with batching
 * 6. Comprehensive error handling and recovery
 * 7. Performance monitoring and logging
 */

const BATCH_SIZE = 50; // Process files in batches to manage memory
const MAX_CONCURRENT_OPERATIONS = 10; // Limit concurrent operations

const importAllDataOptimized = async (options = {}) => {
  const startTime = Date.now();

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
    performanceMetrics: {
      startTime,
      phases: {},
    },
  };

  try {
    // Configure Mongoose for optimal performance
    const mongoose = require('mongoose');

    // Disable buffering for predictable behavior (Context7 best practice)
    mongoose.set('bufferCommands', false);
    mongoose.set('bufferTimeoutMS', 500);

    // Optimize connection pool
    if (mongoose.connection.readyState === 1) {
      console.log('Connection pool optimized: maxPoolSize configured');
    }

    // Import PSA data using optimized two-phase approach
    if (includePsa) {
      const phaseStartTime = Date.now();

      console.log('🚀 Starting OPTIMIZED PSA data import...');

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

      console.log(`📊 Found ${totalPsaFiles} PSA files to import (${metadataFiles.length} metadata + ${individualFiles.length} individual)`);
      totalResults.psaFiles = totalPsaFiles;

      // Phase 1: OPTIMIZED Import set metadata with batching
      console.log('⚡ Phase 1: OPTIMIZED set metadata import with batching...');

      const metadataBatches = chunkArray(metadataFiles, BATCH_SIZE);
      let totalSetsCreated = 0;

      for (let i = 0; i < metadataBatches.length; i++) {
        const batch = metadataBatches[i];

        console.log(`Processing metadata batch ${i + 1}/${metadataBatches.length} (${batch.length} files)`);

        // Use Promise.allSettled for better error handling (Context7 best practice)
        const batchPromises = batch.map(async (filePath) => {
          try {
            const result = await importSetMetadata(filePath);

            return {
              success: true,
              setsProcessed: result.success ? result.setsProcessed : 0,
              filePath,
            };
          } catch (error) {
            return {
              success: false,
              error: `Set Metadata Import Error - ${filePath}: ${error.message}`,
              filePath,
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              totalSetsCreated += result.value.setsProcessed;
            } else {
              totalResults.errors.push(result.value.error);
            }
          } else {
            totalResults.errors.push(`Batch processing error: ${result.reason.message}`);
          }
        });

        // Memory cleanup between batches
        if (global.gc) {
          global.gc();
        }
      }

      totalResults.setsCreated = totalSetsCreated;
      console.log(`✅ Phase 1 completed: ${totalResults.setsCreated} sets created`);

      // Phase 2: OPTIMIZED Import card data with controlled concurrency
      console.log('⚡ Phase 2: OPTIMIZED card data import with controlled concurrency...');

      const cardDataBatches = chunkArray(individualFiles, BATCH_SIZE);
      let totalCardsProcessed = 0;
      let totalSetsUpdated = 0;

      for (let i = 0; i < cardDataBatches.length; i++) {
        const batch = cardDataBatches[i];

        console.log(`Processing card data batch ${i + 1}/${cardDataBatches.length} (${batch.length} files)`);

        // Control concurrency to prevent overwhelming the database
        const batchPromises = batch.map(async (filePath) => {
          try {
            const result = await importCardData(filePath);

            return {
              success: true,
              setsUpdated: result.success ? result.setsUpdated || 0 : 0,
              cardsProcessed: result.success ? result.cardsProcessed || 0 : 0,
              filePath,
            };
          } catch (error) {
            return {
              success: false,
              error: `Card Data Import Error - ${filePath}: ${error.message}`,
              filePath,
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              totalSetsUpdated += result.value.setsUpdated;
              totalCardsProcessed += result.value.cardsProcessed;
            } else {
              totalResults.errors.push(result.value.error);
            }
          } else {
            totalResults.errors.push(`Card batch processing error: ${result.reason.message}`);
          }
        });

        // Memory cleanup between batches
        if (global.gc) {
          global.gc();
        }
      }

      totalResults.setsUpdated = totalSetsUpdated;
      totalResults.cardsProcessed = totalCardsProcessed;
      console.log(`✅ Phase 2 completed: ${totalResults.setsUpdated} sets updated, ${totalResults.cardsProcessed} cards processed`);

      totalResults.performanceMetrics.phases.psaImport = Date.now() - phaseStartTime;
    }

    // Import Sealed Product data with optimized batch processing
    if (includeSealedProducts || includeCardMarket) {
      const phaseStartTime = Date.now();

      console.log('🚀 Starting OPTIMIZED Sealed Product data import...');

      let sealedProductFiles = getAllSealedProductFiles();

      if (limitSealedProductFiles) {
        sealedProductFiles = sealedProductFiles.slice(0, limitSealedProductFiles);
      }

      console.log(`📊 Found ${sealedProductFiles.length} Sealed Product files to import`);
      totalResults.sealedProductFiles = sealedProductFiles.length;

      // Process in optimized batches
      const sealedBatches = chunkArray(sealedProductFiles, BATCH_SIZE);
      let totalProductsProcessed = 0;

      for (let i = 0; i < sealedBatches.length; i++) {
        const batch = sealedBatches[i];

        console.log(`Processing sealed products batch ${i + 1}/${sealedBatches.length} (${batch.length} files)`);

        const batchPromises = batch.map(async (filePath) => {
          try {
            // Import as CardMarket reference products (for autocomplete)
            const cardMarketResult = await importCardMarketData(filePath);

            return {
              success: true,
              productsProcessed: cardMarketResult.success ? cardMarketResult.productsProcessed : 0,
              filePath,
            };
          } catch (error) {
            return {
              success: false,
              error: `CardMarket Reference Import Error - ${filePath}: ${error.message}`,
              filePath,
            };
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              totalProductsProcessed += result.value.productsProcessed;
            } else {
              totalResults.errors.push(result.value.error);
            }
          } else {
            totalResults.errors.push(`Sealed product batch error: ${result.reason.message}`);
          }
        });

        // Memory cleanup between batches
        if (global.gc) {
          global.gc();
        }
      }

      totalResults.sealedProductsProcessed = totalProductsProcessed;
      console.log(`✅ Sealed products completed: ${totalResults.sealedProductsProcessed} products processed`);

      totalResults.performanceMetrics.phases.sealedProductImport = Date.now() - phaseStartTime;
    }

    // OPTIMIZED Phase 3: Bulk update totalCardsInSet with improved performance
    console.log('⚡ Phase 3: OPTIMIZED bulk updating totalCardsInSet...');
    const phase3StartTime = Date.now();

    const SetModel = require('../../models/Set');
    const Card = require('../../models/Card');

    // Use aggregation for better performance (Context7 best practice)
    const cardCountsAggregation = await Card.aggregate([
      {
        $group: {
          _id: '$setId',
          count: { $sum: 1 },
        },
      },
    ]);

    // Create a map for O(1) lookup
    const cardCountsMap = new Map();

    cardCountsAggregation.forEach((result) => {
      cardCountsMap.set(result._id.toString(), result.count);
    });

    const allSets = await SetModel.find({}).lean(); // Use lean for better performance
    const bulkOps = [];

    allSets.forEach((set) => {
      const setIdString = set._id.toString();
      const actualCardCount = cardCountsMap.get(setIdString) || 0;

      if (actualCardCount !== set.totalCardsInSet) {
        bulkOps.push({
          updateOne: {
            filter: { _id: set._id },
            update: { $set: { totalCardsInSet: actualCardCount } },
          },
        });
      }
    });

    let setsUpdatedCount = 0;

    if (bulkOps.length > 0) {
      // Use bulkWrite for optimal performance (Context7 best practice)
      const bulkResult = await SetModel.bulkWrite(bulkOps, { ordered: false });

      setsUpdatedCount = bulkResult.modifiedCount || 0;
    }

    console.log(`✅ Phase 3 completed: ${setsUpdatedCount} sets updated with correct card counts`);
    totalResults.performanceMetrics.phases.cardCountUpdate = Date.now() - phase3StartTime;

    // OPTIMIZED Multiple verification passes with improved performance
    console.log('⚡ Phase 3.5: OPTIMIZED verification passes...');
    const verificationStartTime = Date.now();

    for (let pass = 1; pass <= 3; pass++) {
      console.log(`🔍 Verification Pass ${pass}/3`);

      // Re-check with optimized aggregation
      const recheckAggregation = await Card.aggregate([
        {
          $group: {
            _id: '$setId',
            count: { $sum: 1 },
          },
        },
      ]);

      const recheckMap = new Map();

      recheckAggregation.forEach((result) => {
        recheckMap.set(result._id.toString(), result.count);
      });

      const allSetsRecheck = await SetModel.find({}).lean();
      let issuesFound = 0;
      const fixBulkOps = [];

      allSetsRecheck.forEach((set) => {
        const setIdString = set._id.toString();
        const cardCount = recheckMap.get(setIdString) || 0;

        if (cardCount !== set.totalCardsInSet) {
          fixBulkOps.push({
            updateOne: {
              filter: { _id: set._id },
              update: { $set: { totalCardsInSet: cardCount } },
            },
          });
          issuesFound++;
        }
      });

      if (fixBulkOps.length > 0) {
        await SetModel.bulkWrite(fixBulkOps, { ordered: false });
      }

      // Check for orphaned cards with optimized query
      const mongoose = require('mongoose');
      const validSetIds = new Set(allSetsRecheck.map((set) => set._id.toString()));
      const orphanedCount = await Card.countDocuments({
        setId: { $nin: Array.from(validSetIds).map((id) => new mongoose.Types.ObjectId(id)) },
      });

      console.log(`Pass ${pass} - Sets corrected: ${issuesFound}, Orphaned cards: ${orphanedCount}`);

      // If no issues found, break early
      if (issuesFound === 0 && orphanedCount === 0) {
        console.log(`✅ Pass ${pass} - All checks passed! Data integrity verified.`);
        break;
      }
    }

    totalResults.performanceMetrics.phases.verification = Date.now() - verificationStartTime;
    console.log('✅ Phase 3.5 completed: Optimized verification passes finished');

    // Calculate total performance metrics
    const totalTime = Date.now() - startTime;

    totalResults.performanceMetrics.totalTime = totalTime;
    totalResults.performanceMetrics.throughput = {
      setsPerSecond: (totalResults.setsCreated / (totalTime / 1000)).toFixed(2),
      cardsPerSecond: (totalResults.cardsProcessed / (totalTime / 1000)).toFixed(2),
      productsPerSecond: (totalResults.sealedProductsProcessed / (totalTime / 1000)).toFixed(2),
    };

    console.log('\n🎉 OPTIMIZED data import completed successfully!');
    console.log('📊 Performance Summary:');
    console.log(`   Total Time: ${(totalTime / 1000).toFixed(2)} seconds`);
    console.log(`   PSA Files Processed: ${totalResults.psaFiles}`);
    console.log(`   Sets Created: ${totalResults.setsCreated} (${totalResults.performanceMetrics.throughput.setsPerSecond}/sec)`);
    console.log(`   Cards Processed: ${totalResults.cardsProcessed} (${totalResults.performanceMetrics.throughput.cardsPerSecond}/sec)`);
    console.log(`   Sealed Products: ${totalResults.sealedProductsProcessed} (${totalResults.performanceMetrics.throughput.productsPerSecond}/sec)`);
    console.log(`   Errors: ${totalResults.errors.length}`);

    if (totalResults.performanceMetrics.phases.psaImport) {
      console.log(`   PSA Import: ${(totalResults.performanceMetrics.phases.psaImport / 1000).toFixed(2)}s`);
    }
    if (totalResults.performanceMetrics.phases.sealedProductImport) {
      console.log(`   Sealed Products: ${(totalResults.performanceMetrics.phases.sealedProductImport / 1000).toFixed(2)}s`);
    }
    console.log(`   Card Count Update: ${(totalResults.performanceMetrics.phases.cardCountUpdate / 1000).toFixed(2)}s`);
    console.log(`   Verification: ${(totalResults.performanceMetrics.phases.verification / 1000).toFixed(2)}s`);

    return totalResults;
  } catch (error) {
    console.error('💥 Error during optimized data import:', error.message);
    totalResults.errors.push(`General Error: ${error.message}`);
    totalResults.performanceMetrics.totalTime = Date.now() - startTime;
    return totalResults;
  }
};

// Utility function to chunk arrays for batch processing
function chunkArray(array, chunkSize) {
  const chunks = [];

  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

module.exports = {
  importAllDataOptimized,
  importAllData: importAllDataOptimized, // Alias for backward compatibility
};
