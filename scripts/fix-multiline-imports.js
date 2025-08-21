#!/usr/bin/env node

/**
 * Fix Multi-line Import Script
 * 
 * Fixes imports that are split across multiple lines, joining them into single lines
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
    srcDir: path.resolve(__dirname, '../src'),
    extensions: ['.js', '.mjs', '.cjs']
};

class MultilineImportFixer {
    constructor() {
        this.stats = { filesProcessed: 0, filesChanged: 0 };
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

    fixMultilineImports(content) {
        // Fix imports split across multiple lines
        const fixed = content.replace(
            /(import\s+(?:[^'"]*from\s+)?['"]@\/[^'"]*?)\n([^'"]*?['"];?)/gm,
            (match, part1, part2) => {
                // Join the lines and remove extra whitespace
                return part1 + part2.trim();
            }
        );
        
        return fixed;
    }

    async processFile(filePath) {
        try {
            const originalContent = await fs.promises.readFile(filePath, 'utf8');
            let content = originalContent;
            
            content = this.fixMultilineImports(content);
            
            this.stats.filesProcessed++;
            
            if (content !== originalContent) {
                this.stats.filesChanged++;
                await fs.promises.writeFile(filePath, content, 'utf8');
                console.log(`✅ Fixed: ${path.relative(CONFIG.srcDir, filePath)}`);
            }
            
        } catch (error) {
            console.error(`❌ Error processing ${filePath}: ${error.message}`);
        }
    }

    async run() {
        console.log('🔧 Fixing multi-line imports...');
        
        const files = await this.findJSFiles(CONFIG.srcDir);
        
        for (const filePath of files) {
            await this.processFile(filePath);
        }
        
        console.log(`\n📊 Summary: ${this.stats.filesChanged}/${this.stats.filesProcessed} files fixed`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const fixer = new MultilineImportFixer();
    fixer.run().catch(error => {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    });
}

export default MultilineImportFixer;