/**
 * OCR Text Parser Service
 * 
 * SINGLE RESPONSIBILITY: Parse OCR text into structured data
 * NO OTHER RESPONSIBILITIES: extraction, matching, scoring
 */

/**
 * Regex-based OCR Text Parser
 * 
 * Uses regular expressions to extract structured data from OCR text
 */
export class RegexOcrTextParser {
  
  /**
   * Parse card information from OCR text
   */
  parseCardInfo(ocrText) {
    const text = ocrText.trim().toUpperCase();
    
    const result = {
      originalText: ocrText,
      confidence: 0
    };

    // Extract Pokemon name (usually at the beginning)
    const nameMatch = text.match(/(?:POKEMON\s+)?(?:JAPANESE\s+)?(?:#\s*\d+\s+)?([A-Z\s]+?)(?:\s+EX|\s+GX|\s+-|\s+\d)/);
    if (nameMatch) {
      result.pokemonName = this.cleanPokemonName(nameMatch[1]);
      result.confidence += 0.3;
    }

    // Extract card number (various formats)
    const cardNumberPatterns = [
      /#\s*(\d+)/,                    // # 025
      /(\d+)\s*\/\s*\d+/,             // 25/102
      /NO\.\s*(\d+)/,                 // NO. 025
      /NUMBER\s*(\d+)/                // NUMBER 025
    ];

    for (const pattern of cardNumberPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.cardNumber = match[1].padStart(3, '0'); // Normalize to 3 digits
        result.confidence += 0.2;
        break;
      }
    }

    // Extract set name (look for known set patterns)
    const setPatterns = [
      /(?:BASE|JUNGLE|FOSSIL|ROCKET|GYM|NEO|E-CARD|EXPEDITION|AQUAPOLIS|SKYRIDGE)/,
      /(?:RUBY|SAPPHIRE|EMERALD|DIAMOND|PEARL|PLATINUM)/,
      /(?:BLACK|WHITE|X|Y|SUN|MOON|SWORD|SHIELD)/,
      /(?:RULERS|HEAVENS|RESRCH|TWR|LGHTNG)/,
      /(?:HOLON|DELTA|STAR|PRIME|LEVEL|BREAK)/
    ];

    for (const pattern of setPatterns) {
      const match = text.match(pattern);
      if (match) {
        result.setName = this.normalizeSetName(match[0]);
        result.confidence += 0.2;
        break;
      }
    }

    // Extract year (4-digit number, typically 1998-2024)
    const yearMatch = text.match(/(19\d{2}|20[0-2]\d)/);
    if (yearMatch) {
      result.year = parseInt(yearMatch[1]);
      result.confidence += 0.1;
    }

    // Calculate final confidence
    result.confidence = Math.min(result.confidence, 1.0);

    return result;
  }

  /**
   * Parse PSA information from OCR text
   */
  parsePsaInfo(ocrText) {
    const text = ocrText.trim().toUpperCase();
    
    const result = this.parseCardInfo(ocrText); // Start with card info

    // Extract PSA grade (typically at the end)
    const gradeMatch = text.match(/\b(\d{1,2})\s*(?:PSA|GRADE)?\s*$/);
    if (gradeMatch) {
      result.grade = gradeMatch[1];
      result.confidence += 0.1;
    }

    // Extract certification number (long number at the end)
    const certMatch = text.match(/(\d{8,12})$/);
    if (certMatch) {
      result.certificationNumber = certMatch[1];
      result.confidence += 0.2;
    }

    return result;
  }

  /**
   * Validate parsed data quality
   */
  validateParsedData(data) {
    if (!data) return false;
    
    // Must have at least pokemon name or card number
    if (!data.pokemonName && !data.cardNumber) return false;
    
    // Confidence must be reasonable
    if (data.confidence < 0.1) return false;
    
    // Year validation if present
    if (data.year && (data.year < 1998 || data.year > new Date().getFullYear())) {
      return false;
    }
    
    // Grade validation if present
    if (data.grade && (parseInt(data.grade) < 1 || parseInt(data.grade) > 10)) {
      return false;
    }

    return true;
  }

  /**
   * Clean and normalize Pokemon name
   */
  cleanPokemonName(name) {
    return name
      .trim()
      .replace(/\s+/g, ' ')                    // Normalize spaces
      .replace(/[^\w\s]/g, '')                 // Remove special chars
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Normalize set name to standard format
   */
  normalizeSetName(setName) {
    const setMappings = {
      'RULERS': 'Rulers of the Heavens',
      'HEAVENS': 'Rulers of the Heavens',
      'RESRCH': 'Research Tower',
      'TWR': 'Research Tower',
      'LGHTNG': 'Lightning',
      'HOLON': 'Holon Phantoms'
    };

    return setMappings[setName] || setName;
  }
}

/**
 * OCR Text Parser Factory
 */
export class OcrTextParserFactory {
  static create() {
    console.log('📝 Using Regex OCR Text Parser');
    return new RegexOcrTextParser();
  }
}