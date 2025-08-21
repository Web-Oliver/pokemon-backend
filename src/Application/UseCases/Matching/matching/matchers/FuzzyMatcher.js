/**
 * Fuzzy Matcher
 *
 * Consolidated fuzzy matching logic from all PSA/OCR services
 * Single Responsibility: Perform fuzzy string matching against reference data
 */

import Fuse from 'fuse.js';
import fuzzysort from 'fuzzysort';

class FuzzyMatcher {
  constructor() {
    this.fuse = Fuse;
    this.fuzzySort = fuzzysort;
    console.log('✅ FuzzyMatcher: Fuse.js and fuzzysort initialized');
  }

  /**
   * Main fuzzy matching method
   * @param {Object} parsed - Parsed PSA/OCR fields
   * @param {Object} matchingData - Reference matching data
   * @param {Object} config - Matching configuration
   * @returns {Promise<Array>} Array of fuzzy matches
   */
  async match(parsed, matchingData, config) {
    console.log('🔍 FuzzyMatcher: Starting fuzzy matching');

    const matches = [];
    const threshold = config.fuzzyThreshold || 0.6;
    const useFuzzySort = config.useFuzzySort || false;

    try {
      // Step 1: Fuzzy match set names
      if (parsed.setName && matchingData.uniqueSetNames) {
        const setMatches = this._fuzzyMatchArray(
          parsed.setName,
          matchingData.uniqueSetNames,
          threshold,
          useFuzzySort
        );

        setMatches.forEach(match => {
          matches.push({
            type: 'set',
            field: 'setName',
            query: parsed.setName,
            match: match.target,
            score: match.score,
            confidence: match.confidence,
            method: match.method
          });
        });

        console.log(`🏗️  Found ${setMatches.length} fuzzy set matches`);
      }

      // Step 2: Fuzzy match Pokemon names
      if (parsed.pokemonName && matchingData.uniquePokemonNames) {
        const pokemonMatches = this._fuzzyMatchArray(
          parsed.pokemonName,
          matchingData.uniquePokemonNames,
          threshold,
          useFuzzySort
        );

        pokemonMatches.forEach(match => {
          matches.push({
            type: 'pokemon',
            field: 'pokemonName',
            query: parsed.pokemonName,
            match: match.target,
            score: match.score,
            confidence: match.confidence,
            method: match.method
          });
        });

        console.log(`🐾 Found ${pokemonMatches.length} fuzzy Pokemon matches`);
      }

      // Step 3: Fuzzy match card numbers
      if (parsed.cardNumber && matchingData.uniqueCardNumbers) {
        const numberMatches = this._fuzzyMatchCardNumbers(
          parsed.cardNumber,
          matchingData.uniqueCardNumbers,
          threshold
        );

        numberMatches.forEach(match => {
          matches.push({
            type: 'cardNumber',
            field: 'cardNumber',
            query: parsed.cardNumber,
            match: match.target,
            score: match.score,
            confidence: match.confidence,
            method: match.method
          });
        });

        console.log(`🔢 Found ${numberMatches.length} fuzzy card number matches`);
      }

      // Step 4: Cross-reference matches for enhanced scoring
      const enhancedMatches = this._enhanceFuzzyMatches(matches, parsed);

      console.log(`✅ FuzzyMatcher: Returning ${enhancedMatches.length} total fuzzy matches`);
      return enhancedMatches;

    } catch (error) {
      console.error('❌ FuzzyMatcher error:', error);
      return [];
    }
  }

  /**
   * Fuzzy match against an array of strings
   */
  _fuzzyMatchArray(query, targetArray, threshold, useFuzzySort = false) {
    if (!query || !targetArray || targetArray.length === 0) {
      return [];
    }

    let matches = [];

    if (useFuzzySort && this.fuzzySort) {
      // Use fuzzysort library
      matches = this._fuzzyMatchWithFuzzySort(query, targetArray, threshold);
    } else if (this.fuse) {
      // Use Fuse.js library
      matches = this._fuzzyMatchWithFuse(query, targetArray, threshold);
    } else {
      // Use fallback implementation
      matches = this._fuzzyMatchWithFallback(query, targetArray, threshold);
    }

    return matches
      .filter(match => match.confidence >= threshold)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10); // Limit to top 10 matches
  }

  /**
   * Fuzzy match using fuzzysort library
   */
  _fuzzyMatchWithFuzzySort(query, targetArray, threshold) {
    const results = this.fuzzySort.go(query, targetArray, {
      limit: 20,
      threshold: -10000 // fuzzysort uses negative scores
    });

    return results.map(result => ({
      target: result.target,
      score: Math.abs(result.score),
      confidence: Math.max(0, (result.score + 10000) / 10000),
      method: 'fuzzysort'
    }));
  }

  /**
   * Fuzzy match using Fuse.js library
   */
  _fuzzyMatchWithFuse(query, targetArray, threshold) {
    const fuse = new this.fuse(targetArray, {
      threshold: 1 - threshold, // Fuse uses distance, we use similarity
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 2
    });

    const results = fuse.search(query);

    return results.map(result => ({
      target: result.item,
      score: (1 - result.score) * 100,
      confidence: 1 - result.score,
      method: 'fuse'
    }));
  }

  /**
   * Fuzzy match using fallback implementation
   */
  _fuzzyMatchWithFallback(query, targetArray, threshold) {
    const queryLower = query.toLowerCase();
    const matches = [];

    for (const target of targetArray) {
      const targetLower = target.toLowerCase();

      // Calculate multiple similarity metrics
      const levenshtein = this._calculateLevenshteinSimilarity(queryLower, targetLower);
      const jaro = this._calculateJaroSimilarity(queryLower, targetLower);
      const substring = this._calculateSubstringSimilarity(queryLower, targetLower);
      const tokenSet = this._calculateTokenSetSimilarity(queryLower, targetLower);

      // Combine similarities with weights
      const confidence = (
        levenshtein * 0.3 +
        jaro * 0.25 +
        substring * 0.25 +
        tokenSet * 0.2
      );

      if (confidence >= threshold) {
        matches.push({
          target,
          score: confidence * 100,
          confidence,
          method: 'fallback',
          metrics: {
            levenshtein,
            jaro,
            substring,
            tokenSet
          }
        });
      }
    }

    return matches;
  }

  /**
   * Specialized fuzzy matching for card numbers
   */
  _fuzzyMatchCardNumbers(query, targetArray, threshold) {
    const queryStr = query.toString();
    const matches = [];

    for (const target of targetArray) {
      const targetStr = target.toString();

      let confidence = 0;

      // Exact match
      if (queryStr === targetStr) {
        confidence = 1.0;
      }
      // Extract numbers and compare
      else {
        const queryNums = queryStr.match(/\d+/g) || [];
        const targetNums = targetStr.match(/\d+/g) || [];

        if (queryNums.length > 0 && targetNums.length > 0) {
          // Compare primary numbers (first number in each)
          if (queryNums[0] === targetNums[0]) {
            confidence += 0.7;
          }

          // Compare formats (e.g., both have "/" format)
          if (queryStr.includes('/') === targetStr.includes('/')) {
            confidence += 0.2;
          }

          // String similarity as fallback
          const stringSim = this._calculateLevenshteinSimilarity(queryStr, targetStr);

          confidence += stringSim * 0.1;
        }
      }

      if (confidence >= threshold) {
        matches.push({
          target,
          score: confidence * 100,
          confidence,
          method: 'cardNumber'
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Enhance fuzzy matches with cross-references
   */
  _enhanceFuzzyMatches(matches, parsed) {
    // Group matches by type
    const matchesByType = {
      set: matches.filter(m => m.type === 'set'),
      pokemon: matches.filter(m => m.type === 'pokemon'),
      cardNumber: matches.filter(m => m.type === 'cardNumber')
    };

    // Create combinations for high-confidence matches
    const enhancedMatches = [];

    for (const match of matches) {
      // Base match
      enhancedMatches.push({
        ...match,
        matchScore: match.score,
        enhancementType: 'base'
      });

      // Look for supporting matches in other categories
      if (match.type === 'set' && match.confidence > 0.8) {
        // High-confidence set match - look for Pokemon in same context
        const relatedPokemon = matchesByType.pokemon.filter(p => p.confidence > 0.6);
        const relatedNumbers = matchesByType.cardNumber.filter(n => n.confidence > 0.6);

        if (relatedPokemon.length > 0 || relatedNumbers.length > 0) {
          enhancedMatches.push({
            ...match,
            matchScore: match.score + 10, // Boost for supporting evidence
            enhancementType: 'cross_reference',
            supportingMatches: {
              pokemon: relatedPokemon,
              cardNumbers: relatedNumbers
            }
          });
        }
      }
    }

    return enhancedMatches
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50); // Limit total results
  }

  /**
   * Calculate Levenshtein-based similarity
   */
  _calculateLevenshteinSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this._levenshteinDistance(longer, shorter);

    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Jaro similarity
   */
  _calculateJaroSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;

    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0 || len2 === 0) return 0.0;

    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    const str1Matches = new Array(len1).fill(false);
    const str2Matches = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);

      for (let j = start; j < end; j++) {
        if (str2Matches[j] || str1[i] !== str2[j]) continue;

        str1Matches[i] = true;
        str2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0.0;

    // Find transpositions
    let k = 0;

    for (let i = 0; i < len1; i++) {
      if (!str1Matches[i]) continue;

      while (!str2Matches[k]) k++;

      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }

    return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  }

  /**
   * Calculate substring-based similarity
   */
  _calculateSubstringSimilarity(str1, str2) {
    const shorter = str1.length < str2.length ? str1 : str2;
    const longer = str1.length < str2.length ? str2 : str1;

    if (shorter.length === 0) return 0;
    if (longer.includes(shorter)) return 1.0;

    // Find longest common substring
    let maxLength = 0;

    for (let i = 0; i < shorter.length; i++) {
      for (let j = i + 1; j <= shorter.length; j++) {
        const substr = shorter.substring(i, j);

        if (longer.includes(substr)) {
          maxLength = Math.max(maxLength, substr.length);
        }
      }
    }

    return maxLength / shorter.length;
  }

  /**
   * Calculate token set similarity (word-based)
   */
  _calculateTokenSetSimilarity(str1, str2) {
    const tokens1 = new Set(str1.split(/\s+/).filter(t => t.length > 0));
    const tokens2 = new Set(str2.split(/\s+/).filter(t => t.length > 0));

    if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
    if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
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
}

export default FuzzyMatcher;
