#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

// Path mappings to fix searchCache imports
const pathMappings = {
  // searchCache.js is in Presentation/Middleware, not Infrastructure/Utilities
  '@/Infrastructure/Utilities/searchCache.js': '@/Presentation/Middleware/searchCache.js',
  
  // Fix other common wrong paths
  'from \'@/Infrastructure/Utilities/searchCache.js\'': 'from \'@/Presentation/Middleware/searchCache.js\'',
  'import.*from.*@/Infrastructure/Utilities/searchCache': 'import { cacheManager, getCacheStats, invalidateCacheByEntity, invalidateCacheByPattern } from \'@/Presentation/Middleware/searchCache.js\'',
};

function findJSFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findJSFiles(fullPath, files);
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix wrong searchCache path
  if (content.includes('@/Infrastructure/Utilities/searchCache.js')) {
    console.log(`  Fixing searchCache import in: ${path.relative(srcDir, filePath)}`);
    content = content.replace(
      /@\/Infrastructure\/Utilities\/searchCache\.js/g,
      '@/Presentation/Middleware/searchCache.js'
    );
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

console.log('🔧 Fixing searchCache import paths...\n');

const allFiles = findJSFiles(srcDir);
let fixedFiles = 0;

for (const file of allFiles) {
  if (fixImportsInFile(file)) {
    fixedFiles++;
  }
}

console.log(`\n✅ Fixed searchCache imports in ${fixedFiles} files`);