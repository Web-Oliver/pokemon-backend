const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Logger = require('./utils/Logger');

require('dotenv').config();

// Import models
const PsaGradedCard = require('./models/PsaGradedCard');
const Card = require('./models/Card');
const Set = require('./models/Set');

Logger.section('PSA Graded Cards Import', 'IMPROVED PSA Graded Cards Import Script with Enhanced Set Matching');

async function findCardByNameAndSet(cardName, setName, pokemonNumber) {
    Logger.operationStart('FIND_CARD_BY_NAME_SET', 'Searching for card in database', {
        cardName,
        setName,
        pokemonNumber
    });
    
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
        Logger.warn('Set not found in name mappings', { setName, mappedSetName });
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
        // Show available similar sets for debugging
        const similarSets = await Set.find({ 
            setName: { $regex: new RegExp(setName.split(' ').slice(-2).join('|'), 'i') } 
        }).limit(3);

        Logger.warn('Set not found after all search strategies', {
            originalSetName: setName,
            mappedSetName,
            similarSetsFound: similarSets.map(s => s.setName)
        });
        return null;
    }
    
    Logger.info('Found matching set', { setName: set.setName, setId: set._id });
    
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
            Logger.info('Found matching card', {
                cardName: card.cardName,
                cardId: card._id,
                strategy: i + 1,
                pokemonNumber: card.pokemonNumber
            });
            break;
        }
    }
    
    if (!card) {
        const sampleCards = await Card.find({ setId: set._id }).limit(5);

        Logger.warn('Card not found in set', {
            cardName,
            setName,
            setId: set._id,
            availableCards: sampleCards.map(c => `${c.cardName} (#${c.pokemonNumber})`)
        });
        return null;
    }
    
    Logger.operationSuccess('FIND_CARD_BY_NAME_SET', 'Successfully found card match', {
        cardName: card.cardName,
        cardId: card._id,
        setName: set.setName,
        pokemonNumber: card.pokemonNumber
    });
    
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
            Logger.debug('Image copied successfully', {
                originalName: path.basename(imagePath),
                newFileName,
                targetPath: `/uploads/${newFileName}`
            });
            return `/uploads/${newFileName}`;
        } 
            Logger.warn('Source image not found', { sourceImagePath });
            return null;
        
        
    } catch (error) {
        Logger.operationError('IMAGE_COPY_FAILED', 'Failed to copy image file', error, {
            sourceImagePath,
            targetImagePath,
            newFileName
        });
        return null;
    }
}

async function importPsaCards() {
    try {
        Logger.operationStart('PSA_CARDS_IMPORT', 'Starting PSA graded cards import process');
        
        await mongoose.connect(process.env.MONGO_URI);
        Logger.info('Connected to MongoDB for PSA cards import');
        
        // Read backup data
        const backupData = JSON.parse(fs.readFileSync('./collection-backup.json', 'utf8'));

        Logger.info('Backup data loaded', { totalCardsToImport: backupData.length });
        
        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < backupData.length; i++) {
            const cardData = backupData[i];

            Logger.info('Processing PSA card', {
                current: i + 1,
                total: backupData.length,
                title: cardData.title,
                progress: `${Math.round(((i + 1) / backupData.length) * 100)}%`
            });
            
            try {
                // Extract card information from metadata
                const { cardName, setName, grade, pokemonNumber } = cardData.metadata;
                
                // Find matching card in database
                const matchedCard = await findCardByNameAndSet(cardName, setName, pokemonNumber);
                
                if (!matchedCard) {
                    Logger.warn('Skipping card - no database match found', {
                        cardName,
                        setName,
                        pokemonNumber,
                        title: cardData.title
                    });
                    skipCount++;
                    // eslint-disable-next-line no-continue
                    continue;
                }
                
                // Check if card already exists in collection
                const existingPsaCard = await PsaGradedCard.findOne({
                    cardId: matchedCard._id,
                    grade: parseInt(grade, 10)
                });
                
                if (existingPsaCard) {
                    Logger.debug('Skipping card - already exists in collection', {
                        cardId: matchedCard._id,
                        grade: parseInt(grade, 10),
                        existingCardId: existingPsaCard._id
                    });
                    skipCount++;
                    // eslint-disable-next-line no-continue
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
                    grade: parseInt(grade, 10),
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
                Logger.info('Successfully imported PSA card', {
                    cardName,
                    grade: parseInt(grade, 10),
                    cardId: matchedCard._id,
                    psaCardId: newPsaCard._id,
                    imagesCount: processedImages.length,
                    price: cardData.price
                });
                successCount++;
                
            } catch (error) {
                Logger.operationError('PSA_CARD_PROCESSING_ERROR', 'Error processing individual PSA card', error, {
                    cardIndex: i + 1,
                    title: cardData.title,
                    metadata: cardData.metadata
                });
                errorCount++;
            }
        }
        
        // Verify final count
        const finalCount = await PsaGradedCard.countDocuments({});
        
        Logger.operationSuccess('PSA_CARDS_IMPORT_COMPLETE', 'PSA cards import completed', {
            summary: {
                totalProcessed: backupData.length,
                successfullyImported: successCount,
                skipped: skipCount,
                errors: errorCount,
                finalDatabaseCount: finalCount
            },
            successRate: `${Math.round((successCount / backupData.length) * 100)}%`
        });
        
    } catch (error) {
        Logger.operationError('PSA_CARDS_IMPORT_FAILED', 'PSA cards import process failed', error);
    } finally {
        await mongoose.disconnect();
        Logger.info('Disconnected from MongoDB');
    }
}

// Run the import
importPsaCards();