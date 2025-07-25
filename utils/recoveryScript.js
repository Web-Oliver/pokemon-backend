/**
 * Recovery Script for Pokemon Collection Backup
 * 
 * Recovers collection items from backup even when reference data has new IDs
 * after running all phases. Matches cards by name/set and products by name.
 * 
 * Following CLAUDE.md SOLID principles for maintainable recovery logic.
 */

const mongoose = require('mongoose');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

// Import models
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const SealedProduct = require('../models/SealedProduct');
const SetModel = require('../models/Set');
const Card = require('../models/Card');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');

/**
 * Recovery Service Configuration
 */
const RECOVERY_CONFIG = {
  dbName: process.env.MONGO_DB_NAME || 'pokemon_collection',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  tempDir: path.join(process.cwd(), 'recovery_temp')
};

class RecoveryService {
  constructor() {
    this.stats = {
      psaCardsRecovered: 0,
      rawCardsRecovered: 0,
      sealedProductsRecovered: 0,
      psaCardsFailed: 0,
      rawCardsFailed: 0,
      sealedProductsFailed: 0,
      errors: []
    };
  }

  /**
   * Main recovery function
   */
  async recoverFromBackup(backupId) {
    try {
      console.log(`🔄 Starting recovery from backup: ${backupId}`);
      
      // Find backup directory
      const backupDir = this.findBackupDirectory(backupId);

      if (!backupDir) {
        throw new Error(`Backup ${backupId} not found`);
      }

      console.log(`📁 Found backup at: ${backupDir}`);

      // Create temp directory for extraction
      await this.ensureDirectory(RECOVERY_CONFIG.tempDir);

      // Extract and recover each collection type
      await this.recoverPsaGradedCards(backupDir);
      await this.recoverRawCards(backupDir);
      await this.recoverSealedProducts(backupDir);

      // Clean up temp directory
      execSync(`rm -rf "${RECOVERY_CONFIG.tempDir}"`);

      console.log('\n✅ Recovery completed successfully!');
      this.printRecoveryStats();

      return {
        success: true,
        stats: this.stats
      };

    } catch (error) {
      console.error('❌ Recovery failed:', error.message);
      this.stats.errors.push(error.message);
      throw error;
    }
  }

  /**
   * Find backup directory by ID
   */
  findBackupDirectory(backupId) {
    const backupTypes = ['manual', 'daily', 'weekly', 'archive'];
    const baseDir = path.join(process.cwd(), 'backups');

    for (const type of backupTypes) {
      const typeDir = path.join(baseDir, type);

      if (fs.existsSync(typeDir)) {
        const backupDir = path.join(typeDir, backupId);

        if (fs.existsSync(backupDir)) {
          return backupDir;
        }
      }
    }
    return null;
  }

  /**
   * Recover PSA Graded Cards
   */
  async recoverPsaGradedCards(backupDir) {
    console.log('\n🔄 Recovering PSA Graded Cards...');
    
    const psaBackupPath = path.join(backupDir, 'psagradedcards', RECOVERY_CONFIG.dbName);
    const bsonFile = path.join(psaBackupPath, 'psagradedcards.bson.gz');

    if (!fs.existsSync(bsonFile)) {
      console.log('⚠️ No PSA graded cards backup found');
      return;
    }

    // Extract BSON data
    const tempBsonFile = path.join(RECOVERY_CONFIG.tempDir, 'psagradedcards.bson');

    execSync(`gunzip -c "${bsonFile}" > "${tempBsonFile}"`);

    // Convert BSON to JSON for processing
    const tempJsonFile = path.join(RECOVERY_CONFIG.tempDir, 'psagradedcards.json');

    execSync(`bsondump "${tempBsonFile}" > "${tempJsonFile}"`);

    // Read and process the JSON data
    const jsonData = fs.readFileSync(tempJsonFile, 'utf8');
    const lines = jsonData.trim().split('\n');

    console.log(`📊 Found ${lines.length} PSA graded cards to recover`);

    for (const line of lines) {
      if (line.trim()) {
        try {
          const cardData = JSON.parse(line);

          await this.recoverSinglePsaGradedCard(cardData);
          this.stats.psaCardsRecovered++;
        } catch (error) {
          console.error(`❌ Failed to recover PSA card:`, error.message);
          this.stats.psaCardsFailed++;
          this.stats.errors.push(`PSA Card recovery: ${error.message}`);
        }
      }
    }

    console.log(`✅ PSA Cards: ${this.stats.psaCardsRecovered} recovered, ${this.stats.psaCardsFailed} failed`);
  }

  /**
   * Recover a single PSA graded card by matching card name and set
   */
  async recoverSinglePsaGradedCard(originalCardData) {
    // Get the card ID as string
    const oldCardId = originalCardData.cardId.$oid || originalCardData.cardId;
    
    // Find original card and set data from backup
    const originalCard = await this.findCardByBackupData(oldCardId);

    if (!originalCard) {
      throw new Error('Could not find matching card in current database');
    }

    // Helper function to convert MongoDB extended JSON to proper values
    const convertExtendedJson = (obj) => {
      if (!obj) return obj;
      
      if (typeof obj === 'object') {
        if (obj.$date && obj.$date.$numberLong) {
          return new Date(parseInt(obj.$date.$numberLong));
        }
        if (obj.$oid) {
          return obj.$oid; // Keep as string, don't convert to ObjectId for embedded docs
        }
        if (obj.$numberLong) {
          return parseInt(obj.$numberLong);
        }
        if (obj.$numberInt) {
          return parseInt(obj.$numberInt);
        }
        if (obj.$numberDouble) {
          return parseFloat(obj.$numberDouble);
        }
        
        // Recursively convert arrays and objects
        if (Array.isArray(obj)) {
          return obj.map(convertExtendedJson);
        } 
          const converted = {};

          for (const [key, value] of Object.entries(obj)) {
            converted[key] = convertExtendedJson(value);
          }
          return converted;
        
      }
      
      return obj;
    };

    // Create new PSA graded card with current card ID and converted data
    const newPsaCard = new PsaGradedCard({
      cardId: originalCard._id, // Use new ID from current database
      grade: originalCardData.grade,
      images: originalCardData.images || [],
      myPrice: convertExtendedJson(originalCardData.myPrice),
      priceHistory: convertExtendedJson(originalCardData.priceHistory) || [],
      dateAdded: convertExtendedJson(originalCardData.dateAdded) || new Date(),
      sold: originalCardData.sold || false,
      saleDetails: convertExtendedJson(originalCardData.saleDetails) || {}
    });

    await newPsaCard.save();
    console.log(`✅ Recovered PSA card: Grade ${originalCardData.grade} - ${originalCard.cardName}`);
  }

  /**
   * Recover Raw Cards
   */
  async recoverRawCards(backupDir) {
    console.log('\n🔄 Recovering Raw Cards...');
    
    const rawBackupPath = path.join(backupDir, 'rawcards', RECOVERY_CONFIG.dbName);
    const bsonFile = path.join(rawBackupPath, 'rawcards.bson.gz');

    if (!fs.existsSync(bsonFile) || fs.statSync(bsonFile).size <= 23) {
      console.log('⚠️ No raw cards backup found or empty');
      return;
    }

    // Similar process as PSA cards but for raw cards
    const tempBsonFile = path.join(RECOVERY_CONFIG.tempDir, 'rawcards.bson');

    execSync(`gunzip -c "${bsonFile}" > "${tempBsonFile}"`);

    const tempJsonFile = path.join(RECOVERY_CONFIG.tempDir, 'rawcards.json');

    execSync(`bsondump "${tempBsonFile}" > "${tempJsonFile}"`);

    const jsonData = fs.readFileSync(tempJsonFile, 'utf8');
    const lines = jsonData.trim().split('\n');

    console.log(`📊 Found ${lines.length} raw cards to recover`);

    for (const line of lines) {
      if (line.trim()) {
        try {
          const cardData = JSON.parse(line);

          await this.recoverSingleRawCard(cardData);
          this.stats.rawCardsRecovered++;
        } catch (error) {
          console.error(`❌ Failed to recover raw card:`, error.message);
          this.stats.rawCardsFailed++;
          this.stats.errors.push(`Raw Card recovery: ${error.message}`);
        }
      }
    }

    console.log(`✅ Raw Cards: ${this.stats.rawCardsRecovered} recovered, ${this.stats.rawCardsFailed} failed`);
  }

  /**
   * Recover a single raw card
   */
  async recoverSingleRawCard(originalCardData) {
    const oldCardId = originalCardData.cardId.$oid || originalCardData.cardId;
    const originalCard = await this.findCardByBackupData(oldCardId);

    if (!originalCard) {
      throw new Error('Could not find matching card in current database');
    }

    // Helper function to convert MongoDB extended JSON to proper values (same as PSA cards)
    const convertExtendedJson = (obj) => {
      if (!obj) return obj;
      
      if (typeof obj === 'object') {
        if (obj.$date && obj.$date.$numberLong) {
          return new Date(parseInt(obj.$date.$numberLong));
        }
        if (obj.$oid) {
          return obj.$oid;
        }
        if (obj.$numberLong) {
          return parseInt(obj.$numberLong);
        }
        if (obj.$numberInt) {
          return parseInt(obj.$numberInt);
        }
        if (obj.$numberDouble) {
          return parseFloat(obj.$numberDouble);
        }
        
        if (Array.isArray(obj)) {
          return obj.map(convertExtendedJson);
        } 
          const converted = {};

          for (const [key, value] of Object.entries(obj)) {
            converted[key] = convertExtendedJson(value);
          }
          return converted;
        
      }
      
      return obj;
    };

    const newRawCard = new RawCard({
      cardId: originalCard._id,
      condition: originalCardData.condition,
      images: originalCardData.images || [],
      myPrice: convertExtendedJson(originalCardData.myPrice),
      priceHistory: convertExtendedJson(originalCardData.priceHistory) || [],
      dateAdded: convertExtendedJson(originalCardData.dateAdded) || new Date(),
      sold: originalCardData.sold || false,
      saleDetails: convertExtendedJson(originalCardData.saleDetails) || {}
    });

    await newRawCard.save();
    console.log(`✅ Recovered raw card: ${originalCardData.condition} - ${originalCard.cardName}`);
  }

  /**
   * Recover Sealed Products
   */
  async recoverSealedProducts(backupDir) {
    console.log('\n🔄 Recovering Sealed Products...');
    
    const sealedBackupPath = path.join(backupDir, 'sealedproducts', RECOVERY_CONFIG.dbName);
    const bsonFile = path.join(sealedBackupPath, 'sealedproducts.bson.gz');

    if (!fs.existsSync(bsonFile) || fs.statSync(bsonFile).size <= 23) {
      console.log('⚠️ No sealed products backup found or empty');
      return;
    }

    // Similar process for sealed products
    const tempBsonFile = path.join(RECOVERY_CONFIG.tempDir, 'sealedproducts.bson');

    execSync(`gunzip -c "${bsonFile}" > "${tempBsonFile}"`);

    const tempJsonFile = path.join(RECOVERY_CONFIG.tempDir, 'sealedproducts.json');

    execSync(`bsondump "${tempBsonFile}" > "${tempJsonFile}"`);

    const jsonData = fs.readFileSync(tempJsonFile, 'utf8');
    const lines = jsonData.trim().split('\n');

    console.log(`📊 Found ${lines.length} sealed products to recover`);

    for (const line of lines) {
      if (line.trim()) {
        try {
          const productData = JSON.parse(line);

          await this.recoverSingleSealedProduct(productData);
          this.stats.sealedProductsRecovered++;
        } catch (error) {
          console.error(`❌ Failed to recover sealed product:`, error.message);
          this.stats.sealedProductsFailed++;
          this.stats.errors.push(`Sealed Product recovery: ${error.message}`);
        }
      }
    }

    console.log(`✅ Sealed Products: ${this.stats.sealedProductsRecovered} recovered, ${this.stats.sealedProductsFailed} failed`);
  }

  /**
   * Recover a single sealed product
   */
  async recoverSingleSealedProduct(originalProductData) {
    // Find matching CardMarketReferenceProduct by name
    const originalProduct = await CardMarketReferenceProduct.findOne({
      name: originalProductData.name,
      setName: originalProductData.setName
    });

    if (!originalProduct) {
      throw new Error(`Could not find matching product: ${originalProductData.name}`);
    }

    const newSealedProduct = new SealedProduct({
      productId: originalProduct._id,
      category: originalProductData.category,
      setName: originalProductData.setName,
      name: originalProductData.name,
      availability: originalProductData.availability,
      cardMarketPrice: originalProductData.cardMarketPrice,
      myPrice: originalProductData.myPrice,
      priceHistory: originalProductData.priceHistory || [],
      images: originalProductData.images || [],
      dateAdded: originalProductData.dateAdded || new Date(),
      sold: originalProductData.sold || false,
      saleDetails: originalProductData.saleDetails || {}
    });

    await newSealedProduct.save();
    console.log(`✅ Recovered sealed product: ${originalProductData.name}`);
  }

  /**
   * Find card by backup data using exact attribute matching
   */
  async findCardByBackupData(oldCardId) {
    // Extract card data from cards backup to get the original card details
    const backupMetadataPath = path.join(process.cwd(), 'backups', 'manual');
    const backupDirs = fs.readdirSync(backupMetadataPath);
    const latestBackupDir = backupDirs[0]; // Get the latest backup
    
    const cardsBackupPath = path.join(backupMetadataPath, latestBackupDir, 'cards', RECOVERY_CONFIG.dbName);
    const cardsBsonFile = path.join(cardsBackupPath, 'cards.bson.gz');
    
    if (fs.existsSync(cardsBsonFile)) {
      // Extract and find card by ID in backup
      const tempBsonFile = path.join(RECOVERY_CONFIG.tempDir, 'cards_lookup.bson');
      const tempJsonFile = path.join(RECOVERY_CONFIG.tempDir, 'cards_lookup.json');
      
      execSync(`gunzip -c "${cardsBsonFile}" > "${tempBsonFile}"`);
      execSync(`bsondump "${tempBsonFile}" > "${tempJsonFile}"`);
      
      const jsonData = fs.readFileSync(tempJsonFile, 'utf8');
      const lines = jsonData.trim().split('\n');
      
      // Find the original card details from backup
      let originalCardData = null;

      for (const line of lines) {
        if (line.trim()) {
          const cardData = JSON.parse(line);
          const cardId = cardData._id ? cardData._id.$oid : cardData._id;

          if (cardId === oldCardId) {
            originalCardData = cardData;
            break;
          }
        }
      }
      
      if (originalCardData) {
        // Get the original set details to match set name
        const oldSetId = originalCardData.setId ? originalCardData.setId.$oid : originalCardData.setId;
        const originalSetData = await this.findSetDataByBackupId(oldSetId);
        
        if (originalSetData) {
          // Handle MongoDB extended JSON format for year
          let yearValue;

          if (typeof originalSetData.year === 'object' && originalSetData.year.$numberInt) {
            yearValue = parseInt(originalSetData.year.$numberInt);
          } else {
            yearValue = parseInt(originalSetData.year);
          }
          
          if (!yearValue || isNaN(yearValue)) {
            console.log(`❌ Invalid year value for set: ${originalSetData.setName}`);
            return null;
          }
          
          const currentSet = await SetModel.findOne({
            setName: originalSetData.setName,
            year: yearValue
          });
          
          if (currentSet) {
            // Find current card by exact attribute matching
            const currentCard = await Card.findOne({
              setId: currentSet._id,
              cardName: originalCardData.cardName,
              baseName: originalCardData.baseName,
              pokemonNumber: originalCardData.pokemonNumber || '',
              variety: originalCardData.variety || ''
            });
            
            if (currentCard) {
              return currentCard;
            } 
              console.log(`❌ No match found for card: ${originalCardData.cardName} in set ${originalSetData.setName}`);
            
          } else {
            console.log(`❌ No current set found for: ${originalSetData.setName} (${originalSetData.year})`);
          }
        } else {
          console.log(`❌ Could not find original set data for card ID: ${oldCardId}`);
        }
      } else {
        console.log(`❌ Could not find original card data for ID: ${oldCardId}`);
      }
    }
    
    return null;
  }

  /**
   * Find set data from backup by old set ID
   */
  async findSetDataByBackupId(oldSetId) {
    const backupMetadataPath = path.join(process.cwd(), 'backups', 'manual');
    const backupDirs = fs.readdirSync(backupMetadataPath);
    const latestBackupDir = backupDirs[0];
    
    const setsBackupPath = path.join(backupMetadataPath, latestBackupDir, 'sets', RECOVERY_CONFIG.dbName);
    const setsBsonFile = path.join(setsBackupPath, 'sets.bson.gz');
    
    if (fs.existsSync(setsBsonFile)) {
      const tempBsonFile = path.join(RECOVERY_CONFIG.tempDir, 'sets_lookup.bson');
      const tempJsonFile = path.join(RECOVERY_CONFIG.tempDir, 'sets_lookup.json');
      
      execSync(`gunzip -c "${setsBsonFile}" > "${tempBsonFile}"`);
      execSync(`bsondump "${tempBsonFile}" > "${tempJsonFile}"`);
      
      const jsonData = fs.readFileSync(tempJsonFile, 'utf8');
      const lines = jsonData.trim().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          const setData = JSON.parse(line);
          const setId = setData._id ? setData._id.$oid : setData._id;

          if (setId === oldSetId) {
            return setData;
          }
        }
      }
    }
    
    return null;
  }


  /**
   * Utility method to ensure directory exists
   */
  async ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Print recovery statistics
   */
  printRecoveryStats() {
    console.log('\n📊 Recovery Statistics:');
    console.log(`✅ PSA Graded Cards: ${this.stats.psaCardsRecovered} recovered, ${this.stats.psaCardsFailed} failed`);
    console.log(`✅ Raw Cards: ${this.stats.rawCardsRecovered} recovered, ${this.stats.rawCardsFailed} failed`);
    console.log(`✅ Sealed Products: ${this.stats.sealedProductsRecovered} recovered, ${this.stats.sealedProductsFailed} failed`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      this.stats.errors.forEach(error => console.log(`   - ${error}`));
    }
  }
}

// Main execution
async function main() {
  if (process.argv.length < 3) {
    console.error('Usage: node recoveryScript.js <backup-id>');
    process.exit(1);
  }

  const backupId = process.argv[2];
  
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const recoveryService = new RecoveryService();

    await recoveryService.recoverFromBackup(backupId);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Recovery script failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { RecoveryService };