/**
 * Add Unique Product IDs to Sealed Products
 * 
 * This script processes all sealed product JSON files and adds unique_product_id
 * to each product. The IDs are sequential starting from 1 and maintain context
 * across all product categories.
 */

const fs = require('fs');
const path = require('path');

class UniqueProductIdGenerator {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.currentId = 1;
    this.processedProducts = 0;
    this.totalProducts = 0;
    this.categories = [];
  }

  /**
   * Get all category directories
   */
  getCategoryDirectories() {
    try {
      const items = fs.readdirSync(this.baseDir, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory())
        .map(item => item.name)
        .sort(); // Sort for consistent processing order
    } catch (error) {
      throw new Error(`Failed to read base directory: ${error.message}`);
    }
  }

  /**
   * Read and parse JSON file
   */
  readJsonFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read/parse ${filePath}: ${error.message}`);
    }
  }

  /**
   * Write JSON file with pretty formatting
   */
  writeJsonFile(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to write ${filePath}: ${error.message}`);
    }
  }

  /**
   * Add unique_product_id to a single product
   */
  addUniqueIdToProduct(product) {
    // Create new product object with unique_product_id first
    const updatedProduct = {
      unique_product_id: this.currentId++,
      ...product
    };
    
    this.processedProducts++;
    return updatedProduct;
  }

  /**
   * Process a single category file
   */
  processCategoryFile(categoryDir, categoryName) {
    const jsonFileName = `${categoryName}.json`;
    const filePath = path.join(this.baseDir, categoryDir, jsonFileName);
    
    console.log(`Processing: ${filePath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return;
    }

    // Read the JSON file
    const data = this.readJsonFile(filePath);
    
    if (!data.products || !Array.isArray(data.products)) {
      console.warn(`⚠️  No products array found in: ${filePath}`);
      return;
    }

    const originalCount = data.products.length;
    console.log(`   Found ${originalCount} products`);

    // Add unique_product_id to each product
    data.products = data.products.map(product => this.addUniqueIdToProduct(product));

    // Update metadata
    if (data.metadata) {
      data.metadata.total_products = data.products.length;
      data.metadata.last_updated = new Date().toISOString();
      data.metadata.unique_ids_added = true;
      data.metadata.id_range = {
        start: this.currentId - originalCount,
        end: this.currentId - 1
      };
    }

    // Write back to file
    this.writeJsonFile(filePath, data);
    console.log(`✅ Added unique IDs ${this.currentId - originalCount} to ${this.currentId - 1} (${originalCount} products)\n`);
  }

  /**
   * Analyze all files first to get total count
   */
  analyzeFiles() {
    console.log('🔍 Analyzing sealed product files...\n');
    
    const categories = this.getCategoryDirectories();
    let totalProducts = 0;
    
    for (const categoryDir of categories) {
      const jsonFileName = `${categoryDir}.json`;
      const filePath = path.join(this.baseDir, categoryDir, jsonFileName);
      
      if (fs.existsSync(filePath)) {
        try {
          const data = this.readJsonFile(filePath);
          const productCount = data.products ? data.products.length : 0;
          totalProducts += productCount;
          
          this.categories.push({
            directory: categoryDir,
            fileName: jsonFileName,
            filePath: filePath,
            productCount: productCount
          });
          
          console.log(`📁 ${categoryDir}: ${productCount} products`);
        } catch (error) {
          console.warn(`⚠️  Error analyzing ${filePath}: ${error.message}`);
        }
      } else {
        console.warn(`⚠️  File not found: ${filePath}`);
      }
    }
    
    this.totalProducts = totalProducts;
    console.log(`\n📊 Total products across all categories: ${totalProducts}`);
    console.log(`🔢 Will assign IDs from 1 to ${totalProducts}\n`);
    
    return this.categories;
  }

  /**
   * Process all category files
   */
  processAllFiles() {
    console.log('🚀 Starting unique product ID generation...\n');
    
    // First analyze all files
    const categories = this.analyzeFiles();
    
    if (categories.length === 0) {
      console.log('❌ No valid category files found!');
      return;
    }

    // Ask for confirmation
    console.log('📋 Will process the following categories:');
    categories.forEach(cat => {
      console.log(`   • ${cat.directory}: ${cat.productCount} products`);
    });
    console.log(`\n⚡ This will add unique_product_id to ${this.totalProducts} products total.\n`);

    // Process each category
    for (const category of categories) {
      this.processCategoryFile(category.directory, category.directory);
    }

    // Final summary
    console.log('🎉 Unique product ID generation completed!');
    console.log(`📈 Summary:`);
    console.log(`   • Categories processed: ${categories.length}`);
    console.log(`   • Products processed: ${this.processedProducts}`);
    console.log(`   • ID range: 1 to ${this.currentId - 1}`);
    console.log(`   • Next available ID: ${this.currentId}`);
  }

  /**
   * Verify the results
   */
  verifyResults() {
    console.log('\n🔍 Verifying results...\n');
    
    let totalVerified = 0;
    let minId = Infinity;
    let maxId = 0;
    const duplicateCheck = new Set();
    
    for (const category of this.categories) {
      try {
        const data = this.readJsonFile(category.filePath);
        
        if (data.products && Array.isArray(data.products)) {
          for (const product of data.products) {
            if (product.unique_product_id) {
              const id = product.unique_product_id;
              
              // Check for duplicates
              if (duplicateCheck.has(id)) {
                console.error(`❌ Duplicate ID found: ${id}`);
              } else {
                duplicateCheck.add(id);
              }
              
              // Track min/max
              minId = Math.min(minId, id);
              maxId = Math.max(maxId, id);
              totalVerified++;
            } else {
              console.warn(`⚠️  Product missing unique_product_id in ${category.directory}`);
            }
          }
        }
        
        console.log(`✅ ${category.directory}: ${data.products.length} products verified`);
      } catch (error) {
        console.error(`❌ Verification failed for ${category.directory}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Verification Summary:`);
    console.log(`   • Total products verified: ${totalVerified}`);
    console.log(`   • ID range: ${minId} to ${maxId}`);
    console.log(`   • Unique IDs: ${duplicateCheck.size}`);
    console.log(`   • Duplicates: ${totalVerified - duplicateCheck.size}`);
    
    if (totalVerified === duplicateCheck.size && totalVerified === this.totalProducts) {
      console.log(`🎉 ✅ All products successfully processed with unique IDs!`);
    } else {
      console.log(`❌ Issues detected during verification!`);
    }
  }
}

// Main execution
function main() {
  const baseDir = path.join(__dirname, '../data/SealedProducts');
  
  console.log('🏷️  Unique Product ID Generator for Sealed Products');
  console.log('=' .repeat(60));
  console.log(`📂 Base directory: ${baseDir}\n`);
  
  // Check if base directory exists
  if (!fs.existsSync(baseDir)) {
    console.error(`❌ Base directory not found: ${baseDir}`);
    process.exit(1);
  }
  
  try {
    const generator = new UniqueProductIdGenerator(baseDir);
    generator.processAllFiles();
    generator.verifyResults();
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = UniqueProductIdGenerator;