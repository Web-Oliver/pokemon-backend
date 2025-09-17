#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function findJsonFiles(dir) {
    const files = [];

    function scanDirectory(currentDir) {
        const items = fs.readdirSync(currentDir);

        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (item.endsWith('.json') && !item.includes('_all_sets.json')) {
                files.push(fullPath);
            }
        }
    }

    scanDirectory(dir);
    return files;
}

function findJsonAllSetFiles(dir) {
    const files = [];

    function scanDirectory(currentDir) {
        const items = fs.readdirSync(currentDir);

        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (item.endsWith('_all_sets.json')) {
                files.push(fullPath);
            }
        }
    }

    scanDirectory(dir);
    return files;
}

function checkTotalPopulation(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        if (!data.cards || !Array.isArray(data.cards)) {
            // Return set_name even if no card data, as it might be a valid set without population data.
            return {hasData: false, psaTotal: 0, setName: data.set_name};
        }

        const totalPopCard = data.cards.find((card) =>
            card.card_name === 'TOTAL POPULATION'
            && card.base_name === 'TOTAL POPULATION');

        if (!totalPopCard || !totalPopCard.psa_grades) {
            // Return set_name even if no total population card, might be valid otherwise
            return {hasData: false, psaTotal: 0, setName: data.set_name};
        }

        const psaTotal = totalPopCard.psa_grades.psa_total || 0;

        return {hasData: true, psaTotal, setName: data.set_name};
    } catch (error) {
        console.error(`Error reading or parsing file ${filePath}: ${error.message}`);
        return {hasData: false, psaTotal: 0, setName: null}; // Return null setName on error
    }
}

function removeFile(filePath) {
    try {
        fs.unlinkSync(filePath);
        console.log(`  Removed: ${path.basename(filePath)}`);
        return true;
    } catch (error) {
        console.error(`Error removing file ${filePath}: ${error.message}`);
        return false;
    }
}

// Updated function to synchronize _all_sets.json files based on currently existing sets
function updateAllSetsFile(allSetsFilePath, existingSetNames) {
    try {
        const content = fs.readFileSync(allSetsFilePath, 'utf8');
        const data = JSON.parse(content);

        if (data.set_links && Array.isArray(data.set_links)) {
            const initialLength = data.set_links.length;
            const originalSetLinks = [...data.set_links]; // Create a copy for comparison

            data.set_links = data.set_links.filter((link) =>
                existingSetNames.has(link.set_name));

            if (data.set_links.length < initialLength) {
                fs.writeFileSync(allSetsFilePath, JSON.stringify(data, null, 2), 'utf8');
                const removedLinks = originalSetLinks.filter((link) => !existingSetNames.has(link.set_name));

                console.log(`  Updated ${path.basename(allSetsFilePath)}: Removed ${removedLinks.length} stale entries.`);
                removedLinks.forEach((link) => console.log(`    - "${link.set_name}"`));
                return true;
            }
            console.log(`  No stale entries found in ${path.basename(allSetsFilePath)}.`);
        }
        return false;
    } catch (error) {
        console.error(`Error updating all_sets file ${allSetsFilePath}: ${error.message}`);
        return false;
    }
}

function main() {
    const args = process.argv.slice(2);

    if (args.length < 1) {
        console.log('Usage: node remove_low_population_sets.js <directory_path> [threshold]');
        process.exit(1);
    }

    const setsDir = args[0];
    const threshold = args.length > 1 ? parseInt(args[1], 10) : 200;

    if (!fs.existsSync(setsDir)) {
        console.error(`Error: Directory not found at ${setsDir}`);
        process.exit(1);
    }

    console.log(`Base directory: ${setsDir}`);
    console.log(`Population threshold: ${threshold}`);

    // Step 1: Find all individual JSON files and all _all_sets.json files
    const allJsonFiles = findJsonFiles(setsDir);

    console.log(`Found ${allJsonFiles.length} individual JSON files initially.`);

    const allSetFiles = findJsonAllSetFiles(setsDir);

    console.log(`Found ${allSetFiles.length} _all_sets.json files.`);

    // Step 2: Process individual JSON files to identify sets for removal
    const setsToProcess = [];

    for (const filePath of allJsonFiles) {
        const {hasData, psaTotal, setName} = checkTotalPopulation(filePath);

        if (setName) { // Only add if set_name was successfully retrieved
            setsToProcess.push({filePath, hasData, psaTotal, setName});
        } else {
            console.warn(`Skipping file ${path.basename(filePath)} due to error or missing set_name.`);
        }
    }

    const setsToRemove = setsToProcess.filter((set) => set.hasData && set.psaTotal < threshold);

    console.log(`\nIdentified ${setsToProcess.length} sets for population check.`);
    console.log(`Found ${setsToRemove.length} sets with psa_total < ${threshold} targeted for removal.`);

    // Step 3: Remove individual set files with low population
    if (setsToRemove.length > 0) {
        console.log('\nRemoving individual set files with low population...');
        let removedCount = 0;

        for (const {filePath} of setsToRemove) {
            if (removeFile(filePath)) {
                removedCount++;
            }
        }
        console.log(`\nSuccessfully removed ${removedCount} individual set files.`);
    } else {
        console.log(`\nNo individual set files found with psa_total < ${threshold} to remove based on current criteria.`);
    }

    // Step 4: Determine the names of all currently existing individual set files
    // This is crucial for synchronizing _all_sets.json, including cleaning up stale entries
    const finalExistingJsonFiles = findJsonFiles(setsDir); // Re-scan after removals
    const existingSetNames = new Set();

    for (const filePath of finalExistingJsonFiles) {
        const {setName} = checkTotalPopulation(filePath);

        if (setName) {
            existingSetNames.add(setName);
        } else {
            console.warn(`Could not get set_name for existing file ${path.basename(filePath)} during final scan.`);
        }
    }

    // Step 5: Synchronize _all_sets.json files
    console.log(`\nSynchronizing _all_sets.json files with ${existingSetNames.size} currently existing unique sets...`);
    for (const allSetsFilePath of allSetFiles) {
        updateAllSetsFile(allSetsFilePath, existingSetNames);
    }
    console.log('\nAll _all_sets.json files synchronized.');
}

if (require.main === module) {
    main();
}
