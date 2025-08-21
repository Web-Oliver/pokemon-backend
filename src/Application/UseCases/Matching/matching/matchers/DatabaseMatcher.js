/**
 * Database Matcher
 *
 * Consolidated database matching logic from all PSA/OCR services
 * Single Responsibility: Match parsed fields against database records
 */

import mongoose from 'mongoose';
import Set from '@/Domain/Entities/Set.js';
import Card from '@/Domain/Entities/Card.js';
class DatabaseMatcher {
  constructor() {
    this.connectionEstablished = false;
    this.ensureConnection();
  }

  /**
   * Ensure database connection is established
   */
  ensureConnection() {
    if (mongoose.connection.readyState === 0 && !this.connectionEstablished) {
      mongoose.connect('mongodb://localhost:27017/pokemon_collection', {
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000
      }).then(() => {
        this.connectionEstablished = true;
        console.log('✅ DatabaseMatcher: MongoDB connection established');
      }).catch(error => {
        console.error('❌ DatabaseMatcher: MongoDB connection failed:', error);
      });
    }
  }

  /**
   * Main matching method against database
   * @param {Object} parsed - Parsed PSA/OCR fields
   * @param {Object} matchingData - Reference matching data
   * @param {Object} config - Matching configuration
   * @returns {Promise<Array>} Array of database matches
   */
  async match(parsed, matchingData, config) {
    console.log('🗄️  DatabaseMatcher: Starting database matching');

    const matches = [];

    try {
      // Step 1: Find matching sets
      const setMatches = await this._findSetMatches(parsed);

      console.log(`🏗️  Found ${setMatches.length} set matches`);

      // Step 2: Find matching cards within sets
      if (setMatches.length > 0) {
        const cardMatches = await this._findCardMatches(parsed, setMatches);

        console.log(`🃏 Found ${cardMatches.length} card matches`);
        matches.push(...cardMatches);
      }

      // Step 3: Fallback - direct card matching without set constraint
      if (matches.length === 0) {
        const directCardMatches = await this._findDirectCardMatches(parsed);

        console.log(`🎯 Found ${directCardMatches.length} direct card matches`);
        matches.push(...directCardMatches);
      }

      // Step 4: Enhance matches with additional data
      const enhancedMatches = await this._enhanceMatches(matches);

      console.log(`✅ DatabaseMatcher: Returning ${enhancedMatches.length} total matches`);
      return enhancedMatches;

    } catch (error) {
      console.error('❌ DatabaseMatcher error:', error);
      return [];
    }
  }

  /**
   * Find matching sets based on parsed data
   */
  async _findSetMatches(parsed) {
    const query = {};
    const orConditions = [];

    // Set name matching
    if (parsed.setName) {
      orConditions.push(
        { setName: { $regex: parsed.setName, $options: 'i' } },
        { setName: { $regex: this._escapeRegex(parsed.setName), $options: 'i' } }
      );
    }

    // Year matching
    if (parsed.year) {
      query.year = parsed.year;
    }

    // Combine conditions
    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    // If no meaningful query, return empty
    if (Object.keys(query).length === 0) {
      return [];
    }

    const sets = await Set.find(query)
      .select('setName year totalCardsInSet series language')
      .lean()
      .limit(10);

    return sets.map(set => ({
      ...set,
      matchType: 'set',
      matchScore: this._calculateSetMatchScore(set, parsed)
    }));
  }

  /**
   * Find matching cards within specific sets
   */
  async _findCardMatches(parsed, setMatches) {
    const setIds = setMatches.map(set => set._id);
    const query = { setId: { $in: setIds } };
    const orConditions = [];

    // Pokemon name matching
    if (parsed.pokemonName) {
      orConditions.push(
        { cardName: { $regex: parsed.pokemonName, $options: 'i' } },
        { cardName: { $regex: this._escapeRegex(parsed.pokemonName), $options: 'i' } }
      );
    }

    // Card number matching
    if (parsed.cardNumber) {
      const cardNumStr = parsed.cardNumber.toString();
      const numberOnly = cardNumStr.replace(/\/.*/, ''); // Extract just the number part

      orConditions.push(
        { cardNumber: { $regex: cardNumStr, $options: 'i' } },
        { cardNumber: { $regex: `^${numberOnly}`, $options: 'i' } },
        { cardNumber: parseInt(numberOnly) || cardNumStr }
      );
    }

    // Rarity matching
    if (parsed.rarity) {
      orConditions.push(
        { rarity: { $regex: parsed.rarity, $options: 'i' } }
      );
    }

    // Add OR conditions if any exist
    if (orConditions.length > 0) {
      query.$or = orConditions;
    }

    const cards = await Card.find(query)
      .populate('setId', 'setName year series')
      .select('cardName cardNumber rarity imageUrl price sold dateAdded setId')
      .lean()
      .limit(20);

    return cards.map(card => ({
      ...card,
      matchType: 'card',
      matchScore: this._calculateCardMatchScore(card, parsed),
      setInfo: card.setId
    }));
  }

  /**
   * Find cards directly without set constraint (fallback)
   */
  async _findDirectCardMatches(parsed) {
    const query = {};
    const orConditions = [];

    // Pokemon name matching
    if (parsed.pokemonName) {
      orConditions.push(
        { cardName: { $regex: parsed.pokemonName, $options: 'i' } },
        { cardName: { $regex: this._escapeRegex(parsed.pokemonName), $options: 'i' } }
      );
    }

    // Card number matching with year filter if available
    if (parsed.cardNumber) {
      const cardQuery = { cardNumber: { $regex: parsed.cardNumber, $options: 'i' } };

      // If we have year, add it to narrow results
      if (parsed.year) {
        const setsInYear = await Set.find({ year: parsed.year }).select('_id');

        if (setsInYear.length > 0) {
          cardQuery.setId = { $in: setsInYear.map(s => s._id) };
        }
      }

      orConditions.push(cardQuery);
    }

    if (orConditions.length === 0) {
      return [];
    }

    query.$or = orConditions;

    const cards = await Card.find(query)
      .populate('setId', 'setName year series')
      .select('cardName cardNumber rarity imageUrl price sold dateAdded setId')
      .lean()
      .limit(15);

    return cards.map(card => ({
      ...card,
      matchType: 'card_direct',
      matchScore: this._calculateCardMatchScore(card, parsed),
      setInfo: card.setId
    }));
  }

  /**
   * Enhance matches with additional computed data
   */
  async _enhanceMatches(matches) {
    return matches.map(match => {
      // Add availability status
      match.isAvailable = !match.sold;

      // Add price category
      if (match.price) {
        if (match.price < 10) match.priceCategory = 'budget';
        else if (match.price < 50) match.priceCategory = 'mid';
        else if (match.price < 200) match.priceCategory = 'high';
        else match.priceCategory = 'premium';
      }

      // Add age category
      if (match.setInfo && match.setInfo.year) {
        const age = new Date().getFullYear() - match.setInfo.year;

        if (age <= 2) match.ageCategory = 'recent';
        else if (age <= 5) match.ageCategory = 'modern';
        else if (age <= 10) match.ageCategory = 'classic';
        else match.ageCategory = 'vintage';
      }

      // Add match confidence
      match.confidence = Math.min(1.0, match.matchScore / 100);

      return match;
    });
  }

  /**
   * Calculate match score for sets
   */
  _calculateSetMatchScore(set, parsed) {
    let score = 0;

    // Set name matching (most important)
    if (parsed.setName && set.setName) {
      const similarity = this._calculateStringSimilarity(
        parsed.setName.toLowerCase(),
        set.setName.toLowerCase()
      );

      score += similarity * 70;
    }

    // Year matching
    if (parsed.year && set.year && parsed.year === set.year) {
      score += 30;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate match score for cards
   */
  _calculateCardMatchScore(card, parsed) {
    let score = 0;

    // Pokemon name matching
    if (parsed.pokemonName && card.cardName) {
      const similarity = this._calculateStringSimilarity(
        parsed.pokemonName.toLowerCase(),
        card.cardName.toLowerCase()
      );

      score += similarity * 40;
    }

    // Card number matching
    if (parsed.cardNumber && card.cardNumber) {
      const parsedNum = parsed.cardNumber.toString().toLowerCase();
      const cardNum = card.cardNumber.toString().toLowerCase();

      if (parsedNum === cardNum) {
        score += 35;
      } else if (parsedNum.includes(cardNum) || cardNum.includes(parsedNum)) {
        score += 25;
      }
    }

    // Set matching through populated setId
    if (parsed.setName && card.setInfo && card.setInfo.setName) {
      const similarity = this._calculateStringSimilarity(
        parsed.setName.toLowerCase(),
        card.setInfo.setName.toLowerCase()
      );

      score += similarity * 15;
    }

    // Year matching
    if (parsed.year && card.setInfo && card.setInfo.year === parsed.year) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  _calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this._levenshteinDistance(longer, shorter);

    return (longer.length - distance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between strings
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
   * Escape special regex characters
   */
  _escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default DatabaseMatcher;
