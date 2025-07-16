const mongoose = require('mongoose');
require('dotenv').config();

async function checkOrphanedCards() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const SetModel = require('./models/Set');
    const Card = require('./models/Card');
    
    console.log('=== CHECKING FOR ORPHANED CARDS ===');
    console.log('(Cards that reference sets that no longer exist)\n');
    
    // Get all cards and all sets
    const allCards = await Card.find({});
    const allSets = await SetModel.find({});
    
    console.log(`Total cards in database: ${allCards.length}`);
    console.log(`Total sets in database: ${allSets.length}\n`);
    
    // Create a set of valid set IDs for quick lookup
    const validSetIds = new Set();
    allSets.forEach(set => validSetIds.add(set._id.toString()));
    
    // Find orphaned cards
    const orphanedCards = [];
    const setReferenceCounts = new Map();
    
    for (const card of allCards) {
      const setIdString = card.setId.toString();
      
      // Count cards per set
      if (setReferenceCounts.has(setIdString)) {
        setReferenceCounts.set(setIdString, setReferenceCounts.get(setIdString) + 1);
      } else {
        setReferenceCounts.set(setIdString, 1);
      }
      
      // Check if card references a valid set
      if (!validSetIds.has(setIdString)) {
        orphanedCards.push({
          cardId: card._id,
          cardName: card.cardName,
          baseName: card.baseName,
          pokemonNumber: card.pokemonNumber,
          variety: card.variety,
          setId: card.setId,
          psaTotalGradedForCard: card.psaTotalGradedForCard
        });
      }
    }
    
    console.log(`🔍 ORPHANED CARDS FOUND: ${orphanedCards.length}`);
    
    if (orphanedCards.length > 0) {
      console.log('\n❌ ORPHANED CARDS (cards without valid sets):');
      console.log('================================================');
      
      // Group orphaned cards by set ID
      const orphanedBySet = new Map();
      for (const card of orphanedCards) {
        const setId = card.setId.toString();
        if (orphanedBySet.has(setId)) {
          orphanedBySet.get(setId).push(card);
        } else {
          orphanedBySet.set(setId, [card]);
        }
      }
      
      for (const [setId, cards] of orphanedBySet) {
        console.log(`\nSet ID: ${setId} (${cards.length} orphaned cards)`);
        console.log('Cards:');
        cards.slice(0, 5).forEach(card => {
          console.log(`  - ${card.cardName} (${card.pokemonNumber}) [PSA Total: ${card.psaTotalGradedForCard}]`);
        });
        if (cards.length > 5) {
          console.log(`  ... and ${cards.length - 5} more cards`);
        }
      }
      
      console.log('\n🔧 RECOMMENDED ACTION:');
      console.log('These orphaned cards should be removed from the database');
      console.log('or their set references should be updated to valid sets.');
    } else {
      console.log('✅ No orphaned cards found! All cards have valid set references.');
    }
    
    // Check for sets without cards
    console.log('\n=== CHECKING FOR SETS WITHOUT CARDS ===');
    
    const setsWithoutCards = [];
    for (const set of allSets) {
      const setIdString = set._id.toString();
      const cardCount = setReferenceCounts.get(setIdString) || 0;
      
      if (cardCount === 0) {
        setsWithoutCards.push({
          setId: set._id,
          setName: set.setName,
          year: set.year,
          totalCardsInSet: set.totalCardsInSet,
          setUrl: set.setUrl
        });
      }
    }
    
    console.log(`🔍 SETS WITHOUT CARDS FOUND: ${setsWithoutCards.length}`);
    
    if (setsWithoutCards.length > 0) {
      console.log('\n❌ SETS WITHOUT CARDS:');
      console.log('======================');
      setsWithoutCards.forEach(set => {
        console.log(`- ${set.setName} (${set.year}) - Expected: ${set.totalCardsInSet} cards`);
        console.log(`  Set ID: ${set.setId}`);
        console.log(`  URL: ${set.setUrl}`);
        console.log('');
      });
      
      console.log('🔧 RECOMMENDED ACTION:');
      console.log('These sets should be removed as they have no cards in the database.');
    } else {
      console.log('✅ No sets without cards found! All sets have at least one card.');
    }
    
    // Summary statistics
    console.log('\n=== SUMMARY STATISTICS ===');
    console.log(`Total cards: ${allCards.length}`);
    console.log(`Total sets: ${allSets.length}`);
    console.log(`Orphaned cards: ${orphanedCards.length}`);
    console.log(`Sets without cards: ${setsWithoutCards.length}`);
    console.log(`Average cards per set: ${(allCards.length / allSets.length).toFixed(2)}`);
    
    // Data integrity check
    if (orphanedCards.length === 0 && setsWithoutCards.length === 0) {
      console.log('\n🎉 DATABASE INTEGRITY: PERFECT!');
      console.log('All cards have valid set references and all sets have cards.');
    } else {
      console.log('\n⚠️  DATABASE INTEGRITY: ISSUES FOUND');
      console.log('Some cleanup may be required.');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('Error checking orphaned cards:', error);
    process.exit(1);
  }
}

checkOrphanedCards();