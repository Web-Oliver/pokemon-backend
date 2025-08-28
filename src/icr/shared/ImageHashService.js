/**
 * Image Hash Service - Centralized Image Hash Generation
 * 
 * SOLID Principles:
 * - Single Responsibility: Only handles image hash generation
 * - Open/Closed: Static methods for extension without modification
 * - DRY: Single implementation used across all ICR services
 */

import crypto from 'crypto';

export class ImageHashService {
  /**
   * Generate SHA-256 hash for image buffer
   * @param {Buffer} buffer - Image buffer
   * @returns {string} SHA-256 hash
   */
  static generateHash(buffer) {
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new Error('Invalid buffer provided for hash generation');
    }
    
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Generate hash from file path
   * @param {string} filePath - Path to image file
   * @returns {Promise<string>} SHA-256 hash
   */
  static async generateHashFromFile(filePath) {
    const fs = await import('fs/promises');
    const buffer = await fs.readFile(filePath);
    return this.generateHash(buffer);
  }

  /**
   * Validate hash format
   * @param {string} hash - Hash to validate
   * @returns {boolean} True if valid SHA-256 hash
   */
  static isValidHash(hash) {
    return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
  }
}

export default ImageHashService;