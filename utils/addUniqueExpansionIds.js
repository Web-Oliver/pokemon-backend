/**
 * Add Unique Expansion IDs to Sealed Products
 * 
 * This script first assigns unique_expansion_id to each expansion name,
 * then updates all sealed product JSON files to include the expansion ID
 * based on matching expansion names.
 */

const fs = require('fs');
const path = require('path');

class UniqueExpansionIdGenerator {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.expansionMap = new Map(); // expansion name -> unique_expansion_id
    this.processedProducts = 0;
    this.updatedProducts = 0;
    this.unmatchedExpansions = new Set();
    this.categories = [];
  }

  /**
   * Load and process the expansion names list
   */
  loadExpansionsList() {
    const expansionListPath = path.join(__dirname, '../data/expansion-names-list.json');
    
    console.log('📄 Loading expansion names list...');
    
    if (!fs.existsSync(expansionListPath)) {
      throw new Error(`Expansion names list not found: ${expansionListPath}`);
    }

    const expansionData = JSON.parse(fs.readFileSync(expansionListPath, 'utf8'));
    
    if (!expansionData.expansions || !Array.isArray(expansionData.expansions)) {
      throw new Error('Invalid expansion names list format');
    }

    console.log(`   Found ${expansionData.expansions.length} unique expansions`);
    
    // Create expansion mapping with unique IDs
    expansionData.expansions.forEach((expansionName, index) => {
      const uniqueId = index + 1; // Start from 1
      this.expansionMap.set(expansionName, uniqueId);
    });

    // Update the expansion names list to include IDs
    const updatedExpansionData = {
      ...expansionData,
      expansions_with_ids: expansionData.expansions.map((name, index) => ({
        unique_expansion_id: index + 1,
        expansion_name: name
      })),
      last_updated: new Date().toISOString(),
      total_expansions: expansionData.expansions.length
    };

    // Save updated expansion list
    fs.writeFileSync(expansionListPath, JSON.stringify(updatedExpansionData, null, 2), 'utf8');
    console.log(`✅ Updated expansion names list with unique IDs (1 to ${expansionData.expansions.length})\n`);

    return this.expansionMap;
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
        .sort();
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
   * Add unique_expansion_id to a single product
   */
  addExpansionIdToProduct(product) {
    this.processedProducts++;
    
    if (!product.expansion) {
      console.warn(`⚠️  Product missing expansion field: ${product.name || 'Unknown'}`);
      return product;
    }

    const expansionName = product.expansion.trim();
    const expansionId = this.expansionMap.get(expansionName);

    if (expansionId) {
      // Create new product object with unique_expansion_id added
      const updatedProduct = {
        ...product,
        unique_expansion_id: expansionId
      };
      this.updatedProducts++;
      return updatedProduct;
    } else {
      // Track unmatched expansions for debugging
      this.unmatchedExpansions.add(expansionName);
      console.warn(`⚠️  No ID found for expansion: "${expansionName}"`);
      return product;
    }
  }

  /**
   * Process a single category file
   */
  processCategoryFile(categoryDir, categoryName) {
    const jsonFileName = `${categoryName}.json`;
    const filePath = path.join(this.baseDir, categoryDir, jsonFileName);
    
    console.log(`Processing: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return;
    }

    const data = this.readJsonFile(filePath);
    
    if (!data.products || !Array.isArray(data.products)) {
      console.warn(`⚠️  No products array found in: ${filePath}`);
      return;
    }

    const originalCount = data.products.length;
    const beforeUpdatedCount = this.updatedProducts;
    
    console.log(`   Found ${originalCount} products`);

    // Add unique_expansion_id to each product
    data.products = data.products.map(product => this.addExpansionIdToProduct(product));

    const productsUpdatedInThisFile = this.updatedProducts - beforeUpdatedCount;

    // Update metadata
    if (data.metadata) {
      data.metadata.last_updated = new Date().toISOString();
      data.metadata.expansion_ids_added = true;
      data.metadata.products_with_expansion_id = productsUpdatedInThisFile;
      data.metadata.products_without_expansion_id = originalCount - productsUpdatedInThisFile;
    }

    // Write back to file
    this.writeJsonFile(filePath, data);
    console.log(`✅ Added expansion IDs to ${productsUpdatedInThisFile}/${originalCount} products\n`);
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
    
    console.log(`\n📊 Total products across all categories: ${totalProducts}`);
    console.log(`🎯 Will match against ${this.expansionMap.size} known expansions\n`);
    
    return this.categories;
  }

  /**
   * Process all category files
   */
  processAllFiles() {
    console.log('🚀 Starting unique expansion ID assignment...\n');
    
    // First load expansion mappings
    this.loadExpansionsList();
    
    // Analyze all files
    const categories = this.analyzeFiles();
    
    if (categories.length === 0) {
      console.log('❌ No valid category files found!');
      return;
    }

    // Process each category
    for (const category of categories) {
      this.processCategoryFile(category.directory, category.directory);
    }

    // Final summary
    console.log('🎉 Unique expansion ID assignment completed!');
    console.log(`📈 Summary:`);
    console.log(`   • Categories processed: ${categories.length}`);
    console.log(`   • Products processed: ${this.processedProducts}`);
    console.log(`   • Products updated with expansion ID: ${this.updatedProducts}`);
    console.log(`   • Products without expansion match: ${this.processedProducts - this.updatedProducts}`);
    console.log(`   • Known expansions: ${this.expansionMap.size}`);
    console.log(`   • Unmatched expansion names: ${this.unmatchedExpansions.size}`);

    if (this.unmatchedExpansions.size > 0) {
      console.log(`\n⚠️  Unmatched expansions:`);
      Array.from(this.unmatchedExpansions).sort().forEach(expansion => {
        console.log(`   • "${expansion}"`);
      });
    }
  }

  /**
   * Verify the results
   */
  verifyResults() {
    console.log('\n🔍 Verifying expansion ID results...\n');
    
    let totalVerified = 0;
    let productsWithExpansionId = 0;
    let productsWithoutExpansionId = 0;
    const expansionIdUsage = new Map();
    
    for (const category of this.categories) {
      try {
        const data = this.readJsonFile(category.filePath);
        
        if (data.products && Array.isArray(data.products)) {
          let categoryWithId = 0;
          let categoryWithoutId = 0;
          
          for (const product of data.products) {
            totalVerified++;
            
            if (product.unique_expansion_id) {
              productsWithExpansionId++;
              categoryWithId++;
              
              // Track expansion ID usage
              const id = product.unique_expansion_id;
              expansionIdUsage.set(id, (expansionIdUsage.get(id) || 0) + 1);
            } else {
              productsWithoutExpansionId++;
              categoryWithoutId++;
            }
          }
          
          console.log(`✅ ${category.directory}: ${categoryWithId} with ID, ${categoryWithoutId} without ID`);
        }
      } catch (error) {
        console.error(`❌ Verification failed for ${category.directory}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Verification Summary:`);
    console.log(`   • Total products verified: ${totalVerified}`);
    console.log(`   • Products with expansion ID: ${productsWithExpansionId}`);
    console.log(`   • Products without expansion ID: ${productsWithoutExpansionId}`);
    console.log(`   • Success rate: ${((productsWithExpansionId / totalVerified) * 100).toFixed(1)}%`);
    console.log(`   • Unique expansion IDs used: ${expansionIdUsage.size} / ${this.expansionMap.size}`);
    
    // Show most used expansion IDs
    const topExpansions = Array.from(expansionIdUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log(`\n🏆 Top 10 Most Used Expansion IDs:`);
    topExpansions.forEach(([expansionId, count], index) => {
      // Find expansion name by ID
      const expansionName = Array.from(this.expansionMap.entries())
        .find(([name, id]) => id === expansionId)?.[0] || 'Unknown';
      console.log(`   ${index + 1}. ID ${expansionId}: "${expansionName}" (${count} products)`);
    });
    
    if (productsWithExpansionId === this.updatedProducts && totalVerified === this.processedProducts) {
      console.log(`🎉 ✅ All expansion IDs successfully assigned!`);
    } else {
      console.log(`❌ Discrepancies detected during verification!`);
    }
  }
}

// Main execution
function main() {
  const baseDir = path.join(__dirname, '../data/SealedProducts');
  
  console.log('🏷️  Unique Expansion ID Generator for Sealed Products');
  console.log('=' .repeat(60));
  console.log(`📂 Base directory: ${baseDir}\n`);
  
  // Check if base directory exists
  if (!fs.existsSync(baseDir)) {
    console.error(`❌ Base directory not found: ${baseDir}`);
    process.exit(1);
  }
  
  try {
    const generator = new UniqueExpansionIdGenerator(baseDir);
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

module.exports = UniqueExpansionIdGenerator;