const fs = require('fs');
const path = require('path');

/**
 * Script to update field names in all product JSON files
 * 
 * Field mappings:
 * - unique_product_id → uniqueProductId
 * - name → productName
 * - expansion → setProductName
 * - unique_expansion_id → uniqueSetProductId
 */

const PRODUCTS_DIR = '/home/oliver/apps/pokemon-collection/pokemon-collection-backend/data/Products';

// Field mapping for renaming
const FIELD_MAPPINGS = {
  'unique_product_id': 'uniqueProductId',
  'name': 'productName',
  'expansion': 'setProductName',
  'unique_expansion_id': 'uniqueSetProductId'
};

/**
 * Updates field names in a product object
 * @param {Object} product - Product object to update
 * @returns {Object} - Updated product object
 */
function updateProductFields(product) {
  const updatedProduct = {};
  
  for (const [oldKey, value] of Object.entries(product)) {
    const newKey = FIELD_MAPPINGS[oldKey] || oldKey;
    updatedProduct[newKey] = value;
  }
  
  return updatedProduct;
}

/**
 * Processes a single JSON file
 * @param {string} filePath - Path to the JSON file
 */
async function processJsonFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    
    // Read the JSON file
    const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Track changes
    let changesCount = 0;
    
    // Update products array
    if (jsonData.products && Array.isArray(jsonData.products)) {
      jsonData.products = jsonData.products.map(product => {
        const updatedProduct = updateProductFields(product);
        
        // Check if any changes were made
        const hasChanges = Object.keys(FIELD_MAPPINGS).some(oldKey => 
          product.hasOwnProperty(oldKey)
        );
        
        if (hasChanges) {
          changesCount++;
        }
        
        return updatedProduct;
      });
    }
    
    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
    
    console.log(`  ✅ Updated ${changesCount} products in ${path.basename(filePath)}`);
    return changesCount;
    
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Main function to process all JSON files
 */
async function main() {
  console.log('🚀 Starting product JSON field update...\n');
  
  try {
    // Get all category directories
    const categories = fs.readdirSync(PRODUCTS_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    console.log(`Found ${categories.length} categories: ${categories.join(', ')}\n`);
    
    let totalFilesProcessed = 0;
    let totalProductsUpdated = 0;
    
    // Process each category
    for (const category of categories) {
      const categoryDir = path.join(PRODUCTS_DIR, category);
      console.log(`📁 Processing category: ${category}`);
      
      // Find JSON files in the category directory
      const files = fs.readdirSync(categoryDir)
        .filter(file => file.endsWith('.json'))
        .filter(file => file !== 'progress.json'); // Skip progress files
      
      for (const file of files) {
        const filePath = path.join(categoryDir, file);
        const productsUpdated = await processJsonFile(filePath);
        totalProductsUpdated += productsUpdated;
        totalFilesProcessed++;
      }
      
      console.log(); // Empty line for readability
    }
    
    console.log('🎉 Update completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Files processed: ${totalFilesProcessed}`);
    console.log(`   - Products updated: ${totalProductsUpdated}`);
    console.log(`   - Categories: ${categories.length}`);
    
  } catch (error) {
    console.error('❌ Error during processing:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { updateProductFields, processJsonFile };