const fs = require('fs');
const path = require('path');
const Card = require('../../models/Card');
const Set = require('../../models/Set');
const { ImportValidators, ImportValidationError } = require('../validators/ImportValidators');

/**
 * Optimized Card MongoDB Importer
 * Bulk operations with validation for maximum performance
 */
class OptimizedCardImporter {
  constructor(options = {}) {
    this.options = ImportValidators.validateImportOptions(options);
    
    this.stats = {
      startTime: null,
      endTime: null,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };
    
    this.newSetsDir = path.join(__dirname, '../../data/new_sets/set-details');
    this.setMap = new Map(); // Cache for uniqueSetId -> ObjectId mapping
  }

  /**
   * Build Set lookup cache
   */
  async buildSetCache() {
    this.log('Building Set lookup cache...');
    
    try {
      const sets = await Set.find({}, 'setName uniqueSetId').lean();
      
      sets.forEach(set => {
        this.setMap.set(set.uniqueSetId, set._id);
      });
      
      this.log(`Cached ${this.setMap.size} Set mappings`);
      
      if (this.setMap.size === 0) {
        throw new Error('No Sets found in database. Import Sets first.');
      }
      
    } catch (error) {
      throw new Error(`Failed to build Set cache: ${error.message}`);
    }
  }

  /**
   * Get all set detail JSON files
   */
  getSetFiles() {
    try {
      const files = fs.readdirSync(this.newSetsDir)
        .filter(file => file.endsWith('.json') && !file.includes('Zone.Identifier'))
        .map(file => path.join(this.newSetsDir, file));
      
      this.log(`Found ${files.length} set files to process`);
      return files;
    } catch (error) {
      throw new Error(`Failed to read new_sets directory: ${error.message}`);
    }
  }

  /**
   * Extract card data from JSON files
   */
  async extractCardData() {
    const setFiles = this.getSetFiles();
    const cards = [];
    
    for (const filePath of setFiles) {
      try {
        const fileName = path.basename(filePath);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        if (!data.set_details?.set_info || !data.set_details?.cards) {
          this.log(`⚠️  Invalid structure in ${fileName}`);
          continue;
        }
        
        const setInfo = data.set_details.set_info;
        const setCards = data.set_details.cards;
        
        if (!Array.isArray(setCards)) {
          this.log(`⚠️  Cards is not an array in ${fileName}`);
          continue;
        }
        
        // Get Set ObjectId
        const setId = this.setMap.get(parseInt(setInfo.unique_set_id));
        if (!setId) {
          this.log(`⚠️  Set not found for uniqueSetId: ${setInfo.unique_set_id} in ${fileName}`);
          continue;
        }
        
        this.log(`Processing ${setCards.length} cards from set: ${setInfo.name}`);
        
        for (const card of setCards) {
          try {
            const validatedCard = ImportValidators.validateCardData(
              card, 
              parseInt(setInfo.unique_set_id), 
              fileName
            );
            
            validatedCard.setId = setId;
            cards.push(validatedCard);
            
          } catch (error) {
            if (error instanceof ImportValidationError) {
              this.log(`⚠️  Card validation error in ${fileName}: ${error.message}`);
            }
            this.stats.errors++;
          }
        }
        
      } catch (error) {
        this.log(`❌ Error processing ${path.basename(filePath)}: ${error.message}`);
        this.stats.errors++;
      }
    }
    
    this.log(`Extracted ${cards.length} cards from all set files`);
    return cards;
  }

  /**
   * Import cards using bulk operations
   */
  async importCards(cards) {
    if (cards.length === 0) {
      this.log('No cards to import');
      return;
    }

    this.log(`Starting bulk import of ${cards.length} cards (batch size: ${this.options.batchSize})`);
    
    cards.sort((a, b) => a.uniquePokemonId - b.uniquePokemonId);
    
    for (let i = 0; i < cards.length; i += this.options.batchSize) {
      const batch = cards.slice(i, i + this.options.batchSize);
      await this.processBatch(batch, i);
    }
  }

  /**
   * Process batch using bulkWrite
   */
  async processBatch(batch, batchIndex) {
    const batchNum = Math.floor(batchIndex / this.options.batchSize) + 1;
    this.log(`Processing batch ${batchNum} (${batch.length} items)`);
    
    if (this.options.dryRun) {
      this.log(`🔍 DRY RUN: Would process ${batch.length} cards`);
      this.stats.created += batch.length;
      return;
    }

    try {
      const bulkOps = batch.map(cardData => {
        if (this.options.skipExisting) {
          return {
            insertOne: {
              document: cardData
            }
          };
        } else {
          return {
            updateOne: {
              filter: { uniquePokemonId: cardData.uniquePokemonId },
              update: { $set: cardData },
              upsert: true
            }
          };
        }
      });

      const result = await Card.bulkWrite(bulkOps, { ordered: false });

      this.stats.created += result.insertedCount || 0;
      this.stats.updated += result.modifiedCount || 0;
      this.stats.created += result.upsertedCount || 0;

      if (result.writeErrors?.length > 0) {
        this.log(`⚠️  ${result.writeErrors.length} write errors in batch ${batchNum}`);
        this.stats.errors += result.writeErrors.length;
      }

    } catch (error) {
      this.log(`❌ Batch ${batchNum} failed: ${error.message}`);
      this.stats.errors += batch.length;
    }
  }

  /**
   * Run the complete import process
   */
  async import() {
    this.stats.startTime = new Date();
    
    try {
      this.log('🚀 Starting optimized Card import from new_sets data');
      
      await this.buildSetCache();
      const cards = await this.extractCardData();
      
      if (cards.length === 0) {
        this.log('⚠️  No cards found to import');
        return this.stats;
      }
      
      await this.importCards(cards);
      
      this.stats.endTime = new Date();
      this.log('✅ Optimized Card import completed');
      
      return this.stats;
      
    } catch (error) {
      this.stats.endTime = new Date();
      this.log(`❌ Card import failed: ${error.message}`);
      this.stats.errors++;
      throw error;
    }
  }

  log(message) {
    if (this.options.verbose) {
      const timestamp = new Date().toISOString();
      console.log(`[OptimizedCardImporter ${timestamp}] ${message}`);
    }
  }
}

module.exports = OptimizedCardImporter;