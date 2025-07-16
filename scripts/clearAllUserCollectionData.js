/**
 * Clear All User Collection Data Script
 * This script will remove all user collection data from the database
 * Collections cleared:
 * - psagradedcards
 * - rawcards  
 * - sealedproducts
 * - auctions
 * - activities
 */

const mongoose = require('mongoose');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const SealedProduct = require('../models/SealedProduct');
const Auction = require('../models/Auction');
const { Activity } = require('../models/Activity');
require('dotenv').config();

const clearAllUserCollectionData = async () => {
  try {
    console.log('🔥 Starting complete user collection data cleanup...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_collection';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Count existing items
    const [psaCount, rawCount, sealedCount, auctionCount, activityCount] = await Promise.all([
      PsaGradedCard.countDocuments(),
      RawCard.countDocuments(),
      SealedProduct.countDocuments(),
      Auction.countDocuments(),
      Activity.countDocuments()
    ]);
    
    console.log(`📊 Found ${psaCount} PSA graded cards`);
    console.log(`📊 Found ${rawCount} raw cards`);
    console.log(`📊 Found ${sealedCount} sealed products`);
    console.log(`📊 Found ${auctionCount} auctions`);
    console.log(`📊 Found ${activityCount} activities`);
    
    const totalCount = psaCount + rawCount + sealedCount + auctionCount + activityCount;
    
    if (totalCount === 0) {
      console.log('✨ No user collection data to clear');
      return;
    }
    
    console.log(`⚠️  About to DELETE ${totalCount} total records from user collection`);
    console.log('⚠️  This action is IRREVERSIBLE!');
    
    // Delete all user collection data
    const [psaResult, rawResult, sealedResult, auctionResult, activityResult] = await Promise.all([
      PsaGradedCard.deleteMany({}),
      RawCard.deleteMany({}),
      SealedProduct.deleteMany({}),
      Auction.deleteMany({}),
      Activity.deleteMany({})
    ]);
    
    console.log(`🗑️  Deleted ${psaResult.deletedCount} PSA graded cards`);
    console.log(`🗑️  Deleted ${rawResult.deletedCount} raw cards`);
    console.log(`🗑️  Deleted ${sealedResult.deletedCount} sealed products`);
    console.log(`🗑️  Deleted ${auctionResult.deletedCount} auctions`);
    console.log(`🗑️  Deleted ${activityResult.deletedCount} activities`);
    
    // Verify deletion
    const [finalPsaCount, finalRawCount, finalSealedCount, finalAuctionCount, finalActivityCount] = await Promise.all([
      PsaGradedCard.countDocuments(),
      RawCard.countDocuments(),
      SealedProduct.countDocuments(),
      Auction.countDocuments(),
      Activity.countDocuments()
    ]);
    
    console.log(`📊 Remaining PSA graded cards: ${finalPsaCount}`);
    console.log(`📊 Remaining raw cards: ${finalRawCount}`);
    console.log(`📊 Remaining sealed products: ${finalSealedCount}`);
    console.log(`📊 Remaining auctions: ${finalAuctionCount}`);
    console.log(`📊 Remaining activities: ${finalActivityCount}`);
    
    const finalTotal = finalPsaCount + finalRawCount + finalSealedCount + finalAuctionCount + finalActivityCount;
    
    if (finalTotal === 0) {
      console.log('✅ All user collection data has been successfully cleared!');
      console.log('✅ Reference data (cards, sets, cardmarketreferenceproducts) preserved');
    } else {
      console.log('⚠️  Some collection data may still remain');
    }
    
  } catch (error) {
    console.error('❌ Error clearing user collection data:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
clearAllUserCollectionData();