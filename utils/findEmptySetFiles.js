const fs = require('fs');
const path = require('path');

async function findEmptySetFiles() {
    const dataPath = path.join(__dirname, 'data', 'sets');
    const emptySets = [];
    
    console.log('🔍 Searching for sets with 0 total_graded cards...\n');
    
    // Function to recursively find all JSON files
    function findJsonFiles(dir) {
        const files = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                files.push(...findJsonFiles(fullPath));
            } else if (item.endsWith('.json')) {
                files.push(fullPath);
            }
        }
        return files;
    }
    
    const allFiles = findJsonFiles(dataPath);
    
    for (const filePath of allFiles) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Check all_sets files for empty set references
            if (data.set_links && Array.isArray(data.set_links)) {
                for (const setLink of data.set_links) {
                    if (setLink.total_graded === "0" || setLink.total_graded === 0) {
                        emptySets.push({
                            file: filePath,
                            type: 'all_sets_reference',
                            setName: setLink.set_name,
                            url: setLink.url,
                            id: setLink.id,
                            totalGraded: setLink.total_graded
                        });
                    }
                }
            }
            
            // Check individual set files
            if (data.pokemon_sets && Array.isArray(data.pokemon_sets)) {
                for (const set of data.pokemon_sets) {
                    if (set.total_graded === "0" || set.total_graded === 0) {
                        emptySets.push({
                            file: filePath,
                            type: 'individual_set_file',
                            setName: set.set_name,
                            url: set.url,
                            id: set.id,
                            totalGraded: set.total_graded
                        });
                    }
                }
            }
            
            // Check if entire file represents an empty set
            if (data.set_name && (data.total_graded === "0" || data.total_graded === 0)) {
                emptySets.push({
                    file: filePath,
                    type: 'single_empty_set',
                    setName: data.set_name,
                    url: data.url,
                    id: data.id,
                    totalGraded: data.total_graded
                });
            }
            
        } catch (error) {
            console.log(`❌ Error reading ${filePath}: ${error.message}`);
        }
    }
    
    console.log(`📊 RESULTS: Found ${emptySets.length} empty sets across all files\n`);
    
    // Group by type
    const byType = emptySets.reduce((acc, set) => {
        if (!acc[set.type]) acc[set.type] = [];
        acc[set.type].push(set);
        return acc;
    }, {});
    
    for (const [type, sets] of Object.entries(byType)) {
        console.log(`🗂️  ${type.toUpperCase()}: ${sets.length} empty sets`);
        sets.forEach(set => {
            console.log(`   - ${set.setName} (ID: ${set.id}) in ${path.basename(set.file)}`);
        });
        console.log('');
    }
    
    // Write results to file
    fs.writeFileSync('empty_sets_analysis.json', JSON.stringify(emptySets, null, 2));
    console.log('📝 Full analysis saved to empty_sets_analysis.json');
    
    return emptySets;
}

findEmptySetFiles().catch(console.error);