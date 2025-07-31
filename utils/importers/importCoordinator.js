const { importSetMetadata, importCardData } = require('./psaDataImporter');
const { importCardMarketData } = require('./cardMarketImporter');
const {
  getAllPsaFiles,
  getAllPsaMetadataFiles,
  getAllPsaIndividualFiles,
  getAllSealedProductFiles,
} = require('./fileUtils');
const Logger = require('../../utils/Logger');
const ValidatorFactory = require('../../utils/ValidatorFactory');
const Set = require('../../models/Set');
const Card = require('../../models/Card');

const importAllData = async (options = {}) => {
  // Validate import options using ValidatorFactory
  const validationErrors = [];
  
  if (options.limitPsaFiles !== null && options.limitPsaFiles !== undefined) {
    const psaLimitValidation = ValidatorFactory.number().min(1).max(1000);

    if (!psaLimitValidation.validate(options.limitPsaFiles)) {
      validationErrors.push('limitPsaFiles must be a number between 1 and 1000');
    }
  }
  
  if (options.limitSealedProductFiles !== null && options.limitSealedProductFiles !== undefined) {
    const sealedLimitValidation = ValidatorFactory.number().min(1).max(1000);

    if (!sealedLimitValidation.validate(options.limitSealedProductFiles)) {
      validationErrors.push('limitSealedProductFiles must be a number between 1 and 1000');
    }
  }
  
  if (validationErrors.length > 0) {
    Logger.operationError('INVALID_IMPORT_OPTIONS', 'Import options validation failed', new Error('Validation errors'), {
      validationErrors,
      options
    });
    return {
      success: false,
      errors: validationErrors,
      psaFiles: 0,
      sealedProductFiles: 0,
      setsCreated: 0,
      setsUpdated: 0,
      cardsProcessed: 0,
      sealedProductsProcessed: 0
    };
  }
  
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
    Logger.operationStart('DATA_IMPORT', 'Starting complete data import', { options });
    
    // Import PSA data using two-phase approach
    if (includePsa) {
      Logger.section('PSA Data Import', 'Starting PSA data import phase');

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

      Logger.info(`Found ${totalPsaFiles} PSA files to import (${metadataFiles.length} metadata + ${individualFiles.length} individual)`);
      totalResults.psaFiles = totalPsaFiles;

      // Phase 1: Import set metadata from *_all_sets.json files
      Logger.section('Phase 1 - Set Metadata', `Importing set metadata from ${metadataFiles.length} summary files`);

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

      Logger.operationSuccess('PHASE_1_METADATA', `Phase 1 completed: ${totalResults.setsCreated} sets created`);

      // Phase 2: Import card data from individual set files
      Logger.section('Phase 2 - Card Data', `Importing card data from ${individualFiles.length} individual set files`);

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

      Logger.operationSuccess('PHASE_2_CARDS', `Phase 2 completed: ${totalResults.setsUpdated} sets updated, ${totalResults.cardsProcessed} cards processed`);
    }

    // Import Sealed Product data as CardMarket reference products
    if (includeSealedProducts || includeCardMarket) {
      Logger.section('Sealed Products Import', 'Starting Sealed Product data import phase');
      let sealedProductFiles = getAllSealedProductFiles();

      if (limitSealedProductFiles) {
        sealedProductFiles = sealedProductFiles.slice(0, limitSealedProductFiles);
      }

      Logger.info(`Found ${sealedProductFiles.length} Sealed Product files to import`);
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
    Logger.section('Phase 3 - Set Updates', 'Updating totalCardsInSet for all sets based on actual card count');

    const allSets = await Set.find({});
    let setsUpdatedCount = 0;

    Logger.info(`Found ${allSets.length} sets to check for card count updates`);

    for (const set of allSets) {
      const cardCount = await Card.countDocuments({ setId: set._id });

      const cardsMatch = cardCount === set.totalCardsInSet;

      Logger.debug(`Set "${set.setName}" check`, {
        setId: set._id,
        currentCount: set.totalCardsInSet,
        actualCount: cardCount,
        cardsMatch
      });

      if (!cardsMatch) {
        Logger.info(`Updating set ${set.setName}: ${set.totalCardsInSet} -> ${cardCount}`);
        const updateResult = await Set.findByIdAndUpdate(set._id, { totalCardsInSet: cardCount }, { new: true });

        Logger.debug(`Set update completed`, { setName: set.setName, newCount: updateResult.totalCardsInSet });
        setsUpdatedCount++;
      }
    }

    Logger.operationSuccess('PHASE_3_UPDATES', `Phase 3 completed: ${setsUpdatedCount} sets updated with correct card counts`);

    // Phase 3.5: Multiple verification passes to ensure all cards are properly assigned
    Logger.section('Phase 3.5 - Verification', 'Running multiple verification passes to ensure data integrity');

    for (let pass = 1; pass <= 3; pass++) {
      Logger.section(`Verification Pass ${pass}/3`, `Running verification pass ${pass} of 3`);

      // Re-check all sets and cards
      const allSetsRecheck = await Set.find({});
      let issuesFound = 0;

      for (const set of allSetsRecheck) {
        const cardCount = await Card.countDocuments({ setId: set._id });

        if (cardCount !== set.totalCardsInSet) {
          Logger.warn(`Pass ${pass} - Fixing set discrepancy`, {
            setName: set.setName,
            previousCount: set.totalCardsInSet,
            actualCount: cardCount
          });
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

      Logger.info(`Pass ${pass} verification results`, {
        setsCorrected: issuesFound,
        orphanedCards: orphanedCount
      });

      // If no issues found, break early
      if (issuesFound === 0 && orphanedCount === 0) {
        Logger.operationSuccess('VERIFICATION_COMPLETE', `Pass ${pass} - All checks passed! Data integrity verified.`);
        break;
      }
    }

    Logger.operationSuccess('PHASE_3_5_VERIFICATION', 'Multiple verification passes completed');

    Logger.operationSuccess('DATA_IMPORT_COMPLETE', 'All data import completed', {
      summary: {
        psaFilesProcessed: totalResults.psaFiles,
        setsCreated: totalResults.setsCreated,
        setsUpdated: totalResults.setsUpdated,
        cardsProcessed: totalResults.cardsProcessed,
        sealedProductsProcessed: totalResults.sealedProductsProcessed,
        errorCount: totalResults.errors.length
      }
    });
    return totalResults;
  } catch (error) {
    Logger.operationError('DATA_IMPORT_FAILED', 'Critical error during data import', error, {
      totalResults,
      options
    });
    totalResults.errors.push(`General Error: ${error.message}`);
    return totalResults;
  }
};

module.exports = {
  importAllData,
};
