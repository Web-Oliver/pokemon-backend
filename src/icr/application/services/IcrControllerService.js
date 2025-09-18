/**
 * ICR Controller Service - Business Logic Layer for Controllers
 *
 * SOLID Principles:
 * - Single Responsibility: Handles all ICR controller business logic
 * - Dependency Inversion: Uses repositories and other services
 * - Interface Segregation: Focused interface for controller operations
 */

import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import StitchedLabelRepository from '@/icr/infrastructure/repositories/StitchedLabelRepository.js';
import IcrBatchService from '@/icr/application/IcrBatchService.js';
import { FileSystemUtils } from '@/icr/shared/FileSystemUtils.js';
import Logger from '@/system/logging/Logger.js';
import fs from 'fs/promises';
import fsConstants from 'fs';
import path from 'path';

export class IcrControllerService {
    constructor() {
        this.gradedCardScanRepository = new GradedCardScanRepository();
        this.stitchedLabelRepository = new StitchedLabelRepository();
        this.icrBatchService = new IcrBatchService();
    }

    /**
     * Get scans with pagination and filtering
     */
    async getScans(filters = {}, pagination = {}) {
        const { status, skip = 0, limit = 150 } = { ...filters, ...pagination };

        if (status) {
            return await this.gradedCardScanRepository.findByStatus(status, { skip, limit });
        }

        return await this.gradedCardScanRepository.findMany({}, { skip, limit });
    }

    /**
     * Get individual scan by ID with complete details
     */
    async getScanById(id) {
        return await this.gradedCardScanRepository.findById(id);
    }

    /**
     * Get overall processing status
     */
    async getOverallStatus() {
        const [scanStats, labelStats] = await Promise.all([
            this.gradedCardScanRepository.getStatusStatistics(),
            this.stitchedLabelRepository.getStatusStatistics()
        ]);

        return {
            gradedCardScans: this.formatStatusStats(scanStats),
            stitchedLabels: this.formatStatusStats(labelStats)
        };
    }

    /**
     * Get stitched images with pagination
     */
    async getStitchedImages(pagination = {}) {
        const { skip = 0, limit = 50 } = pagination;
        return await this.stitchedLabelRepository.findWithPagination({ skip, limit });
    }

    /**
     * Delete scans by IDs
     */
    async deleteScans(ids) {
        // Find scans by IDs using findAll with $in operator
        const scansToDelete = await this.gradedCardScanRepository.findAll({
            _id: { $in: ids }
        });

        // Delete associated files
        await this.deleteAssociatedFiles(scansToDelete);

        // Delete from database
        const result = await this.gradedCardScanRepository.deleteManyByIds(ids);

        Logger.info('IcrControllerService', 'Scans deleted', {
            deletedCount: result.deletedCount,
            ids: ids.slice(0, 5) // Log first 5 IDs
        });

        return result;
    }

    /**
     * Delete stitched images by IDs
     */
    async deleteStitchedImages(labelIds) {
        // Find labels by IDs using findAll with $in operator
        const labelsToDelete = await this.stitchedLabelRepository.findAll({
            _id: { $in: labelIds }
        });

        // Delete associated files
        await this.deleteStitchedFiles(labelsToDelete);

        // Delete from database
        const result = await this.stitchedLabelRepository.deleteManyByIds(labelIds);

        Logger.info('IcrControllerService', 'Stitched images deleted', {
            deletedCount: result.deletedCount,
            labelIds: labelIds.slice(0, 5)
        });

        return result;
    }

    /**
     * Sync statuses between database and processing states
     */
    async syncStatuses(imageHashes) {
        const scans = await this.gradedCardScanRepository.findByHashes(imageHashes);

        const statusMap = {};
        scans.forEach(scan => {
            statusMap[scan.imageHash] = scan.processingStatus;
        });

        return statusMap;
    }

    /**
     * Serve image file with enhanced security validation
     */
    async serveImage(imagePath, imageType = 'full') {
        try {
            // SECURITY: Validate image type first
            const allowedTypes = ['full', 'label', 'stitched'];
            if (!allowedTypes.includes(imageType)) {
                Logger.warn('IcrControllerService', 'Invalid image type attempted', { imageType, imagePath });
                throw new Error('Invalid image type');
            }

            // SECURITY: Strict path validation to prevent directory traversal
            const normalizedPath = path.resolve(imagePath);
            const uploadsDir = path.resolve(process.cwd(), 'uploads', 'icr');

            // Define allowed subdirectories based on image type
            const allowedSubDirs = {
                'full': 'full-images',
                'label': 'extracted-labels',
                'stitched': 'stitched-images'
            };

            const expectedSubDir = path.join(uploadsDir, allowedSubDirs[imageType]);

            // SECURITY: Ensure path is within expected subdirectory
            if (!normalizedPath.startsWith(expectedSubDir)) {
                Logger.warn('IcrControllerService', 'Path traversal attempt detected', {
                    normalizedPath,
                    expectedSubDir,
                    imageType
                });
                throw new Error('Access denied: Invalid image path');
            }

            // SECURITY: Validate file extension
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
            const fileExtension = path.extname(normalizedPath).toLowerCase();
            if (!allowedExtensions.includes(fileExtension)) {
                Logger.warn('IcrControllerService', 'Invalid file extension attempted', {
                    fileExtension,
                    imagePath
                });
                throw new Error('Invalid file type');
            }

            // SECURITY: Check if file exists and is readable
            await fs.access(normalizedPath, fsConstants.constants.R_OK);

            const stats = await fs.stat(normalizedPath);

            // SECURITY: Check file size (prevent serving huge files)
            const maxFileSize = 500 * 1024 * 1024; // 500MB limit
            if (stats.size > maxFileSize) {
                Logger.warn('IcrControllerService', 'File too large', {
                    size: stats.size,
                    maxSize: maxFileSize,
                    imagePath
                });
                throw new Error('File too large');
            }

            const imageBuffer = await fs.readFile(normalizedPath);

            Logger.info('IcrControllerService', 'Image served successfully', {
                imagePath: path.basename(normalizedPath),
                imageType,
                size: stats.size
            });

            return {
                buffer: imageBuffer,
                contentType: this.getContentType(normalizedPath),
                size: stats.size,
                lastModified: stats.mtime
            };
        } catch (error) {
            Logger.error('IcrControllerService', 'Image access denied', {
                imagePath: path.basename(imagePath),
                imageType,
                error: error.message
            });
            throw new Error('Image not found or access denied');
        }
    }

    /**
     * Format status statistics for API response
     * @private
     */
    formatStatusStats(stats) {
        const formatted = {};
        stats.forEach(stat => {
            formatted[stat._id] = stat.count;
        });
        return formatted;
    }

    /**
     * Delete associated files for scans
     * @private
     */
    async deleteAssociatedFiles(scans) {
        for (const scan of scans) {
            try {
                if (scan.fullImage) {
                    await fs.unlink(scan.fullImage);
                    Logger.info('IcrControllerService', 'Deleted full image file', { path: scan.fullImage });
                }
                if (scan.labelImage) {
                    await fs.unlink(scan.labelImage);
                    Logger.info('IcrControllerService', 'Deleted label image file', { path: scan.labelImage });
                }
            } catch (error) {
                Logger.warn('IcrControllerService', 'Failed to delete scan file', { error: error.message, id: scan._id });
            }
        }
    }

    /**
     * Delete associated files for stitched labels
     * @private
     */
    async deleteStitchedFiles(labels) {
        for (const label of labels) {
            try {
                if (label.stitchedImagePath) {
                    await fs.unlink(label.stitchedImagePath);
                    Logger.info('IcrControllerService', 'Deleted stitched image file', { path: label.stitchedImagePath });
                }
            } catch (error) {
                Logger.warn('IcrControllerService', 'Failed to delete stitched file', {
                    error: error.message,
                    labelId: label._id
                });
            }
        }
    }

    /**
     * Get content type from file path
     * REFACTORED: Uses centralized FileSystemUtils - NO MORE DUPLICATION
     * @private
     */
    getContentType(filePath) {
        return FileSystemUtils.getContentType(filePath);
    }
}

export default IcrControllerService;