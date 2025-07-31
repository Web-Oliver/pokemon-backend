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
const Logger = require('./Logger');

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
      Logger.operationStart('BACKUP_RECOVERY', 'Starting backup recovery process', { backupId });
      
      // Find backup directory
      const backupDir = this.findBackupDirectory(backupId);

      if (!backupDir) {
        const error = new Error(`Backup ${backupId} not found`);

        Logger.operationError('BACKUP_NOT_FOUND', 'Backup directory not found', error, { backupId });
        throw error;
      }

      Logger.info('Found backup directory', { backupDir, backupId });

      // Create temp directory for extraction
      await this.ensureDirectory(RECOVERY_CONFIG.tempDir);

      // Extract and recover each collection type
      await this.recoverPsaGradedCards(backupDir);
      await this.recoverRawCards(backupDir);
      await this.recoverSealedProducts(backupDir);

      // Clean up temp directory
      execSync(`rm -rf "${RECOVERY_CONFIG.tempDir}"`);

      Logger.operationSuccess('BACKUP_RECOVERY_COMPLETE', 'Recovery completed successfully', {
        backupId,
        stats: this.stats
      });
      this.printRecoveryStats();

      return {
        success: true,
        stats: this.stats
      };

    } catch (error) {
      Logger.operationError('BACKUP_RECOVERY_FAILED', 'Recovery process failed', error, {
        backupId,
        stats: this.stats
      });
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
    Logger.section('PSA Graded Cards Recovery', 'Starting PSA graded cards recovery phase');
    
    const psaBackupPath = path.join(backupDir, 'psagradedcards', RECOVERY_CONFIG.dbName);
    const bsonFile = path.join(psaBackupPath, 'psagradedcards.bson.gz');

    if (!fs.existsSync(bsonFile)) {
      Logger.warn('No PSA graded cards backup found', { expectedPath: bsonFile });
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

    Logger.info('PSA graded cards backup loaded', { cardCount: lines.length, backupDir });

    for (const line of lines) {
      if (line.trim()) {
        try {
          const cardData = JSON.parse(line);

          await this.recoverSinglePsaGradedCard(cardData);
          this.stats.psaCardsRecovered++;
        } catch (error) {
          Logger.operationError('PSA_CARD_RECOVERY_ERROR', 'Failed to recover individual PSA card', error, {
            cardData: cardData.cardName || 'unknown',
            grade: cardData.grade
          });
          this.stats.psaCardsFailed++;
          this.stats.errors.push(`PSA Card recovery: ${error.message}`);
        }
      }
    }

    Logger.operationSuccess('PSA_CARDS_RECOVERY_COMPLETE', 'PSA graded cards recovery completed', {
      recovered: this.stats.psaCardsRecovered,
      failed: this.stats.psaCardsFailed,
      totalProcessed: this.stats.psaCardsRecovered + this.stats.psaCardsFailed
    });
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
          return new Date(parseInt(obj.$date.$numberLong, 10));
        }
        if (obj.$oid) {
          return obj.$oid; // Keep as string, don't convert to ObjectId for embedded docs
        }
        if (obj.$numberLong) {
          return parseInt(obj.$numberLong, 10);
        }
        if (obj.$numberInt) {
          return parseInt(obj.$numberInt, 10);
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
    Logger.info('PSA card recovered successfully', {
      grade: originalCardData.grade,
      cardName: originalCard.cardName,
      cardId: originalCard._id
    });
  }

  /**
   * Recover Raw Cards
   */
  async recoverRawCards(backupDir) {
    Logger.section('Raw Cards Recovery', 'Starting raw cards recovery phase');
    
    const rawBackupPath = path.join(backupDir, 'rawcards', RECOVERY_CONFIG.dbName);
    const bsonFile = path.join(rawBackupPath, 'rawcards.bson.gz');

    if (!fs.existsSync(bsonFile) || fs.statSync(bsonFile).size <= 23) {
      Logger.warn('No raw cards backup found or backup is empty', {
        expectedPath: bsonFile,
        exists: fs.existsSync(bsonFile),
        size: fs.existsSync(bsonFile) ? fs.statSync(bsonFile).size : 0
      });
      return;
    }

    // Similar process as PSA cards but for raw cards
    const tempBsonFile = path.join(RECOVERY_CONFIG.tempDir, 'rawcards.bson');

    execSync(`gunzip -c "${bsonFile}" > "${tempBsonFile}"`);

    const tempJsonFile = path.join(RECOVERY_CONFIG.tempDir, 'rawcards.json');

    execSync(`bsondump "${tempBsonFile}" > "${tempJsonFile}"`);

    const jsonData = fs.readFileSync(tempJsonFile, 'utf8');
    const lines = jsonData.trim().split('\n');

    Logger.info('Raw cards backup loaded', { cardCount: lines.length, backupDir });

    for (const line of lines) {
      if (line.trim()) {
        try {
          const cardData = JSON.parse(line);

          await this.recoverSingleRawCard(cardData);
          this.stats.rawCardsRecovered++;
        } catch (error) {
          Logger.operationError('RAW_CARD_RECOVERY_ERROR', 'Failed to recover individual raw card', error, {
            cardData: cardData.cardName || 'unknown',
            condition: cardData.condition
          });
          this.stats.rawCardsFailed++;
          this.stats.errors.push(`Raw Card recovery: ${error.message}`);
        }
      }
    }

    Logger.operationSuccess('RAW_CARDS_RECOVERY_COMPLETE', 'Raw cards recovery completed', {
      recovered: this.stats.rawCardsRecovered,
      failed: this.stats.rawCardsFailed,
      totalProcessed: this.stats.rawCardsRecovered + this.stats.rawCardsFailed
    });
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
          return new Date(parseInt(obj.$date.$numberLong, 10));
        }
        if (obj.$oid) {
          return obj.$oid;
        }
        if (obj.$numberLong) {
          return parseInt(obj.$numberLong, 10);
        }
        if (obj.$numberInt) {
          return parseInt(obj.$numberInt, 10);
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
    Logger.info('Raw card recovered successfully', {
      condition: originalCardData.condition,
      cardName: originalCard.cardName,
      cardId: originalCard._id
    });
  }

  /**
   * Recover Sealed Products
   */
  async recoverSealedProducts(backupDir) {
    Logger.section('Sealed Products Recovery', 'Starting sealed products recovery phase');
    
    const sealedBackupPath = path.join(backupDir, 'sealedproducts', RECOVERY_CONFIG.dbName);
    const bsonFile = path.join(sealedBackupPath, 'sealedproducts.bson.gz');

    if (!fs.existsSync(bsonFile) || fs.statSync(bsonFile).size <= 23) {
      Logger.warn('No sealed products backup found or backup is empty', {
        expectedPath: bsonFile,
        exists: fs.existsSync(bsonFile),
        size: fs.existsSync(bsonFile) ? fs.statSync(bsonFile).size : 0
      });
      return;
    }

    // Similar process for sealed products
    const tempBsonFile = path.join(RECOVERY_CONFIG.tempDir, 'sealedproducts.bson');

    execSync(`gunzip -c "${bsonFile}" > "${tempBsonFile}"`);

    const tempJsonFile = path.join(RECOVERY_CONFIG.tempDir, 'sealedproducts.json');

    execSync(`bsondump "${tempBsonFile}" > "${tempJsonFile}"`);

    const jsonData = fs.readFileSync(tempJsonFile, 'utf8');
    const lines = jsonData.trim().split('\n');

    Logger.info('Sealed products backup loaded', { productCount: lines.length, backupDir });

    for (const line of lines) {
      if (line.trim()) {
        try {
          const productData = JSON.parse(line);

          await this.recoverSingleSealedProduct(productData);
          this.stats.sealedProductsRecovered++;
        } catch (error) {
          Logger.operationError('SEALED_PRODUCT_RECOVERY_ERROR', 'Failed to recover individual sealed product', error, {
            productName: productData.name || 'unknown',
            setName: productData.setName
          });
          this.stats.sealedProductsFailed++;
          this.stats.errors.push(`Sealed Product recovery: ${error.message}`);
        }
      }
    }

    Logger.operationSuccess('SEALED_PRODUCTS_RECOVERY_COMPLETE', 'Sealed products recovery completed', {
      recovered: this.stats.sealedProductsRecovered,
      failed: this.stats.sealedProductsFailed,
      totalProcessed: this.stats.sealedProductsRecovered + this.stats.sealedProductsFailed
    });
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
    Logger.info('Sealed product recovered successfully', {
      productName: originalProductData.name,
      setName: originalProductData.setName,
      category: originalProductData.category
    });
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
            yearValue = parseInt(originalSetData.year.$numberInt, 10);
          } else {
            yearValue = parseInt(originalSetData.year, 10);
          }
          
          if (!yearValue || isNaN(yearValue)) {
            Logger.warn('Invalid year value for set', {
              setName: originalSetData.setName,
              yearValue: originalSetData.year,
              oldCardId
            });
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
              Logger.warn('No matching card found in current database', {
                cardName: originalCardData.cardName,
                setName: originalSetData.setName,
                oldCardId
              });
            
          } else {
            Logger.warn('No current set found for card recovery', {
              setName: originalSetData.setName,
              year: originalSetData.year,
              oldCardId
            });
          }
        } else {
          Logger.warn('Could not find original set data for card', { oldCardId });
        }
      } else {
        Logger.warn('Could not find original card data in backup', { oldCardId });
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
    Logger.section('Recovery Statistics', 'Final recovery statistics summary');
    Logger.info('PSA Graded Cards Recovery', {
      recovered: this.stats.psaCardsRecovered,
      failed: this.stats.psaCardsFailed,
      successRate: this.stats.psaCardsRecovered + this.stats.psaCardsFailed > 0 
        ? `${((this.stats.psaCardsRecovered / (this.stats.psaCardsRecovered + this.stats.psaCardsFailed)) * 100).toFixed(2)  }%`
        : 'N/A'
    });
    Logger.info('Raw Cards Recovery', {
      recovered: this.stats.rawCardsRecovered,
      failed: this.stats.rawCardsFailed,
      successRate: this.stats.rawCardsRecovered + this.stats.rawCardsFailed > 0 
        ? `${((this.stats.rawCardsRecovered / (this.stats.rawCardsRecovered + this.stats.rawCardsFailed)) * 100).toFixed(2)  }%`
        : 'N/A'
    });
    Logger.info('Sealed Products Recovery', {
      recovered: this.stats.sealedProductsRecovered,
      failed: this.stats.sealedProductsFailed,
      successRate: this.stats.sealedProductsRecovered + this.stats.sealedProductsFailed > 0 
        ? `${((this.stats.sealedProductsRecovered / (this.stats.sealedProductsRecovered + this.stats.sealedProductsFailed)) * 100).toFixed(2)  }%`
        : 'N/A'
    });
    
    if (this.stats.errors.length > 0) {
      Logger.warn('Recovery errors encountered', {
        errorCount: this.stats.errors.length,
        errors: this.stats.errors
      });
    }
  }
}

// Main execution
async function main() {
  if (process.argv.length < 3) {
    Logger.operationError('INVALID_USAGE', 'Invalid command line arguments', new Error('Missing backup-id argument'), {
      usage: 'node recoveryScript.js <backup-id>',
      providedArgs: process.argv.length
    });
    process.exit(1);
  }

  const backupId = process.argv[2];
  
  try {
    await mongoose.connect(process.env.MONGO_URI);
    Logger.operationStart('MONGODB_CONNECTION', 'Connected to MongoDB for recovery');

    const recoveryService = new RecoveryService();

    await recoveryService.recoverFromBackup(backupId);

    await mongoose.disconnect();
    Logger.operationSuccess('MONGODB_DISCONNECTION', 'Disconnected from MongoDB successfully');
    
  } catch (error) {
    Logger.operationError('RECOVERY_SCRIPT_FAILED', 'Recovery script execution failed', error, { backupId });
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { RecoveryService };