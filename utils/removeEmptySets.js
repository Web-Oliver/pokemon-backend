const fs = require('fs');
const path = require('path');

// List of empty sets to remove (from previous check)
const emptySetsToRemove = [
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
  { name: 'Pokemon McDonald\'s Collection', year: 2014 },
  { name: 'Pokemon Promo', year: 2011 },
  { name: 'Pokemon Promo', year: 2014 },
  { name: 'Pokemon Japanese Promo Tropical Mega Battle', year: 2001 },
  { name: 'Pokemon Japanese Coin Promo', year: 2013 },
  { name: 'Pokemon McDonald\'s Collection', year: 2015 },
  { name: 'Pokemon Promo', year: 2015 },
  { name: 'Pokemon Promo', year: 2018 },
  { name: 'Pokemon McDonald\'s Collection', year: 2016 },
  { name: 'Pokemon Japanese Coin Promo', year: 2012 },
  { name: 'Pokemon Pop Series 1', year: 2007 },
  { name: 'Pokemon Promo Pokken Tournament', year: 2015 },
  { name: 'Pokemon Japanese Coin Promo', year: 2000 },
  { name: 'Pokemon Promo', year: 2013 },
  { name: 'Pokemon Promo', year: 2010 },
  { name: 'Pokemon World Championships Promo', year: 2015 },
  { name: 'Pokemon World Championship Promo', year: 2013 },
  { name: 'Pokemon McDonald\'s Collection', year: 2017 },
  { name: 'Pokemon World Championships Promo', year: 2016 },
  { name: 'Pokemon McDonald\'s Collection', year: 2012 },
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

function normalizeSetName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function findAllSetsFiles() {
  const dataDir = path.join(__dirname, 'data', 'sets');
  const allSetsFiles = [];

  function findFiles(dir) {
    if (!fs.existsSync(dir)) {
      return;
    }

    const entries = fs.readdirSync(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        findFiles(fullPath);
      } else if (entry.endsWith('_all_sets.json')) {
        allSetsFiles.push(fullPath);
      }
    }
  }

  findFiles(dataDir);
  return allSetsFiles;
}

async function removeEmptySetsFromAllSetsFiles() {
  const allSetsFiles = findAllSetsFiles();

  console.log('=== REMOVING EMPTY SETS FROM ALL_SETS FILES ===');
  console.log(`Found ${allSetsFiles.length} *_all_sets.json files`);
  console.log(`Removing ${emptySetsToRemove.length} empty sets\n`);

  let totalFilesModified = 0;
  let totalSetsRemoved = 0;

  for (const filePath of allSetsFiles) {
    try {
      console.log(`Processing: ${path.basename(filePath)}`);

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (!data.set_links || !Array.isArray(data.set_links)) {
        console.log('  ⚠️  Skipping - not a valid all_sets file');
      } else {
        const originalCount = data.set_links.length;
        const fileYear = parseInt(data.year);

        // Filter out empty sets
        const filteredSetLinks = data.set_links.filter((setLink) => {
          const setName = normalizeSetName(setLink.set_name);

          // Check if this set should be removed
          const shouldRemove = emptySetsToRemove.some((emptySet) => {
            const emptySetName = normalizeSetName(emptySet.name);

            return emptySetName === setName && emptySet.year === fileYear;
          });

          if (shouldRemove) {
            console.log(`    ❌ Removing: ${setLink.set_name}`);
            return false;
          }

          return true;
        });

        const removedCount = originalCount - filteredSetLinks.length;

        if (removedCount > 0) {
        // Update the data
          data.set_links = filteredSetLinks;
          data.total_sets = filteredSetLinks.length;

          // Write back to file
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

          console.log(`  ✅ Modified: Removed ${removedCount} sets (${originalCount} → ${filteredSetLinks.length})`);
          totalFilesModified++;
          totalSetsRemoved += removedCount;
        } else {
          console.log('  ✅ No changes needed');
        }
      }
    } catch (error) {
      console.log(`  ❌ Error processing ${filePath}: ${error.message}`);
    }

    console.log('');
  }

  console.log('=== SUMMARY ===');
  console.log(`Files modified: ${totalFilesModified}`);
  console.log(`Total sets removed: ${totalSetsRemoved}`);
  console.log(`Files processed: ${allSetsFiles.length}`);

  if (totalSetsRemoved > 0) {
    console.log('\n🎉 Empty sets have been removed from *_all_sets.json files!');
    console.log('💡 Run the import script again to verify the database no longer contains these empty sets.');
  }
}

removeEmptySetsFromAllSetsFiles().catch(console.error);
