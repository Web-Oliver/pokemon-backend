#!/usr/bin/env node

/**
 * Import Fix Script for Pokemon Collection Backend
 * 
 * This script fixes common import issues in the codebase:
 * 1. Converts invalid .js extensions on Node.js built-ins
 * 2. Standardizes path alias usage
 * 3. Adds missing file extensions for local imports
 * 4. Converts between CommonJS and ESM patterns
 * 
 * Usage: node scripts/fix-imports.js [--dry-run] [--verbose]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
    srcDir: path.resolve(__dirname, '../src'),
    dryRun: process.argv.includes('--dry-run'),
    verbose: process.argv.includes('--verbose'),
    extensions: ['.js', '.mjs', '.cjs'],
    
    // Node.js built-in modules that should NOT have .js extension
    nodeBuiltins: new Set([
        'mongoose', 'express', 'path', 'fs', 'url', 'crypto', 'http', 'https',
        'os', 'util', 'stream', 'events', 'buffer', 'child_process', 'cluster',
        'dgram', 'dns', 'net', 'querystring', 'readline', 'repl', 'string_decoder',
        'tls', 'tty', 'v8', 'vm', 'worker_threads', 'zlib', 'async_hooks',
        'inspector', 'perf_hooks', 'trace_events', 'diagnostics_channel',
        'sharp', 'cors', 'dotenv', 'winston', 'flexsearch', 'fuse.js', 'axios'
    ]),
    
    // Path patterns to fix
    pathPatterns: {
        // Fix mongoose.js -> mongoose
        nodeBuiltinWithJs: /from\s+['"]([^'"]+)\.js['"];?$/gm,
        
        // Fix incomplete path aliases (convert #@/ to @/)
        incompleteAlias: /from\s+['"](#@)\/([^'"]*?)(?:\.js)?['"];?$/gm,
        
        // Fix relative imports without extensions
        relativeWithoutExt: /from\s+['"](\.\.?\/[^'"]*?)(?<!\.js)['"];?$/gm,
        
        // Mix of import/require patterns
        requirePattern: /const\s+.*?=\s+require\(['"]([^'"]+)['"]\);?/g,
        moduleExportsPattern: /module\.exports\s*=/g
    }
};

class ImportFixer {
    constructor() {
        this.stats = {
            filesProcessed: 0,
            filesChanged: 0,
            fixes: {
                nodeBuiltinExtensions: 0,
                pathAliases: 0,
                relativeExtensions: 0,
                requireToImport: 0,
                moduleExportsToExport: 0
            }
        };
    }

    log(message, level = 'info') {
        if (level === 'verbose' && !CONFIG.verbose) return;
        
        const prefix = {
            error: '❌',
            warn: '⚠️ ',
            info: 'ℹ️ ',
            success: '✅',
            verbose: '🔍'
        };
        
        console.log(`${prefix[level]} ${message}`);
    }

    async findJSFiles(dir) {
        const files = [];
        
        const traverse = async (currentDir) => {
            const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    await traverse(fullPath);
                } else if (entry.isFile() && CONFIG.extensions.some(ext => entry.name.endsWith(ext))) {
                    files.push(fullPath);
                }
            }
        };
        
        await traverse(dir);
        return files;
    }

    fixNodeBuiltinExtensions(content) {
        let fixes = 0;
        
        const fixed = content.replace(CONFIG.pathPatterns.nodeBuiltinWithJs, (match, moduleName) => {
            const baseModule = moduleName.split('/')[0];
            
            if (CONFIG.nodeBuiltins.has(baseModule)) {
                fixes++;
                this.log(`  → Fixed Node builtin: ${moduleName}.js → ${moduleName}`, 'verbose');
                return match.replace(`${moduleName}.js`, moduleName);
            }
            
            return match;
        });
        
        this.stats.fixes.nodeBuiltinExtensions += fixes;
        return fixed;
    }

    fixPathAliases(content) {
        let fixes = 0;
        
        // Fix #@/ to @/ conversion
        const fixed = content.replace(CONFIG.pathPatterns.incompleteAlias, (match, aliasPrefix, importPath) => {
            fixes++;
            this.log(`  → Fixed path alias: ${aliasPrefix}/${importPath} → @/${importPath}`, 'verbose');
            
            // Ensure proper path structure and add .js if it's a file import
            let fixedPath = importPath;
            
            // If it looks like a file (not ending with a directory), add .js
            if (!importPath.endsWith('/') && !importPath.includes('.')) {
                const pathParts = importPath.split('/');
                const lastPart = pathParts[pathParts.length - 1];
                
                // Heuristic: if last part has capital letter or common file patterns, it's likely a file
                if (/^[A-Z]/.test(lastPart) || /Service|Controller|Repository|Model|Util/.test(lastPart)) {
                    fixedPath += '.js';
                }
            }
            
            return match.replace(`${aliasPrefix}/${importPath}`, `@/${fixedPath}`);
        });
        
        this.stats.fixes.pathAliases += fixes;
        return fixed;
    }

    fixRelativeExtensions(content, filePath) {
        let fixes = 0;
        
        const fixed = content.replace(CONFIG.pathPatterns.relativeWithoutExt, (match, importPath) => {
            const resolvedPath = path.resolve(path.dirname(filePath), importPath);
            
            // Check if the file exists with .js extension
            if (fs.existsSync(resolvedPath + '.js')) {
                fixes++;
                this.log(`  → Added .js extension to: ${importPath}`, 'verbose');
                return match.replace(`'${importPath}'`, `'${importPath}.js'`);
            }
            
            return match;
        });
        
        this.stats.fixes.relativeExtensions += fixes;
        return fixed;
    }

    convertRequireToImport(content) {
        let fixes = 0;
        
        // Convert simple require statements to imports
        const fixed = content.replace(CONFIG.pathPatterns.requirePattern, (match, modulePath) => {
            // Extract variable name from the require statement
            const varMatch = match.match(/const\s+({[^}]+}|\w+)/);
            
            if (varMatch) {
                const varName = varMatch[1];
                fixes++;
                this.log(`  → Converted require to import: ${modulePath}`, 'verbose');
                
                if (varName.startsWith('{')) {
                    // Destructured import
                    return `import ${varName} from '${modulePath}';`;
                } else {
                    // Default import
                    return `import ${varName} from '${modulePath}';`;
                }
            }
            
            return match;
        });
        
        this.stats.fixes.requireToImport += fixes;
        return fixed;
    }

    convertModuleExports(content) {
        let fixes = 0;
        
        // Convert module.exports to export statements (simple cases only)
        const fixed = content.replace(CONFIG.pathPatterns.moduleExportsPattern, (match) => {
            fixes++;
            this.log(`  → Found module.exports (manual review recommended)`, 'verbose');
            return match; // Keep as-is for now, manual review needed
        });
        
        this.stats.fixes.moduleExportsToExport += fixes;
        return fixed;
    }

    async processFile(filePath) {
        try {
            this.log(`Processing: ${path.relative(CONFIG.srcDir, filePath)}`, 'verbose');
            
            const originalContent = await fs.promises.readFile(filePath, 'utf8');
            let content = originalContent;
            
            // Apply all fixes
            content = this.fixNodeBuiltinExtensions(content);
            content = this.fixPathAliases(content);
            content = this.fixRelativeExtensions(content, filePath);
            
            // Only convert require/module.exports if requested
            if (process.argv.includes('--convert-cjs')) {
                content = this.convertRequireToImport(content);
                content = this.convertModuleExports(content);
            }
            
            this.stats.filesProcessed++;
            
            if (content !== originalContent) {
                this.stats.filesChanged++;
                
                if (CONFIG.dryRun) {
                    this.log(`Would modify: ${path.relative(CONFIG.srcDir, filePath)}`, 'info');
                } else {
                    await fs.promises.writeFile(filePath, content, 'utf8');
                    this.log(`Modified: ${path.relative(CONFIG.srcDir, filePath)}`, 'success');
                }
            }
            
        } catch (error) {
            this.log(`Error processing ${filePath}: ${error.message}`, 'error');
        }
    }

    async run() {
        this.log('🚀 Starting Import Fix Script', 'info');
        this.log(`Source directory: ${CONFIG.srcDir}`, 'info');
        this.log(`Dry run mode: ${CONFIG.dryRun}`, 'info');
        
        if (!fs.existsSync(CONFIG.srcDir)) {
            this.log(`Source directory not found: ${CONFIG.srcDir}`, 'error');
            process.exit(1);
        }
        
        try {
            const files = await this.findJSFiles(CONFIG.srcDir);
            this.log(`Found ${files.length} JavaScript files`, 'info');
            
            for (const filePath of files) {
                await this.processFile(filePath);
            }
            
            this.printStats();
            
        } catch (error) {
            this.log(`Fatal error: ${error.message}`, 'error');
            process.exit(1);
        }
    }

    printStats() {
        this.log('\n📊 Import Fix Summary', 'info');
        this.log(`Files processed: ${this.stats.filesProcessed}`, 'info');
        this.log(`Files changed: ${this.stats.filesChanged}`, 'info');
        
        this.log('\n🔧 Fixes applied:', 'info');
        Object.entries(this.stats.fixes).forEach(([type, count]) => {
            if (count > 0) {
                this.log(`  ${type}: ${count}`, 'success');
            }
        });
        
        if (CONFIG.dryRun) {
            this.log('\n💡 Run without --dry-run to apply changes', 'info');
        }
        
        if (this.stats.filesChanged === 0) {
            this.log('\n✨ No issues found - your imports look good!', 'success');
        } else {
            this.log(`\n✅ Successfully processed ${this.stats.filesChanged} files`, 'success');
        }
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    const fixer = new ImportFixer();
    fixer.run().catch(error => {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    });
}

export default ImportFixer;