/**
 * Inspect Database Script
 * This script will show what's actually in the database
 */

const mongoose = require('mongoose');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const SealedProduct = require('../models/SealedProduct');
const Card = require('../models/Card');
const Set = require('../models/Set');
require('dotenv').config();

const inspectDatabase = async () => {
  try {
    console.log('🔍 Inspecting database contents...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-collection';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Count all collections
    const [psaCount, rawCount, sealedCount, cardCount, setCount] = await Promise.all([
      PsaGradedCard.countDocuments(),
      RawCard.countDocuments(),
      SealedProduct.countDocuments(),
      Card.countDocuments(),
      Set.countDocuments()
    ]);
    
    console.log('\n📊 COLLECTION COUNTS:');
    console.log(`PSA Graded Cards: ${psaCount}`);
    console.log(`Raw Cards: ${rawCount}`);
    console.log(`Sealed Products: ${sealedCount}`);
    console.log(`Reference Cards: ${cardCount}`);
    console.log(`Reference Sets: ${setCount}`);
    
    // Sample some PSA cards with populated data
    if (psaCount > 0) {
      console.log('\n🎯 PSA GRADED CARDS SAMPLE:');
      const psaCards = await PsaGradedCard.find()
        .populate({
          path: 'cardId',
          populate: {
            path: 'setId',
            model: 'Set',
          },
        })
        .limit(5);
      
      psaCards.forEach((card, index) => {
        console.log(`\n--- PSA Card ${index + 1} ---`);
        console.log(`ID: ${card._id}`);
        console.log(`Grade: ${card.grade}`);
        console.log(`Price: ${card.myPrice}`);
        console.log(`CardId: ${card.cardId?._id || 'NULL'}`);
        console.log(`Card Name: ${card.cardId?.cardName || 'NULL'}`);
        console.log(`Set Name: ${card.cardId?.setId?.setName || 'NULL'}`);
        console.log(`Images: ${card.images?.length || 0}`);
      });
    }
    
    // Sample some raw cards
    if (rawCount > 0) {
      console.log('\n🎯 RAW CARDS SAMPLE:');
      const rawCards = await RawCard.find()
        .populate({
          path: 'cardId',
          populate: {
            path: 'setId',
            model: 'Set',
          },
        })
        .limit(3);
      
      rawCards.forEach((card, index) => {
        console.log(`\n--- Raw Card ${index + 1} ---`);
        console.log(`ID: ${card._id}`);
        console.log(`Condition: ${card.condition}`);
        console.log(`Price: ${card.myPrice}`);
        console.log(`CardId: ${card.cardId?._id || 'NULL'}`);
        console.log(`Card Name: ${card.cardId?.cardName || 'NULL'}`);
        console.log(`Set Name: ${card.cardId?.setId?.setName || 'NULL'}`);
      });
    }
    
    // Sample some sealed products
    if (sealedCount > 0) {
      console.log('\n🎯 SEALED PRODUCTS SAMPLE:');
      const sealedProducts = await SealedProduct.find().limit(3);
      
      sealedProducts.forEach((product, index) => {
        console.log(`\n--- Sealed Product ${index + 1} ---`);
        console.log(`ID: ${product._id}`);
        console.log(`Name: ${product.name || 'NULL'}`);
        console.log(`Category: ${product.category || 'NULL'}`);
        console.log(`Set Name: ${product.setName || 'NULL'}`);
        console.log(`Price: ${product.myPrice}`);
      });
    }
    
    // Sample reference cards
    if (cardCount > 0) {
      console.log('\n🎯 REFERENCE CARDS SAMPLE:');
      const cards = await Card.find()
        .populate('setId')
        .limit(3);
      
      cards.forEach((card, index) => {
        console.log(`\n--- Reference Card ${index + 1} ---`);
        console.log(`ID: ${card._id}`);
        console.log(`Card Name: ${card.cardName || 'NULL'}`);
        console.log(`Base Name: ${card.baseName || 'NULL'}`);
        console.log(`Pokemon Number: ${card.pokemonNumber || 'NULL'}`);
        console.log(`Set Name: ${card.setId?.setName || 'NULL'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error inspecting database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
inspectDatabase();