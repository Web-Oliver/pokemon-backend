/**
 * ICR Card Matching Service
 *
 * Single Responsibility: Handle hierarchical card matching for OCR results
 * Extracted from IcrBatchService to follow SRP
 */

import HierarchicalPsaParser from '@/icr/application/HierarchicalPsaParser.js';
import GradedCardScanRepository from '@/icr/infrastructure/repositories/GradedCardScanRepository.js';
import Logger from '@/system/logging/Logger.js';

import OperationManager from '@/system/utilities/OperationManager.js';

export class IcrCardMatchingService {
  constructor() {
    this.hierarchicalParser = new HierarchicalPsaParser();
    this.gradedCardScanRepository = new GradedCardScanRepository();
  }

  /**
   * STEP 5: Perform hierarchical card matching
   * EXACT EXTRACTION from IcrBatchService.js lines 219-317
   */
  async performCardMatching(batchId) {
    const context = OperationManager.createContext('IcrCardMatching', 'performCardMatching', {
      batchId
    });

    return OperationManager.executeOperation(context, async () => {
      const scans = await this.gradedCardScanRepository.findMany({ batchId, ocrText: { $exists: true, $ne: '' } });

      return OperationManager.executeBatchOperation(
        { ...context, operation: 'cardMatching' },
        scans,
        async (scan, index) => {
          const parsingResult = await this.hierarchicalParser.parsePsaLabel(scan.ocrText);

          const result = {
            scanId: scan._id,
            originalFileName: scan.originalFileName,
            ocrText: scan.ocrText,
            extractedData: parsingResult.extractedData || {},
            cardMatches: [],
            matchingStatus: 'no_match',
            bestMatch: null
          };

          if (parsingResult.success && parsingResult.bestMatch) {
            const bestMatch = parsingResult.bestMatch;

            result.bestMatch = {
              cardName: bestMatch.card.cardName,
              cardNumber: bestMatch.card.cardNumber,
              setName: bestMatch.setDetails?.setName,
              year: bestMatch.setDetails?.year,
              scores: bestMatch.scores
            };
            result.matchingStatus = 'auto_matched';

            // Store ONLY TOP 5 matches to avoid database bloat
            const topMatches = parsingResult.matches.slice(0, 5).map(match => ({
              cardId: match.card._id,
              cardName: match.card.cardName,
              cardNumber: match.card.cardNumber,
              setName: match.setDetails?.setName || 'Unknown',
              year: match.setDetails?.year,
              confidence: match.confidence,
              scores: match.scores
            }));

            result.cardMatches = topMatches;

            // Update database with SUCCESS results
            await this.gradedCardScanRepository.update(scan._id, {
              extractedData: parsingResult.extractedData || {},
              cardMatches: topMatches,
              matchedCard: bestMatch.card._id,
              matchConfidence: bestMatch.confidence,
              matchingStatus: 'auto_matched',
              processingStatus: 'matched'
            });

            return result;
          } else {
            // Update database for FAILED matches
            await this.gradedCardScanRepository.update(scan._id, {
              extractedData: parsingResult.extractedData || {},
              cardMatches: [],
              matchedCard: null,
              matchConfidence: 0,
              matchingStatus: 'no_match',
              processingStatus: 'matching_failed'
            });

            return result;
          }
        },
        {
          continueOnError: true,
          maxConcurrent: 2
        }
      );
    });
  }

  /**
   * Perform card matching by imageHashes
   * EXACT EXTRACTION from IcrBatchService.js lines 448-534 (approximately)
   */
  async performCardMatchingByHashes(imageHashes) {
    try {
      Logger.operationStart('ICR_MATCH_BY_HASHES', 'Performing card matching by hashes', { imageHashes });

      const scans = await this.gradedCardScanRepository.findByHashes(imageHashes);

      const matchingResults = [];
      let successfulMatching = 0;

      for (const scan of scans) {
        try {
          const parsingResult = await this.hierarchicalParser.parsePsaLabel(scan.ocrText);

          const result = {
            scanId: scan._id,
            imageHash: scan.imageHash,
            originalFileName: scan.originalFileName,
            ocrText: scan.ocrText,
            extractedData: parsingResult.extractedData || {},
            cardMatches: [],
            matchingStatus: 'no_match',
            bestMatch: null
          };

          if (parsingResult.success && parsingResult.bestMatch) {
            const bestMatch = parsingResult.bestMatch;

            result.bestMatch = {
              cardName: bestMatch.card.cardName,
              cardNumber: bestMatch.card.cardNumber,
              setName: bestMatch.setDetails?.setName,
              year: bestMatch.setDetails?.year,
              scores: bestMatch.scores
            };
            result.matchingStatus = 'auto_matched';

            const topMatches = parsingResult.matches.slice(0, 5).map(match => ({
              cardId: match.card._id,
              cardName: match.card.cardName,
              cardNumber: match.card.cardNumber,
              setName: match.setDetails?.setName || 'Unknown',
              year: match.setDetails?.year,
              confidence: match.confidence,
              scores: match.scores
            }));

            result.cardMatches = topMatches;

            await this.gradedCardScanRepository.update(scan._id, {
              extractedData: parsingResult.extractedData || {},
              cardMatches: topMatches,
              matchedCard: bestMatch.card._id,
              matchConfidence: bestMatch.confidence,
              matchingStatus: 'auto_matched',
              processingStatus: 'matched'
            });

            successfulMatching++;
          }

          matchingResults.push(result);

        } catch (error) {
          Logger.operationError('ICR_SCAN_MATCHING_BY_HASH', 'Individual scan matching failed', error, { scanId: scan._id });
          matchingResults.push({
            scanId: scan._id,
            imageHash: scan.imageHash,
            originalFileName: scan.originalFileName,
            error: error.message,
            processingStatus: 'error'
          });
        }
      }

      Logger.operationSuccess('ICR_MATCH_BY_HASHES', 'Card matching by hashes completed', {
        totalProcessed: matchingResults.length,
        successfulMatches: successfulMatching
      });

      return {
        totalProcessed: matchingResults.length,
        successfulMatches: successfulMatching,
        matchingResults
      };

    } catch (error) {
      Logger.operationError('ICR_MATCH_BY_HASHES', 'Card matching by hashes failed', error);
      throw error;
    }
  }
}

export default IcrCardMatchingService;