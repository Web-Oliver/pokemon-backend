/**
 * Hierarchical PSA Parser Service
 *
 * Single Responsibility: Parse PSA label OCR text using hierarchical search
 * - Extract year, base Pokemon name, card number, and modifiers
 * - Search cards by base name + card number (ignore modifiers initially)
 * - Verify sets by matching set names against full OCR text
 * - Score matches based on modifier agreement + set verification
 *
 * Architecture: Uses existing search APIs for maximum compatibility
 */

import SearchService from '@/search/services/SearchService.js';
import Logger from '@/system/logging/Logger.js';

class HierarchicalPsaParser {
  constructor() {
    this.searchService = new SearchService();
  }

  /**
   * Parse PSA label using multi-phase hierarchical approach
   * @param {string} ocrText - Raw OCR text from PSA label
   * @returns {Object} Parsing result with matched cards and confidence scores
   */
  async parsePsaLabel(ocrText) {
    Logger.operationStart('PSA_HIERARCHICAL_PARSE', 'Starting multi-phase hierarchical PSA parsing', {
      ocrLength: ocrText?.length
    });

    try {
      // PHASE 1: Extract all possible card numbers and year
      const extractedData = this.extractAllPossibleData(ocrText);

      if (!extractedData.year || extractedData.possibleCardNumbers.length === 0) {
        return this.createEmptyResult('Missing year or no card numbers found', extractedData);
      }

      // PHASE 2: Search by card numbers only (no Pokemon name filtering)
      const cardCandidates = await this.searchByCardNumbers(extractedData.possibleCardNumbers);

      if (cardCandidates.length === 0) {
        return this.createEmptyResult('No cards found matching any extracted card numbers', extractedData);
      }

      // PHASE 3: Filter candidates by Pokemon names found in OCR
      const pokemonFilteredCandidates = this.filterByPokemonNames(cardCandidates, extractedData.possiblePokemonNames);

      // PHASE 4: Enrich with set details and verify
      const candidatesWithSets = await this.enrichWithSetDetails(pokemonFilteredCandidates);
      const setVerifiedCandidates = this.verifySetNames(candidatesWithSets, ocrText);

      // PHASE 5: Score final matches
      const scoredMatches = this.scoreMatches(setVerifiedCandidates, extractedData, ocrText);

      // PHASE 6: Return best matches
      const result = this.createSuccessResult(scoredMatches, extractedData, ocrText);

      Logger.operationSuccess('PSA_HIERARCHICAL_PARSE', 'Multi-phase hierarchical parsing completed', {
        cardNumbersFound: extractedData.possibleCardNumbers.length,
        totalCandidates: cardCandidates.length,
        pokemonFiltered: pokemonFilteredCandidates.length,
        setVerified: setVerifiedCandidates.length,
        finalMatches: scoredMatches.length,
        bestScore: scoredMatches[0]?.totalScore || 0
      });

      return result;

    } catch (error) {
      Logger.operationError('PSA_HIERARCHICAL_PARSE', 'Multi-phase hierarchical parsing failed', error, {
        ocrLength: ocrText?.length
      });
      throw error;
    }
  }

  /**
   * PHASE 1: Extract all possible data from OCR text
   */
  extractAllPossibleData(ocrText) {
    const cleanText = ocrText.replace(/\s+/g, ' ').trim().toUpperCase();

    const extractedData = {
      year: null,
      certificationNumber: null,
      grade: null,
      possibleCardNumbers: [],
      possiblePokemonNames: [],
      modifiers: [],
      rawText: ocrText,
      cleanText: cleanText
    };

    // Extract year (4 digits) - CONVERT TO INTEGER
    const yearMatch = cleanText.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      extractedData.year = parseInt(yearMatch[0], 10);
      Logger.info('HierarchicalPsaParser', `Extracted year: ${extractedData.year}`);
    }

    // Extract certification number (PSA cert numbers are typically 7-9 digits)
    const certMatch = cleanText.match(/\b(\d{7,9})\b/);
    if (certMatch) {
      extractedData.certificationNumber = certMatch[1];
      Logger.info('HierarchicalPsaParser', `Extracted cert number: ${extractedData.certificationNumber}`);
    }

    // Extract grade (1-10)
    const gradeMatch = cleanText.match(/(?:MINT|GEM MINT|NM-MT|EX-MT|EX|VG-EX|VG|GOOD|PR)\s*(\d+)/i);
    if (gradeMatch) {
      extractedData.grade = parseInt(gradeMatch[1], 10);
      Logger.info('HierarchicalPsaParser', `Extracted grade: ${extractedData.grade}`);
    } else {
      const numberMatch = cleanText.match(/\b(10|9|8|7|6|5|4|3|2|1)\b/);
      if (numberMatch) {
        extractedData.grade = parseInt(numberMatch[1], 10);
        Logger.info('HierarchicalPsaParser', `Extracted grade (number): ${extractedData.grade}`);
      }
    }

    // Extract ALL possible card numbers using multiple patterns
    extractedData.possibleCardNumbers = this.extractAllCardNumbers(cleanText);

    // Extract ALL possible Pokemon names
    extractedData.possiblePokemonNames = this.extractAllPokemonNames(cleanText);

    // Extract modifiers
    extractedData.modifiers = this.extractModifiers(cleanText);

    Logger.info('HierarchicalPsaParser', 'Extracted data summary:', {
      year: extractedData.year,
      certificationNumber: extractedData.certificationNumber,
      grade: extractedData.grade,
      cardNumbers: extractedData.possibleCardNumbers.length,
      pokemonNames: extractedData.possiblePokemonNames.length,
      modifiers: extractedData.modifiers.length
    });

    return extractedData;
  }

  /**
   * Extract all possible card numbers from text using multiple patterns
   */
  extractAllCardNumbers(cleanText) {
    const cardNumbers = new Set();
    const skipWords = ['JAPANESE', 'EX', 'STAR', 'HOLO', 'MINT', 'PSA', 'BGS', 'NM', 'MT', 'MOON', 'BSP'];

    // Pattern 1: # followed by alphanumeric (# 014, #SM226, # BSP066)
    const pattern1Matches = cleanText.match(/#\s*([A-Z0-9]{1,10})(?=\s|$)/g);
    if (pattern1Matches) {
      pattern1Matches.forEach(match => {
        const num = match.replace(/#\s*/, '');
        if (num.length >= 1 && num.length <= 10 && !skipWords.includes(num)) {
          cardNumbers.add(num);
        }
      });
    }

    // Pattern 2: alphanumeric before # (024 #, BSP066 #) - skip JAPANESE
    const pattern2Matches = cleanText.match(/\s([A-Z0-9]{1,10})\s+#/g);
    if (pattern2Matches) {
      pattern2Matches.forEach(match => {
        const num = match.replace(/\s+#/, '').trim();
        if (num.length >= 1 && num.length <= 10 && !skipWords.includes(num)) {
          cardNumbers.add(num);
        }
      });
    }

    // Pattern 3: isolated numbers that could be card numbers (2-4 digits)
    const pattern3Matches = cleanText.match(/\b(\d{2,4})\b/g);
    if (pattern3Matches) {
      pattern3Matches.forEach(match => {
        const num = match.trim();
        // Skip years
        if (!num.match(/^(19|20)\d{2}$/)) {
          cardNumbers.add(num.padStart(3, '0')); // Normalize to 3 digits
        }
      });
    }

    // Pattern 4: alphanumeric codes (SM226, BSP066, etc.)
    const pattern4Matches = cleanText.match(/\b([A-Z]{1,3}\d{1,4}[A-Z]?)\b/g);
    if (pattern4Matches) {
      pattern4Matches.forEach(match => {
        const code = match.trim();
        // Skip common words
        if (code.length >= 3 && !skipWords.includes(code)) {
          cardNumbers.add(code);
        }
      });
    }

    return Array.from(cardNumbers);
  }

  /**
   * Extract all possible Pokemon names from text
   */
  extractAllPokemonNames(cleanText) {
    const pokemonNames = new Set();

    // Handle special cases first
    if (cleanText.includes('MR . MIME') || cleanText.includes('MR. MIME')) {
      pokemonNames.add('MR MIME');
    }

    // Skip garbage words that are never Pokemon names
    const skipWords = ['POKEMON', 'JAPANESE', 'MINT', 'HOLO', 'CARD', 'DECK', 'KIT',
                       'SILVER', 'GOLDEN', 'SKY', 'OCEAN', 'LEGENDS', 'MASTER', 'SIDE',
                       'EDITION', 'FIRST', '1ST', 'ED', 'GEM', 'MT', 'NM', 'PSA', 'BGS',
                       'JPN', 'P', 'M', 'PM', 'SUN', 'MOON', 'SWSH', 'BSP', 'BLACK', 'STAR',
                       'EX', 'GX', 'V', 'VMAX', 'VSTAR', 'TAG', 'TEAM', 'DARK', 'LIGHT', 'SHINING',
                       'PACK', 'EXPANSION', 'PROMO', 'HOLON', 'PHANTOMS', 'DRAGON', 'FRONTIERS',
                       'MIRAGE', 'FOREST', 'FLIGHT', 'PRERELEASE', 'STRENGTH', 'ABLAZE'];

    const words = cleanText.split(/\s+/);

    // Look for potential Pokemon names after the card number
    let foundCardNumber = false;
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const cleanWord = word.replace(/[^A-Z]/g, '');

      // Mark when we see # or card number pattern
      if (word.includes('#') || (cleanWord.match(/^\d{2,4}$/) && i < 8)) {
        foundCardNumber = true;
        continue;
      }

      // After card number, look for potential Pokemon names
      if (foundCardNumber && cleanWord.length >= 4 &&
          !skipWords.includes(cleanWord) &&
          !cleanWord.match(/^[0-9]+$/) &&
          !cleanWord.match(/^(19|20)\d{2}$/) &&
          !cleanWord.match(/^[A-Z]{0,3}\d+[A-Z]{0,3}$/)) {

        // Add any word that passes filters - let the matching decide if it's valid
        pokemonNames.add(cleanWord);

        // Only take the first 2-3 potential names to avoid garbage
        if (pokemonNames.size >= 3) break;
      }
    }

    return Array.from(pokemonNames);
  }

  /**
   * Extract modifiers from text
   */
  extractModifiers(cleanText) {
    const modifiers = ['DARK', 'LIGHT', 'SHINING', 'CRYSTAL', 'DELTA', 'STAR', 'PRIME',
                      'EX', 'GX', 'V', 'VMAX', 'VSTAR', 'TAG TEAM', 'BREAK',
                      'HOLO', 'REVERSE FOIL', 'SECRET', 'RAINBOW', 'GOLD', 'HYPER'];

    const extractedModifiers = [];
    for (const modifier of modifiers) {
      if (cleanText.includes(modifier)) {
        extractedModifiers.push(modifier);
      }
    }
    return extractedModifiers;
  }

  /**
   * PHASE 2: Search database by card numbers only
   */
  async searchByCardNumbers(cardNumbers) {
    const allCandidates = [];
    const Card = (await import('@/pokemon/cards/Card.js')).default;

    for (const cardNumber of cardNumbers) {
      try {
        const cards = await Card.find(
          { cardNumber: cardNumber },
          'cardName cardNumber variety setId uniqueSetId uniquePokemonId'
        )
        .populate('setId', 'setName year uniqueSetId')
        .limit(100)
        .lean();

        if (cards.length > 0) {
          allCandidates.push(...cards);
        }
      } catch (error) {
        Logger.operationError('PSA_CARD_NUMBER_SEARCH', 'Card number search failed', error, { cardNumber });
      }
    }

    // Remove duplicates by card ID
    const uniqueCandidates = [];
    const seenIds = new Set();
    for (const card of allCandidates) {
      if (!seenIds.has(card._id.toString())) {
        seenIds.add(card._id.toString());
        uniqueCandidates.push(card);
      }
    }

    return uniqueCandidates;
  }

  /**
   * PHASE 3: Filter card candidates by Pokemon names
   */
  filterByPokemonNames(cardCandidates, pokemonNames) {
    if (pokemonNames.length === 0) {
      // If no Pokemon names found, return all candidates
      return cardCandidates;
    }

    const filteredCandidates = [];

    for (const card of cardCandidates) {
      const cardName = card.cardName?.toUpperCase() || '';

      // Check if any extracted Pokemon name matches the card name
      for (const pokemonName of pokemonNames) {
        if (cardName.includes(pokemonName) || pokemonName.includes(cardName.split(' ')[0])) {
          filteredCandidates.push({
            ...card,
            matchedPokemonName: pokemonName
          });
          break;
        }
      }
    }

    // If Pokemon name filtering eliminates all results, fall back to all candidates
    return filteredCandidates.length > 0 ? filteredCandidates : cardCandidates;
  }

  /**
   * STEP 3: Enrich candidates with set details (if not populated)
   */
  async enrichWithSetDetails(candidates) {
    return candidates.map(card => ({
      card,
      setDetails: card.setId || null,
      uniqueSetId: card.uniqueSetId
    }));
  }

  /**
   * STEP 4: Verify set names against full OCR text
   */
  verifySetNames(candidates, ocrText) {
    const upperOcrText = ocrText.toUpperCase();

    return candidates.map(candidate => {
      const setName = candidate.setDetails?.setName || '';
      const setNameUpper = setName.toUpperCase();

      let setConfidence = 0;
      let matchedPortion = '';

      // Check for exact set name match
      if (setNameUpper && upperOcrText.includes(setNameUpper)) {
        setConfidence = 0.9;
        matchedPortion = setName;
      } else {
        // Check for partial matches (key words) - skip "POKEMON" since all sets have it
        const setWords = setNameUpper.split(' ').filter(word =>
          word.length > 3 &&
          word !== 'POKEMON' &&
          word !== 'JAPANESE' &&
          word !== 'SWORD' &&
          word !== 'SHIELD'
        );
        let matchedWords = 0;

        for (const word of setWords) {
          if (upperOcrText.includes(word)) {
            matchedWords++;
            matchedPortion += word + ' ';
          }
        }

        if (matchedWords > 0 && setWords.length > 0) {
          setConfidence = (matchedWords / setWords.length) * 0.7; // Partial match
        }
      }

      return {
        ...candidate,
        setVerification: {
          confidence: setConfidence,
          matchedPortion: matchedPortion.trim(),
          fullSetName: setName
        }
      };
    }).filter(candidate => candidate.setVerification.confidence > 0.1); // Only keep candidates with some set match
  }

  /**
   * PHASE 5: Score matches based on multiple factors
   */
  scoreMatches(candidates, extractedData, ocrText) {
    return candidates.map(candidate => {
      const card = candidate.card;
      const setVerification = candidate.setVerification;
      const matchedPokemonName = candidate.matchedPokemonName;

      // Score components
      const scores = {
        yearMatch: this.scoreYearMatch(card, extractedData.year),
        pokemonMatch: this.scorePokemonMatch(card.cardName, matchedPokemonName || extractedData.possiblePokemonNames[0]),
        cardNumberMatch: extractedData.possibleCardNumbers.includes(card.cardNumber) ? 1.0 : 0.8,
        modifierMatch: this.scoreModifierMatch(card.cardName, extractedData.modifiers),
        setVerification: setVerification.confidence
      };

      // Weighted total score
      const weights = {
        yearMatch: 0.15,
        pokemonMatch: 0.25,
        cardNumberMatch: 0.25,
        modifierMatch: 0.15,
        setVerification: 0.20
      };

      const totalScore = Object.entries(weights).reduce((total, [key, weight]) => {
        return total + (scores[key] * weight);
      }, 0);

      return {
        card,
        setDetails: candidate.setDetails,
        setVerification,
        scores,
        totalScore,
        confidence: Math.min(totalScore, 1.0),
        matchedPokemonName
      };
    }).sort((a, b) => b.totalScore - a.totalScore); // Sort by best score first
  }

  /**
   * Score year match between card and PSA
   */
  scoreYearMatch(card, psaYear) {
    const cardYear = card.setId?.year;
    if (!cardYear || !psaYear) return 0.5; // Unknown, neutral score
    return cardYear === psaYear ? 1.0 : 0.0;
  }

  /**
   * Score Pokemon name match
   */
  scorePokemonMatch(cardName, basePokemon) {
    if (!cardName || !basePokemon) return 0.0;

    const cardNameUpper = cardName.toUpperCase();
    const basePokemonUpper = basePokemon.toUpperCase();

    if (cardNameUpper.includes(basePokemonUpper)) {
      return 1.0; // Perfect match
    }

    // Check for partial matches (handle compound names)
    const baseWords = basePokemonUpper.split(' ');
    let matchedWords = 0;

    for (const word of baseWords) {
      if (cardNameUpper.includes(word)) {
        matchedWords++;
      }
    }

    return baseWords.length > 0 ? matchedWords / baseWords.length : 0.0;
  }

  /**
   * Score modifier match between card name and PSA modifiers
   */
  scoreModifierMatch(cardName, psaModifiers) {
    if (!psaModifiers || psaModifiers.length === 0) return 0.5; // No modifiers to match

    const cardNameUpper = cardName.toUpperCase();
    let matchedModifiers = 0;

    for (const modifier of psaModifiers) {
      if (cardNameUpper.includes(modifier)) {
        matchedModifiers++;
      }
    }

    return psaModifiers.length > 0 ? matchedModifiers / psaModifiers.length : 0.5;
  }

  /**
   * Create empty result for failed parsing
   */
  createEmptyResult(reason, components = {}) {
    return {
      success: false,
      reason,
      components,
      matches: [],
      bestMatch: null,
      confidence: 0.0,
      metadata: {
        totalCandidates: 0,
        setVerified: 0,
        processingTime: Date.now()
      }
    };
  }

  /**
   * Create success result with matches
   */
  createSuccessResult(matches, extractedData, ocrText) {
    return {
      success: true,
      extractedData,
      matches,
      bestMatch: matches[0] || null,
      confidence: matches[0]?.confidence || 0.0,
      metadata: {
        totalMatches: matches.length,
        cardNumbersFound: extractedData.possibleCardNumbers.length,
        pokemonNamesFound: extractedData.possiblePokemonNames.length,
        ocrText,
        processingTime: Date.now()
      }
    };
  }
}

export default HierarchicalPsaParser;
