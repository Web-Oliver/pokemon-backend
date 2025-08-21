/**
 * Expansion Name Mapper for Sealed Products
 *
 * This script analyzes all sealed product JSON files and creates a comprehensive
 * mapping of unique expansion names across all product categories.
 */

import fs from 'fs';
import path from 'path';
import FileUtils from './core/FileUtils.js';
class ExpansionNameMapper {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.expansionSet = new Set();
    this.expansionsByCategory = new Map();
    this.expansionCounts = new Map();
    this.categoryCounts = new Map();
    this.products = [];
  }

  /**
   * Get all category directories
   */
  getCategoryDirectories() {
    return FileUtils.getCategoryDirectories(this.baseDir);
  }

  /**
   * Read and parse JSON file
   */
  readJsonFile(filePath) {
    return FileUtils.readJsonFile(filePath);
  }

  /**
   * Process a single category file
   */
  processCategoryFile(categoryDir) {
    const jsonFileName = `${categoryDir}.json`;
    const filePath = path.join(this.baseDir, categoryDir, jsonFileName);

    console.log(`Processing: ${categoryDir}`);

    if (!FileUtils.fileExists(filePath)) {
      console.warn(`⚠️  File not found: ${filePath}`);
      return;
    }

    const data = this.readJsonFile(filePath);

    if (!data.products || !Array.isArray(data.products)) {
      console.warn(`⚠️  No products array found in: ${filePath}`);
      return;
    }

    const categoryExpansions = new Set();
    let productsProcessed = 0;

    // Process each product in the category
    for (const product of data.products) {
      if (product.expansion) {
        const expansion = product.expansion.trim();

        // Add to global set
        this.expansionSet.add(expansion);

        // Add to category set
        categoryExpansions.add(expansion);

        // Count occurrences
        this.expansionCounts.set(expansion, (this.expansionCounts.get(expansion) || 0) + 1);

        // Store product data for detailed analysis
        this.products.push({
          name: product.name,
          expansion,
          category: categoryDir,
          price: product.price,
          available: product.available
        });

        productsProcessed++;
      } else {
        console.warn(`⚠️  Product missing expansion: ${product.name} in ${categoryDir}`);
      }
    }

    // Store category results
    this.expansionsByCategory.set(categoryDir, Array.from(categoryExpansions).sort());
    this.categoryCounts.set(categoryDir, productsProcessed);

    console.log(`   Found ${categoryExpansions.size} unique expansions in ${productsProcessed} products`);
  }

  /**
   * Generate detailed mapping report
   */
  generateDetailedReport() {
    const report = {
      summary: {
        total_unique_expansions: this.expansionSet.size,
        total_categories: this.expansionsByCategory.size,
        total_products: this.products.length,
        generated_at: new Date().toISOString()
      },
      expansions: {
        all_expansions: Array.from(this.expansionSet).sort(),
        expansion_counts: Object.fromEntries(
          Array.from(this.expansionCounts.entries())
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
        )
      },
      by_category: {},
      top_expansions: Array.from(this.expansionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([expansion, count]) => ({ expansion, product_count: count })),
      expansion_distribution: this.generateExpansionDistribution(),
      category_stats: Object.fromEntries(
        Array.from(this.categoryCounts.entries())
          .map(([category, count]) => [
            category,
            {
              product_count: count,
              unique_expansions: this.expansionsByCategory.get(category).length,
              expansions: this.expansionsByCategory.get(category)
            }
          ])
      )
    };

    // Add detailed category breakdown
    for (const [category, expansions] of this.expansionsByCategory.entries()) {
      report.by_category[category] = {
        expansion_count: expansions.length,
        expansions,
        products_in_category: this.categoryCounts.get(category)
      };
    }

    return report;
  }

  /**
   * Generate expansion distribution analysis
   */
  generateExpansionDistribution() {
    const distribution = {
      single_category: 0, // Expansions in only 1 category
      multi_category: 0, // Expansions in 2+ categories
      universal: 0, // Expansions in all categories
      category_breakdown: {}
    };

    // Analyze each expansion's category presence
    for (const expansion of this.expansionSet) {
      const categoriesWithExpansion = [];

      for (const [category, expansions] of this.expansionsByCategory.entries()) {
        if (expansions.includes(expansion)) {
          categoriesWithExpansion.push(category);
        }
      }

      const categoryCount = categoriesWithExpansion.length;

      if (categoryCount === 1) {
        distribution.single_category++;
      } else if (categoryCount === this.expansionsByCategory.size) {
        distribution.universal++;
      } else {
        distribution.multi_category++;
      }

      distribution.category_breakdown[expansion] = {
        category_count: categoryCount,
        categories: categoriesWithExpansion,
        total_products: this.expansionCounts.get(expansion)
      };
    }

    return distribution;
  }

  /**
   * Generate simple expansion list file
   */
  generateSimpleList() {
    return {
      expansions: Array.from(this.expansionSet).sort(),
      count: this.expansionSet.size,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Process all files and generate reports
   */
  async processAllFiles() {
    console.log('🔍 Analyzing sealed product expansion names...\n');

    const categories = this.getCategoryDirectories();

    if (categories.length === 0) {
      console.log('❌ No category directories found!');
      return;
    }

    console.log(`📂 Found ${categories.length} categories: ${categories.join(', ')}\n`);

    // Process each category
    for (const category of categories) {
      this.processCategoryFile(category);
    }

    console.log('\n📊 Processing completed!');
    console.log(`   • Categories processed: ${this.expansionsByCategory.size}`);
    console.log(`   • Total products: ${this.products.length}`);
    console.log(`   • Unique expansions: ${this.expansionSet.size}`);

    // Generate and save reports
    const detailedReport = this.generateDetailedReport();
    const simpleList = this.generateSimpleList();

    // Save detailed report
    const detailedReportPath = path.join(__dirname, '../data/expansion-mapping-detailed.json');

    FileUtils.writeJsonFile(detailedReportPath, detailedReport);
    console.log(`\n📄 Detailed report saved: ${detailedReportPath}`);

    // Save simple list
    const simpleListPath = path.join(__dirname, '../data/expansion-names-list.json');

    FileUtils.writeJsonFile(simpleListPath, simpleList);
    console.log(`📄 Simple list saved: ${simpleListPath}`);

    // Display summary
    this.displaySummary(detailedReport);

    return {
      detailed: detailedReport,
      simple: simpleList
    };
  }

  /**
   * Display summary to console
   */
  displaySummary(report) {
    console.log(`\n${'='.repeat(60)}`);
    console.log('📋 EXPANSION MAPPING SUMMARY');
    console.log('='.repeat(60));

    console.log('\n🎯 Overall Statistics:');
    console.log(`   • Total unique expansions: ${report.summary.total_unique_expansions}`);
    console.log(`   • Total categories: ${report.summary.total_categories}`);
    console.log(`   • Total products: ${report.summary.total_products}`);

    console.log('\n🏆 Top 10 Most Common Expansions:');
    report.top_expansions.slice(0, 10).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.expansion} (${item.product_count} products)`);
    });

    console.log('\n📊 Distribution Analysis:');
    console.log(`   • Single category only: ${report.expansion_distribution.single_category} expansions`);
    console.log(`   • Multiple categories: ${report.expansion_distribution.multi_category} expansions`);
    console.log(`   • Universal (all categories): ${report.expansion_distribution.universal} expansions`);

    console.log('\n📂 Category Breakdown:');
    Object.entries(report.category_stats).forEach(([category, stats]) => {
      console.log(`   • ${category}: ${stats.unique_expansions} expansions, ${stats.product_count} products`);
    });
  }
}

// Main execution
function main() {
  const baseDir = path.join(__dirname, '../data/SealedProducts');

  console.log('🗺️  Expansion Name Mapper for Sealed Products');
  console.log('='.repeat(60));
  console.log(`📂 Base directory: ${baseDir}\n`);

  if (!FileUtils.fileExists(baseDir)) {
    console.error(`❌ Base directory not found: ${baseDir}`);
    process.exit(1);
  }

  try {
    const mapper = new ExpansionNameMapper(baseDir);

    mapper.processAllFiles();
  } catch (error) {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

export default ExpansionNameMapper;
