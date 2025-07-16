const fs = require('fs');
const path = require('path');

// List of empty sets from the database check
const emptySets = [
  { name: 'Pokemon Japanese Coin Promo', year: 1997 },
  { name: 'Pokemon Black & White Promo', year: 2014 },
  { name: 'Pokemon Japanese Coin Promo', year: 1996 },
  { name: 'Pokemon Japanese Coin Promo', year: 2014 },
  { name: 'Pokemon Japanese Coin Promo', year: 2015 },
  { name: 'Pokemon Japanese Coin Promo', year: 2019 },
  { name: 'Pokemon Game Movie', year: 2002 },
  { name: 'Pokemon Japanese SM Promo', year: 2020 },
  { name: 'Pokemon Japanese Coin Promo', year: 2001 },
  { name: 'Pokemon Japanese Coin Promo', year: 2002 },
  { name: 'Pokemon Japanese Coin Promo', year: 2005 },
  { name: 'Pokemon Japanese Coin Promo', year: 2007 },
  { name: 'Pokemon Japanese Coin Promo', year: 2006 },
  { name: 'Pokemon Japanese Coin Promo', year: 2009 },
  { name: 'Pokemon Japanese Black & White Promo', year: 2010 },
  { name: 'Pokemon Japanese Coin Promo', year: 2003 },
  { name: 'Pokemon Japanese Coin Promo', year: 2008 },
  { name: 'Pokemon Japanese Design Contest Promo', year: 2009 },
  { name: 'Pokemon Japanese Coin Promo', year: 2010 },
  { name: 'Pokemon Japanese Coin Promo', year: 2011 },
  { name: "Pokemon McDonald's Collection", year: 2014 },
  { name: 'Pokemon Promo', year: 2011 },
  { name: 'Pokemon Promo', year: 2014 },
  { name: 'Pokemon Japanese Promo Tropical Mega Battle', year: 2001 },
  { name: 'Pokemon Japanese Coin Promo', year: 2013 },
  { name: "Pokemon McDonald's Collection", year: 2015 },
  { name: 'Pokemon Promo', year: 2015 },
  { name: 'Pokemon Promo', year: 2018 },
  { name: "Pokemon McDonald's Collection", year: 2016 },
  { name: 'Pokemon Japanese Coin Promo', year: 2012 },
  { name: 'Pokemon Pop Series 1', year: 2007 },
  { name: 'Pokemon Promo Pokken Tournament', year: 2015 },
  { name: 'Pokemon Japanese Coin Promo', year: 2000 },
  { name: 'Pokemon Promo', year: 2013 },
  { name: 'Pokemon Promo', year: 2010 },
  { name: 'Pokemon World Championships Promo', year: 2015 },
  { name: 'Pokemon World Championship Promo', year: 2013 },
  { name: "Pokemon McDonald's Collection", year: 2017 },
  { name: 'Pokemon World Championships Promo', year: 2016 },
  { name: "Pokemon McDonald's Collection", year: 2012 },
  { name: 'Pokemon Promo', year: 2007 },
  { name: 'Pokemon Promo Pokken Tournament', year: 2017 },
  { name: 'Pokemon Japanese Coin Promo', year: 2004 },
  { name: 'Pokemon World Championship Promo', year: 2018 },
  { name: 'Pokemon Pop Series 7', year: 2009 },
  { name: 'Pokemon Promo', year: 2005 },
  { name: 'Pokemon World Championships Promo', year: 2017 },
  { name: 'Pokemon XY Ancient Origins', year: 2017 },
  { name: 'Pokemon XY Breakpoint', year: 2017 },
  { name: 'Pokemon XY Breakthrough', year: 2017 },
  { name: 'Pokemon Swsh Black Star Promo', year: 2019 },
];

function findJsonFiles(dir, files = []) {
  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      findJsonFiles(fullPath, files);
    } else if (entry.endsWith('.json') && !entry.includes('Zone.Identifier') && !entry.includes('_all_sets.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalizeSetName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function checkEmptySetFiles() {
  const dataDir = path.join(__dirname, 'data', 'sets');
  const allJsonFiles = findJsonFiles(dataDir);

  console.log('=== CHECKING JSON FILES FOR EMPTY SETS ===');
  console.log(`Found ${allJsonFiles.length} individual set JSON files`);
  console.log(`Checking ${emptySets.length} empty sets from database\n`);

  const results = [];

  for (const emptySet of emptySets) {
    let foundFile = null;
    let cardCount = 0;
    let hasCards = false;

    // Try to find matching JSON file
    for (const filePath of allJsonFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        if (data.set_name && data.year) {
          const fileSetName = normalizeSetName(data.set_name);
          const querySetName = normalizeSetName(emptySet.name);
          const fileYear = parseInt(data.year);

          if (fileSetName === querySetName && fileYear === emptySet.year) {
            foundFile = filePath;
            if (data.cards && Array.isArray(data.cards)) {
              // Count non-TOTAL_POPULATION cards
              const nonTotalCards = data.cards.filter(
                (card) => card.card_name !== 'TOTAL POPULATION' && card.base_name !== 'TOTAL POPULATION',
              );

              cardCount = nonTotalCards.length;
              hasCards = cardCount > 0;
            }
            break;
          }
        }
      } catch (error) {
        // Skip invalid JSON files
      }
    }

    const result = {
      setName: emptySet.name,
      year: emptySet.year,
      foundFile: foundFile ? path.basename(foundFile) : 'NOT FOUND',
      cardCount,
      hasCards,
      filePath: foundFile || 'N/A',
    };

    results.push(result);

    if (foundFile) {
      if (hasCards) {
        console.log(`❌ ISSUE: ${emptySet.name} (${emptySet.year}) - JSON has ${cardCount} cards but DB has 0`);
      } else {
        console.log(`✅ CONFIRMED: ${emptySet.name} (${emptySet.year}) - JSON also has 0 cards`);
      }
    } else {
      console.log(`❓ MISSING: ${emptySet.name} (${emptySet.year}) - No JSON file found`);
    }
  }

  console.log('\n=== SUMMARY ===');
  const confirmedEmpty = results.filter((r) => r.foundFile !== 'NOT FOUND' && !r.hasCards);
  const hasCardsInJson = results.filter((r) => r.foundFile !== 'NOT FOUND' && r.hasCards);
  const missingFiles = results.filter((r) => r.foundFile === 'NOT FOUND');

  console.log(`✅ Confirmed empty in JSON: ${confirmedEmpty.length}`);
  console.log(`❌ Has cards in JSON but empty in DB: ${hasCardsInJson.length}`);
  console.log(`❓ Missing JSON files: ${missingFiles.length}`);

  if (hasCardsInJson.length > 0) {
    console.log('\n🚨 SETS WITH CARDS IN JSON BUT EMPTY IN DATABASE:');
    hasCardsInJson.forEach((result) => {
      console.log(`   - ${result.setName} (${result.year}): ${result.cardCount} cards in ${result.foundFile}`);
    });
  }

  if (missingFiles.length > 0) {
    console.log('\n❓ MISSING JSON FILES:');
    missingFiles.forEach((result) => {
      console.log(`   - ${result.setName} (${result.year})`);
    });
  }
}

checkEmptySetFiles().catch(console.error);
