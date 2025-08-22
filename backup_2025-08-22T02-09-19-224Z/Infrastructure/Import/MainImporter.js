#!/usr/bin/env node

/**
 * Main MongoDB Import Script
 *
 * Uses bulk operations and validation for high-performance imports.
 * Comprehensive error handling and monitoring.
 */

import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
// Import importers
import SetProductImporter from './SetProductImporter.js';
import SetImporter from './SetImporter.js';
import ProductImporter from './ProductImporter.js';
import CardImporter from './CardImporter.js';
// Import models for connection
import Set from '@/Domain/Entities/Set.js';
import Card from '@/Domain/Entities/Card.js';
import SetProduct from '@/Domain/Entities/SetProduct.js';
import Product from '@/Domain/Entities/Product.js';

class MainImporter {
  constructor(options = {}) {
    this.options = {
      dryRun: options.dryRun || false,
      skipExisting: options.skipExisting || false,
      batchSize: options.batchSize || 200,
      verbose: options.verbose || true,
      ...options
    };

    this.stats = {
      startTime: new Date(),
      endTime: null,
      setProducts: { created: 0, updated: 0, skipped: 0, errors: 0 },
      sets: { created: 0, updated: 0, skipped: 0, errors: 0 },
      products: { created: 0, updated: 0, skipped: 0, errors: 0 },
      cards: { created: 0, updated: 0, skipped: 0, errors: 0 }
    };
  }

  /**
   * Initialize database connection with optimization
   */
  async initDatabase() {
    try {
      const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/pokemon_collection';

      await mongoose.connect(mongoUri, {
        maxPoolSize: 20,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
      });

      this.log('✅ Connected to MongoDB with optimized settings');

      if (this.options.dryRun) {
        this.log('🔍 DRY RUN MODE - No data will be saved');
      }

    } catch (error) {
      this.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async closeDatabase() {
    try {
      await mongoose.connection.close();
      this.log('✅ Database connection closed');
    } catch (error) {
      this.error('❌ Error closing database connection:', error);
    }
  }

  /**
   * Validate data directories exist
   */
  validateDataDirectories() {
    const requiredDirs = [
      path.join(__dirname, '../../data/new_sets/set-details'),
      path.join(__dirname, '../../data/Products')
    ];

    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        throw new Error(`Required data directory not found: ${dir}`);
      }
    }

    this.log('✅ All required data directories found');
  }

  /**
   * Import SetProducts using optimized importer
   */
  async importSetProducts() {
    this.log('\n📦 Starting optimized SetProduct import...');

    try {
      const importer = new SetProductImporter(this.options);
      const result = await importer.import();

      this.stats.setProducts = result;
      this.log(`✅ SetProduct import completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);

      return result;
    } catch (error) {
      this.error('❌ SetProduct import failed:', error);
      throw error;
    }
  }

  /**
   * Import Sets using optimized importer
   */
  async importSets() {
    this.log('\n🎯 Starting optimized Set import...');

    try {
      const importer = new SetImporter(this.options);
      const result = await importer.import();

      this.stats.sets = result;
      this.log(`✅ Set import completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);

      return result;
    } catch (error) {
      this.error('❌ Set import failed:', error);
      throw error;
    }
  }

  /**
   * Import Products using optimized importer
   */
  async importProducts() {
    this.log('\n🛍️ Starting optimized Product import...');

    try {
      const importer = new ProductImporter(this.options);
      const result = await importer.import();

      this.stats.products = result;
      this.log(`✅ Product import completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);

      return result;
    } catch (error) {
      this.error('❌ Product import failed:', error);
      throw error;
    }
  }

  /**
   * Import Cards using optimized importer
   */
  async importCards() {
    this.log('\n🃏 Starting optimized Card import...');

    try {
      const importer = new CardImporter(this.options);
      const result = await importer.import();

      this.stats.cards = result;
      this.log(`✅ Card import completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors`);

      return result;
    } catch (error) {
      this.error('❌ Card import failed:', error);
      throw error;
    }
  }

  /**
   * Run complete optimized import process
   */
  async run() {
    try {
      this.log('🚀 Starting Optimized Pokemon Collection Data Import');
      this.log(`Configuration: batchSize=${this.options.batchSize}, dryRun=${this.options.dryRun}, skipExisting=${this.options.skipExisting}`);

      // Initialize
      this.validateDataDirectories();
      await this.initDatabase();

      // Import in dependency order with optimized importers
      await this.importSetProducts(); // 1. SetProduct (no deps)
      await this.importSets(); // 2. Set (no deps)
      await this.importProducts(); // 3. Product (depends on SetProduct)
      await this.importCards(); // 4. Card (depends on Set)

      // Finalize
      this.stats.endTime = new Date();
      await this.closeDatabase();

      this.printFinalStats();

    } catch (error) {
      this.error('❌ Optimized import process failed:', error);
      await this.closeDatabase();
      process.exit(1);
    }
  }

  /**
   * Print final import statistics with performance metrics
   */
  printFinalStats() {
    const duration = this.stats.endTime - this.stats.startTime;
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);

    this.log(`\n${'='.repeat(60)}`);
    this.log('🎉 OPTIMIZED IMPORT COMPLETED SUCCESSFULLY');
    this.log('='.repeat(60));
    this.log(`⏱️  Total Duration: ${minutes}m ${seconds}s`);
    this.log(`🔍 Mode: ${this.options.dryRun ? 'DRY RUN' : 'LIVE IMPORT'}`);
    this.log(`⚡ Batch Size: ${this.options.batchSize} (optimized for bulk operations)`);
    this.log('');

    const categories = ['setProducts', 'sets', 'products', 'cards'];
    const labels = ['SetProducts', 'Sets', 'Products', 'Cards'];

    categories.forEach((category, index) => {
      const stats = this.stats[category];
      const total = stats.created + stats.updated + stats.skipped;

      this.log(`📊 ${labels[index]}: ${stats.created} created, ${stats.updated} updated, ${stats.skipped} skipped, ${stats.errors} errors (${total} total)`);
    });

    const grandTotal = categories.reduce((sum, cat) => {
      const stats = this.stats[cat];

      return sum + stats.created + stats.updated + stats.skipped;
    }, 0);

    const totalErrors = categories.reduce((sum, cat) => sum + this.stats[cat].errors, 0);

    // Performance metrics
    const recordsPerSecond = grandTotal / (duration / 1000);

    this.log('');
    this.log(`🎯 Grand Total: ${grandTotal} records processed`);
    this.log(`⚡ Performance: ${recordsPerSecond.toFixed(0)} records/second`);
    this.log(`${totalErrors > 0 ? '⚠️' : '✅'} Total Errors: ${totalErrors}`);

    if (totalErrors === 0) {
      this.log('🏆 PERFECT RUN - No errors detected!');
    }

    this.log('='.repeat(60));
  }

  /**
   * Log message with timestamp
   */
  log(message) {
    if (this.options.verbose) {
      const timestamp = new Date().toISOString();

      console.log(`[MainImporter ${timestamp}] ${message}`);
    }
  }

  /**
   * Log error message
   */
  error(message, error = null) {
    const timestamp = new Date().toISOString();

    console.error(`[MainImporter ${timestamp}] ${message}`);
    if (error) {
      console.error(error);
    }
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    dryRun: args.includes('--dry-run'),
    skipExisting: args.includes('--skip-existing'),
    verbose: !args.includes('--quiet'),
    batchSize: args.includes('--fast') ? 500 : 200
  };

  const importer = new MainImporter(options);

  importer.run().catch(error => {
    console.error('Optimized import failed:', error);
    process.exit(1);
  });
}

export default MainImporter;
