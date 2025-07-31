const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

// Import models
const SealedProduct = require('../models/SealedProduct');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');

/**
 * Optional script to add thumbnail field to existing documents
 * This is only needed if you want to explicitly store thumbnail paths in the database
 * Currently, thumbnails are generated with predictable naming (-thumb suffix)
 */

class ThumbnailFieldUpdater {
  constructor() {
    this.uploadsDir = path.join(__dirname, '../public/uploads');
    this.stats = {
      processed: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
  }

  async connectDB() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-collection';
      await mongoose.connect(mongoUri);
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      process.exit(1);
    }
  }

  /**
   * Get thumbnail path for an image if it exists
   */
  getThumbnailPath(imagePath) {
    if (!imagePath || !imagePath.startsWith('/uploads/')) {
      return null;
    }
    
    const filename = imagePath.replace('/uploads/', '');
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    const thumbnailFilename = `${nameWithoutExt}-thumb${ext}`;
    const thumbnailPath = path.join(this.uploadsDir, thumbnailFilename);
    
    if (fs.existsSync(thumbnailPath)) {
      return `/uploads/${thumbnailFilename}`;
    }
    
    return null;
  }

  /**
   * Process documents for a model and add thumbnail fields
   */
  async processModel(Model, modelName) {
    console.log(`\n🔍 Processing ${modelName} collection...`);
    
    try {
      const docs = await Model.find({ images: { $exists: true, $ne: [] } });
      console.log(`📊 Found ${docs.length} ${modelName} documents with images`);
      
      for (const doc of docs) {
        console.log(`\n📄 Processing ${modelName} document: ${doc._id}`);
        
        // Check if document already has thumbnails field
        if (doc.thumbnails && doc.thumbnails.length > 0) {
          console.log('  ⏭️  Document already has thumbnails field, skipping');
          this.stats.skipped++;
          continue;
        }
        
        const thumbnails = [];
        
        for (const imagePath of doc.images) {
          const thumbnailPath = this.getThumbnailPath(imagePath);
          if (thumbnailPath) {
            thumbnails.push(thumbnailPath);
            console.log(`  ✅ Found thumbnail: ${thumbnailPath}`);
          } else {
            thumbnails.push(null); // Maintain array alignment
            console.log(`  ❌ No thumbnail found for: ${imagePath}`);
          }
        }
        
        try {
          // Add thumbnails field to document
          await Model.updateOne(
            { _id: doc._id },
            { $set: { thumbnails: thumbnails } }
          );
          
          console.log(`  ✅ Updated document with ${thumbnails.filter(t => t).length} thumbnails`);
          this.stats.updated++;
        } catch (updateError) {
          console.error(`  ❌ Failed to update document:`, updateError);
          this.stats.errors++;
        }
        
        this.stats.processed++;
      }
      
      console.log(`✅ Completed processing ${modelName} collection`);
    } catch (error) {
      console.error(`❌ Error processing ${modelName}:`, error);
    }
  }

  async run() {
    console.log('🚀 Starting thumbnail field update for existing documents...\n');
    console.log('ℹ️  This script adds a "thumbnails" array field to match existing images');
    console.log('ℹ️  Only run this if you want explicit thumbnail paths in the database\n');
    
    await this.connectDB();
    
    // Process all three models
    await this.processModel(SealedProduct, 'SealedProduct');
    await this.processModel(PsaGradedCard, 'PsaGradedCard');
    await this.processModel(RawCard, 'RawCard');
    
    // Print final statistics
    console.log('\n📊 FINAL STATISTICS:');
    console.log('==================');
    console.log(`Documents processed: ${this.stats.processed}`);
    console.log(`Documents updated: ${this.stats.updated}`);
    console.log(`Documents skipped: ${this.stats.skipped}`);
    console.log(`Errors: ${this.stats.errors}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Thumbnail field update completed!');
    process.exit(0);
  }
}

// Handle script execution
if (require.main === module) {
  const updater = new ThumbnailFieldUpdater();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down gracefully...');
    await mongoose.disconnect();
    process.exit(0);
  });
  
  // Run the script
  updater.run().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = ThumbnailFieldUpdater;