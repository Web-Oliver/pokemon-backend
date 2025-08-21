/**
 * PSA Text Parser
 *
 * Consolidated parsing logic from all PSA matching services
 * Single Responsibility: Parse PSA label text into structured data
 */

class PsaTextParser {
  /**
   * Parse PSA label text into structured fields
   * @param {string} psaText - Raw PSA label text
   * @param {Object} matchingData - Reference data for validation
   * @returns {Object} Parsed PSA fields
   */
  parse(psaText, matchingData = {}) {
    if (!psaText || typeof psaText !== 'string') {
      return this._getEmptyResult();
    }

    const text = psaText.toUpperCase().replace(/\s+/g, ' ').trim();

    const parsed = {
      originalText: psaText,
      normalizedText: text,
      setName: this._extractSetName(text, matchingData),
      pokemonName: this._extractPokemonName(text, matchingData),
      cardNumber: this._extractCardNumber(text),
      year: this._extractYear(text),
      grade: this._extractGrade(text),
      rarity: this._extractRarity(text),
      language: this._detectLanguage(text),
      isHolo: this._detectHolo(text),
      isFirstEdition: this._detectFirstEdition(text)
    };

    // Calculate confidence based on extracted fields
    parsed.confidence = this._calculateParsingConfidence(parsed);

    return parsed;
  }

  /**
   * Extract set name from PSA text
   */
  _extractSetName(text, matchingData) {
    const setNames = matchingData.uniqueSetNames || [];

    // Try exact matches first
    for (const setName of setNames) {
      const normalizedSetName = setName.toUpperCase();

      if (text.includes(normalizedSetName)) {
        return setName;
      }
    }

    // Try partial matches for common abbreviations
    const abbreviations = {
      'BASE SET': ['BASE', 'BS'],
      'JUNGLE': ['JUNGLE', 'JUN'],
      'FOSSIL': ['FOSSIL', 'FOS'],
      'TEAM ROCKET': ['TEAM ROCKET', 'TR'],
      'GYM HEROES': ['GYM HEROES', 'GH'],
      'GYM CHALLENGE': ['GYM CHALLENGE', 'GC'],
      'NEO GENESIS': ['NEO GENESIS', 'NG'],
      'NEO DISCOVERY': ['NEO DISCOVERY', 'ND'],
      'NEO DESTINY': ['NEO DESTINY', 'DEST']
    };

    for (const [fullName, abbrevs] of Object.entries(abbreviations)) {
      for (const abbrev of abbrevs) {
        if (text.includes(abbrev)) {
          return fullName;
        }
      }
    }

    // Extract potential set name using patterns
    const setPatterns = [
      /\b([A-Z][A-Z\s]{3,20})\s+(\d{4}|\d{1,3}\/\d{1,3})/,
      /\b(BASE SET|JUNGLE|FOSSIL|NEO \w+|TEAM ROCKET)\b/,
      /\b([A-Z\s]{4,15})\s+POKEMON\b/
    ];

    for (const pattern of setPatterns) {
      const match = text.match(pattern);

      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract Pokemon name from PSA text
   */
  _extractPokemonName(text, matchingData) {
    const pokemonNames = matchingData.uniquePokemonNames || [];

    // Try exact matches first
    for (const pokemon of pokemonNames) {
      const normalizedPokemon = pokemon.toUpperCase();

      if (text.includes(normalizedPokemon)) {
        return pokemon;
      }
    }

    // Common Pokemon name patterns
    const pokemonPatterns = [
      /\b(PIKACHU|CHARIZARD|BLASTOISE|VENUSAUR|MEW|MEWTWO)\b/,
      /\b([A-Z][A-Z]+)\s+(\d+\/\d+|\d+)\b/,
      /POKEMON\s+([A-Z][A-Z\s]{3,15})/
    ];

    for (const pattern of pokemonPatterns) {
      const match = text.match(pattern);

      if (match) {
        const name = match[1].trim();

        if (name.length >= 3) {
          return name;
        }
      }
    }

    return null;
  }

  /**
   * Extract card number from PSA text
   */
  _extractCardNumber(text) {
    const numberPatterns = [
      /\b(\d{1,3})\/(\d{1,3})\b/, // Standard format: 25/102
      /\b#(\d{1,3})\b/, // Hash format: #25
      /\bNO\.?\s*(\d{1,3})\b/, // No. format
      /\b(\d{1,3})\s*\/\s*(\d{1,3})\b/ // Spaced format
    ];

    for (const pattern of numberPatterns) {
      const match = text.match(pattern);

      if (match) {
        if (match[2]) {
          // Full format with total
          return `${match[1]}/${match[2]}`;
        }
          // Just card number
          return match[1];

      }
    }

    // Try to find isolated numbers that might be card numbers
    const isolatedNumbers = text.match(/\b(\d{1,3})\b/g);

    if (isolatedNumbers) {
      // Return the first reasonable number (not year, not grade)
      for (const num of isolatedNumbers) {
        const numVal = parseInt(num);

        if (numVal >= 1 && numVal <= 500 && numVal !== this._extractYear(text) && numVal !== this._extractGrade(text)) {
          return num;
        }
      }
    }

    return null;
  }

  /**
   * Extract year from PSA text
   */
  _extractYear(text) {
    const yearPatterns = [
      /\b(19\d{2}|20\d{2})\b/, // 4-digit year
      /\b(9[8-9]|0[0-9]|1[0-9]|2[0-5])\b/ // 2-digit year (98-25)
    ];

    for (const pattern of yearPatterns) {
      const match = text.match(pattern);

      if (match) {
        let year = parseInt(match[1]);

        // Convert 2-digit years to 4-digit
        if (year < 100) {
          if (year >= 98) {
            year += 1900;
          } else if (year <= 25) {
            year += 2000;
          }
        }

        // Validate year range for Pokemon cards
        if (year >= 1998 && year <= 2025) {
          return year;
        }
      }
    }

    return null;
  }

  /**
   * Extract PSA grade from text
   */
  _extractGrade(text) {
    const gradePatterns = [
      /\bGRADE\s*(\d+(?:\.\d)?)\b/,
      /\bPSA\s*(\d+(?:\.\d)?)\b/,
      /\b(\d+(?:\.\d)?)\s*GRADE\b/,
      /\b(10|9\.5|9|8\.5|8|7\.5|7|6\.5|6|5\.5|5|4\.5|4|3\.5|3|2\.5|2|1\.5|1)\b/
    ];

    for (const pattern of gradePatterns) {
      const match = text.match(pattern);

      if (match) {
        const grade = parseFloat(match[1]);

        if (grade >= 1 && grade <= 10) {
          return grade;
        }
      }
    }

    return null;
  }

  /**
   * Extract rarity from text
   */
  _extractRarity(text) {
    const rarityPatterns = [
      /\b(COMMON|UNCOMMON|RARE|HOLO|RARE HOLO|PROMO|SECRET RARE)\b/,
      /\b(SHADOWLESS|1ST EDITION|UNLIMITED)\b/
    ];

    for (const pattern of rarityPatterns) {
      const match = text.match(pattern);

      if (match) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Detect language from text patterns
   */
  _detectLanguage(text) {
    if ((/\b(JAPANESE|JP|日本)\b/).test(text)) {
      return 'Japanese';
    }

    if ((/\b(ENGLISH|EN|ENG)\b/).test(text)) {
      return 'English';
    }

    // Default to English for standard patterns
    return 'English';
  }

  /**
   * Detect if card is holographic
   */
  _detectHolo(text) {
    return (/\b(HOLO|HOLOGRAPHIC|HOLOFOIL)\b/).test(text);
  }

  /**
   * Detect if card is first edition
   */
  _detectFirstEdition(text) {
    return (/\b(1ST EDITION|FIRST EDITION)\b/).test(text);
  }

  /**
   * Calculate parsing confidence based on extracted fields
   */
  _calculateParsingConfidence(parsed) {
    let confidence = 0;
    let maxPoints = 0;

    // Award points for successfully parsed fields
    const fieldWeights = {
      setName: 0.25,
      pokemonName: 0.20,
      cardNumber: 0.15,
      year: 0.15,
      grade: 0.10,
      rarity: 0.10,
      language: 0.05
    };

    Object.entries(fieldWeights).forEach(([field, weight]) => {
      maxPoints += weight;
      if (parsed[field]) {
        confidence += weight;
      }
    });

    return Math.round((confidence / maxPoints) * 100) / 100;
  }

  /**
   * Return empty parsing result
   */
  _getEmptyResult() {
    return {
      originalText: '',
      normalizedText: '',
      setName: null,
      pokemonName: null,
      cardNumber: null,
      year: null,
      grade: null,
      rarity: null,
      language: null,
      isHolo: false,
      isFirstEdition: false,
      confidence: 0
    };
  }
}

export default PsaTextParser;
