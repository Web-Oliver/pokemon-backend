/**
 * ICR File Service - File System Operations
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles file system operations for ICR
 * - Open/Closed: Extensible for new file operations
 * - Dependency Inversion: Abstracts file operations from controllers
 */

import fs from 'fs/promises';
import path from 'path';
import Logger from '@/system/logging/Logger.js';
import {FileSystemUtils} from '@/icr/shared/FileSystemUtils.js';

import IcrPathManager from '@/icr/shared/IcrPathManager.js';

export class IcrFileService {
    constructor() {
        // Use IcrPathManager for centralized path management
        this.baseUploadDir = IcrPathManager.BASE_ICR_DIR;
        this.directories = {
            fullImages: IcrPathManager.getDirectory('FULL_IMAGES'),
            extractedLabels: IcrPathManager.getDirectory('EXTRACTED_LABELS'),
            stitchedImages: IcrPathManager.getDirectory('STITCHED_IMAGES')
        };
    }

    /**
     * Ensure all ICR directories exist
     */
    async ensureDirectories() {
        try {
            for (const [dirName, dirPath] of Object.entries(this.directories)) {
                await fs.mkdir(dirPath, {recursive: true});
                Logger.debug('IcrFileService', `Ensured directory: ${dirName}`, {path: dirPath});
            }
        } catch (error) {
            Logger.error('IcrFileService', 'Failed to ensure directories', error);
            throw error;
        }
    }

    /**
     * Get upload directory path for specific type
     */
    getUploadPath(type = 'fullImages') {
        if (!this.directories[type]) {
            throw new Error(`Unknown directory type: ${type}`);
        }
        return this.directories[type];
    }

    /**
     * Generate safe filename with timestamp
     */
    generateSafeFilename(originalName, prefix = '') {
        const timestamp = Date.now();
        const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
        return prefix ? `${prefix}_${timestamp}_${safeName}` : `${timestamp}_${safeName}`;
    }

    /**
     * Validate file path to prevent directory traversal
     */
    validateFilePath(filePath) {
        const normalizedPath = path.resolve(filePath);
        const allowedBasePath = path.resolve(this.baseUploadDir);

        if (!normalizedPath.startsWith(allowedBasePath)) {
            throw new Error('Invalid file path - outside allowed directory');
        }

        return normalizedPath;
    }

    /**
     * Read file with validation
     */
    async readFile(filePath) {
        const validatedPath = this.validateFilePath(filePath);

        try {
            return await fs.readFile(validatedPath);
        } catch (error) {
            Logger.error('IcrFileService', 'Failed to read file', error, {filePath: validatedPath});
            throw new Error(`File not found: ${path.basename(validatedPath)}`);
        }
    }

    /**
     * Write file to specific directory type
     */
    async writeFile(buffer, filename, directoryType = 'fullImages') {
        await this.ensureDirectories();

        const directoryPath = this.getUploadPath(directoryType);
        const filePath = path.join(directoryPath, filename);

        try {
            await fs.writeFile(filePath, buffer);
            Logger.info('IcrFileService', 'File written successfully', {
                filePath,
                size: buffer.length,
                directoryType
            });
            return filePath;
        } catch (error) {
            Logger.error('IcrFileService', 'Failed to write file', error, {filePath});
            throw error;
        }
    }

    /**
     * Delete file with validation
     */
    async deleteFile(filePath) {
        if (!filePath) {
            return false;
        }

        try {
            const validatedPath = this.validateFilePath(filePath);
            await fs.unlink(validatedPath);
            Logger.info('IcrFileService', 'File deleted successfully', {filePath: validatedPath});
            return true;
        } catch (error) {
            if (error.code === 'ENOENT') {
                Logger.warn('IcrFileService', 'File not found for deletion', {filePath});
                return false;
            }
            Logger.error('IcrFileService', 'Failed to delete file', error, {filePath});
            throw error;
        }
    }

    /**
     * Get file stats
     */
    async getFileStats(filePath) {
        const validatedPath = this.validateFilePath(filePath);

        try {
            return await fs.stat(validatedPath);
        } catch (error) {
            Logger.error('IcrFileService', 'Failed to get file stats', error, {filePath: validatedPath});
            throw new Error(`File not accessible: ${path.basename(validatedPath)}`);
        }
    }

    /**
     * Get content type from file extension
     * REFACTORED: Uses centralized FileSystemUtils - NO MORE DUPLICATION
     */
    getContentType(filePath) {
        return FileSystemUtils.getContentType(filePath);
    }

    /**
     * Validate image file type
     * REFACTORED: Uses centralized FileSystemUtils - NO MORE DUPLICATION
     */
    isValidImageFile(filename, mimeType) {
        return FileSystemUtils.isValidImageFile(filename, mimeType);
    }
}

export default IcrFileService;