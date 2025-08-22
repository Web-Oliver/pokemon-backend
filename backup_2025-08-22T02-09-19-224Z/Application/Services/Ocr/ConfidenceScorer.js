/**
 * Confidence Scorer Service
 * 
 * SINGLE RESPONSIBILITY: Score match confidence
 * NO OTHER RESPONSIBILITIES: matching, parsing, extraction
 */

/**
 * Fuzzy Confidence Scorer
 */
export class FuzzyConfidenceScorer {
  
  /**
   * Score matches by confidence
   */
  scoreMatches(matches) {
    if (!matches || matches.length === 0) return [];

    // Score each match
    const scoredMatches = matches.map(match => {
      const enhancedMatch = { ...match };
      enhancedMatch.confidence = this.calculateEnhancedConfidence(match);
      return enhancedMatch;
    });

    // Sort by confidence (highest first)
    return scoredMatches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate confidence for a single match
   */
  calculateConfidence(match, parsedData) {
    let confidence = match.confidence || 0.5;

    // Boost for exact name matches
    if (parsedData.pokemonName && match.cardName) {
      const nameSimilarity = this.calculateStringSimilarity(
        parsedData.pokemonName.toLowerCase(),
        match.cardName.toLowerCase()
      );
      confidence += nameSimilarity * 0.3;
    }

    // Boost for exact number matches
    if (parsedData.cardNumber && match.cardNumber) {
      if (parsedData.cardNumber === match.cardNumber) {
        confidence += 0.2;
      } else if (parsedData.cardNumber.padStart(3, '0') === match.cardNumber.padStart(3, '0')) {
        confidence += 0.15;
      }
    }

    // Boost for set matches
    if (parsedData.setName && match.setName) {
      const setSimilarity = this.calculateStringSimilarity(
        parsedData.setName.toLowerCase(),
        match.setName.toLowerCase()
      );
      confidence += setSimilarity * 0.2;
    }

    // Boost for year matches
    if (parsedData.year && match.year) {
      if (parsedData.year === match.year) {
        confidence += 0.1;
      }
    }

    // Strategy-based adjustments
    const strategyBoosts = {
      'exact': 0.0,
      'number-set': -0.05,
      'name-fuzzy': -0.1,
      'set-based': -0.15
    };

    confidence += strategyBoosts[match.matchStrategy] || -0.2;

    return Math.min(Math.max(confidence, 0), 1.0);
  }

  /**
   * Calculate enhanced confidence with additional factors
   */
  calculateEnhancedConfidence(match) {
    let confidence = match.confidence || 0.5;

    // Strategy confidence mapping
    const strategyConfidence = {
      'exact': 0.95,
      'number-set': 0.85,
      'name-fuzzy': 0.70,
      'set-based': 0.60,
      'fallback': 0.40
    };

    const baseConfidence = strategyConfidence[match.matchStrategy] || strategyConfidence.fallback;
    
    // Weighted combination of original and strategy confidence
    confidence = (confidence * 0.6) + (baseConfidence * 0.4);

    // Additional boosts for data quality
    if (match.cardName && match.cardName !== 'Unknown Card') {
      confidence += 0.05;
    }

    if (match.setName && match.setName !== 'Unknown Set') {
      confidence += 0.05;
    }

    if (match.cardNumber && match.cardNumber !== 'Unknown') {
      confidence += 0.05;
    }

    return Math.min(Math.max(confidence, 0), 1.0);
  }

  /**
   * Calculate string similarity using basic algorithm
   */
  calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1;

    // Simple character-based similarity
    let matches = 0;
    const minLen = Math.min(len1, len2);

    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) {
        matches++;
      }
    }

    // Check for substring matches
    if (str1.includes(str2) || str2.includes(str1)) {
      matches += minLen * 0.5;
    }

    return Math.min(matches / maxLen, 1.0);
  }
}

/**
 * Confidence Scorer Factory
 */
export class ConfidenceScorerFactory {
  static create() {
    console.log('📊 Using Fuzzy Confidence Scorer');
    return new FuzzyConfidenceScorer();
  }
}