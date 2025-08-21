#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src');

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

function fixDynamicImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix invalid import statements inside functions/blocks
  const invalidPatterns = [
    // Fix "import PsaGradedCard from ..." inside functions
    {
      pattern: /(\s+)import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?\s*$/gm,
      replacement: (match, indent, identifier, modulePath) => {
        return `${indent}const ${identifier} = (await import('${modulePath}')).default;`;
      }
    },
    // Fix "import { something } from ..." inside functions
    {
      pattern: /(\s+)import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"];?\s*$/gm,
      replacement: (match, indent, imports, modulePath) => {
        return `${indent}const { ${imports} } = await import('${modulePath}');`;
      }
    },
    // Fix "this.fuse = import 'fuse.js';" style
    {
      pattern: /(\s+)(\w+)\.(\w+)\s*=\s*import\s+['"]([^'"]+)['"];?\s*$/gm,
      replacement: (match, indent, obj, prop, modulePath) => {
        return `${indent}${obj}.${prop} = (await import('${modulePath}')).default;`;
      }
    }
  ];
  
  for (const { pattern, replacement } of invalidPatterns) {
    if (pattern.test(content)) {
      console.log(`  Fixing dynamic imports in: ${path.relative(srcDir, filePath)}`);
      content = content.replace(pattern, replacement);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

console.log('🔧 Fixing dynamic import syntax errors...\n');

const allFiles = findJSFiles(srcDir);
let fixedFiles = 0;

for (const file of allFiles) {
  if (fixDynamicImportsInFile(file)) {
    fixedFiles++;
  }
}

console.log(`\n✅ Fixed dynamic imports in ${fixedFiles} files`);