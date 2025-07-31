const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const ThumbnailService = require('../services/shared/thumbnailService');

// Import models
const SealedProduct = require('../models/SealedProduct');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');

/**
 * Script to generate thumbnails for existing images in the database
 * 
 * This script:
 * 1. Connects to MongoDB
 * 2. Finds all documents with images
 * 3. Generates thumbnails for existing image files
 * 4. Updates database records with thumbnail paths
 * 5. Reports progress and results
 */

class ExistingThumbnailGenerator {
  constructor() {
    this.stats = {
      processed: 0,
      thumbnailsGenerated: 0,
      thumbnailsSkipped: 0,
      errors: 0,
      missingFiles: 0
    };
    
    this.uploadsDir = path.join(__dirname, '../public/uploads');
  }

  /**
   * Connect to MongoDB
   */
  async connectDB() {
    try {
      // Load environment variables
      require('dotenv').config();
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_collection';
      await mongoose.connect(mongoUri);
      console.log('✅ Connected to MongoDB:', mongoUri);
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      process.exit(1);
    }
  }

  /**
   * Check if image file exists and is JPEG/PNG
   */
  isValidImageFile(imagePath) {
    if (!imagePath || !imagePath.startsWith('/uploads/')) {
      return false;
    }
    
    const filename = imagePath.replace('/uploads/', '');
    const fullPath = path.join(this.uploadsDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return false;
    }
    
    // Check if it's JPEG or PNG
    const ext = path.extname(filename).toLowerCase();
    return ext === '.jpg' || ext === '.jpeg' || ext === '.png';
  }

  /**
   * Check if thumbnail already exists
   */
  thumbnailExists(imagePath) {
    if (!imagePath) return false;
    
    const filename = imagePath.replace('/uploads/', '');
    const ext = path.extname(filename);
    const nameWithoutExt = path.basename(filename, ext);
    const thumbnailFilename = `${nameWithoutExt}-thumb${ext}`;
    const thumbnailPath = path.join(this.uploadsDir, thumbnailFilename);
    
    return fs.existsSync(thumbnailPath);
  }

  /**
   * Generate thumbnail for a single image
   */
  async generateSingleThumbnail(imagePath) {
    try {
      const filename = imagePath.replace('/uploads/', '');
      const fullPath = path.join(this.uploadsDir, filename);
      
      const thumbnailPath = await ThumbnailService.generateThumbnail(fullPath, filename);
      console.log(`  ✅ Generated thumbnail: ${thumbnailPath}`);
      this.stats.thumbnailsGenerated++;
      
      return thumbnailPath;
    } catch (error) {
      console.error(`  ❌ Failed to generate thumbnail for ${imagePath}:`, error.message);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Process images for a single document
   */
  async processDocumentImages(doc, modelName) {
    console.log(`\n📄 Processing ${modelName} document: ${doc._id}`);
    
    if (!doc.images || doc.images.length === 0) {
      console.log('  ℹ️  No images found');
      return;
    }

    const updatedImages = [];
    let hasUpdates = false;

    for (const imagePath of doc.images) {
      console.log(`  🖼️  Processing image: ${imagePath}`);
      
      // Skip if not a valid image file
      if (!this.isValidImageFile(imagePath)) {
        if (!imagePath.startsWith('/uploads/')) {
          console.log(`  ⚠️  Skipping external/invalid image: ${imagePath}`);
        } else {
          console.log(`  ❌ Missing file: ${imagePath}`);
          this.stats.missingFiles++;
        }
        updatedImages.push(imagePath);
        continue;
      }

      // Skip if thumbnail already exists
      if (this.thumbnailExists(imagePath)) {
        console.log(`  ⏭️  Thumbnail already exists, skipping`);
        updatedImages.push(imagePath);
        this.stats.thumbnailsSkipped++;
        continue;
      }

      // Generate thumbnail
      const thumbnailPath = await this.generateSingleThumbnail(imagePath);
      updatedImages.push(imagePath);
      
      // Mark that we have updates (even if thumbnail generation failed)
      hasUpdates = true;
    }

    this.stats.processed++;
    console.log(`  ✅ Processed ${doc.images.length} images for document ${doc._id}`);
  }

  /**
   * Process all documents for a given model
   */
  async processModel(Model, modelName) {
    console.log(`\n🔍 Processing ${modelName} collection...`);
    
    try {
      const docs = await Model.find({ images: { $exists: true, $ne: [] } });
      console.log(`📊 Found ${docs.length} ${modelName} documents with images`);
      
      for (const doc of docs) {
        await this.processDocumentImages(doc, modelName);
      }
      
      console.log(`✅ Completed processing ${modelName} collection`);
    } catch (error) {
      console.error(`❌ Error processing ${modelName}:`, error);
    }
  }

  /**
   * Main execution function
   */
  async run() {
    console.log('🚀 Starting thumbnail generation for existing images...\n');
    
    await this.connectDB();
    
    // Process all three models
    await this.processModel(SealedProduct, 'SealedProduct');
    await this.processModel(PsaGradedCard, 'PsaGradedCard');
    await this.processModel(RawCard, 'RawCard');
    
    // Print final statistics
    console.log('\n📊 FINAL STATISTICS:');
    console.log('==================');
    console.log(`Documents processed: ${this.stats.processed}`);
    console.log(`Thumbnails generated: ${this.stats.thumbnailsGenerated}`);
    console.log(`Thumbnails skipped (already exist): ${this.stats.thumbnailsSkipped}`);
    console.log(`Missing files: ${this.stats.missingFiles}`);
    console.log(`Errors: ${this.stats.errors}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Thumbnail generation completed!');
    process.exit(0);
  }
}

// Handle script execution
if (require.main === module) {
  const generator = new ExistingThumbnailGenerator();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n⏹️  Shutting down gracefully...');
    await mongoose.disconnect();
    process.exit(0);
  });
  
  // Run the script
  generator.run().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
}

module.exports = ExistingThumbnailGenerator;