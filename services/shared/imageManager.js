const fs = require('fs').promises;
const path = require('path');

/**
 * Image Management Service
 * 
 * Centralizes image file operations to ensure consistency and prevent duplication.
 * Handles deletion of image files with robust error handling and logging.
 */
class ImageManager {
  /**
   * Deletes multiple image files from the filesystem
   * 
   * @param {Array<string>} imageUrls - Array of image URLs to delete
   * @returns {Promise<void>}
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
   * 
   * @param {string} imageUrl - Image URL to delete
   * @returns {Promise<void>}
   */
  static async deleteImageFile(imageUrl) {
    return await this.deleteImageFiles([imageUrl]);
  }

  /**
   * Validates if an image URL is valid for deletion
   * 
   * @param {string} imageUrl - Image URL to validate
   * @returns {boolean} - True if valid, false otherwise
   */
  static isValidImageUrl(imageUrl) {
    return imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/');
  }

  /**
   * Gets the file path for an image URL
   * 
   * @param {string} imageUrl - Image URL
   * @returns {string} - File path
   */
  static getImageFilePath(imageUrl) {
    return path.join(__dirname, '..', '..', imageUrl);
  }
}

module.exports = ImageManager;