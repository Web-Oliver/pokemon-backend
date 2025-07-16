const Card = require('../models/Card');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const { searchCache } = require('../middleware/searchCache');

// Enhanced search utilities for word order and special character handling
class SearchUtility {
  // Normalize search query by removing special characters and handling word order
  static normalizeQuery(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }

    // Remove special characters but keep spaces and alphanumeric
    const normalized = query
      .replace(/[^\w\s-]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .trim() // Remove leading/trailing spaces
      .toLowerCase(); // Convert to lowercase

    return normalized;
  }

  // Create fuzzy search patterns that ignore word order and special characters
  static createFuzzyPatterns(query) {
    const normalized = this.normalizeQuery(query);

    if (!normalized) {
      return [];
    }

    const words = normalized.split(' ').filter((word) => word.length > 0);

    if (words.length === 0) {
      return [];
    }

    const patterns = [];

    // Original query pattern (for exact matches)
    patterns.push(normalized);

    // Individual word patterns (for partial matches)
    words.forEach((word) => {
      patterns.push(word);
    });

    // All permutations of words (for order-independent matching)
    if (words.length > 1 && words.length <= 4) { // Limit to prevent explosion
      const permutations = this.generatePermutations(words);

      permutations.forEach((perm) => {
        patterns.push(perm.join(' '));
      });
    }

    return [...new Set(patterns)]; // Remove duplicates
  }

  // Generate all permutations of words array
  static generatePermutations(arr) {
    if (arr.length <= 1) {
      return [arr];
    }

    const result = [];

    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
      const perms = this.generatePermutations(remaining);

      perms.forEach((perm) => {
        result.push([current].concat(perm));
      });
    }

    return result;
  }

  // Create MongoDB regex patterns for flexible matching
  static createMongoRegexPatterns(query) {
    const patterns = this.createFuzzyPatterns(query);
    const regexPatterns = [];

    patterns.forEach((pattern) => {
      // Escape special regex characters
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      regexPatterns.push(new RegExp(escapedPattern, 'i'));

      // Also add word boundary patterns for better matching
      if (pattern.includes(' ')) {
        const wordBoundaryPattern = escapedPattern.replace(/\s+/g, '\\s+');

        regexPatterns.push(new RegExp(wordBoundaryPattern, 'i'));
      }
    });

    return regexPatterns;
  }

  // Score search results based on relevance to original query
  static calculateRelevanceScore(text, originalQuery) {
    if (!text || !originalQuery) {
      return 0;
    }

    const normalizedText = this.normalizeQuery(text);
    const normalizedQuery = this.normalizeQuery(originalQuery);

    let score = 0;

    // Exact match bonus
    if (normalizedText === normalizedQuery) {
      score += 100;
    }

    // Starts with query bonus
    if (normalizedText.startsWith(normalizedQuery)) {
      score += 50;
    }

    // Contains all words bonus
    const queryWords = normalizedQuery.split(' ');
    const textWords = normalizedText.split(' ');
    let wordMatches = 0;

    queryWords.forEach((queryWord) => {
      if (textWords.some((textWord) => textWord.includes(queryWord))) {
        wordMatches++;
      }
    });

    const wordMatchRatio = queryWords.length > 0 ? wordMatches / queryWords.length : 0;

    score += wordMatchRatio * 30;

    // Length similarity bonus (prefer shorter, more relevant results)
    const lengthDiff = Math.abs(normalizedText.length - normalizedQuery.length);
    const lengthScore = Math.max(0, 20 - lengthDiff);

    score += lengthScore;

    return score;
  }
}

// Export the utility for use in other modules
module.exports = { SearchUtility };
