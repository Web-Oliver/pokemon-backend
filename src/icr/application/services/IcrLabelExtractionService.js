/**
 * ICR Label Extraction Service
 *
 * Single Responsibility: Extract PSA labels from uploaded scans
 * Extracted from IcrBatchService to follow SRP
 */

import PsaLabelExtractionService from '@/icr/infrastructure/services/PsaLabelExtractionService.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import {promises as fs} from 'fs';

import OperationManager from '@/system/utilities/OperationManager.js';
import IcrPathManager from '@/icr/shared/IcrPathManager.js';

export class IcrLabelExtractionService {
    constructor() {
        this.psaLabelExtractionService = new PsaLabelExtractionService();
        this.gradedCardScanRepository = new GradedCardScanRepository();
    }

    /**
     * STEP 2: Extract PSA labels from uploaded scans
     * EXACT EXTRACTION from IcrBatchService.js lines 123-196
     */
    async extractLabels(ids) {
        const context = OperationManager.createContext('IcrLabelExtraction', 'extractLabels', {
            scanCount: ids.length
        });

        return OperationManager.executeBatchOperation(
            context,
            ids,
            async (id, index) => {
                const scan = await this.gradedCardScanRepository.findById(id);
                if (!scan) {
                    throw new Error('Scan not found');
                }

                // NO STATUS CHECK - Always allow label extraction

                // Read uploaded image file
                const imageBuffer = await fs.readFile(scan.fullImage);

                // Extract PSA label
                const extractionResult = await this.psaLabelExtractionService.extractPsaLabel(imageBuffer);

                // Save extracted label using IcrPathManager
                const labelPath = await this.saveExtractedLabel(
                    extractionResult.labelBuffer,
                    scan.originalFileName,
                    id
                );

                // Update GradedCardScan with label info
                await this.gradedCardScanRepository.update(id, {
                    labelImage: labelPath,
                    extractedDimensions: extractionResult.extractedDimensions,
                    processingStatus: 'extracted'
                });

                return {
                    id,
                    originalFileName: scan.originalFileName,
                    labelPath,
                    extractedDimensions: extractionResult.extractedDimensions
                };
            },
            {
                continueOnError: true,
                maxConcurrent: 3
            }
        );
    }

    /**
     * Helper method extracted from IcrBatchService lines 1050-1055
     */
    async saveExtractedLabel(labelBuffer, originalName, id) {
        // Generate filename using IcrPathManager
        const filenameInfo = IcrPathManager.generateFileName(`${originalName}_extracted_label.jpg`, {
            id: id.toString().substring(0, 8)
        });

        // Use IcrPathManager for consistent path generation
        const filePath = IcrPathManager.getFilePath('EXTRACTED_LABELS', filenameInfo.descriptive);
        await fs.writeFile(filePath, labelBuffer);
        return filePath;
    }
}

export default IcrLabelExtractionService;