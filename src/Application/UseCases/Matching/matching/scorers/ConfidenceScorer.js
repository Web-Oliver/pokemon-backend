/**
 * Confidence Scorer
 *
 * Consolidated confidence scoring logic from all PSA/OCR services
 * Single Responsibility: Score and rank matching results with confidence metrics
 */

class ConfidenceScorer {
  constructor() {
    this.scoringWeights = {
      exactMatch: 1.0,
      fuzzyMatch: 0.85,
      partialMatch: 0.6,
      contextMatch: 0.4,
      fallbackMatch: 0.2
    };

    this.fieldWeights = {
      setName: 0.35, // Most important for identification
      pokemonName: 0.25, // Very important for card identity
      cardNumber: 0.20, // Important for exact identification
      year: 0.10, // Helps narrow down options
      rarity: 0.05, // Less critical but helpful
      grade: 0.03, // PSA specific
      language: 0.02 // Minor factor
    };
  }

  /**
   * Main scoring method
   * @param {Array} matchResults - Results from different matchers
   * @param {Object} parsed - Original parsed input
   * @param {Object} config - Scoring configuration
   * @returns {Array} Scored and ranked results
   */
  score(matchResults, parsed, config) {
    console.log('📊 ConfidenceScorer: Starting confidence scoring');

    const allMatches = this._consolidateMatches(matchResults);
    const scoredMatches = this._scoreMatches(allMatches, parsed, config);
    const rankedMatches = this._rankMatches(scoredMatches, config);

    console.log(`✅ ConfidenceScorer: Scored ${rankedMatches.length} matches`);
    return rankedMatches;
  }

  /**
   * Consolidate matches from different matchers
   */
  _consolidateMatches(matchResults) {
    const allMatches = [];
    const seenMatches = new Set();

    for (const matchResult of matchResults) {
      for (const match of matchResult.matches) {
        // Create unique key for deduplication
        const matchKey = this._createMatchKey(match);

        if (!seenMatches.has(matchKey)) {
          seenMatches.add(matchKey);
          allMatches.push({
            ...match,
            sourceType: matchResult.type,
            originalScore: match.score || match.matchScore || 0
          });
        } else {
          // Merge duplicate matches by boosting confidence
          const existingMatch = allMatches.find(m => this._createMatchKey(m) === matchKey);

          if (existingMatch) {
            existingMatch.duplicateCount = (existingMatch.duplicateCount || 1) + 1;
            existingMatch.originalScore = Math.max(existingMatch.originalScore, match.score || match.matchScore || 0);
          }
        }
      }
    }

    return allMatches;
  }

  /**
   * Score individual matches
   */
  _scoreMatches(matches, parsed, config) {
    return matches.map(match => {
      const scores = {
        fieldScore: this._calculateFieldScore(match, parsed),
        matchTypeScore: this._calculateMatchTypeScore(match),
        qualityScore: this._calculateQualityScore(match),
        contextScore: this._calculateContextScore(match, parsed),
        duplicateBonus: this._calculateDuplicateBonus(match)
      };

      // Combine scores with weights
      const combinedScore = (
        scores.fieldScore * 0.40 +
        scores.matchTypeScore * 0.25 +
        scores.qualityScore * 0.20 +
        scores.contextScore * 0.10 +
        scores.duplicateBonus * 0.05
      );

      // Apply strategy-specific adjustments
      const adjustedScore = this._applyStrategyAdjustments(combinedScore, match, config);

      return {
        ...match,
        confidence: Math.min(1.0, Math.max(0.0, adjustedScore)),
        scoreBreakdown: scores,
        finalScore: adjustedScore * 100
      };
    });
  }

  /**
   * Calculate field-based scoring
   */
  _calculateFieldScore(match, parsed) {
    let score = 0;
    let totalWeight = 0;

    Object.entries(this.fieldWeights).forEach(([field, weight]) => {
      totalWeight += weight;

      if (parsed[field] && match[field]) {
        const fieldSimilarity = this._calculateFieldSimilarity(parsed[field], match[field], field);

        score += fieldSimilarity * weight;
      } else if (parsed[field] && match.setInfo && match.setInfo[field]) {
        // Check in nested setInfo object
        const fieldSimilarity = this._calculateFieldSimilarity(parsed[field], match.setInfo[field], field);

        score += fieldSimilarity * weight;
      }
    });

    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Calculate match type scoring
   */
  _calculateMatchTypeScore(match) {
    const typeScores = {
      'exact': 1.0,
      'database': 0.9,
      'fuzzy': 0.7,
      'partial': 0.5,
      'fallback': 0.3
    };

    const matchType = match.matchType || match.type || match.sourceType || 'fallback';

    return typeScores[matchType] || typeScores.fallback;
  }

  /**
   * Calculate quality-based scoring
   */
  _calculateQualityScore(match) {
    let qualityScore = 0.5; // Base score

    // Image availability bonus
    if (match.imageUrl && match.imageUrl.length > 0) {
      qualityScore += 0.1;
    }

    // Price information bonus
    if (match.price && match.price > 0) {
      qualityScore += 0.1;
    }

    // Availability bonus
    if (match.isAvailable !== undefined) {
      qualityScore += match.isAvailable ? 0.1 : 0.05;
    }

    // Data completeness bonus
    const completenessFields = ['cardName', 'cardNumber', 'rarity', 'setId'];
    const completenessRatio = completenessFields.reduce((count, field) => count + (match[field] ? 1 : 0), 0) / completenessFields.length;

    qualityScore += completenessRatio * 0.2;

    return Math.min(1.0, qualityScore);
  }

  /**
   * Calculate context-based scoring
   */
  _calculateContextScore(match, parsed) {
    let contextScore = 0;

    // Year context
    if (parsed.year && match.setInfo && match.setInfo.year) {
      if (parsed.year === match.setInfo.year) {
        contextScore += 0.3;
      } else {
        const yearDiff = Math.abs(parsed.year - match.setInfo.year);

        if (yearDiff <= 2) contextScore += 0.15;
        else if (yearDiff <= 5) contextScore += 0.05;
      }
    }

    // Series context
    if (parsed.setName && match.setInfo && match.setInfo.series) {
      if (parsed.setName.toLowerCase().includes(match.setInfo.series.toLowerCase())) {
        contextScore += 0.2;
      }
    }

    // Language context
    if (parsed.language && match.language) {
      if (parsed.language.toLowerCase() === match.language.toLowerCase()) {
        contextScore += 0.1;
      }
    }

    // Rarity context
    if (parsed.rarity && match.rarity) {
      const raritySimilarity = this._calculateFieldSimilarity(parsed.rarity, match.rarity, 'rarity');

      contextScore += raritySimilarity * 0.15;
    }

    // Holo/First Edition context
    if (parsed.isHolo && match.rarity && match.rarity.toLowerCase().includes('holo')) {
      contextScore += 0.1;
    }

    if (parsed.isFirstEdition && match.rarity && match.rarity.toLowerCase().includes('1st')) {
      contextScore += 0.15;
    }

    return Math.min(1.0, contextScore);
  }

  /**
   * Calculate bonus for duplicate matches
   */
  _calculateDuplicateBonus(match) {
    if (!match.duplicateCount || match.duplicateCount <= 1) {
      return 0;
    }

    // Bonus increases with more duplicates but with diminishing returns
    const duplicateBonus = Math.min(0.3, (match.duplicateCount - 1) * 0.1);

    return duplicateBonus;
  }

  /**
   * Apply strategy-specific adjustments
   */
  _applyStrategyAdjustments(score, match, config) {
    let adjustedScore = score;

    // Fuzzy matching strategy adjustments
    if (config.useFuzzySort || config.fuzzyThreshold < 0.6) {
      // Boost fuzzy matches in fuzzy-focused strategies
      if (match.method === 'fuzzysort' || match.method === 'fuse') {
        adjustedScore *= 1.1;
      }
    }

    // Optimal matching strategy adjustments
    if (config.useOptimalScoring) {
      // Apply more conservative scoring
      adjustedScore *= 0.95;

      // But boost high-quality exact matches
      if (match.confidence > 0.9 && match.matchType === 'exact') {
        adjustedScore *= 1.15;
      }
    }

    // Database-first strategy adjustments
    if (config.priority && config.priority[0] === 'setName') {
      // Boost database matches when set-focused
      if (match.sourceType === 'database' && match.setInfo) {
        adjustedScore *= 1.05;
      }
    }

    return adjustedScore;
  }

  /**
   * Rank matches by confidence and apply final filtering
   */
  _rankMatches(matches, config) {
    // Sort by confidence descending
    const sortedMatches = matches.sort((a, b) => b.confidence - a.confidence);

    // Apply confidence threshold
    const threshold = config.confidenceThreshold || 0.1;
    const thresholdedMatches = sortedMatches.filter(match => match.confidence >= threshold);

    // Group by confidence tiers
    const tieredMatches = this._groupByConfidenceTiers(thresholdedMatches);

    // Apply final ranking within tiers
    return this._applyFinalRanking(tieredMatches, config);
  }

  /**
   * Group matches by confidence tiers
   */
  _groupByConfidenceTiers(matches) {
    const tiers = {
      excellent: [], // >= 0.9
      good: [], // >= 0.7
      fair: [], // >= 0.5
      poor: [] // < 0.5
    };

    matches.forEach(match => {
      if (match.confidence >= 0.9) tiers.excellent.push(match);
      else if (match.confidence >= 0.7) tiers.good.push(match);
      else if (match.confidence >= 0.5) tiers.fair.push(match);
      else tiers.poor.push(match);
    });

    return tiers;
  }

  /**
   * Apply final ranking logic
   */
  _applyFinalRanking(tieredMatches, config) {
    const finalRanked = [];
    const maxResults = config.maxResults || 20;

    // Prioritize excellent matches
    finalRanked.push(...tieredMatches.excellent.slice(0, Math.floor(maxResults * 0.4)));

    // Add good matches
    const remainingSlots = maxResults - finalRanked.length;

    if (remainingSlots > 0) {
      finalRanked.push(...tieredMatches.good.slice(0, Math.floor(remainingSlots * 0.6)));
    }

    // Add fair matches if still room
    const stillRemaining = maxResults - finalRanked.length;

    if (stillRemaining > 0) {
      finalRanked.push(...tieredMatches.fair.slice(0, stillRemaining));
    }

    // Add confidence tier labels
    return finalRanked.map((match, index) => ({
      ...match,
      rank: index + 1,
      confidenceTier: this._getConfidenceTier(match.confidence),
      isTopResult: index === 0
    }));
  }

  /**
   * Calculate field similarity for specific field types
   */
  _calculateFieldSimilarity(value1, value2, fieldType) {
    if (!value1 || !value2) return 0;

    const str1 = value1.toString().toLowerCase();
    const str2 = value2.toString().toLowerCase();

    // Exact match
    if (str1 === str2) return 1.0;

    // Field-specific similarity calculations
    switch (fieldType) {
      case 'setName':
        return this._calculateSetNameSimilarity(str1, str2);
      case 'pokemonName':
        return this._calculatePokemonNameSimilarity(str1, str2);
      case 'cardNumber':
        return this._calculateCardNumberSimilarity(str1, str2);
      case 'year':
        return str1 === str2 ? 1.0 : 0.0; // Years must match exactly
      case 'rarity':
        return this._calculateRaritySimilarity(str1, str2);
      default:
        return this._calculateLevenshteinSimilarity(str1, str2);
    }
  }

  /**
   * Calculate set name similarity
   */
  _calculateSetNameSimilarity(str1, str2) {
    // Check for common abbreviations
    const abbreviations = {
      'base set': ['base', 'bs'],
      'jungle': ['jun'],
      'fossil': ['fos'],
      'team rocket': ['tr', 'rocket'],
      'gym heroes': ['gh'],
      'gym challenge': ['gc']
    };

    for (const [fullName, abbrevs] of Object.entries(abbreviations)) {
      if ((str1 === fullName && abbrevs.includes(str2)) ||
          (str2 === fullName && abbrevs.includes(str1))) {
        return 0.95;
      }
    }

    // Standard string similarity
    return this._calculateLevenshteinSimilarity(str1, str2);
  }

  /**
   * Calculate Pokemon name similarity
   */
  _calculatePokemonNameSimilarity(str1, str2) {
    // Handle common variations
    if (str1.includes(str2) || str2.includes(str1)) {
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;

      return shorter.length / longer.length;
    }

    return this._calculateLevenshteinSimilarity(str1, str2);
  }

  /**
   * Calculate card number similarity
   */
  _calculateCardNumberSimilarity(str1, str2) {
    // Extract numbers
    const nums1 = str1.match(/\d+/g) || [];
    const nums2 = str2.match(/\d+/g) || [];

    if (nums1.length > 0 && nums2.length > 0) {
      // Compare primary numbers
      if (nums1[0] === nums2[0]) {
        // Same primary number - check format similarity
        return str1.includes('/') === str2.includes('/') ? 0.95 : 0.85;
      }
    }

    return this._calculateLevenshteinSimilarity(str1, str2);
  }

  /**
   * Calculate rarity similarity
   */
  _calculateRaritySimilarity(str1, str2) {
    const rarityMap = {
      'common': ['c'],
      'uncommon': ['u', 'uc'],
      'rare': ['r'],
      'rare holo': ['rh', 'holo'],
      'promo': ['p']
    };

    for (const [fullRarity, abbrevs] of Object.entries(rarityMap)) {
      if ((str1 === fullRarity && abbrevs.includes(str2)) ||
          (str2 === fullRarity && abbrevs.includes(str1))) {
        return 0.9;
      }
    }

    return this._calculateLevenshteinSimilarity(str1, str2);
  }

  /**
   * Calculate Levenshtein similarity
   */
  _calculateLevenshteinSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this._levenshteinDistance(longer, shorter);

    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   */
  _levenshteinDistance(str1, str2) {
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

  /**
   * Create unique key for match deduplication
   */
  _createMatchKey(match) {
    const keyParts = [
      match.cardName || match.name || '',
      match.cardNumber || match.number || '',
      match.setId || match.setName || '',
      match._id || match.id || ''
    ];

    return keyParts.join('|').toLowerCase();
  }

  /**
   * Get confidence tier label
   */
  _getConfidenceTier(confidence) {
    if (confidence >= 0.9) return 'excellent';
    if (confidence >= 0.7) return 'good';
    if (confidence >= 0.5) return 'fair';
    return 'poor';
  }
}

export default ConfidenceScorer;
