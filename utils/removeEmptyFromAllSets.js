const fs = require('fs');
const path = require('path');

async function removeEmptyFromAllSets() {
  // Read the analysis file we just created
  const emptySetData = JSON.parse(fs.readFileSync('empty_sets_analysis.json', 'utf8'));

  // Filter for only all_sets_reference entries
  const emptySetsInAllFiles = emptySetData.filter((set) => set.type === 'all_sets_reference');

  console.log(`🗑️  Removing ${emptySetsInAllFiles.length} empty sets from *_all_sets.json files...\n`);

  // Group by file
  const fileGroups = emptySetsInAllFiles.reduce((acc, set) => {
    if (!acc[set.file]) {
      acc[set.file] = [];
    }
    acc[set.file].push(set);
    return acc;
  }, {});

  let totalRemoved = 0;
  let filesModified = 0;

  for (const [filePath, emptySets] of Object.entries(fileGroups)) {
    try {
      console.log(`📝 Processing ${path.basename(filePath)}...`);

      // Read the file
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      if (!data.set_links || !Array.isArray(data.set_links)) {
        console.log('   ⚠️  Skipping - not a valid all_sets file format');
      } else {
        const originalCount = data.set_links.length;

        // Get IDs of empty sets to remove
        const emptySetIds = new Set(emptySets.map((set) => set.id));

        // Filter out empty sets
        data.set_links = data.set_links.filter((setLink) => {
          const shouldRemove = emptySetIds.has(setLink.id);

          if (shouldRemove) {
            console.log(`   🗑️  Removing: ${setLink.set_name} (ID: ${setLink.id})`);
          }
          return !shouldRemove;
        });

        const newCount = data.set_links.length;
        const removedCount = originalCount - newCount;

        // Update total_sets count
        data.total_sets = newCount;

        // Write back to file
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');

        console.log(`   ✅ Removed ${removedCount} empty sets (${originalCount} → ${newCount})`);
        totalRemoved += removedCount;
        filesModified++;
      }
    } catch (error) {
      console.log(`   ❌ Error processing ${filePath}: ${error.message}`);
    }

    console.log('');
  }

  console.log('🎉 CLEANUP COMPLETE:');
  console.log(`   📁 Files modified: ${filesModified}`);
  console.log(`   🗑️  Total empty sets removed: ${totalRemoved}`);
  console.log(`   📊 Original empty sets found: ${emptySetsInAllFiles.length}`);

  // Also clean up the individual file with empty sets (TEST file)
  const testFile = path.join(__dirname, 'data/sets/1999/1999_pokemon_sets_TEST.json');

  if (fs.existsSync(testFile)) {
    console.log(`\\n🧪 Cleaning up TEST file: ${testFile}`);
    const testData = JSON.parse(fs.readFileSync(testFile, 'utf8'));

    if (testData.pokemon_sets) {
      const originalTestCount = testData.pokemon_sets.length;

      testData.pokemon_sets = testData.pokemon_sets.filter((set) => set.total_graded !== '0' && set.total_graded !== 0);
      const newTestCount = testData.pokemon_sets.length;

      testData.total_pokemon_sets = newTestCount;

      fs.writeFileSync(testFile, JSON.stringify(testData, null, 2), 'utf8');
      console.log(`   ✅ TEST file: ${originalTestCount - newTestCount} empty sets removed`);
    }
  }
}

removeEmptyFromAllSets().catch(console.error);
