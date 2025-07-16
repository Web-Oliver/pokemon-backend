const fs = require('fs');
const path = require('path');

async function verifyEmptySetFiles() {
    // Read the analysis file to get the sets we removed
    const emptySetData = JSON.parse(fs.readFileSync('empty_sets_analysis.json', 'utf8'));
    
    console.log('🔍 VERIFYING: Checking individual set files for removed empty sets...\n');
    
    let totalChecked = 0;
    let actuallyEmpty = 0;
    let notEmpty = 0;
    let fileNotFound = 0;
    
    // Get unique set IDs that were removed
    const removedSets = emptySetData.filter(set => set.type === 'all_sets_reference');
    
    for (const removedSet of removedSets) {
        totalChecked++;
        
        // Try to find the individual set file
        const setId = removedSet.id;
        const year = path.dirname(removedSet.file).split('/').pop();
        
        // Common patterns for individual set files
        const possiblePaths = [
            path.join(__dirname, 'data', 'sets', year, `${setId}.json`),
            path.join(__dirname, 'data', 'sets', year, `${removedSet.setName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}.json`),
            path.join(__dirname, 'data', 'sets', year, `${removedSet.setName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_${setId}.json`)
        ];
        
        // Also search for any file containing this set ID
        const yearDir = path.join(__dirname, 'data', 'sets', year);
        let foundFile = null;
        
        if (fs.existsSync(yearDir)) {
            const files = fs.readdirSync(yearDir);
            for (const file of files) {
                if (file.endsWith('.json') && !file.includes('_all_sets')) {
                    const filePath = path.join(yearDir, file);
                    try {
                        const content = fs.readFileSync(filePath, 'utf8');
                        if (content.includes(`"id": "${setId}"`)) {
                            foundFile = filePath;
                            break;
                        }
                    } catch (e) {
                        // Skip files that can't be read
                    }
                }
            }
        }
        
        // Try the possible paths first
        if (!foundFile) {
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    foundFile = possiblePath;
                    break;
                }
            }
        }
        
        if (!foundFile) {
            console.log(`❓ File not found for: ${removedSet.setName} (ID: ${setId})`);
            fileNotFound++;
            continue;
        }
        
        try {
            const data = JSON.parse(fs.readFileSync(foundFile, 'utf8'));
            
            // Count cards in the set
            let cardCount = 0;
            
            if (data.cards && Array.isArray(data.cards)) {
                cardCount = data.cards.length;
            } else if (data.pokemon_data && Array.isArray(data.pokemon_data)) {
                cardCount = data.pokemon_data.length;
            } else if (data.set_data && data.set_data.cards) {
                cardCount = data.set_data.cards.length;
            }
            
            if (cardCount === 0) {
                console.log(`✅ CONFIRMED EMPTY: ${removedSet.setName} (${cardCount} cards) - ${path.basename(foundFile)}`);
                actuallyEmpty++;
            } else {
                console.log(`❌ NOT EMPTY: ${removedSet.setName} has ${cardCount} cards! - ${path.basename(foundFile)}`);
                console.log(`   File: ${foundFile}`);
                notEmpty++;
            }
            
        } catch (error) {
            console.log(`❌ Error reading ${foundFile}: ${error.message}`);
        }
    }
    
    console.log(`\n📊 VERIFICATION RESULTS:`);
    console.log(`   Total checked: ${totalChecked}`);
    console.log(`   Actually empty: ${actuallyEmpty}`);
    console.log(`   NOT empty (ERROR): ${notEmpty}`);
    console.log(`   File not found: ${fileNotFound}`);
    
    if (notEmpty > 0) {
        console.log(`\n⚠️  WARNING: ${notEmpty} sets were removed but are NOT actually empty!`);
        console.log(`   These sets should be restored to the *_all_sets.json files.`);
    } else {
        console.log(`\n✅ All verified sets are actually empty - removal was correct!`);
    }
}

verifyEmptySetFiles().catch(console.error);