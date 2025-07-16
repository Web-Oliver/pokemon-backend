const fs = require('fs');
const Set = require('../../models/Set');
const Card = require('../../models/Card');

// Phase 1: Import set metadata from *_all_sets.json files
const importSetMetadata = async (filePath) => {
  try {
    console.log(`Importing set metadata from ${filePath}...`);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return { success: false, error: `File not found: ${filePath}` };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let setsProcessed = 0;

    // Only process summary files (like *_all_sets.json)
    if (!data.set_links || !Array.isArray(data.set_links)) {
      console.log(`Skipping file ${filePath} - not a summary file`);
      return { success: true, setsProcessed: 0 };
    }

    console.log(`Processing summary file ${filePath} with ${data.set_links.length} sets`);

    // Process each set from the summary file
    for (const setLink of data.set_links) {
      try {
        // Check if there's already a set with this exact URL (primary key)
        const existingSetByUrl = await Set.findOne({ setUrl: setLink.url });

        // Skip if URL already exists (primary identifier)
        if (existingSetByUrl) {
          console.log(`Set already exists with URL: ${setLink.url}, skipping...`);
          continue;
        }

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
        if (finalSetName.toLowerCase().includes('promo')
            || finalSetName.toLowerCase().includes('black star')
            || finalSetName.toLowerCase().includes('world championships')) {
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

        console.log(`Set metadata created: ${finalSetName} (${setLink.url})`);
        setsProcessed++;
      } catch (error) {
        console.error(`Error processing set ${setLink.set_name}:`, error.message);
      }
    }

    return { success: true, setsProcessed };
  } catch (error) {
    console.error(`Error importing set metadata from ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Phase 2: Import card data from individual set files
const importCardData = async (filePath) => {
  try {
    console.log(`Importing card data from ${filePath}...`);

    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return { success: false, error: `File not found: ${filePath}` };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    let setsUpdated = 0;
    let cardsProcessed = 0;
    let skippedCards = 0;

    // Skip summary files (*_all_sets.json)
    if (data.set_links && Array.isArray(data.set_links)) {
      console.log(`Skipping summary file ${filePath}`);
      return { success: true, setsUpdated: 0, cardsProcessed: 0, skippedCards: 0 };
    }

    // Skip files that don't have individual set data structure
    if (!data.set_name || !data.cards) {
      console.log(`Skipping file ${filePath} - not a valid set data file`);
      return { success: true, setsUpdated: 0, cardsProcessed: 0, skippedCards: 0 };
    }

    const setData = data;

    // Check TOTAL POPULATION entry to filter out low population sets
    const totalPopCard = setData.cards.find((card) =>
      card.card_name === 'TOTAL POPULATION' && card.base_name === 'TOTAL POPULATION');

    if (totalPopCard) {
      const totalGraded = totalPopCard.psa_grades?.psa_total || totalPopCard.grade_totals?.grade_total || 0;

      if (totalGraded < 200) {
        console.log(`Skipping low population set ${setData.set_name}: only ${totalGraded} total graded cards`);
        return { success: true, setsUpdated: 0, cardsProcessed: 0, skippedCards: 0 };
      }
    }

    try {
      // Find the existing set by URL
      const existingSet = await Set.findOne({ setUrl: setData.set_url });

      if (!existingSet) {
        console.log(`Set not found for URL ${setData.set_url}, skipping card data import`);
        return { success: true, setsUpdated: 0, cardsProcessed: 0, skippedCards: 0 };
      }

      // Find total population card for this set
      const totalPopCard = setData.cards.find((card) => card.card_name === 'TOTAL POPULATION'
                || card.base_name === 'TOTAL POPULATION');

      // Update Set with PSA population data only (totalCardsInSet will be updated in Phase 3)
      await Set.findOneAndUpdate(
        { setUrl: setData.set_url },
        {
          totalPsaPopulation: totalPopCard?.grade_totals?.grade_total || totalPopCard?.psa_grades?.psa_total || 0,
        },
      );

      const psaTotal = totalPopCard?.grade_totals?.grade_total || totalPopCard?.psa_grades?.psa_total || 0;

      console.log(`Set updated with card data: ${setData.set_name} (${psaTotal} PSA total)`);
      setsUpdated++;

      // Process cards for this set
      const cardPromises = setData.cards.map(async (cardData, i) => {
        // Skip total population cards only
        const isTotalPop = cardData.card_name === 'TOTAL POPULATION'
                                 || cardData.base_name === 'TOTAL POPULATION';

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
            console.error(`Error processing card ${cardData.card_name}:`, cardError.message);
            return { processed: false, skipped: false, error: true };
          }
        }

        return { processed: false, skipped: true, error: false };
      });

      const cardResults = await Promise.all(cardPromises);

      cardsProcessed += cardResults.filter((result) => result.processed).length;
      skippedCards += cardResults.filter((result) => result.skipped || result.error).length;
    } catch (error) {
      console.error(`Error processing set ${setData.set_name}:`, error.message);
      return { success: false, error: error.message };
    }

    console.log(`Card data import from ${filePath} completed successfully`);
    console.log(`Sets updated: ${setsUpdated}, Cards: ${cardsProcessed}, Skipped: ${skippedCards}`);

    return {
      success: true,
      setsUpdated,
      cardsProcessed,
      skippedCards,
    };
  } catch (error) {
    console.error(`Error importing card data from ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Legacy function for backward compatibility
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
