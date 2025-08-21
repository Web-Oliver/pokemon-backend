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

// Load package.json to see what's already installed
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const installedPackages = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies
};

console.log('🔍 Scanning for missing npm packages...\n');

const allFiles = findJSFiles(srcDir);
const missingPackages = new Set();

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find import statements for npm packages (not relative imports)
  const importRegex = /import\s+.*?from\s+['"]([^.'\/][^'"]*)['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const packageName = match[1];
    
    // Skip built-in Node.js modules
    const builtinModules = ['fs', 'path', 'os', 'crypto', 'util', 'url', 'querystring', 'stream', 'events', 'buffer', 'timers', 'readline', 'http', 'https', 'zlib', 'child_process'];
    if (builtinModules.includes(packageName)) continue;
    
    // Skip path alias imports
    if (packageName.startsWith('@/')) continue;
    
    // Extract base package name (handle scoped packages)
    let basePackageName = packageName;
    if (packageName.startsWith('@')) {
      const parts = packageName.split('/');
      basePackageName = `${parts[0]}/${parts[1]}`;
    } else {
      basePackageName = packageName.split('/')[0];
    }
    
    // Check if package is installed
    if (!installedPackages[basePackageName]) {
      missingPackages.add(basePackageName);
    }
  }
}

if (missingPackages.size === 0) {
  console.log('✅ All npm packages are installed!');
} else {
  console.log('❌ Missing npm packages:');
  [...missingPackages].sort().forEach(pkg => {
    console.log(`  - ${pkg}`);
  });
  
  console.log('\n📦 Install command:');
  console.log(`npm install ${[...missingPackages].sort().join(' ')}`);
}

console.log(`\n📊 Scanned ${allFiles.length} files`);
console.log(`📦 Found ${missingPackages.size} missing packages`);