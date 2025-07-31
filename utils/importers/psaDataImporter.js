const fs = require('fs');
const Set = require('../../models/Set');
const Card = require('../../models/Card');
const Logger = require('../../utils/Logger');
const ValidatorFactory = require('../../utils/ValidatorFactory');

// Phase 1: Import set metadata from *_all_sets.json files
const importSetMetadata = async (filePath) => {
  try {
    Logger.operationStart('IMPORT_SET_METADATA', `Importing set metadata from file`, { filePath });

    if (!fs.existsSync(filePath)) {
      Logger.operationError('FILE_NOT_FOUND', `Set metadata file not found`, new Error(`File not found: ${filePath}`), { filePath });
      return { success: false, error: `File not found: ${filePath}` };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let setsProcessed = 0;

    // Only process summary files (like *_all_sets.json)
    if (!data.set_links || !Array.isArray(data.set_links)) {
      Logger.info(`Skipping non-summary file`, { filePath, reason: 'not a summary file' });
      return { success: true, setsProcessed: 0 };
    }

    Logger.info(`Processing summary file`, { filePath, setCount: data.set_links.length });

    // Process each set from the summary file
    for (const setLink of data.set_links) {
      try {
        // Check if there's already a set with this exact URL (primary key)
        const existingSetByUrl = await Set.findOne({ setUrl: setLink.url });

        // Skip if URL already exists (primary identifier)
        if (existingSetByUrl) {
          Logger.debug(`Set already exists, skipping`, { url: setLink.url, setName: setLink.set_name });
        } else {
          // Clean the set name first - remove problematic characters
          function cleanSetName(name) {
            return name
              .replace(/[|\/\\&]/g, ' ') // Replace |, /, \, & with space
              .replace(/[-–—_]/g, ' ') // Replace all dashes and underscores with space
              .replace(/[()[\]]/g, '') // Remove parentheses and brackets
              .replace(/[.,:;!?]/g, '') // Remove punctuation
              .replace(/['""`]/g, '') // Remove quotes
              .replace(/\s+/g, ' ') // Replace multiple spaces with single space
              .trim(); // Remove leading/trailing spaces
          }

          let finalSetName = cleanSetName(setLink.set_name);

          // Always make promo sets unique by year to avoid conflicts
          if (
            finalSetName.toLowerCase().includes('promo') ||
            finalSetName.toLowerCase().includes('black star') ||
            finalSetName.toLowerCase().includes('world championships')
          ) {
            finalSetName = `${finalSetName} (${data.year})`;
          }

          // Check if this unique name already exists
          const existingSetByName = await Set.findOne({
            setName: finalSetName,
          });

          // If still a duplicate, add the ID
          if (existingSetByName) {
            finalSetName = `${cleanSetName(setLink.set_name)} (${data.year} ${setLink.id})`;
          }

          // Create the set
          await Set.create({
            setName: finalSetName,
            year: parseInt(data.year, 10),
            setUrl: setLink.url,
            totalCardsInSet: 0, // Will be updated in phase 2
            totalPsaPopulation: 0, // Will be updated in phase 2
          });

          Logger.info(`Set metadata created`, { setName: finalSetName, url: setLink.url, year: data.year });
          setsProcessed++;
        }
      } catch (error) {
        Logger.operationError('SET_PROCESSING_ERROR', `Error processing individual set`, error, {
          setName: setLink.set_name,
          url: setLink.url
        });
      }
    }

    Logger.operationSuccess('IMPORT_SET_METADATA_COMPLETE', `Set metadata import completed`, {
      filePath,
      setsProcessed
    });
    return { success: true, setsProcessed };
  } catch (error) {
    Logger.operationError('IMPORT_SET_METADATA_FAILED', `Failed to import set metadata`, error, { filePath });
    return { success: false, error: error.message };
  }
};

// Phase 2: Import card data from individual set files
const importCardData = async (filePath) => {
  try {
    Logger.operationStart('IMPORT_CARD_DATA', `Importing card data from file`, { filePath });

    if (!fs.existsSync(filePath)) {
      Logger.operationError('FILE_NOT_FOUND', `Card data file not found`, new Error(`File not found: ${filePath}`), { filePath });
      return { success: false, error: `File not found: ${filePath}` };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let setsUpdated = 0;
    let cardsProcessed = 0;
    let skippedCards = 0;

    // Skip summary files (*_all_sets.json)
    if (data.set_links && Array.isArray(data.set_links)) {
      Logger.info(`Skipping summary file during card data import`, { filePath });
      return {
        success: true,
        setsUpdated: 0,
        cardsProcessed: 0,
        skippedCards: 0,
      };
    }

    // Skip files that don't have individual set data structure
    if (!data.set_name || !data.cards) {
      Logger.info(`Skipping invalid set data file`, { filePath, reason: 'missing set_name or cards' });
      return {
        success: true,
        setsUpdated: 0,
        cardsProcessed: 0,
        skippedCards: 0,
      };
    }

    const setData = data;

    // Check TOTAL POPULATION entry to filter out low population sets
    const totalPopCard = setData.cards.find(
      (card) => card.card_name === 'TOTAL POPULATION' && card.base_name === 'TOTAL POPULATION',
    );

    if (totalPopCard) {
      const totalGraded = totalPopCard.psa_grades?.psa_total || totalPopCard.grade_totals?.grade_total || 0;

      if (totalGraded < 200) {
        Logger.info(`Skipping low population set`, {
          setName: setData.set_name,
          totalGraded,
          reason: 'population below 200 threshold'
        });
        return {
          success: true,
          setsUpdated: 0,
          cardsProcessed: 0,
          skippedCards: 0,
        };
      }
    }

    try {
      // Find the existing set by URL
      const existingSet = await Set.findOne({ setUrl: setData.set_url });

      if (!existingSet) {
        Logger.warn(`Set not found for card data import`, {
          setUrl: setData.set_url,
          setName: setData.set_name
        });
        return {
          success: true,
          setsUpdated: 0,
          cardsProcessed: 0,
          skippedCards: 0,
        };
      }

      // Find total population card for this set
      const setTotalPopCard = setData.cards.find(
        (card) => card.card_name === 'TOTAL POPULATION' || card.base_name === 'TOTAL POPULATION',
      );

      // Update Set with PSA population data only (totalCardsInSet will be updated in Phase 3)
      await Set.findOneAndUpdate(
        { setUrl: setData.set_url },
        {
          totalPsaPopulation: setTotalPopCard?.grade_totals?.grade_total || setTotalPopCard?.psa_grades?.psa_total || 0,
        },
      );

      const psaTotal = setTotalPopCard?.grade_totals?.grade_total || setTotalPopCard?.psa_grades?.psa_total || 0;

      Logger.info(`Set updated with card data`, {
        setName: setData.set_name,
        psaTotal,
        setId: existingSet._id
      });
      setsUpdated++;

      // Process cards for this set
      const cardPromises = setData.cards.map(async (cardData, i) => {
        // Skip total population cards only
        const isTotalPop = cardData.card_name === 'TOTAL POPULATION' || cardData.base_name === 'TOTAL POPULATION';

        if (!isTotalPop) {
          try {
            await Card.findOneAndUpdate(
              {
                setId: existingSet._id,
                cardName: cardData.card_name,
                pokemonNumber: cardData.pokemon_number,
                variety: cardData.variety || '',
              },
              {
                setId: existingSet._id,
                pokemonNumber: cardData.pokemon_number || '',
                cardName: cardData.card_name,
                baseName: cardData.base_name,
                variety: cardData.variety || '',
                psaGrades: cardData.psa_grades || {},
                psaTotalGradedForCard: cardData.grade_totals?.grade_total || cardData.psa_grades?.psa_total || 0,
              },
              { upsert: true, new: true },
            );

            return { processed: true, skipped: false, error: false };
          } catch (cardError) {
            Logger.operationError('CARD_PROCESSING_ERROR', `Error processing individual card`, cardError, {
              cardName: cardData.card_name,
              pokemonNumber: cardData.pokemon_number,
              setName: setData.set_name
            });
            return { processed: false, skipped: false, error: true };
          }
        }

        return { processed: false, skipped: true, error: false };
      });

      const cardResults = await Promise.all(cardPromises);

      cardsProcessed += cardResults.filter((result) => result.processed).length;
      skippedCards += cardResults.filter((result) => result.skipped || result.error).length;
    } catch (error) {
      Logger.operationError('SET_CARD_DATA_ERROR', `Error processing set card data`, error, {
        setName: setData.set_name,
        setUrl: setData.set_url
      });
      return { success: false, error: error.message };
    }

    Logger.operationSuccess('IMPORT_CARD_DATA_COMPLETE', `Card data import completed`, {
      filePath,
      setsUpdated,
      cardsProcessed,
      skippedCards
    });

    return {
      success: true,
      setsUpdated,
      cardsProcessed,
      skippedCards,
    };
  } catch (error) {
    Logger.operationError('IMPORT_CARD_DATA_FAILED', `Failed to import card data`, error, { filePath });
    return { success: false, error: error.message };
  }
};

// Main import dispatcher function
const importPsaData = async (filePath) => {
  // Determine if this is a metadata file or card data file
  if (filePath.includes('_all_sets.json')) {
    return importSetMetadata(filePath);
  }
  return importCardData(filePath);
};

module.exports = {
  importPsaData,
  importSetMetadata,
  importCardData,
};
