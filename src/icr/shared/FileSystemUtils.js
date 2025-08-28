/**
 * File System Utilities - Centralized File Operations
 * 
 * ELIMINATES CODE DUPLICATION for file operations across ICR services.
 * 
 * BEFORE: Duplicate content type, file deletion, and validation logic 
 *         spread across IcrFileService, IcrControllerService
 * AFTER: Single source of truth for all file operations
 */

import fs from 'fs/promises';
import path from 'path';
import Logger from '@/system/logging/Logger.js';

export class FileSystemUtils {
  /**
   * Get content type from file extension
   * SINGLE IMPLEMENTATION - eliminates duplication
   */
  static getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp'
    };
    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Delete files safely with error handling
   * SINGLE IMPLEMENTATION - eliminates duplication
   */
  static async deleteFilesSafely(filePaths) {
    if (!Array.isArray(filePaths)) {
      filePaths = [filePaths];
    }

    const results = {
      deleted: [],
      failed: [],
      notFound: []
    };

    for (const filePath of filePaths) {
      if (!filePath) {
        continue;
      }

      try {
        await fs.unlink(filePath);
        results.deleted.push(filePath);
        Logger.info('FileSystemUtils', 'File deleted successfully', { filePath });
      } catch (error) {
        if (error.code === 'ENOENT') {
          results.notFound.push(filePath);
          Logger.warn('FileSystemUtils', 'File not found for deletion', { filePath });
        } else {
          results.failed.push({ filePath, error: error.message });
          Logger.error('FileSystemUtils', 'Failed to delete file', error, { filePath });
        }
      }
    }

    return results;
  }

  /**
   * Validate image file path to prevent directory traversal
   * SINGLE IMPLEMENTATION - eliminates duplication
   */
  static validateImagePath(filePath, allowedBasePath) {
    const normalizedPath = path.resolve(filePath);
    const allowedBase = path.resolve(allowedBasePath);
    
    if (!normalizedPath.startsWith(allowedBase)) {
      throw new Error('Invalid file path - outside allowed directory');
    }
    
    return normalizedPath;
  }

  /**
   * Validate image file type
   * SINGLE IMPLEMENTATION - eliminates duplication
   */
  static isValidImageFile(filename, mimeType) {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
    
    const ext = path.extname(filename).toLowerCase();
    return allowedExtensions.includes(ext) && allowedMimeTypes.includes(mimeType);
  }

  /**
   * Copy file with validation and error handling
   */
  static async copyFileWithValidation(sourcePath, destinationPath, allowedSourceDir, allowedDestDir) {
    try {
      // Validate paths
      const validatedSource = this.validateImagePath(sourcePath, allowedSourceDir);
      const validatedDest = this.validateImagePath(destinationPath, allowedDestDir);

      // Ensure destination directory exists
      await fs.mkdir(path.dirname(validatedDest), { recursive: true });

      // Copy file
      await fs.copyFile(validatedSource, validatedDest);
      
      Logger.info('FileSystemUtils', 'File copied successfully', {
        source: validatedSource,
        destination: validatedDest
      });

      return validatedDest;
    } catch (error) {
      Logger.error('FileSystemUtils', 'Failed to copy file', error, { 
        sourcePath, 
        destinationPath 
      });
      throw error;
    }
  }

  /**
   * Read file with validation
   */
  static async readFileWithValidation(filePath, allowedBasePath) {
    try {
      const validatedPath = this.validateImagePath(filePath, allowedBasePath);
      const buffer = await fs.readFile(validatedPath);
      const stats = await fs.stat(validatedPath);

      return {
        buffer,
        stats,
        contentType: this.getContentType(validatedPath),
        size: stats.size,
        lastModified: stats.mtime
      };
    } catch (error) {
      Logger.error('FileSystemUtils', 'Failed to read file', error, { filePath });
      throw new Error(`File not found: ${path.basename(filePath)}`);
    }
  }

  /**
   * Generate safe filename with timestamp
   */
  static generateSafeFilename(originalName, prefix = '') {
    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return prefix ? `${prefix}_${timestamp}_${safeName}` : `${timestamp}_${safeName}`;
  }
}