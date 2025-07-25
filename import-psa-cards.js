const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Import models
const PsaGradedCard = require('./models/PsaGradedCard');
const Card = require('./models/Card');
const Set = require('./models/Set');

console.log('🃏 IMPROVED PSA Graded Cards Import Script with Enhanced Set Matching');
console.log('=================================================================');

async function findCardByNameAndSet(cardName, setName, pokemonNumber) {
    console.log(`🔍 Searching for card: "${cardName}" in set: "${setName}" (Pokemon #${pokemonNumber})`);
    
    // Enhanced set name mapping for exact matches
    const setNameMappings = {
        'Pokemon Japanese Promo (2006)': 'Pokemon Japanese Promo (2006)',
        'Pokemon Japanese Sword Shield Shiny Star V': null, // No exact match found
        'Pokemon Japanese Neo 2 Promo (2000)': 'Pokemon Japanese Neo 2 Promo (2000)',
        'Pokemon Japanese Garchomp Half Deck (2012 140765)': 'Pokemon Japanese Garchomp Half Deck (2012 140765)',
        'Pokemon Black Star Promos (2005)': 'Pokemon Black Star Promos (2005)',
        'Pokemon Japanese Sun Moon Strength Expansion Pack Shining Legends': 'Pokemon Japanese Sun Moon Strength Expansion Pack Shining Legends',
        'Pokemon Japanese Promo Trainers Magazine (2002)': 'Pokemon Japanese Promo Trainers Magazine (2002)',
        'Pokemon Diamond Pearl Black Star Promo (2009)': 'Pokemon Diamond Pearl Black Star Promo (2009)',
        'Pokemon Japanese Flight of Legends': 'Pokemon Japanese Flight of Legends'
    };
    
    // Use mapped name if available
    const mappedSetName = setNameMappings[setName] || setName;
    
    if (mappedSetName === null) {
        console.log(`❌ Set not found in mapping: "${setName}"`);
        return null;
    }
    
    // First, find the set with improved search strategies
    let set = null;
    
    // Strategy 1: Exact match with mapped name
    set = await Set.findOne({ setName: mappedSetName });
    
    if (!set) {
        // Strategy 2: Case-insensitive exact match
        set = await Set.findOne({ setName: { $regex: new RegExp(`^${mappedSetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    }
    
    if (!set) {
        // Strategy 3: Remove Pokemon prefix and try again
        const withoutPokemon = mappedSetName.replace(/Pokemon\s+/i, '');

        set = await Set.findOne({ setName: { $regex: new RegExp(withoutPokemon, 'i') } });
    }
    
    if (!set) {
        // Strategy 4: Remove parentheses and try again
        const withoutParens = mappedSetName.replace(/\s*\([^)]*\)/g, '');

        set = await Set.findOne({ setName: { $regex: new RegExp(withoutParens, 'i') } });
    }
    
    if (!set) {
        console.log(`❌ Set not found after all strategies: "${setName}" (mapped to: "${mappedSetName}")`);
        console.log(`📝 Trying partial matches...`);
        
        // Show available similar sets for debugging
        const similarSets = await Set.find({ 
            setName: { $regex: new RegExp(setName.split(' ').slice(-2).join('|'), 'i') } 
        }).limit(3);

        if (similarSets.length > 0) {
            console.log(`📝 Similar sets found:`);
            similarSets.forEach(s => console.log(`   - ${s.setName}`));
        }
        return null;
    }
    
    console.log(`✅ Found set: "${set.setName}" (ID: ${set._id})`);
    
    // Now find the card in that set
    let card = null;
    
    // Try different search strategies
    const searchStrategies = [
        // Exact match with pokemon number
        { 
            setId: set._id, 
            cardName: { $regex: new RegExp(`^${cardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            pokemonNumber 
        },
        // Exact card name match
        { 
            setId: set._id, 
            cardName: { $regex: new RegExp(`^${cardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        },
        // Partial card name match with pokemon number
        { 
            setId: set._id, 
            cardName: { $regex: new RegExp(cardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
            pokemonNumber 
        },
        // Partial card name match
        { 
            setId: set._id, 
            cardName: { $regex: new RegExp(cardName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        },
        // Base name match (without variants)
        { 
            setId: set._id, 
            baseName: { $regex: new RegExp(cardName.split('-')[0].trim(), 'i') }
        }
    ];
    
    for (let i = 0; i < searchStrategies.length; i++) {
        card = await Card.findOne(searchStrategies[i]);
        if (card) {
            console.log(`✅ Found card using strategy ${i + 1}: "${card.cardName}" (ID: ${card._id})`);
            break;
        }
    }
    
    if (!card) {
        console.log(`❌ Card not found: "${cardName}" in set "${setName}"`);
        console.log(`📝 Available cards in set (first 5):`);
        const sampleCards = await Card.find({ setId: set._id }).limit(5);

        sampleCards.forEach(c => console.log(`   - ${c.cardName} (#${c.pokemonNumber})`));
        return null;
    }
    
    return card;
}

async function copyImageToPublicUploads(imagePath, newFileName) {
    const sourceImagePath = path.join(__dirname, 'backup-images', path.basename(imagePath));
    const targetDir = path.join(__dirname, 'public', 'uploads');
    const targetImagePath = path.join(targetDir, newFileName);
    
    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    try {
        if (fs.existsSync(sourceImagePath)) {
            fs.copyFileSync(sourceImagePath, targetImagePath);
            console.log(`📸 Image copied: ${path.basename(imagePath)} -> ${newFileName}`);
            return `/uploads/${newFileName}`;
        } 
            console.log(`⚠️ Image not found: ${sourceImagePath}`);
            return null;
        
    } catch (error) {
        console.log(`❌ Error copying image: ${error.message}`);
        return null;
    }
}

async function importPsaCards() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
        
        // Read backup data
        const backupData = JSON.parse(fs.readFileSync('./collection-backup.json', 'utf8'));

        console.log(`📊 Found ${backupData.length} PSA cards to import`);
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < backupData.length; i++) {
            const cardData = backupData[i];

            console.log(`\n🔄 Processing card ${i + 1}/${backupData.length}: ${cardData.title}`);
            
            try {
                // Extract card information from metadata
                const { cardName, setName, grade, pokemonNumber } = cardData.metadata;
                
                // Find matching card in database
                const matchedCard = await findCardByNameAndSet(cardName, setName, pokemonNumber);
                
                if (!matchedCard) {
                    console.log(`⏭️ Skipping card due to no match found`);
                    skipCount++;
                    continue;
                }
                
                // Check if card already exists in collection
                const existingPsaCard = await PsaGradedCard.findOne({
                    cardId: matchedCard._id,
                    grade: parseInt(grade)
                });
                
                if (existingPsaCard) {
                    console.log(`⏭️ Card already exists in collection, skipping`);
                    skipCount++;
                    continue;
                }
                
                // Process images
                const processedImages = [];

                if (cardData.imagePaths && cardData.imagePaths.length > 0) {
                    for (let j = 0; j < cardData.imagePaths.length; j++) {
                        const imagePath = cardData.imagePaths[j];
                        const imageExtension = path.extname(imagePath);
                        const newFileName = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${imageExtension}`;
                        
                        const copiedImagePath = await copyImageToPublicUploads(imagePath, newFileName);

                        if (copiedImagePath) {
                            processedImages.push(copiedImagePath);
                        }
                    }
                }
                
                // Create new PSA graded card
                const newPsaCard = new PsaGradedCard({
                    cardId: matchedCard._id,
                    grade: parseInt(grade),
                    images: processedImages,
                    myPrice: cardData.price,
                    priceHistory: [{
                        price: cardData.price,
                        date: new Date(),
                        source: 'Import from backup'
                    }],
                    dateAdded: new Date(),
                    sold: false
                });
                
                await newPsaCard.save();
                console.log(`✅ Successfully imported PSA ${grade} card: ${cardName}`);
                successCount++;
                
            } catch (error) {
                console.log(`❌ Error processing card: ${error.message}`);
                errorCount++;
            }
        }
        
        console.log(`\n📊 Import Summary:`);
        console.log(`✅ Successfully imported: ${successCount} cards`);
        console.log(`⏭️ Skipped: ${skipCount} cards`);
        console.log(`❌ Errors: ${errorCount} cards`);
        
        // Verify final count
        const finalCount = await PsaGradedCard.countDocuments({});

        console.log(`\n🎯 Total PSA cards in database: ${finalCount}`);
        
    } catch (error) {
        console.error('❌ Import failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
}

// Run the import
importPsaCards();