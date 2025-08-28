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

import OperationManager from '@/system/utilities/OperationManager.js';

import IcrPathManager from '@/icr/shared/IcrPathManager.js';

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
    const context = OperationManager.createContext('IcrImageUpload', 'uploadImages', {
      imageCount: imageFiles.length
    });

    // Ensure directories exist using IcrPathManager
    await IcrPathManager.ensureDirectories();

    return OperationManager.executeBatchOperation(
      context,
      imageFiles,
      async (file, index) => {
        // Read file from disk (multer disk storage provides path, not buffer)
        const fileBuffer = await fs.readFile(file.path);
        const imageHash = ImageHashService.generateHash(fileBuffer);

        // Check for existing GradedCardScan with same hash
        const existingScan = await this.gradedCardScanRepository.findByHash(imageHash);
        if (existingScan) {
          throw new Error(`Image already uploaded: ${existingScan._id}`);
        }

        // Generate intelligent filename using IcrPathManager
        const filenameInfo = IcrPathManager.generateFileName(file.originalname, {
          imageHash: imageHash.substring(0, 8)
        });

        // Use IcrPathManager for consistent path generation
        const filePath = IcrPathManager.getFilePath('FULL_IMAGES', filenameInfo.descriptive);
        await fs.writeFile(filePath, fileBuffer);

        // Create GradedCardScan record
        const gradedCardScan = await this.gradedCardScanRepository.create({
          fullImage: filePath,
          originalFileName: filenameInfo.descriptive,
          imageHash,
          fileSize: fileBuffer.length,
          mimeType: file.mimetype,
          processingStatus: 'uploaded'
        });

        return {
          scanId: gradedCardScan._id,
          filename: file.originalname,
          storedFileName: filenameInfo.descriptive
        };
      },
      {
        continueOnError: true,
        maxConcurrent: 3
      }
    );
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