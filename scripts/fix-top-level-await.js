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

function fixTopLevelAwaitInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix top-level const declarations with await import
  const topLevelAwaitPattern = /^const\s+(\w+)\s*=\s*\(await\s+import\(['"]([^'"]+)['"]\)\)\.default;?\s*$/gm;
  if (topLevelAwaitPattern.test(content)) {
    console.log(`  Fixing top-level await in: ${path.relative(srcDir, filePath)}`);
    content = content.replace(topLevelAwaitPattern, (match, identifier, modulePath) => {
      return `import ${identifier} from '${modulePath}';`;
    });
    modified = true;
  }
  
  // Fix destructured top-level await imports
  const destructuredAwaitPattern = /^const\s*\{\s*([^}]+)\s*\}\s*=\s*await\s+import\(['"]([^'"]+)['"]\);?\s*$/gm;
  if (destructuredAwaitPattern.test(content)) {
    console.log(`  Fixing destructured top-level await in: ${path.relative(srcDir, filePath)}`);
    content = content.replace(destructuredAwaitPattern, (match, imports, modulePath) => {
      return `import { ${imports} } from '${modulePath}';`;
    });
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

console.log('🔧 Fixing top-level await issues...\n');

const allFiles = findJSFiles(srcDir);
let fixedFiles = 0;

for (const file of allFiles) {
  if (fixTopLevelAwaitInFile(file)) {
    fixedFiles++;
  }
}

console.log(`\n✅ Fixed top-level await in ${fixedFiles} files`);