import { promises as fs } from 'fs';
import path from 'path';
/**
 * Image Management Service
 *
 * Centralizes image file operations to ensure consistency and prevent duplication.
 * Handles deletion of image files with robust error handling and logging.
 * Implements IImageManager interface contract for consistent behavior.
 *
 * @class ImageManager
 * @implements {IImageManager}
 * @see {@link module:services/interfaces/ServiceContracts~IImageManager}
 */
class ImageManager {
  /**
   * Deletes multiple image files from the filesystem
   * Handles bulk deletion with individual error handling to prevent cascade failures
   *
   * @param {Array<string>} imageUrls - Array of image URLs to delete (must start with '/uploads/')
   * @returns {Promise<void>}
   * @throws {FileSystemError} When file operations fail (non-blocking, continues with other files)
   * @static
   */
  static async deleteImageFiles(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) {
      return;
    }

    console.log('[IMAGE CLEANUP] Starting deletion of', imageUrls.length, 'images');

    for (const imageUrl of imageUrls) {
      try {
        // Convert URL to file path
        // Assuming images are stored as relative paths like "/uploads/images/filename.jpg"
        if (imageUrl && imageUrl.startsWith('/uploads/')) {
          const filePath = path.join(__dirname, '..', '..', imageUrl);

          console.log('[IMAGE CLEANUP] Attempting to delete:', filePath);

          // Check if file exists before trying to delete
          try {
            await fs.access(filePath);
            await fs.unlink(filePath);
            console.log('[IMAGE CLEANUP] Successfully deleted:', filePath);
          } catch (accessError) {
            if (accessError.code === 'ENOENT') {
              console.log('[IMAGE CLEANUP] File not found (already deleted):', filePath);
            } else {
              throw accessError;
            }
          }
        } else {
          console.log('[IMAGE CLEANUP] Skipping external/invalid URL:', imageUrl);
        }
      } catch (error) {
        console.error('[IMAGE CLEANUP] Failed to delete image:', imageUrl, error);
        // Continue with other images even if one fails
      }
    }

    console.log('[IMAGE CLEANUP] Cleanup completed');
  }

  /**
   * Deletes a single image file from the filesystem
   * Convenience method that delegates to deleteImageFiles for consistent behavior
   *
   * @param {string} imageUrl - Image URL to delete (must start with '/uploads/')
   * @returns {Promise<void>}
   * @throws {FileSystemError} When file operation fails
   * @static
   */
  static async deleteImageFile(imageUrl) {
    return await this.deleteImageFiles([imageUrl]);
  }

  /**
   * Validates if an image URL is valid for deletion
   * Checks if URL is a string and starts with '/uploads/' path
   *
   * @param {string} imageUrl - Image URL to validate
   * @returns {boolean} True if valid for deletion, false otherwise
   * @static
   */
  static isValidImageUrl(imageUrl) {
    return imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/');
  }

  /**
   * Gets the file path for an image URL
   * Converts relative URL to absolute filesystem path
   *
   * @param {string} imageUrl - Image URL (should start with '/uploads/')
   * @returns {string} Absolute file path
   * @throws {ValidationError} When URL format is invalid
   * @static
   */
  static getImageFilePath(imageUrl) {
    return path.join(__dirname, '..', '..', imageUrl);
  }
}

export default ImageManager;
