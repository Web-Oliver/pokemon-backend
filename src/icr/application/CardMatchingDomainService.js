/**
 * Card Matching Domain Service
 *
 * Handles matching of OCR text to card database entries.
 * Pure domain logic with no external dependencies.
 */

import Logger from '@/system/logging/Logger.js';

// Set cache for fast lookups
class SetCache {
  constructor() {
    this.cache = new Map();
    this.initialized = false;
  }

  async initialize(setRepository) {
    if (this.initialized) return;
    
    try {
      const sets = await setRepository.findAll({});
      this.cache.clear();
      
      sets.forEach(set => {
        this.cache.set(set._id.toString(), {
          _id: set._id,
          setName: set.setName,
          year: set.year,
          uniqueSetId: set.uniqueSetId
        });
      });
      
      this.initialized = true;
      Logger.info('SetCache', `Initialized with ${this.cache.size} sets`);
    } catch (error) {
      Logger.error('SetCache', 'Failed to initialize:', error);
      throw error;
    }
  }

  getById(setId) {
    return this.cache.get(setId.toString());
  }

  findByName(setName) {
    const regex = new RegExp(setName, 'i');
    return Array.from(this.cache.values()).filter(set => 
      regex.test(set.setName)
    );
  }

  findByNameExact(setName) {
    const regex = new RegExp(`^${setName}$`, 'i');
    return Array.from(this.cache.values()).filter(set => 
      regex.test(set.setName)
    );
  }

  getAll() {
    return Array.from(this.cache.values());
  }

  clear() {
    this.cache.clear();
    this.initialized = false;
  }
}

const setCache = new SetCache();

export class CardMatchingDomainService {
  constructor(cardRepository, setRepository) {
    this.cardRepository = cardRepository;
    this.setRepository = setRepository;
    
    // Initialize set cache
    this.initializeCache();
  }

  async initializeCache() {
    try {
      await setCache.initialize(this.setRepository);
    } catch (error) {
      Logger.error('CardMatchingDomainService', 'Failed to initialize set cache:', error);
    }
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

    Logger.info('CardMatchingDomainService', 'Extracting PSA fields from OCR text:', ocrText);

    const lines = ocrText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const extracted = {};

    // PSA Label Pattern Recognition
    const patterns = {
      grade: /(?:PSA|GRADE|MINT)\s*(\d{1,2})/i,
      cardNumber: /#?(\d+)(?:\/(\d+))?/,
      year: /(19\d{2}|20\d{2})/,
      pokemon: /^(POKEMON|POK[ÉE]MON)/i,
      setIndicators: /^(BASE|FOSSIL|JUNGLE|ROCKET|GYM|NEO|EXPEDITION|AQUAPOLIS|SKYRIDGE|RUBY|SAPPHIRE|EMERALD|DIAMOND|PEARL|PLATINUM|BLACK|WHITE|XY|SUN|MOON|SWORD|SHIELD)/i
    };

    // Extract grade information
    for (const line of lines) {
      const gradeMatch = line.match(patterns.grade);
      if (gradeMatch) {
        extracted.grade = parseInt(gradeMatch[1]);
        Logger.info('CardMatchingDomainService', `Extracted grade: ${extracted.grade}`);
        break;
      }
    }

    // Extract card number
    for (const line of lines) {
      const numberMatch = line.match(patterns.cardNumber);
      if (numberMatch) {
        extracted.cardNumber = numberMatch[0];
        Logger.info('CardMatchingDomainService', `Extracted card number: ${extracted.cardNumber}`);
        break;
      }
    }

    // Extract year
    for (const line of lines) {
      const yearMatch = line.match(patterns.year);
      if (yearMatch) {
        extracted.year = parseInt(yearMatch[1]);
        Logger.info('CardMatchingDomainService', `Extracted year: ${extracted.year}`);
        break;
      }
    }

    // Enhanced card name and set extraction
    const cleanedLines = lines.filter(line => {
      // Skip PSA header lines
      if (line.match(/^(PSA|PROFESSIONAL|SPORTS|AUTHENTICATOR|GRADE|MINT)/i)) return false;
      // Skip pure numbers or grades
      if (line.match(/^\d+$/)) return false;
      // Skip year-only lines
      if (line.match(/^(19|20)\d{2}$/)) return false;
      return true;
    });

    // Identify Pokemon-related content
    let pokemonLineIndex = -1;
    for (let i = 0; i < cleanedLines.length; i++) {
      if (cleanedLines[i].match(patterns.pokemon)) {
        pokemonLineIndex = i;
        break;
      }
    }

    // Extract card name and set name based on context
    if (cleanedLines.length > 0) {
      // If we found "POKEMON", card name is likely next, set name after that
      if (pokemonLineIndex >= 0 && pokemonLineIndex + 1 < cleanedLines.length) {
        extracted.cardName = this.cleanCardName(cleanedLines[pokemonLineIndex + 1]);
        if (pokemonLineIndex + 2 < cleanedLines.length) {
          extracted.setName = this.cleanSetName(cleanedLines[pokemonLineIndex + 2]);
        }
      } else {
        // Fallback: assume first meaningful line is card name, second is set
        extracted.cardName = this.cleanCardName(cleanedLines[0]);
        if (cleanedLines.length > 1) {
          // Look for set indicators
          for (let i = 1; i < cleanedLines.length; i++) {
            if (cleanedLines[i].match(patterns.setIndicators) || cleanedLines[i].includes('SET')) {
              extracted.setName = this.cleanSetName(cleanedLines[i]);
              break;
            }
          }
          // If no set indicators found, use second line
          if (!extracted.setName) {
            extracted.setName = this.cleanSetName(cleanedLines[1]);
          }
        }
      }
    }

    // Clean and validate extracted data
    this.validateAndCleanExtractedData(extracted);

    Logger.info('CardMatchingDomainService', 'Final extracted data:', extracted);
    return extracted;
  }

  /**
   * Clean and normalize card names
   */
  cleanCardName(cardName) {
    if (!cardName) return null;
    
    return cardName
      .replace(/[^\w\s\-'\.]/g, ' ') // Remove special chars except common ones
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .replace(/^(CARD|POKEMON)\s+/i, '') // Remove prefix words
      .replace(/\s+(CARD|POKEMON)$/i, ''); // Remove suffix words
  }

  /**
   * Clean and normalize set names
   */
  cleanSetName(setName) {
    if (!setName) return null;
    
    return setName
      .replace(/[^\w\s\-]/g, ' ') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .replace(/^(SET|POKEMON)\s+/i, '') // Remove prefix words
      .replace(/\s+(SET|EDITION)$/i, ''); // Remove suffix words
  }

  /**
   * Validate and clean extracted data
   */
  validateAndCleanExtractedData(extracted) {
    // Validate grade range
    if (extracted.grade && (extracted.grade < 1 || extracted.grade > 10)) {
      Logger.warn('CardMatchingDomainService', `Invalid grade: ${extracted.grade}`);
      delete extracted.grade;
    }

    // Validate year range
    if (extracted.year && (extracted.year < 1996 || extracted.year > new Date().getFullYear())) {
      Logger.warn('CardMatchingDomainService', `Invalid year: ${extracted.year}`);
      delete extracted.year;
    }

    // Validate card name length
    if (extracted.cardName && extracted.cardName.length < 2) {
      Logger.warn('CardMatchingDomainService', `Card name too short: ${extracted.cardName}`);
      delete extracted.cardName;
    }

    // Validate set name length
    if (extracted.setName && extracted.setName.length < 2) {
      Logger.warn('CardMatchingDomainService', `Set name too short: ${extracted.setName}`);
      delete extracted.setName;
    }
  }


  /**
   * Find matching cards based on extracted data
   */
  async findCardMatches(extractedData) {
    const { cardName, setName, cardNumber, grade } = extractedData;
    
    if (!cardName && !setName && !cardNumber) {
      Logger.warn('CardMatchingDomainService', 'No searchable data extracted');
      return [];
    }

    try {
      Logger.info('CardMatchingDomainService', 'Searching for matches', { 
        cardName, setName, cardNumber 
      });

      let matches = [];
      
      // Strategy 1: Exact card name and set match
      if (cardName && setName) {
        matches = await this.exactCardAndSetMatch(cardName, setName);
        if (matches.length > 0) {
          Logger.info('CardMatchingDomainService', `Found ${matches.length} exact matches`);
          return this.scoreMatches(matches, 'exact', extractedData);
        }
      }
      
      // Strategy 2: Fuzzy card name match with set constraint
      if (cardName && setName) {
        matches = await this.fuzzyCardNameMatch(cardName, setName);
        if (matches.length > 0) {
          Logger.info('CardMatchingDomainService', `Found ${matches.length} fuzzy matches`);
          return this.scoreMatches(matches, 'fuzzy', extractedData);
        }
      }
      
      // Strategy 3: Card name only (broader search)
      if (cardName) {
        matches = await this.cardNameOnlyMatch(cardName);
        if (matches.length > 0) {
          Logger.info('CardMatchingDomainService', `Found ${matches.length} name-only matches`);
          return this.scoreMatches(matches, 'partial', extractedData);
        }
      }
      
      // Strategy 4: Set name only (fallback)
      if (setName) {
        matches = await this.setNameOnlyMatch(setName);
        if (matches.length > 0) {
          Logger.info('CardMatchingDomainService', `Found ${matches.length} set matches`);
          return this.scoreMatches(matches, 'set-only', extractedData);
        }
      }

      Logger.warn('CardMatchingDomainService', 'No matches found with any strategy');
      return [];

    } catch (error) {
      Logger.error('CardMatchingDomainService', 'Card matching failed:', error);
      return [];
    }
  }

  /**
   * Exact match: card name and set name
   */
  async exactCardAndSetMatch(cardName, setName) {
    try {
      // Use cache instead of database query
      const sets = setCache.findByNameExact(setName);
      
      if (sets.length === 0) return [];

      // Find cards in those sets
      const setIds = sets.map(set => set._id);
      const cards = await this.cardRepository.findAll({
        cardName: { $regex: new RegExp(`^${cardName}$`, 'i') },
        setId: { $in: setIds }
      }, { limit: 10 });

      // Manually add set data from cache
      return cards.map(card => ({
        ...card.toObject ? card.toObject() : card,
        setId: setCache.getById(card.setId)
      }));
    } catch (error) {
      Logger.error('CardMatchingDomainService', 'Exact match failed:', error);
      return [];
    }
  }

  /**
   * Fuzzy match: similar card name within matching sets
   */
  async fuzzyCardNameMatch(cardName, setName) {
    try {
      // Use cache instead of database query
      const sets = setCache.findByName(setName);

      if (sets.length === 0) return [];

      const setIds = sets.map(set => set._id);
      
      // Find cards with similar names in those sets
      const cards = await this.cardRepository.findAll({
        cardName: { $regex: new RegExp(cardName, 'i') },
        setId: { $in: setIds }
      }, { limit: 15 });

      // Manually add set data from cache and filter by similarity
      return cards
        .map(card => ({
          ...card.toObject ? card.toObject() : card,
          setId: setCache.getById(card.setId)
        }))
        .filter(card => {
          const similarity = this.calculateStringSimilarity(cardName, card.cardName);
          return similarity >= 0.6; // 60% similarity threshold
        });
    } catch (error) {
      Logger.error('CardMatchingDomainService', 'Fuzzy match failed:', error);
      return [];
    }
  }

  /**
   * Card name only match (broader search)
   */
  async cardNameOnlyMatch(cardName) {
    try {
      const cards = await this.cardRepository.findAll({
        cardName: { $regex: new RegExp(cardName, 'i') }
      }, { limit: 20 });

      // Manually add set data from cache
      return cards.map(card => ({
        ...card.toObject ? card.toObject() : card,
        setId: setCache.getById(card.setId)
      }));
    } catch (error) {
      Logger.error('CardMatchingDomainService', 'Name-only match failed:', error);
      return [];
    }
  }

  /**
   * Set name only match (fallback)
   */
  async setNameOnlyMatch(setName) {
    try {
      // Use cache instead of database query
      const sets = setCache.findByName(setName);

      if (sets.length === 0) return [];

      const setIds = sets.map(set => set._id);
      
      const cards = await this.cardRepository.findAll({
        setId: { $in: setIds }
      }, { limit: 25 });

      // Manually add set data from cache
      return cards.map(card => ({
        ...card.toObject ? card.toObject() : card,
        setId: setCache.getById(card.setId)
      }));
    } catch (error) {
      Logger.error('CardMatchingDomainService', 'Set-only match failed:', error);
      return [];
    }
  }

  /**
   * Score and rank matches based on strategy and similarity
   */
  scoreMatches(matches, strategy, extractedData) {
    const { cardName, setName } = extractedData;
    
    return matches.map(card => {
      let confidence = 0.5; // Base confidence
      
      // Strategy-based scoring
      switch (strategy) {
        case 'exact':
          confidence = 0.95;
          break;
        case 'fuzzy':
          confidence = 0.8;
          if (cardName) {
            const nameSimilarity = this.calculateStringSimilarity(cardName, card.cardName);
            confidence *= nameSimilarity;
          }
          break;
        case 'partial':
          confidence = 0.6;
          if (cardName) {
            const nameSimilarity = this.calculateStringSimilarity(cardName, card.cardName);
            confidence *= nameSimilarity;
          }
          break;
        case 'set-only':
          confidence = 0.3;
          break;
      }

      // Set name bonus
      if (setName && card.setId && card.setId.setName) {
        const setNameSimilarity = this.calculateStringSimilarity(setName, card.setId.setName);
        confidence += setNameSimilarity * 0.2;
      }

      return {
        ...card.toObject ? card.toObject() : card,
        confidence: Math.min(confidence, 1.0),
        setName: card.setId ? card.setId.setName : null,
        year: card.setId ? card.setId.year : null
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10); // Return top 10 matches
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
