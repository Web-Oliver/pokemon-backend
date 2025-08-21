#!/usr/bin/env node

/**
 * Fix CommonJS to ES Module Exports Script
 * 
 * Converts all module.exports = {...} to ES module export syntax
 * This fixes import errors when ES modules try to import from CommonJS modules
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Counter for tracking changes
let filesProcessed = 0;
let filesChanged = 0;
let totalChanges = 0;

/**
 * Check if file should be processed (exclude config and node_modules)
 */
function shouldProcessFile(filePath) {
  const excludePatterns = [
    /node_modules/,
    /\.git/,
    /jest\.config\.js$/,
    /\.prettierrc\.js$/,
    /eslint\.config\.js$/,
    /start\.cjs$/
  ];
  
  // Only exclude files, not directories
  if (filePath.endsWith('.js')) {
    return !excludePatterns.some(pattern => pattern.test(filePath));
  }
  
  // Allow directories unless they match exclude patterns
  return !excludePatterns.some(pattern => pattern.test(filePath));
}

/**
 * Convert CommonJS exports to ES module exports
 */
function convertExports(content, filePath) {
  let changed = false;
  let changeCount = 0;
  
  // Pattern 1: module.exports = { ... }
  const objectExportPattern = /module\.exports\s*=\s*\{([^}]*)\}/gs;
  if (objectExportPattern.test(content)) {
    content = content.replace(objectExportPattern, (match, exports) => {
      changed = true;
      changeCount++;
      
      // Extract export names
      const exportNames = exports
        .split(',')
        .map(exp => exp.trim())
        .filter(exp => exp && !exp.includes(':'))
        .map(exp => exp.replace(/[,\s]/g, ''))
        .filter(exp => exp);
      
      if (exportNames.length === 0) {
        return match; // Keep original if we can't parse
      }
      
      const namedExports = `export {\n  ${exportNames.join(',\n  ')}\n};`;
      const defaultExport = `\nexport default ${exportNames[0]};`;
      
      console.log(`  📦 Converting object exports: {${exportNames.join(', ')}}`);
      return namedExports + defaultExport;
    });
  }
  
  // Pattern 2: module.exports = SomeClass/Function
  const singleExportPattern = /module\.exports\s*=\s*([^{;][^;]*);?$/gm;
  if (singleExportPattern.test(content)) {
    content = content.replace(singleExportPattern, (match, exportValue) => {
      const trimmed = exportValue.trim();
      if (trimmed && !trimmed.includes('{')) {
        changed = true;
        changeCount++;
        console.log(`  🎯 Converting single export: ${trimmed}`);
        return `export default ${trimmed};`;
      }
      return match;
    });
  }
  
  // Pattern 3: exports.something = value
  const namedExportPattern = /exports\.(\w+)\s*=\s*([^;]+);?/g;
  const namedExports = [];
  let namedExportContent = content;
  
  namedExportContent = namedExportContent.replace(namedExportPattern, (match, name, value) => {
    changed = true;
    changeCount++;
    namedExports.push(name);
    console.log(`  🏷️ Converting named export: ${name}`);
    return `export const ${name} = ${value};`;
  });
  
  if (namedExports.length > 0) {
    content = namedExportContent;
  }
  
  if (changed) {
    filesChanged++;
    totalChanges += changeCount;
    console.log(`  ✅ Made ${changeCount} export conversions`);
  }
  
  return content;
}

/**
 * Process a single file
 */
async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // Skip if no CommonJS exports
    if (!content.includes('module.exports') && !content.includes('exports.')) {
      return;
    }
    
    console.log(`\n🔧 Processing: ${path.relative(process.cwd(), filePath)}`);
    
    const newContent = convertExports(content, filePath);
    
    if (newContent !== content) {
      await fs.writeFile(filePath, newContent, 'utf8');
      console.log(`  💾 Updated file`);
    } else {
      console.log(`  ⏭️ No changes needed`);
    }
    
    filesProcessed++;
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Recursively find all JavaScript files
 */
async function findJsFiles(dir) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (shouldProcessFile(fullPath)) {
          const subFiles = await findJsFiles(fullPath);
          files.push(...subFiles);
        }
      } else if (entry.isFile() && shouldProcessFile(fullPath)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting CommonJS to ES Module Export Conversion');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  const srcDir = path.join(__dirname, '..', 'src');
  
  try {
    // Find all JavaScript files
    console.log(`📁 Scanning for JavaScript files in: ${srcDir}`);
    const jsFiles = await findJsFiles(srcDir);
    
    console.log(`📊 Found ${jsFiles.length} JavaScript files to check`);
    
    // Process each file
    for (const file of jsFiles) {
      await processFile(file);
    }
    
    const duration = Date.now() - startTime;
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ CommonJS Export Conversion Complete!');
    console.log(`📈 Summary:`);
    console.log(`   • Files processed: ${filesProcessed}`);
    console.log(`   • Files changed: ${filesChanged}`);
    console.log(`   • Total conversions: ${totalChanges}`);
    console.log(`   • Duration: ${duration}ms`);
    
    if (filesChanged > 0) {
      console.log('\n🎉 Successfully converted CommonJS exports to ES modules!');
      console.log('💡 You can now test the application startup again.');
    } else {
      console.log('\n📋 No CommonJS exports found that needed conversion.');
    }
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);