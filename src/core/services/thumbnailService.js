import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * Thumbnail Generation Service
 *
 * Creates thumbnails for uploaded images using Sharp library.
 * Supports JPEG and PNG formats with optimized compression.
 *
 * @class ThumbnailService
 */
class ThumbnailService {
  static THUMBNAIL_SIZE = 300; // Single thumbnail size

  static THUMBNAIL_QUALITY = 85; // JPEG quality

  /**
   * Generates a single thumbnail for an uploaded image
   *
   * @param {string} originalPath - Path to the original image
   * @param {string} originalFilename - Original filename
   * @returns {Promise<string>} - Path to generated thumbnail
   */
  static async generateThumbnail(originalPath, originalFilename) {
    try {
      // Extract file extension and name
      const ext = path.extname(originalFilename).toLowerCase();
      const nameWithoutExt = path.basename(originalFilename, ext);

      // Create thumbnail filename
      const thumbnailFilename = `${nameWithoutExt}-thumb${ext}`;
      const thumbnailPath = path.join(path.dirname(originalPath), thumbnailFilename);

      // Generate thumbnail based on format
      if (ext === '.jpg' || ext === '.jpeg') {
        await sharp(originalPath)
          .resize(this.THUMBNAIL_SIZE, this.THUMBNAIL_SIZE, {
            fit: sharp.fit.cover,
            position: sharp.strategy.entropy,
            withoutEnlargement: true
          })
          .jpeg({
            quality: this.THUMBNAIL_QUALITY,
            mozjpeg: true
          })
          .toFile(thumbnailPath);
      } else if (ext === '.png') {
        await sharp(originalPath)
          .resize(this.THUMBNAIL_SIZE, this.THUMBNAIL_SIZE, {
            fit: sharp.fit.cover,
            position: sharp.strategy.entropy,
            withoutEnlargement: true
          })
          .png({
            compressionLevel: 9,
            palette: true
          })
          .toFile(thumbnailPath);
      } else {
        throw new Error(`Unsupported format: ${ext}`);
      }

      console.log(`[THUMBNAIL] Generated: ${thumbnailPath}`);
      return `/uploads/${thumbnailFilename}`;

    } catch (error) {
      console.error('[THUMBNAIL] Generation failed:', error);
      throw error;
    }
  }

  /**
   * Deletes thumbnail file
   *
   * @param {string} thumbnailUrl - URL/path to thumbnail
   * @returns {Promise<void>}
   */
  static async deleteThumbnail(thumbnailUrl) {
    try {
      if (thumbnailUrl && thumbnailUrl.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', '..', thumbnailUrl);

        await fs.unlink(filePath);
        console.log(`[THUMBNAIL] Deleted: ${filePath}`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[THUMBNAIL] Delete failed:', error);
      }
    }
  }

  /**
   * Checks if a file is a thumbnail
   *
   * @param {string} filename - Filename to check
   * @returns {boolean}
   */
  static isThumbnail(filename) {
    return filename.includes('-thumb.');
  }
}

export default ThumbnailService;
