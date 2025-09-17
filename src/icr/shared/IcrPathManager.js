/**
 * IcrPathManager - Centralized ICR File Path Management
 *
 * Eliminates hardcoded path duplication across ICR services by providing
 * centralized path generation and management for all ICR-related files.
 *
 * BEFORE: Repeated patterns in ~6 ICR services:
 * - path.join(process.cwd(), 'uploads', 'icr', 'full-images', fileName)
 * - path.join(process.cwd(), 'uploads', 'icr', 'extracted-labels', fileName)
 * - Similar patterns for stitched images, results, metadata files
 *
 * AFTER: Centralized path management with consistent directory structure
 */

import path from 'path';
import {promises as fs} from 'fs';

export class IcrPathManager {
    // Base ICR directory structure
    static BASE_ICR_DIR = path.join(process.cwd(), 'uploads', 'icr');

    // ICR subdirectories
    static DIRECTORIES = {
        FULL_IMAGES: 'full-images',
        EXTRACTED_LABELS: 'extracted-labels',
        STITCHED_IMAGES: 'stitched-images',
        OCR_RESULTS: 'ocr-results',
        CARD_MATCHING: 'card-matching',
        METADATA: 'metadata',
        BATCH_EXPORTS: 'batch-exports',
        TEMP: 'temp'
    };

    /**
     * Get full path for a specific ICR directory
     * @param {string} directory - Directory type from DIRECTORIES constant
     * @returns {string} Full directory path
     */
    static getDirectory(directory) {
        if (!this.DIRECTORIES[directory]) {
            throw new Error(`Unknown ICR directory type: ${directory}`);
        }
        return path.join(this.BASE_ICR_DIR, this.DIRECTORIES[directory]);
    }

    /**
     * Get full file path within an ICR directory
     * @param {string} directory - Directory type from DIRECTORIES constant
     * @param {string} fileName - File name
     * @returns {string} Full file path
     */
    static getFilePath(directory, fileName) {
        return path.join(this.getDirectory(directory), fileName);
    }

    /**
     * Generate intelligent file names with metadata
     * @param {string} originalName - Original file name
     * @param {Object} metadata - File metadata
     * @returns {Object} File name info
     */
    static generateFileName(originalName, metadata = {}) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = path.parse(originalName).name;
        const extension = path.parse(originalName).ext;

        const parts = [baseName];

        if (metadata.batchId) {
            parts.push(`batch-${metadata.batchId}`);
        }

        if (metadata.cardId) {
            parts.push(`card-${metadata.cardId}`);
        }

        if (metadata.grade) {
            parts.push(`grade-${metadata.grade}`);
        }

        parts.push(timestamp);

        return {
            descriptive: `${parts.join('_')}${extension}`,
            timestamped: `${baseName}_${timestamp}${extension}`,
            original: originalName
        };
    }

    /**
     * Ensure all ICR directories exist
     * @returns {Promise<void>}
     */
    static async ensureDirectories() {
        const directories = Object.values(this.DIRECTORIES).map(dir =>
            path.join(this.BASE_ICR_DIR, dir)
        );

        await Promise.all(
            directories.map(dir =>
                fs.mkdir(dir, {recursive: true})
            )
        );
    }

    /**
     * Get paths for common ICR operations
     * @param {string} batchId - Batch identifier
     * @param {string} fileName - File name
     * @returns {Object} Common paths for ICR operations
     */
    static getBatchPaths(batchId, fileName = null) {
        const baseName = fileName ? path.parse(fileName).name : `batch-${batchId}`;

        return {
            fullImage: fileName ? this.getFilePath('FULL_IMAGES', fileName) : null,
            extractedLabel: this.getFilePath('EXTRACTED_LABELS', `${baseName}_extracted.jpg`),
            stitchedImage: this.getFilePath('STITCHED_IMAGES', `${baseName}_stitched.jpg`),
            ocrResults: this.getFilePath('OCR_RESULTS', `${baseName}_ocr.json`),
            cardMatching: this.getFilePath('CARD_MATCHING', `${baseName}_matches.json`),
            metadata: this.getFilePath('METADATA', `${baseName}_metadata.json`),
            batchExport: this.getFilePath('BATCH_EXPORTS', `batch-${batchId}_export.json`)
        };
    }

    /**
     * Clean up temporary files older than specified age
     * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
     * @returns {Promise<Object>} Cleanup results
     */
    static async cleanupTempFiles(maxAge = 24 * 60 * 60 * 1000) {
        const tempDir = this.getDirectory('TEMP');
        const cutoffTime = Date.now() - maxAge;

        try {
            const files = await fs.readdir(tempDir);
            const cleanupResults = {
                totalFiles: files.length,
                deletedFiles: 0,
                errors: []
            };

            for (const file of files) {
                try {
                    const filePath = path.join(tempDir, file);
                    const stats = await fs.stat(filePath);

                    if (stats.mtime.getTime() < cutoffTime) {
                        await fs.unlink(filePath);
                        cleanupResults.deletedFiles++;
                    }
                } catch (error) {
                    cleanupResults.errors.push({
                        file,
                        error: error.message
                    });
                }
            }

            return cleanupResults;
        } catch (error) {
            return {
                totalFiles: 0,
                deletedFiles: 0,
                errors: [{file: 'temp directory', error: error.message}]
            };
        }
    }

    /**
     * Get disk usage statistics for ICR directories
     * @returns {Promise<Object>} Directory usage statistics
     */
    static async getDirectoryStats() {
        const stats = {};

        for (const [key, dirName] of Object.entries(this.DIRECTORIES)) {
            try {
                const dirPath = this.getDirectory(key);
                const files = await fs.readdir(dirPath);

                let totalSize = 0;
                for (const file of files) {
                    try {
                        const filePath = path.join(dirPath, file);
                        const fileStat = await fs.stat(filePath);
                        totalSize += fileStat.size;
                    } catch (error) {
                        // Skip files we can't stat
                    }
                }

                stats[key] = {
                    directory: dirName,
                    path: dirPath,
                    fileCount: files.length,
                    totalSize,
                    totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100
                };
            } catch (error) {
                stats[key] = {
                    directory: dirName,
                    error: error.message,
                    fileCount: 0,
                    totalSize: 0
                };
            }
        }

        return stats;
    }

    /**
     * Validate file path is within ICR directories (security check)
     * @param {string} filePath - File path to validate
     * @returns {boolean} True if path is safe
     */
    static validatePath(filePath) {
        const resolvedPath = path.resolve(filePath);
        const resolvedBaseDir = path.resolve(this.BASE_ICR_DIR);

        return resolvedPath.startsWith(resolvedBaseDir);
    }

    /**
     * Get relative path from ICR base directory
     * @param {string} fullPath - Full file path
     * @returns {string} Relative path from ICR base
     */
    static getRelativePath(fullPath) {
        return path.relative(this.BASE_ICR_DIR, fullPath);
    }

    /**
     * Archive old batch files to reduce disk usage
     * @param {string} batchId - Batch ID to archive
     * @returns {Promise<Object>} Archive results
     */
    static async archiveBatch(batchId) {
        const archiveDir = path.join(this.BASE_ICR_DIR, 'archived', batchId);
        await fs.mkdir(archiveDir, {recursive: true});

        const batchFiles = [];
        const archiveResults = {
            batchId,
            archivedFiles: [],
            errors: []
        };

        // Find all files related to this batch
        for (const [key, dirName] of Object.entries(this.DIRECTORIES)) {
            if (key === 'ARCHIVED') continue;

            try {
                const dirPath = this.getDirectory(key);
                const files = await fs.readdir(dirPath);

                for (const file of files) {
                    if (file.includes(`batch-${batchId}`) || file.includes(batchId)) {
                        batchFiles.push({
                            source: path.join(dirPath, file),
                            destination: path.join(archiveDir, `${dirName}_${file}`)
                        });
                    }
                }
            } catch (error) {
                archiveResults.errors.push({
                    directory: dirName,
                    error: error.message
                });
            }
        }

        // Move files to archive
        for (const fileMove of batchFiles) {
            try {
                await fs.rename(fileMove.source, fileMove.destination);
                archiveResults.archivedFiles.push({
                    originalPath: fileMove.source,
                    archivePath: fileMove.destination
                });
            } catch (error) {
                archiveResults.errors.push({
                    file: fileMove.source,
                    error: error.message
                });
            }
        }

        return archiveResults;
    }
}

export default IcrPathManager;