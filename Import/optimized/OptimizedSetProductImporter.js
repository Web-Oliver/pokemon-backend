const fs = require('fs');
const path = require('path');
const SetProduct = require('../../models/SetProduct');
const { ImportValidators, ImportValidationError } = require('../validators/ImportValidators');

/**
 * Optimized SetProduct MongoDB Importer
 * Extracts unique setProductName values from Products data
 */
class OptimizedSetProductImporter {
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
    
    this.productsDir = path.join(__dirname, '../../data/Products');
  }

  /**
   * Get all product category directories
   */
  getProductCategories() {
    try {
      const categories = fs.readdirSync(this.productsDir)
        .filter(item => {
          const fullPath = path.join(this.productsDir, item);
          return fs.statSync(fullPath).isDirectory();
        });
      
      this.log(`Found ${categories.length} product categories: ${categories.join(', ')}`);
      return categories;
    } catch (error) {
      throw new Error(`Failed to read products directory: ${error.message}`);
    }
  }

  /**
   * Extract unique set product data from all product files
   */
  async extractSetProductData() {
    const categories = this.getProductCategories();
    const setProductMap = new Map();
    
    for (const category of categories) {
      const categoryFile = path.join(this.productsDir, category, `${category}.json`);
      
      if (!fs.existsSync(categoryFile)) {
        this.log(`⚠️  Category file not found: ${categoryFile}`);
        continue;
      }
      
      try {
        const data = JSON.parse(fs.readFileSync(categoryFile, 'utf8'));
        
        if (!data.products || !Array.isArray(data.products)) {
          this.log(`⚠️  Invalid products structure in ${categoryFile}`);
          continue;
        }
        
        this.log(`Processing ${data.products.length} products from ${category}`);
        
        // Extract unique setProductName entries
        data.products.forEach(product => {
          if (product.setProductName && product.uniqueSetProductId) {
            const key = product.setProductName.trim();
            
            if (!setProductMap.has(key)) {
              try {
                const validatedSetProduct = ImportValidators.validateSetProductData(product, categoryFile);
                setProductMap.set(key, validatedSetProduct);
              } catch (error) {
                if (error instanceof ImportValidationError) {
                  this.log(`⚠️  SetProduct validation error: ${error.message}`);
                }
                this.stats.errors++;
              }
            }
          }
        });
        
      } catch (error) {
        this.log(`❌ Error processing ${categoryFile}: ${error.message}`);
        this.stats.errors++;
      }
    }
    
    const setProducts = Array.from(setProductMap.values());
    this.log(`Extracted ${setProducts.length} unique set products`);
    
    return setProducts;
  }

  /**
   * Import set products using bulk operations
   */
  async importSetProducts(setProducts) {
    if (setProducts.length === 0) {
      this.log('No set products to import');
      return;
    }

    this.log(`Starting bulk import of ${setProducts.length} set products (batch size: ${this.options.batchSize})`);
    
    setProducts.sort((a, b) => a.uniqueSetProductId - b.uniqueSetProductId);
    
    for (let i = 0; i < setProducts.length; i += this.options.batchSize) {
      const batch = setProducts.slice(i, i + this.options.batchSize);
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
      this.log(`🔍 DRY RUN: Would process ${batch.length} set products`);
      this.stats.created += batch.length;
      return;
    }

    try {
      const bulkOps = batch.map(setProductData => {
        if (this.options.skipExisting) {
          return {
            insertOne: {
              document: setProductData
            }
          };
        } else {
          return {
            updateOne: {
              filter: { 
                $or: [
                  { setProductName: setProductData.setProductName },
                  { uniqueSetProductId: setProductData.uniqueSetProductId }
                ]
              },
              update: { $set: setProductData },
              upsert: true
            }
          };
        }
      });

      const result = await SetProduct.bulkWrite(bulkOps, { ordered: false });

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
      this.log('🚀 Starting optimized SetProduct import from Products data');
      
      const setProducts = await this.extractSetProductData();
      
      if (setProducts.length === 0) {
        this.log('⚠️  No set products found to import');
        return this.stats;
      }
      
      await this.importSetProducts(setProducts);
      
      this.stats.endTime = new Date();
      this.log('✅ Optimized SetProduct import completed');
      
      return this.stats;
      
    } catch (error) {
      this.stats.endTime = new Date();
      this.log(`❌ SetProduct import failed: ${error.message}`);
      this.stats.errors++;
      throw error;
    }
  }

  log(message) {
    if (this.options.verbose) {
      const timestamp = new Date().toISOString();
      console.log(`[OptimizedSetProductImporter ${timestamp}] ${message}`);
    }
  }
}

module.exports = OptimizedSetProductImporter;