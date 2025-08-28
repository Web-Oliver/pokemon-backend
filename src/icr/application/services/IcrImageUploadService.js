/**
 * ICR Image Upload Service
 * 
 * Single Responsibility: Handle image upload and GradedCardScan creation
 * Extracted from IcrBatchService to follow SRP
 */

import IntelligentImageNamingService from '@/icr/infrastructure/services/IntelligentImageNamingService.js';
import ImageHashService from '@/icr/shared/ImageHashService.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import Logger from '@/system/logging/Logger.js';
import { promises as fs } from 'fs';
import path from 'path';

export class IcrImageUploadService {
  constructor() {
    this.intelligentNamingService = new IntelligentImageNamingService();
    this.gradedCardScanRepository = new GradedCardScanRepository();
  }

  /**
   * STEP 1: Upload images and create GradedCardScan records
   * EXACT EXTRACTION from IcrBatchService.js lines 42-118
   */
  async uploadImages(imageFiles) {
    try {
      Logger.operationStart('ICR_IMAGE_UPLOAD', 'Starting image upload', {
        imageCount: imageFiles.length
      });

      await this.ensureUploadDirectories();

      const scanIds = [];
      const errors = [];
      const duplicates = [];

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          // Read file from disk (multer disk storage provides path, not buffer)
          const fileBuffer = await fs.readFile(file.path);
          const imageHash = ImageHashService.generateHash(fileBuffer);

          // Check for existing GradedCardScan with same hash
          const existingScan = await this.gradedCardScanRepository.findByHash(imageHash);
          if (existingScan) {
            duplicates.push({
              filename: file.originalname,
              existingId: existingScan._id,
              message: 'Image already uploaded'
            });
            continue;
          }

          // Generate intelligent filename
          const filenameInfo = await this.intelligentNamingService.generateUploadFilename(
            fileBuffer, 
            file.originalname, 
            imageHash
          );
          const storedFileName = filenameInfo.descriptive;
          const filePath = path.join(process.cwd(), 'uploads', 'icr', 'full-images', storedFileName);
          await fs.writeFile(filePath, fileBuffer);

          // Create GradedCardScan record with intelligent filename
          const gradedCardScan = await this.gradedCardScanRepository.create({
            fullImage: filePath,
            originalFileName: storedFileName,
            imageHash,
            fileSize: fileBuffer.length,
            mimeType: file.mimetype,
            processingStatus: 'uploaded'
          });
          scanIds.push(gradedCardScan._id);

        } catch (error) {
          Logger.operationError('ICR_IMAGE_UPLOAD', 'Image upload failed', error, { filename: file.originalname });
          errors.push({ filename: file.originalname, error: error.message });
        }
      }

      Logger.operationSuccess('ICR_IMAGE_UPLOAD', 'Image upload completed', {
        successful: scanIds.length,
        failed: errors.length,
        duplicates: duplicates.length
      });

      return {
        scanIds,
        successful: scanIds.length,
        failed: errors.length,
        duplicateCount: duplicates.length,
        errors,
        duplicates
      };

    } catch (error) {
      Logger.operationError('ICR_IMAGE_UPLOAD', 'Image upload failed', error);
      throw error;
    }
  }

  /**
   * Helper method extracted from IcrBatchService lines 1030-1036
   */
  async ensureUploadDirectories() {
    const baseUploadDir = path.join(process.cwd(), 'uploads', 'icr');
    const dirs = ['full-images', 'extracted-labels', 'stitched-images'];
    for (const dir of dirs) {
      await fs.mkdir(path.join(baseUploadDir, dir), { recursive: true });
    }
  }
}

export default IcrImageUploadService;