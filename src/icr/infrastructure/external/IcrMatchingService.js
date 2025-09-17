/**
 * ICR Matching Service - CLEAN IMPLEMENTATION
 *
 * Hierarchical search and matching for graded cards.
 * NO COMPATIBILITY BULLSHIT - CLEAN ICR ONLY
 */

import {CardMatchingDomainService} from '@/icr/domain/services/CardMatchingDomainService.js';
import CardRepository from '@/pokemon/cards/CardRepository.js';
import SetRepository from '@/pokemon/sets/SetRepository.js';
import Logger from '@/system/logging/Logger.js';

class IcrMatchingService {
    constructor() {
        this.cardMatchingService = new CardMatchingDomainService(CardRepository, SetRepository);
    }

    /**
     * Match graded card OCR text to database
     */
    async matchGradedCard(ocrText) {
        try {
            Logger.info('IcrMatchingService', 'Processing graded card matching');

            const result = await this.cardMatchingService.matchPsaLabel(ocrText);

            Logger.info('IcrMatchingService', `Found ${result.matches.length} potential matches`);

            return result;

        } catch (error) {
            Logger.error('IcrMatchingService', 'Graded card matching failed:', error);
            return {matches: [], confidence: 0, extractedData: {}};
        }
    }

    /**
     * Extract graded card fields from OCR text
     */
    async extractGradedCardFields(ocrText) {
        try {
            return this.cardMatchingService.extractPsaFields(ocrText);
        } catch (error) {
            Logger.error('IcrMatchingService', 'Field extraction failed:', error);
            return {};
        }
    }

    /**
     * Match card name only - REAL CARD DATABASE SEARCH
     */
    async matchCardName(cardName) {
        try {
            // Direct card name search in database - NO MOCKING
            const CardRepository = (await import('@/pokemon/cards/CardRepository.js')).default;
            const matches = await CardRepository.findByCardName(cardName);
            return matches || [];
        } catch (error) {
            Logger.error('IcrMatchingService', 'Card name matching failed:', error);
            return [];
        }
    }

    /**
     * Match set name only - REAL SET DATABASE SEARCH
     */
    async matchSetName(setName) {
        try {
            // Direct set name search in database - NO MOCKING
            const SetRepository = (await import('@/pokemon/sets/SetRepository.js')).default;
            const matches = await SetRepository.findBySetName(setName);
            return matches || [];
        } catch (error) {
            Logger.error('IcrMatchingService', 'Set name matching failed:', error);
            return [];
        }
    }

    /**
     * Batch matching for multiple OCR texts
     */
    async batchMatchGradedCards(ocrTexts) {
        try {
            const results = await Promise.all(
                ocrTexts.map(async (text, index) => {
                    try {
                        const result = await this.matchGradedCard(text);
                        return {index, ...result};
                    } catch (error) {
                        Logger.error('IcrMatchingService', `Batch matching failed for index ${index}:`, error);
                        return {index, matches: [], confidence: 0, extractedData: {}};
                    }
                })
            );

            return results;

        } catch (error) {
            Logger.error('IcrMatchingService', 'Batch matching failed:', error);
            return ocrTexts.map((_, index) => ({index, matches: [], confidence: 0, extractedData: {}}));
        }
    }
}

export default new IcrMatchingService();
