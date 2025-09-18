/**
 * ICR Status Service - Single Responsibility: Status Management & Query Operations
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles status queries and updates
 * - Open/Closed: Extensible for new status types without modification
 * - Dependency Inversion: Uses repository pattern for data access
 */

import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import StitchedLabelRepository from '@/icr/infrastructure/repositories/StitchedLabelRepository.js';
import Logger from '@/system/logging/Logger.js';
import path from 'path';

class IcrStatusService {
    constructor() {
        this.gradedCardScanRepository = new GradedCardScanRepository();
        this.stitchedLabelRepository = new StitchedLabelRepository();
    }

    async getScans(status = 'uploaded', page = 1, limit = 20) {
        try {
            const skip = (page - 1) * limit;

            const scans = await this.gradedCardScanRepository.findByStatus(status, {
                skip,
                limit,
                sort: { createdAt: -1 }
            });

            const totalCount = await this.gradedCardScanRepository.countByStatus(status);

            return {
                scans: scans.map(scan => ({
                    id: scan._id,
                    originalFileName: scan.originalFileName,
                    fullImageUrl: `http://localhost:3000/api/icr/images/full/${path.basename(scan.fullImage)}`,
                    labelImageUrl: scan.labelImage ? `http://localhost:3000/api/icr/images/labels/${path.basename(scan.labelImage)}` : null,
                    ocrText: scan.ocrText,
                    ocrConfidence: scan.ocrConfidence,
                    matchedCard: scan.matchedCard,
                    matchConfidence: scan.matchConfidence,
                    processingStatus: scan.processingStatus,
                    imageHash: scan.imageHash,
                    createdAt: scan.createdAt
                })),
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                }
            };

        } catch (error) {
            Logger.operationError('ICR_STATUS', 'Failed to get scans', error);
            throw error;
        }
    }

    async getStitchedImages(page = 1, limit = 20) {
        try {
            const skip = (page - 1) * limit;

            const stitchedImages = await this.stitchedLabelRepository.findWithPagination({
                skip,
                limit,
                sort: { createdAt: -1 }
            });

            const totalCount = await this.stitchedLabelRepository.count();

            const formattedImages = stitchedImages.map(stitched => ({
                id: stitched._id,
                stitchedImagePath: stitched.stitchedImagePath,
                stitchedImageUrl: `http://localhost:3000/api/icr/images/stitched/${path.basename(stitched.stitchedImagePath)}`,
                imageWidth: stitched.stitchedImageDimensions.width,
                imageHeight: stitched.stitchedImageDimensions.height,
                labelCount: stitched.labelCount,
                batchId: stitched.batchId,
                processingStatus: stitched.processingStatus,
                createdAt: stitched.createdAt,
                labelHashes: stitched.labelHashes
            }));

            return {
                stitchedImages: formattedImages,
                pagination: {
                    page: parseInt(page, 10),
                    limit: parseInt(limit, 10),
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit)
                }
            };

        } catch (error) {
            Logger.operationError('ICR_STATUS', 'Failed to get stitched images', error);
            throw error;
        }
    }

    async getOverallStatus() {
        try {
            Logger.operationStart('ICR_STATUS', 'Getting overall status statistics');

            // Get status statistics from repository
            const stats = await this.gradedCardScanRepository.getStatusStatistics();

            // Transform repository stats into format expected by API
            const statusCounts = {};
            stats.forEach(stat => {
                statusCounts[stat._id] = stat.count;
            });

            // Calculate totals and completion rate
            const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
            const matched = statusCounts.matched || 0;
            const completionRate = total > 0 ? Math.round((matched / total) * 100) : 0;

            const result = {
                total,
                uploaded: statusCounts.uploaded || 0,
                extracted: statusCounts.extracted || 0,
                stitched: statusCounts.stitched || 0,
                ocrCompleted: statusCounts.ocr_completed || 0,
                matched: statusCounts.matched || 0,
                failed: statusCounts.failed || 0,
                approved: statusCounts.approved || 0,
                rejected: statusCounts.rejected || 0,
                completionRate
            };

            Logger.operationSuccess('ICR_STATUS', 'Overall status retrieved', result);
            return result;

        } catch (error) {
            Logger.operationError('ICR_STATUS', 'Failed to get overall status', error);
            throw error;
        }
    }

    async updateScanStatuses(imageHashes, newStatus) {
        try {
            Logger.operationStart('ICR_STATUS', 'Updating scan statuses', {
                imageHashes: imageHashes.length,
                newStatus
            });

            // Use repository pattern instead of direct database access
            const updateResult = await this.gradedCardScanRepository.updateStatusByHashes(
                imageHashes,
                newStatus
            );

            Logger.operationSuccess('ICR_STATUS', 'Scan statuses updated', {
                imageHashes: imageHashes.length,
                newStatus,
                updated: updateResult.modifiedCount || updateResult
            });

            return updateResult.modifiedCount || updateResult;

        } catch (error) {
            Logger.operationError('ICR_STATUS', 'Failed to update scan statuses', error);
            throw error;
        }
    }

    async syncStatusesWithStitchedLabels() {
        try {
            Logger.info('ICR_STATUS', 'Syncing scan statuses with stitched labels');

            const stitchedLabels = await this.stitchedLabelRepository.findMany({});
            let totalUpdated = 0;

            for (const stitched of stitchedLabels) {
                const updateResult = await this.gradedCardScanRepository.updateStatusByHashes(
                    stitched.labelHashes,
                    'stitched'
                );

                totalUpdated += updateResult.modifiedCount;
            }

            Logger.info('ICR_STATUS', 'Status sync completed', {
                stitchedLabelsProcessed: stitchedLabels.length,
                totalScansUpdated: totalUpdated
            });

            return {
                stitchedLabelsProcessed: stitchedLabels.length,
                scansUpdated: totalUpdated
            };

        } catch (error) {
            Logger.operationError('ICR_STATUS', 'Status sync failed', error);
            throw error;
        }
    }
}

export default IcrStatusService;
