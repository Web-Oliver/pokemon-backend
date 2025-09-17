import fs from 'fs';
import path from 'path';
import Product from '@/pokemon/products/Product.js';
import SetProduct from '@/pokemon/products/SetProduct.js';
import {ImportValidationError, ImportValidators} from './validators/ImportValidators.js';

/**
 * Optimized Product MongoDB Importer
 * Bulk operations with SetProduct validation
 */
class ProductImporter {
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
        this.setProductMap = new Map(); // Cache for setProductName -> ObjectId mapping
    }

    /**
     * Build SetProduct lookup cache
     */
    async buildSetProductCache() {
        this.log('Building SetProduct lookup cache...');

        try {
            const setProducts = await SetProduct.find({}, 'setProductName uniqueSetProductId').lean();

            setProducts.forEach(sp => {
                this.setProductMap.set(sp.setProductName, sp._id);
            });

            this.log(`Cached ${this.setProductMap.size} SetProduct mappings`);

            if (this.setProductMap.size === 0) {
                throw new Error('No SetProducts found in database. Import SetProducts first.');
            }

        } catch (error) {
            throw new Error(`Failed to build SetProduct cache: ${error.message}`);
        }
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
     * Extract product data from all category files
     */
    async extractProductData() {
        const categories = this.getProductCategories();
        const products = [];

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

                for (const product of data.products) {
                    try {
                        const validatedProduct = ImportValidators.validateProductData(product, categoryFile);

                        // Get SetProduct ObjectId
                        const setProductId = this.setProductMap.get(validatedProduct.setProductName);

                        if (!setProductId) {
                            this.log(`⚠️  SetProduct not found for: ${validatedProduct.setProductName}`);
                            this.stats.errors++;
                            continue;
                        }

                        validatedProduct.setProductId = setProductId;
                        delete validatedProduct.setProductName; // Remove since we have the ObjectId

                        products.push(validatedProduct);

                    } catch (error) {
                        if (error instanceof ImportValidationError) {
                            this.log(`⚠️  Product validation error: ${error.message}`);
                        }
                        this.stats.errors++;
                    }
                }

            } catch (error) {
                this.log(`❌ Error processing ${categoryFile}: ${error.message}`);
                this.stats.errors++;
            }
        }

        this.log(`Extracted ${products.length} products from all categories`);
        return products;
    }

    /**
     * Import products using bulk operations
     */
    async importProducts(products) {
        if (products.length === 0) {
            this.log('No products to import');
            return;
        }

        this.log(`Starting bulk import of ${products.length} products (batch size: ${this.options.batchSize})`);

        products.sort((a, b) => a.uniqueProductId - b.uniqueProductId);

        for (let i = 0; i < products.length; i += this.options.batchSize) {
            const batch = products.slice(i, i + this.options.batchSize);

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
            this.log(`🔍 DRY RUN: Would process ${batch.length} products`);
            this.stats.created += batch.length;
            return;
        }

        try {
            const bulkOps = batch.map(productData => {
                if (this.options.skipExisting) {
                    return {
                        insertOne: {
                            document: productData
                        }
                    };
                }
                return {
                    updateOne: {
                        filter: {uniqueProductId: productData.uniqueProductId},
                        update: {$set: productData},
                        upsert: true
                    }
                };

            });

            const result = await Product.bulkWrite(bulkOps, {ordered: false});

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
            this.log('🚀 Starting optimized Product import from Products data');

            await this.buildSetProductCache();
            const products = await this.extractProductData();

            if (products.length === 0) {
                this.log('⚠️  No products found to import');
                return this.stats;
            }

            await this.importProducts(products);

            this.stats.endTime = new Date();
            this.log('✅ Optimized Product import completed');

            return this.stats;

        } catch (error) {
            this.stats.endTime = new Date();
            this.log(`❌ Product import failed: ${error.message}`);
            this.stats.errors++;
            throw error;
        }
    }

    log(message) {
        if (this.options.verbose) {
            const timestamp = new Date().toISOString();

            console.log(`[ProductImporter ${timestamp}] ${message}`);
        }
    }
}

export default ProductImporter;
