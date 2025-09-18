/**
 * ICR Batch Processing Service
 *
 * Application layer service that orchestrates the complete ICR workflow:
 * 1. Batch image upload and PSA label extraction
 * 2. Vertical image stitching
 * 3. Google Vision OCR processing
 * 4. Text distribution by coordinates
 * 5. Hierarchical PSA card matching
 */

import IcrImageUploadService from '@/icr/application/services/IcrImageUploadService.js';
import IcrLabelExtractionService from '@/icr/application/services/IcrLabelExtractionService.js';
import IcrOcrProcessingService from '@/icr/application/services/IcrOcrProcessingService.js';
import IcrTextDistributionService from '@/icr/application/services/IcrTextDistributionService.js';
import IcrCardMatchingService from '@/icr/application/services/IcrCardMatchingService.js';
import IcrStitchingOrchestrator from '@/icr/application/services/IcrStitchingOrchestrator.js';
import ImageHashService from '@/icr/shared/ImageHashService.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import StitchedLabelRepository from '@/icr/infrastructure/repositories/StitchedLabelRepository.js';
import Logger from '@/system/logging/Logger.js';
import { promises as fs } from 'fs';
import path from 'path';

class IcrBatchService {
    constructor() {
        this.imageUploadService = new IcrImageUploadService();
        this.labelExtractionService = new IcrLabelExtractionService();
        this.ocrProcessingService = new IcrOcrProcessingService();
        this.textDistributionService = new IcrTextDistributionService();
        this.cardMatchingService = new IcrCardMatchingService();
        this.stitchingOrchestrator = new IcrStitchingOrchestrator();

        // FIXED: Use repositories instead of direct model access
        this.gradedCardScanRepository = new GradedCardScanRepository();
        this.stitchedLabelRepository = new StitchedLabelRepository();
    }

    /**
     * STEP 1: Upload images and create GradedCardScan records
     * Delegates to dedicated upload service
     */
    async uploadImages(imageFiles) {
        console.log('DEBUG: IcrBatchService.uploadImages called with', imageFiles.length, 'files');
        const result = await this.imageUploadService.uploadImages(imageFiles);
        console.log('DEBUG: IcrBatchService got result:', {
            hasIds: !!result.ids,
            idCount: result.ids?.length || 0,
            successful: result.successful,
            resultKeys: Object.keys(result || {})
        });
        return result;
    }

    /**
     * STEP 2: Extract PSA labels from uploaded scans
     * Delegates to dedicated label extraction service
     */
    async extractLabels(ids) {
        return await this.labelExtractionService.extractLabels(ids);
    }

    /**
     * STEP 2: Create vertical stitched image with duplicate detection
     */
    async createStitchedImage(batchId) {
        try {
            Logger.operationStart('ICR_STITCHING', 'Creating vertical stitched image', { batchId });

            const scans = await this.gradedCardScanRepository.findMany({ batchId }, { sort: { createdAt: 1 } });
            if (scans.length === 0) {
                throw new Error(`No scans found for batch ${batchId}`);
            }

            // Get all existing stitched labels to check which hashes have been processed
            const existingStitchedLabels = await this.stitchedLabelRepository.findMany({});
            const alreadyStitchedHashes = new Set();
            existingStitchedLabels.forEach(stitched => {
                stitched.labelHashes.forEach(hash => alreadyStitchedHashes.add(hash));
            });

            // ✅ RE-ENABLED: Prevent re-stitching already processed labels
            const newScans = scans.filter(scan => !alreadyStitchedHashes.has(scan.imageHash));

            if (newScans.length === 0) {
                Logger.info('ICR_STITCHING', 'All labels already stitched - no new labels to process', {
                    totalScans: scans.length,
                    alreadyStitched: scans.length - newScans.length,
                    batchId
                });

                return {
                    message: 'All labels already stitched',
                    isDuplicate: true,
                    totalLabels: scans.length,
                    newLabels: 0,
                    alreadyStitched: scans.length
                };
            }

            Logger.info('ICR_STITCHING', 'Found new labels to stitch', {
                totalScans: scans.length,
                newScans: newScans.length,
                alreadyStitched: scans.length - newScans.length,
                batchId
            });

            // Load only NEW label images that haven't been stitched AND exist on disk
            const labelBuffers = [];
            const availableScans = [];

            for (const scan of newScans) {
                try {
                    await fs.access(scan.labelImage); // Check if file exists
                    const labelBuffer = await fs.readFile(scan.labelImage);
                    labelBuffers.push(labelBuffer);
                    availableScans.push(scan);
                } catch (error) {
                    Logger.warn('ICR_STITCHING', 'Label file not found - skipping scan', {
                        id: scan._id,
                        labelPath: scan.labelImage,
                        error: error.message
                    });
                }
            }

            if (availableScans.length === 0) {
                Logger.info('ICR_STITCHING', 'No available label files found for new scans', {
                    totalScans: scans.length,
                    newScans: newScans.length,
                    batchId
                });

                return {
                    message: 'No available label files found for stitching',
                    isDuplicate: true,
                    totalLabels: scans.length,
                    newLabels: 0,
                    alreadyStitched: scans.length
                };
            }

            // Create vertical stitched image using orchestrator
            const stitchedResult = await this.stitchingOrchestrator.createVerticalStitchedImage(labelBuffers);

            // Generate hash of stitched image
            const stitchedBuffer = await fs.readFile(stitchedResult.stitchedImagePath);
            const stitchedImageHash = ImageHashService.generateHash(stitchedBuffer);

            // Create StitchedLabel record for AVAILABLE scans only - PRESERVE ORDER!
            const newLabelHashes = availableScans.map(scan => scan.imageHash);
            const stitchedLabel = await this.stitchedLabelRepository.create({
                stitchedImagePath: stitchedResult.stitchedImagePath,
                stitchedImageHash,
                stitchedImageDimensions: {
                    width: stitchedResult.width,
                    height: stitchedResult.height
                },
                batchId,
                labelHashes: newLabelHashes,
                labelCount: availableScans.length,
                gradedCardScanIds: availableScans.map(scan => scan._id),
                processingStatus: 'stitched'
            });


            // Update the scans' processing status to 'stitched'
            const statusUpdateResult = await this.gradedCardScanRepository.updateStatusByHashes(newLabelHashes, 'stitched'
            );

            Logger.operationSuccess('ICR_STITCHING', 'Stitching completed', {
                labelCount: labelBuffers.length,
                dimensions: `${stitchedResult.width}x${stitchedResult.height}`,
                scansUpdated: statusUpdateResult.modifiedCount,
                requestedHashes: newLabelHashes,
                stitchedLabelId: stitchedLabel._id
            });

            return {
                ...stitchedResult,
                stitchedLabelId: stitchedLabel._id,
                isDuplicate: false,
                totalLabels: scans.length,
                newLabels: availableScans.length,
                alreadyStitched: scans.length - availableScans.length,
                message: `Stitched ${availableScans.length} new labels (${scans.length - availableScans.length} already processed)`
            };

        } catch (error) {
            Logger.operationError('ICR_STITCHING', 'Stitching failed', error, { batchId });
            throw error;
        }
    }


    /**
     * STEP 3: Process OCR on stitched image
     * Delegates to dedicated OCR processing service
     */
    async processOcr(stitchedImagePath) {
        return await this.ocrProcessingService.processOcr(stitchedImagePath);
    }

    /**
     * STEP 3B: Process OCR by batch ID (auto-detect stitched image)
     * Delegates to dedicated OCR processing service
     */
    async processOcrByBatch(batchId) {
        return await this.ocrProcessingService.processOcrByBatch(batchId);
    }

    /**
     * STEP 4: Distribute OCR text to individual scans
     * Delegates to dedicated text distribution service
     */
    async distributeOcrText(batchId, ocrResult = null) {
        return await this.textDistributionService.distributeOcrText(batchId, ocrResult);
    }

    /**
     * STEP 5: Perform hierarchical card matching
     * Delegates to dedicated card matching service
     */
    async performCardMatching(batchId) {
        return await this.cardMatchingService.performCardMatching(batchId);
    }

    /**
     * Get scans by processing status
     */
    async getUploadedScans(status = 'uploaded', page = 1, limit = 20) {
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
                    fullImageUrl: `/api/icr/images/full/${path.basename(scan.fullImage)}`,
                    labelImageUrl: scan.labelImage ? `/api/icr/images/labels/${path.basename(scan.labelImage)}` : null,
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
            Logger.operationError('ICR_GET_SCANS', 'Failed to get scans', error);
            throw error;
        }
    }

    /**
     * Create PSA card from matched GradedCardScan with pre-populated certification details
     */
    async createPsaCardFromScan(id, userInputs) {
        try {
            console.log('🚀 PSA CARD CREATION STARTED');
            console.log('📥 Input Parameters:', { id, userInputs });
            Logger.operationStart('ICR_CREATE_PSA', 'Creating PSA card from scan', { id });

            const scan = await this.gradedCardScanRepository.findById(id);
            if (!scan) {
                console.log('❌ SCAN NOT FOUND:', id);
                throw new Error('Scan not found');
            }
            console.log('✅ SCAN FOUND:', {
                id: scan._id,
                fullImage: scan.fullImage,
                labelImage: scan.labelImage,
                processingStatus: scan.processingStatus
            });

            // FIXED: Use cardId from user input instead of scan's getBestMatch()
            const selectedCard = userInputs.cardId;
            if (!selectedCard) {
                console.log('❌ NO CARD ID PROVIDED IN REQUEST');
                throw new Error('Card ID is required for PSA creation');
            }
            console.log('✅ SELECTED CARD ID:', selectedCard);

            // Import required modules
            console.log('📦 IMPORTING MODULES...');
            const path = await import('path');
            const fs = await import('fs');
            // const { v4: uuidv4 } = await import('uuid'); // Not used
            const mongoose = await import('mongoose');
            const CollectionService = (await import('@/collection/items/CollectionService.js')).default;
            const CollectionRepository = (await import('@/collection/items/CollectionRepository.js')).default;
            const PsaGradedCard = (await import('@/collection/items/PsaGradedCard.js')).default;
            console.log('✅ MODULES IMPORTED');

            // CRITICAL FIX: Copy images from ICR folder to collection folder
            const collectionFolder = path.resolve('./uploads/collection');
            console.log('📁 COLLECTION FOLDER PATH:', collectionFolder);

            // Ensure collection folder exists
            if (!fs.existsSync(collectionFolder)) {
                console.log('📁 CREATING COLLECTION FOLDER...');
                fs.mkdirSync(collectionFolder, { recursive: true });
                console.log('✅ COLLECTION FOLDER CREATED');
            } else {
                console.log('✅ COLLECTION FOLDER EXISTS');
            }

            const copiedImages = [];
            // FIXED: Only copy the full image, not the label image
            const imagesToCopy = [scan.fullImage].filter(Boolean);
            console.log('🖼️ IMAGES TO COPY (FULL IMAGE ONLY):', imagesToCopy);

            for (const originalImagePath of imagesToCopy) {
                console.log('🔄 PROCESSING IMAGE:', originalImagePath);
                if (originalImagePath && fs.existsSync(originalImagePath)) {
                    const originalFileName = path.basename(originalImagePath);
                    const fileExtension = path.extname(originalFileName);
                    const newFileName = `image-${Date.now()}-${Math.floor(Math.random() * 1000000)}${fileExtension}`;
                    const newImagePath = path.join(collectionFolder, newFileName);

                    console.log('📋 IMAGE COPY DETAILS:', {
                        original: originalImagePath,
                        newFileName,
                        newPath: newImagePath
                    });

                    // Copy file to collection folder
                    fs.copyFileSync(originalImagePath, newImagePath);
                    // FIXED: Store full path like manual creation for consistency
                    copiedImages.push(`/uploads/${newFileName}`);

                    console.log('✅ IMAGE COPIED SUCCESSFULLY:', newImagePath);
                    console.log('✅ STORED FULL PATH:', `/uploads/${newFileName}`);
                    Logger.info('ICR_CREATE_PSA', 'Image copied to collection folder', {
                        original: originalImagePath,
                        new: newImagePath,
                        storedAsPath: `/uploads/${newFileName}`
                    });
                } else {
                    console.log('❌ IMAGE NOT FOUND OR INVALID:', originalImagePath);
                }
            }

            console.log('🖼️ TOTAL IMAGES COPIED:', copiedImages.length);
            console.log('📂 COPIED IMAGE PATHS:', copiedImages);

            // CRITICAL FIX: Price handling with proper Decimal128 conversion
            console.log('💰 PROCESSING PRICE...');
            console.log('💰 RAW PRICE INPUT:', userInputs.myPrice, typeof userInputs.myPrice);

            let processedPrice;
            if (userInputs.myPrice !== undefined && userInputs.myPrice !== null) {
                // FIXED: Convert number to Decimal128 for MongoDB schema compatibility
                processedPrice = mongoose.default.Types.Decimal128.fromString(userInputs.myPrice.toString());
                console.log('✅ PROCESSED PRICE AS DECIMAL128:', processedPrice);
            } else {
                console.log('❌ PRICE IS MISSING OR NULL');
                throw new Error('myPrice is required for PSA card creation');
            }

            // FIXED: Use extracted data as fallback for missing user inputs
            const extractedData = scan.extractedData || {};

            // CRITICAL FIX: Use the same data structure as manual creation
            const psaData = {
                cardId: selectedCard,
                grade: userInputs.grade || extractedData.grade || 10,
                certNumber: userInputs.certificationNumber || extractedData.certificationNumber, // Use user input or extracted from OCR
                myPrice: processedPrice, // Use Decimal128 price for MongoDB compatibility
                dateAdded: userInputs.dateAdded || new Date(),
                images: copiedImages, // Use copied image paths consistent with manual creation
                sold: false, // Default value like manual creation
                saleDetails: {} // Default empty object like manual creation
            };

            console.log('📋 FINAL PSA DATA OBJECT:', psaData);

            Logger.info('ICR_CREATE_PSA', 'Creating PSA card:', {
                id,
                grade: psaData.grade,
                certNumber: psaData.certNumber,
                myPrice: userInputs.myPrice, // Log original number for debugging
                imageCount: copiedImages.length
            });

            // CRITICAL FIX: Use CollectionService with CollectionRepository (same as manual creation)
            // This ensures same validation, price history creation, and activity tracking as manual creation
            const psaGradedCardRepository = new CollectionRepository(PsaGradedCard, 'PsaGradedCard');
            const collectionService = new CollectionService(psaGradedCardRepository);

            console.log('🔄 USING COLLECTION SERVICE FOR CONSISTENT CREATION...');
            const psaCard = await collectionService.create(psaData);
            console.log('✅ PSA CARD CREATED VIA COLLECTION SERVICE:', psaCard._id);

            // FIXED: Mark scan as card_created (valid enum value, not psa_created)
            await this.gradedCardScanRepository.update(id, {
                processingStatus: 'card_created',
                psaCardId: psaCard._id
            });

            Logger.operationSuccess('ICR_CREATE_PSA', 'PSA card created successfully', {
                id,
                psaCardId: psaCard._id,
                imagesInCollection: copiedImages.length
            });

            const result = {
                psaCard,
                sourceGradedCardScan: id,
                copiedImages: copiedImages.length
            };

            return result;

        } catch (error) {
            Logger.operationError('ICR_CREATE_PSA', 'PSA card creation failed', error);
            throw error;
        }
    }

    /**
     * Complete scan after PSA card creation - cleanup files and update status
     */
    async completeScan(scanId, options = {}) {
        const { psaCardId, cleanupFiles = true, keepImageHash = true } = options;

        try {
            Logger.operationStart('ICR_COMPLETE_SCAN', 'Completing scan after PSA creation', {
                scanId,
                psaCardId,
                cleanupFiles,
                keepImageHash
            });

            // Get scan data before updating
            const scan = await this.gradedCardScanRepository.findById(scanId);
            if (!scan) {
                throw new Error('Scan not found');
            }

            // File cleanup logic
            const filesDeleted = [];
            if (cleanupFiles) {
                const fs = (await import('fs')).default;
                const path = (await import('path')).default;

                // Delete scan image files but keep the image data for copying to collection
                const filesToDelete = [
                    scan.fullImage,    // Delete full scan image
                    scan.labelImage    // Delete label image (we only keep full image in collection)
                ].filter(Boolean);   // Remove null/undefined values

                for (const filePath of filesToDelete) {
                    try {
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath);
                            filesDeleted.push(path.basename(filePath));
                            Logger.info('ICR_COMPLETE_SCAN', `Deleted file: ${filePath}`);
                        }
                    } catch (fileError) {
                        Logger.warn('ICR_COMPLETE_SCAN', `Failed to delete file: ${filePath}`, fileError);
                    }
                }
            }

            // Update scan status to 'card_created' instead of 'psa_created'
            const updateData = {
                processingStatus: 'card_created',  // New status to distinguish from PSA workflow
                psaCardId,
                completedAt: new Date()
            };

            // Keep imageHash for duplicate prevention if requested
            if (keepImageHash) {
                updateData.imageHash = scan.imageHash;  // Preserve imageHash
                Logger.info('ICR_COMPLETE_SCAN', `Preserving imageHash for duplicate prevention: ${scan.imageHash}`);
            }

            await this.gradedCardScanRepository.update(scanId, updateData);

            Logger.operationSuccess('ICR_COMPLETE_SCAN', 'Scan completion successful', {
                scanId,
                psaCardId,
                filesDeleted: filesDeleted.length,
                newStatus: 'card_created'
            });

            return {
                scanId,
                psaCardId,
                oldStatus: scan.processingStatus,
                newStatus: 'card_created',
                filesDeleted,
                imageHashPreserved: keepImageHash
            };

        } catch (error) {
            Logger.operationError('ICR_COMPLETE_SCAN', 'Scan completion failed', error);
            throw error;
        }
    }

    /**
     * HASH-BASED METHODS: Work directly with imageHashes (no batchId needed)
     */

    /**
     * Create stitched image from imageHashes array
     * Delegates to IcrStitchingOrchestrator - SOLID & DRY
     */
    async createStitchedImageFromHashes(imageHashes) {
        return this.stitchingOrchestrator.stitchImagesByHashes(imageHashes);
    }

    /**
     * Process OCR by imageHashes - delegates to OCR processing service
     */
    async processOcrByHashes(imageHashes) {
        return await this.ocrProcessingService.processOcrByHashes(imageHashes);
    }

    /**
     * Distribute OCR text by imageHashes - delegates to text distribution service
     */
    async distributeOcrTextByHashes(imageHashes, ocrResult = null) {
        return await this.textDistributionService.distributeOcrTextByHashes(imageHashes, ocrResult);
    }


    /**
     * Perform card matching by imageHashes - delegates to card matching service
     */
    async performCardMatchingByHashes(imageHashes) {
        return await this.cardMatchingService.performCardMatchingByHashes(imageHashes);
    }

    /**
     * Select a specific card match for a scan
     */
    async selectCardMatch(id, cardId) {
        const scan = await this.gradedCardScanRepository.findById(id);
        if (!scan) {
            throw new Error('Scan not found');
        }

        // Update the scan with the selected card match
        await this.gradedCardScanRepository.update(id, {
            selectedCardId: cardId,
            matchingStatus: 'manual_override',
            processedAt: new Date()
        });

        return {
            id,
            selectedCardId: cardId,
            matchingStatus: 'manual_override'
        };
    }

    /**
     * Get scans ready for PSA creation (matched status)
     */
    async getMatchedScans(page = 1, limit = 20) {
        try {
            Logger.operationStart('ICR_GET_MATCHED_SCANS', 'Getting scans ready for PSA creation');

            const skip = (page - 1) * limit;

            // Get scans that are matched and ready for PSA creation
            const query = {
                matchingStatus: { $in: ['auto_matched', 'manual_override'] },
                processingStatus: { $ne: 'card_created' }
            };

            const scans = await this.gradedCardScanRepository.findWithPagination(query, {
                skip,
                limit,
                sort: { createdAt: -1 }
            });

            const formattedScans = scans.data.map(scan => ({
                id: scan._id,
                originalFileName: scan.originalFileName,
                fullImageUrl: `/api/icr/images/full/${path.basename(scan.fullImage)}`,
                labelImageUrl: scan.labelImage ? `/api/icr/images/labels/${path.basename(scan.labelImage)}` : null,
                processingStatus: scan.processingStatus,
                matchingStatus: scan.matchingStatus,
                cardMatches: scan.cardMatches || [],
                extractedData: scan.extractedData,
                userSelectedMatch: scan.userSelectedMatch,
                createdAt: scan.createdAt
            }));

            Logger.operationSuccess('ICR_GET_MATCHED_SCANS', `Found ${formattedScans.length} matched scans`);

            return {
                scans: formattedScans,
                pagination: {
                    page,
                    limit,
                    totalCount: scans.totalCount,
                    totalPages: Math.ceil(scans.totalCount / limit)
                }
            };
        } catch (error) {
            Logger.operationError('ICR_GET_MATCHED_SCANS', 'Failed to get matched scans', error);
            throw error;
        }
    }

    // ==========================================================================
    // PRIVATE HELPER METHODS
    // ==========================================================================

    async ensureDirectories() {
        const dirs = ['full-images', 'labels', 'stitched-images'];
        for (const dir of dirs) {
            await fs.mkdir(path.join(this.baseDir, dir), { recursive: true });
        }
    }


    async clearExistingBatch(batchId) {
        await this.gradedCardScanRepository.deleteMany({ batchId });
    }


    async saveFullImage(file) {
        const filename = `${file.originalname}`;
        const filePath = path.join(process.cwd(), 'uploads', 'icr', 'full-images', filename);
        await fs.writeFile(filePath, file.buffer);
        return filePath;
    }


}

export default IcrBatchService;
