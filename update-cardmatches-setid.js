import {MongoClient} from 'mongodb';

async function updateCardMatchesWithSetId() {
    const client = new MongoClient('mongodb://localhost:27017/pokemon_collection');

    try {
        await client.connect();
        console.log('Connected to MongoDB');

        const db = client.db('pokemon_collection');
        const scansCollection = db.collection('gradedcardscans');
        const cardsCollection = db.collection('cards');

        // Find all scans that have cardMatches
        const scansWithMatches = await scansCollection.find({
            cardMatches: { $exists: true, $ne: [] }
        }).toArray();

        console.log(`Found ${scansWithMatches.length} scans with cardMatches to update`);

        let updatedCount = 0;

        for (const scan of scansWithMatches) {
            let needsUpdate = false;
            const updatedMatches = [];

            for (const match of scan.cardMatches) {
                // Check if setId is missing
                if (!match.setId) {
                    needsUpdate = true;

                    // Find the card to get its setId
                    const card = await cardsCollection.findOne({ _id: match.cardId });

                    if (card && card.setId) {
                        // Add setId to the match
                        const updatedMatch = {
                            ...match,
                            setId: card.setId
                        };
                        updatedMatches.push(updatedMatch);
                        console.log(`Adding setId to ${match.cardName} - setId: ${card.setId}`);
                    } else {
                        // Keep the original match if we can't find setId
                        updatedMatches.push(match);
                        console.log(`⚠️  Could not find setId for card: ${match.cardName} (${match.cardId})`);
                    }
                } else {
                    // Keep the original match if setId already exists
                    updatedMatches.push(match);
                }
            }

            // Update the scan if we made changes
            if (needsUpdate) {
                await scansCollection.updateOne(
                    { _id: scan._id },
                    { $set: { cardMatches: updatedMatches } }
                );
                updatedCount++;
                console.log(`✅ Updated scan ${scan._id} with setId fields`);
            }
        }

        console.log(`\n🎉 Successfully updated ${updatedCount} scans with setId fields in cardMatches`);

    } catch (error) {
        console.error('Error updating cardMatches:', error);
    } finally {
        await client.close();
    }
}

updateCardMatchesWithSetId();