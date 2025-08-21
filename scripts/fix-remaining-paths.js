#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

// Path mapping corrections
const pathMappings = {
  // ActivityService corrections
  '@/Application/Services/Activity/activityService.js': '@/Application/UseCases/Activities/activityService.js',
  '@/Activities/activityService.js': '@/Application/UseCases/Activities/activityService.js',
  
  // ProductSearchService corrections
  '@/Application/UseCases/Products/ProductSearchService.js': '@/Application/UseCases/Products/products/ProductSearchService.js',
  
  // Services directory corrections (need to find actual locations)
  '@/Application/Services/Core/psaLabelService.js': '@/Application/UseCases/PSA/psaLabelService.js',
  '@/Application/Services/Core/stitchedLabelService.js': '@/Application/UseCases/PSA/stitchedLabelService.js', 
  '@/Application/Services/Cache/cacheWarmupService.js': '@/Infrastructure/Utilities/cacheWarmupService.js',
  '@/Application/Services/System/backupService.js': '@/Infrastructure/Utilities/backupService.js',
  '@/Application/Services/Data/dbaExportService.js': '@/Application/UseCases/Analytics/dbaExportService.js',
  '@/Application/Services/Data/dbaIntegrationService.js': '@/Application/UseCases/Analytics/dbaIntegrationService.js',
  '@/Application/Services/Ocr/stitchedLabelService.js': '@/Application/UseCases/PSA/stitchedLabelService.js',
  '@/Application/Services/Ocr/UnifiedOcrMatchingService.js': '@/Application/UseCases/OCR/UnifiedOcrMatchingService.js'
};

// Find all JavaScript files
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

// Check if file exists
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

// Find actual file locations
function findActualPath(relativePath) {
  const baseName = path.basename(relativePath, '.js');
  const possiblePaths = [];
  
  // Search through common directories
  const searchDirs = [
    'Application/UseCases',
    'Infrastructure/Utilities', 
    'Infrastructure/Services',
    'Application/Services',
    'Domain/Services'
  ];
  
  for (const dir of searchDirs) {
    const fullDir = path.join(srcDir, dir);
    if (fs.existsSync(fullDir)) {
      findJSFiles(fullDir).forEach(file => {
        if (path.basename(file, '.js') === baseName) {
          const relativePath = path.relative(srcDir, file).replace(/\\/g, '/');
          possiblePaths.push('@/' + relativePath);
        }
      });
    }
  }
  
  return possiblePaths[0]; // Return first match
}

// Fix imports in a file
function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check each mapping
  for (const [oldPath, newPath] of Object.entries(pathMappings)) {
    if (content.includes(oldPath)) {
      console.log(`  Fixing: ${oldPath} -> ${newPath}`);
      content = content.replace(new RegExp(oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newPath);
      modified = true;
    }
  }
  
  // Look for other broken imports and try to fix them
  const importRegex = /import\s+.*?from\s+['"](@\/[^'"]+)['"];?/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const absolutePath = path.join(srcDir, importPath.replace('@/', ''));
    
    if (!fileExists(absolutePath)) {
      console.log(`  Broken import found: ${importPath}`);
      
      // Try to find the actual file
      const actualPath = findActualPath(importPath);
      if (actualPath) {
        const actualAbsolutePath = path.join(srcDir, actualPath.replace('@/', ''));
        if (fileExists(actualAbsolutePath)) {
          console.log(`  Auto-fixing: ${importPath} -> ${actualPath}`);
          content = content.replace(importPath, actualPath);
          modified = true;
        }
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

// Main execution
console.log('🔧 Fixing remaining import path issues...\n');

const allFiles = findJSFiles(srcDir);
let fixedFiles = 0;

for (const file of allFiles) {
  const relativePath = path.relative(srcDir, file);
  
  if (fixImportsInFile(file)) {
    console.log(`✅ Fixed imports in: ${relativePath}`);
    fixedFiles++;
  }
}

console.log(`\n🎉 Fixed imports in ${fixedFiles} files`);

// Generate report of any missing files
console.log('\n📊 Checking for any remaining missing files...');
const missingFiles = [];

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /import\s+.*?from\s+['"](@\/[^'"]+)['"];?/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const absolutePath = path.join(srcDir, importPath.replace('@/', ''));
    
    if (!fileExists(absolutePath)) {
      const relativePath = path.relative(srcDir, file);
      missingFiles.push({ file: relativePath, import: importPath });
    }
  }
}

if (missingFiles.length > 0) {
  console.log('\n⚠️  Still missing files:');
  missingFiles.forEach(({ file, import: imp }) => {
    console.log(`  ${file} -> ${imp}`);
  });
} else {
  console.log('\n✅ All import paths appear to be correct!');
}