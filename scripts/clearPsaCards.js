/**
 * Clear PSA Cards Script
 * This script will remove all PSA graded cards from the database
 */

const mongoose = require('mongoose');
const PsaGradedCard = require('../models/PsaGradedCard');
require('dotenv').config();

const clearPsaCards = async () => {
  try {
    console.log('🔥 Starting PSA cards cleanup...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-collection';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Count existing PSA cards
    const initialCount = await PsaGradedCard.countDocuments();
    console.log(`📊 Found ${initialCount} PSA graded cards in the database`);
    
    if (initialCount === 0) {
      console.log('✨ No PSA graded cards to clear');
      return;
    }
    
    // Delete all PSA graded cards
    const deleteResult = await PsaGradedCard.deleteMany({});
    console.log(`🗑️  Deleted ${deleteResult.deletedCount} PSA graded cards`);
    
    // Verify deletion
    const finalCount = await PsaGradedCard.countDocuments();
    console.log(`📊 Remaining PSA graded cards: ${finalCount}`);
    
    if (finalCount === 0) {
      console.log('✅ All PSA graded cards have been successfully cleared!');
    } else {
      console.log('⚠️  Some PSA graded cards may still remain');
    }
    
  } catch (error) {
    console.error('❌ Error clearing PSA cards:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
clearPsaCards();