#!/usr/bin/env node

/**
 * Import Analysis Script for Pokemon Collection Backend
 * 
 * Analyzes import patterns and generates a comprehensive report
 * about the current state of imports in the codebase.
 * 
 * Usage: node scripts/import-analysis.js [--detailed]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
    srcDir: path.resolve(__dirname, '../src'),
    detailed: process.argv.includes('--detailed'),
    extensions: ['.js', '.mjs', '.cjs']
};

class ImportAnalyzer {
    constructor() {
        this.analysis = {
            totalFiles: 0,
            importPatterns: {
                esm: 0,
                commonjs: 0,
                mixed: 0
            },
            issues: {
                invalidNodeBuiltins: [],
                missingExtensions: [],
                brokenAliases: [],
                circularDependencies: [],
                unusedImports: []
            },
            dependencies: new Map(),
            pathAliases: {
                using: 0,
                notUsing: 0
            }
        };
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

    analyzeFile(filePath, content) {
        const relativePath = path.relative(CONFIG.srcDir, filePath);
        let hasESM = false;
        let hasCommonJS = false;
        
        // Track import patterns
        const esmPatterns = [
            /^import\s+/gm,
            /^export\s+/gm,
            /import\.meta/g
        ];
        
        const cjsPatterns = [
            /require\s*\(/g,
            /module\.exports/g,
            /exports\./g
        ];
        
        // Check for ESM patterns
        esmPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                hasESM = true;
            }
        });
        
        // Check for CommonJS patterns
        cjsPatterns.forEach(pattern => {
            if (pattern.test(content)) {
                hasCommonJS = true;
            }
        });
        
        // Classify file
        if (hasESM && hasCommonJS) {
            this.analysis.importPatterns.mixed++;
        } else if (hasESM) {
            this.analysis.importPatterns.esm++;
        } else if (hasCommonJS) {
            this.analysis.importPatterns.commonjs++;
        }
        
        // Find specific issues
        this.findInvalidNodeBuiltins(content, relativePath);
        this.findMissingExtensions(content, filePath, relativePath);
        this.findBrokenAliases(content, relativePath);
        this.trackDependencies(content, relativePath);
    }

    findInvalidNodeBuiltins(content, relativePath) {
        const nodeBuiltins = [
            'mongoose', 'express', 'path', 'fs', 'url', 'crypto', 'sharp', 
            'cors', 'dotenv', 'winston', 'flexsearch', 'axios'
        ];
        
        const pattern = /(?:import|from|require\(['"])\s*([^'"]+)\.js['"\)]/g;
        let match;
        
        while ((match = pattern.exec(content)) !== null) {
            const moduleName = match[1];
            const baseModule = moduleName.split('/')[0];
            
            if (nodeBuiltins.includes(baseModule)) {
                this.analysis.issues.invalidNodeBuiltins.push({
                    file: relativePath,
                    module: moduleName + '.js',
                    line: this.getLineNumber(content, match.index)
                });
            }
        }
    }

    findMissingExtensions(content, filePath, relativePath) {
        const relativeImportPattern = /(?:import|from)\s+['"](\.\.[^'"]*?)['"];?/g;
        let match;
        
        while ((match = relativeImportPattern.exec(content)) !== null) {
            const importPath = match[1];
            
            if (!importPath.endsWith('.js') && !importPath.endsWith('/')) {
                const resolvedPath = path.resolve(path.dirname(filePath), importPath);
                
                if (fs.existsSync(resolvedPath + '.js')) {
                    this.analysis.issues.missingExtensions.push({
                        file: relativePath,
                        importPath: importPath,
                        line: this.getLineNumber(content, match.index)
                    });
                }
            }
        }
    }

    findBrokenAliases(content, relativePath) {
        const aliasPattern = /#@\/([^'"]*?)(?:\.js)?['"]/g;
        let match;
        
        while ((match = aliasPattern.exec(content)) !== null) {
            const aliasPath = match[1];
            const fullPath = path.resolve(CONFIG.srcDir, aliasPath);
            
            if (!fs.existsSync(fullPath) && !fs.existsSync(fullPath + '.js')) {
                this.analysis.issues.brokenAliases.push({
                    file: relativePath,
                    alias: `#@/${aliasPath}`,
                    line: this.getLineNumber(content, match.index)
                });
            }
            
            this.analysis.pathAliases.using++;
        }
        
        // Check for files not using aliases that could
        const relativeToSrcPattern = /from\s+['"]\.\.\/.*?['"]/g;
        if (relativeToSrcPattern.test(content)) {
            this.analysis.pathAliases.notUsing++;
        }
    }

    trackDependencies(content, relativePath) {
        const importPattern = /(?:import|from|require\(['"])\s*([^'"]+)['"\)]/g;
        let match;
        
        const dependencies = [];
        
        while ((match = importPattern.exec(content)) !== null) {
            const dependency = match[1];
            dependencies.push(dependency);
        }
        
        this.analysis.dependencies.set(relativePath, dependencies);
    }

    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    async run() {
        console.log('🔍 Starting Import Analysis...\n');
        
        if (!fs.existsSync(CONFIG.srcDir)) {
            console.error(`❌ Source directory not found: ${CONFIG.srcDir}`);
            process.exit(1);
        }
        
        try {
            const files = await this.findJSFiles(CONFIG.srcDir);
            this.analysis.totalFiles = files.length;
            
            console.log(`📁 Found ${files.length} JavaScript files\n`);
            
            for (const filePath of files) {
                const content = await fs.promises.readFile(filePath, 'utf8');
                this.analyzeFile(filePath, content);
            }
            
            this.generateReport();
            
        } catch (error) {
            console.error(`❌ Analysis failed: ${error.message}`);
            process.exit(1);
        }
    }

    generateReport() {
        console.log('📊 IMPORT ANALYSIS REPORT\n');
        console.log('=' * 50);
        
        // Overview
        console.log('\n📈 OVERVIEW');
        console.log(`Total files analyzed: ${this.analysis.totalFiles}`);
        console.log(`ESM files: ${this.analysis.importPatterns.esm}`);
        console.log(`CommonJS files: ${this.analysis.importPatterns.commonjs}`);
        console.log(`Mixed pattern files: ${this.analysis.importPatterns.mixed}`);
        
        // Issues Summary
        const totalIssues = Object.values(this.analysis.issues)
            .reduce((sum, issues) => sum + issues.length, 0);
        
        console.log(`\n🚨 ISSUES FOUND: ${totalIssues}`);
        
        if (this.analysis.issues.invalidNodeBuiltins.length > 0) {
            console.log(`\n❌ Invalid Node.js Built-in Extensions (${this.analysis.issues.invalidNodeBuiltins.length}):`);
            this.analysis.issues.invalidNodeBuiltins.forEach(issue => {
                console.log(`  • ${issue.file}:${issue.line} - ${issue.module}`);
            });
        }
        
        if (this.analysis.issues.missingExtensions.length > 0) {
            console.log(`\n❌ Missing File Extensions (${this.analysis.issues.missingExtensions.length}):`);
            this.analysis.issues.missingExtensions.forEach(issue => {
                console.log(`  • ${issue.file}:${issue.line} - ${issue.importPath}`);
            });
        }
        
        if (this.analysis.issues.brokenAliases.length > 0) {
            console.log(`\n❌ Broken Path Aliases (${this.analysis.issues.brokenAliases.length}):`);
            this.analysis.issues.brokenAliases.forEach(issue => {
                console.log(`  • ${issue.file}:${issue.line} - ${issue.alias}`);
            });
        }
        
        // Path Alias Usage
        console.log(`\n🔗 PATH ALIAS USAGE:`);
        console.log(`Files using aliases: ${this.analysis.pathAliases.using}`);
        console.log(`Files not using aliases: ${this.analysis.pathAliases.notUsing}`);
        
        if (CONFIG.detailed) {
            this.generateDetailedReport();
        }
        
        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        
        if (this.analysis.issues.invalidNodeBuiltins.length > 0) {
            console.log('  1. Remove .js extensions from Node.js built-in modules');
        }
        
        if (this.analysis.issues.missingExtensions.length > 0) {
            console.log('  2. Add .js extensions to relative imports');
        }
        
        if (this.analysis.issues.brokenAliases.length > 0) {
            console.log('  3. Fix broken path aliases');
        }
        
        if (this.analysis.importPatterns.mixed > 0) {
            console.log('  4. Consider standardizing on ESM throughout the codebase');
        }
        
        if (this.analysis.pathAliases.notUsing > 0) {
            console.log('  5. Consider using path aliases for better maintainability');
        }
        
        console.log('\n🛠️  Run: node scripts/fix-imports.js --dry-run to see what would be fixed');
        console.log('🛠️  Run: node scripts/fix-imports.js to apply fixes');
    }

    generateDetailedReport() {
        console.log('\n📋 DETAILED DEPENDENCY ANALYSIS:');
        
        const dependencyCount = new Map();
        
        // Count imports per module
        this.analysis.dependencies.forEach((deps, file) => {
            deps.forEach(dep => {
                dependencyCount.set(dep, (dependencyCount.get(dep) || 0) + 1);
            });
        });
        
        // Show most imported modules
        const sortedDeps = Array.from(dependencyCount.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);
        
        console.log('\nMost imported modules:');
        sortedDeps.forEach(([module, count]) => {
            console.log(`  • ${module}: ${count} times`);
        });
    }
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
    const analyzer = new ImportAnalyzer();
    analyzer.run().catch(error => {
        console.error('❌ Analysis failed:', error.message);
        process.exit(1);
    });
}

export default ImportAnalyzer;