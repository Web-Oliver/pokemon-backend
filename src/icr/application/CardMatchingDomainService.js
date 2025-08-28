/**
 * Card Matching Domain Service
 *
 * Handles matching of OCR text to card database entries.
 * Pure domain logic with no external dependencies.
 */

import Logger from '@/system/logging/Logger.js';

export class CardMatchingDomainService {
  constructor(cardRepository, setRepository) {
    this.cardRepository = cardRepository;
    this.setRepository = setRepository;
  }

  /**
   * Match PSA label text to cards in database
   */
  async matchPsaLabel(ocrText) {
    try {
      Logger.info('CardMatchingDomainService', 'Starting PSA label matching');

      const extractedData = this.extractPsaFields(ocrText);
      const matches = await this.findCardMatches(extractedData);

      return {
        matches: matches.map(match => ({
          card: {
            _id: match._id,
            cardName: match.cardName,
            cardNumber: match.cardNumber,
            setName: match.setName,
            setId: match.setId,
            year: match.year
          },
          confidence: match.confidence || 0.8,
          strategy: 'unified-psa-matching'
        })),
        confidence: matches.length > 0 ? matches[0].confidence || 0.8 : 0,
        extractedData
      };

    } catch (error) {
      Logger.error('CardMatchingDomainService', 'PSA matching failed:', error);
      return { matches: [], confidence: 0, extractedData: {} };
    }
  }

  /**
   * Extract PSA-specific fields from OCR text
   */
  extractPsaFields(ocrText) {
    if (!ocrText || ocrText.trim().length === 0) {
      return {};
    }

    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const extracted = {};

    // Extract potential card name and set
    const textFields = [];
    for (const line of lines) {
      if (line.length > 0) {
        textFields.push(line);
      }
    }

    if (textFields.length > 0) {
      extracted.cardName = textFields[0];
    }
    if (textFields.length > 1) {
      extracted.setName = textFields[1];
    }

    return extracted;
  }


  /**
   * Find matching cards based on extracted data
   */
  async findCardMatches(extractedData) {
    return [];
  }

  /**
   * Calculate string similarity (simple implementation)
   */
  calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;

    // Simple contains check
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Levenshtein distance approximation
    const maxLength = Math.max(s1.length, s2.length);
    const distance = this.levenshteinDistance(s1, s2);

    return Math.max(0, 1 - distance / maxLength);
  }

  /**
   * Levenshtein distance calculation
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}
