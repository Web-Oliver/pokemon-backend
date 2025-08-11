/**
 * Pokemon Name Shortener Service
 * 
 * Provides functionality to shorten Pokemon set names according to standardized abbreviations
 * while preserving original names for database integrity.
 * 
 * Following SOLID principles:
 * - Single Responsibility: Only handles name shortening logic
 * - Open/Closed: Extensible for new abbreviation rules
 * - Dependency Inversion: Uses configuration-based rules
 */

/**
 * Pokemon TCG Set Name Abbreviation Rules
 * Based on common Pokemon TCG conventions and user specifications
 */
const POKEMON_ABBREVIATIONS = {
  // Generation/Series Abbreviations
  'Black White': 'B&W',
  'Black & White': 'B&W',
  'Sun Moon': 'S&M',
  'Sun & Moon': 'S&M',
  'Diamond Pearl': 'D&P',
  'Diamond & Pearl': 'D&P',
  'Heartgold Soulsilver': 'HGSS',
  'HeartGold SoulSilver': 'HGSS',
  'Sword Shield': 'S&S',
  'Sword & Shield': 'S&S',
  'Scarlet Violet': 'S&V',
  'Scarlet & Violet': 'S&V',
  'X Y': 'XY',
  'X & Y': 'XY',
  
  // Promo Abbreviations
  'Black Star Promo': 'Promo',
  'World Championships': 'World',
  'World Championship': 'World',
  'Corocoro Comics': 'Corocoro',
  'CoroCoro Comics': 'Corocoro',
  'Pokemon Center': 'PC',
  'Pokémon Center': 'PC',
  
  // Common Set Types
  'Starter Set': 'Starter',
  'Theme Deck': 'Theme',
  'Elite Trainer Box': 'ETB',
  'Collection Box': 'Collection',
  'Premium Collection': 'Premium',
  'Gift Set': 'Gift',
  'Battle Deck': 'Battle',
  
  // Language Prefixes (keep as-is but standardize)
  'Japanese': 'Japanese',
  'Korean': 'Korean',
  'Chinese': 'Chinese',
  'German': 'German',
  'French': 'French',
  'Italian': 'Italian',
  'Spanish': 'Spanish',
};

/**
 * Special processing rules for specific patterns
 */
const SPECIAL_RULES = {
  // Corocoro special rule
  corocoro: {
    pattern: /Pokemon Japanese Corocoro Comics? Promo \((\d+)\)/i,
    replacement: 'Corocoro $1'
  },
  
  // World championship rule
  world: {
    pattern: /Pokemon Diamond Pearl World (\d+) Promo \((\d+)\)/i,
    replacement: 'D&P Promo $2'
  },
  
  // General promo year extraction
  promoYear: {
    pattern: /(.+) Promo \((\d+)\)$/i,
    replacement: '$1 Promo $2'
  },
};

/**
 * Configuration for name shortening behavior
 */
const SHORTENER_CONFIG = {
  addPokemonKortPrefix: true,
  preserveLanguage: true,
  standardizePromoFormat: true,
  removeRedundantWords: true,
};

class PokemonNameShortener {
  constructor(config = {}) {
    this.config = { ...SHORTENER_CONFIG, ...config };
  }

  /**
   * Main function to shorten a Pokemon set name
   * 
   * @param {string} originalName - The original set name
   * @returns {object} - Object containing original and shortened names
   */
  shortenSetName(originalName) {
    if (!originalName || typeof originalName !== 'string') {
      return {
        originalName: originalName || '',
        shortenedName: originalName || '',
        abbreviationsApplied: [],
      };
    }

    let processedName = originalName.trim();
    const abbreviationsApplied = [];

    // Step 1: Apply special rules first
    processedName = this.applySpecialRules(processedName, abbreviationsApplied);

    // Step 2: Apply standard abbreviations
    processedName = this.applyStandardAbbreviations(processedName, abbreviationsApplied);

    // Step 3: Add Pokémon Kort prefix if configured
    if (this.config.addPokemonKortPrefix && !processedName.startsWith('Pokémon Kort')) {
      processedName = `Pokémon Kort ${processedName}`;
    }

    // Step 4: Clean up the result
    processedName = this.cleanupResult(processedName);

    return {
      originalName,
      shortenedName: processedName,
      abbreviationsApplied,
      charactersReduced: originalName.length - processedName.length,
    };
  }

  /**
   * Apply special processing rules
   * 
   * @param {string} name - Name to process
   * @param {Array} abbreviationsApplied - Array to track applied abbreviations
   * @returns {string} - Processed name
   */
  applySpecialRules(name, abbreviationsApplied) {
    let processedName = name;

    // Corocoro special case
    if (SPECIAL_RULES.corocoro.pattern.test(processedName)) {
      processedName = processedName.replace(SPECIAL_RULES.corocoro.pattern, SPECIAL_RULES.corocoro.replacement);
      abbreviationsApplied.push('Corocoro special rule');
      return processedName;
    }

    // World championship special case
    if (SPECIAL_RULES.world.pattern.test(processedName)) {
      processedName = processedName.replace(SPECIAL_RULES.world.pattern, SPECIAL_RULES.world.replacement);
      abbreviationsApplied.push('World championship rule');
      return processedName;
    }

    // General promo year extraction
    if (SPECIAL_RULES.promoYear.pattern.test(processedName)) {
      processedName = processedName.replace(SPECIAL_RULES.promoYear.pattern, SPECIAL_RULES.promoYear.replacement);
      abbreviationsApplied.push('Promo year extraction');
    }

    return processedName;
  }

  /**
   * Apply standard abbreviation rules
   * 
   * @param {string} name - Name to process
   * @param {Array} abbreviationsApplied - Array to track applied abbreviations
   * @returns {string} - Processed name
   */
  applyStandardAbbreviations(name, abbreviationsApplied) {
    let processedName = name;

    // Remove "Pokemon" prefix but preserve language indicators
    processedName = processedName.replace(/^Pokemon\s+/i, '');

    // Apply abbreviations
    Object.entries(POKEMON_ABBREVIATIONS).forEach(([fullForm, abbreviation]) => {
      const regex = new RegExp(fullForm, 'gi');

      if (regex.test(processedName)) {
        processedName = processedName.replace(regex, abbreviation);
        abbreviationsApplied.push(`${fullForm} → ${abbreviation}`);
      }
    });

    return processedName;
  }

  /**
   * Clean up the final result
   * 
   * @param {string} name - Name to clean up
   * @returns {string} - Cleaned name
   */
  cleanupResult(name) {
    return name
      .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
      .replace(/\s*\(\s*\)/g, '')     // Remove empty parentheses
      .trim();                        // Remove leading/trailing whitespace
  }

  /**
   * Batch process multiple set names
   * 
   * @param {Array} setNames - Array of set names to process
   * @returns {Array} - Array of processed results
   */
  shortenMultipleSetNames(setNames) {
    if (!Array.isArray(setNames)) {
      throw new Error('Input must be an array of set names');
    }

    return setNames.map(name => this.shortenSetName(name));
  }

  /**
   * Get statistics about abbreviations that would be applied
   * 
   * @param {string} name - Name to analyze
   * @returns {object} - Statistics about potential abbreviations
   */
  getAbbreviationStats(name) {
    const result = this.shortenSetName(name);

    return {
      originalLength: result.originalName.length,
      shortenedLength: result.shortenedName.length,
      charactersReduced: result.charactersReduced,
      reductionPercentage: Math.round((result.charactersReduced / result.originalName.length) * 100),
      abbreviationsCount: result.abbreviationsApplied.length,
      abbreviationsApplied: result.abbreviationsApplied,
    };
  }
}

/**
 * Utility function to create a shortener instance
 * 
 * @param {object} config - Configuration options
 * @returns {PokemonNameShortener} - Shortener instance
 */
function createPokemonNameShortener(config = {}) {
  return new PokemonNameShortener(config);
}

/**
 * Quick function to shorten a single name with default settings
 * 
 * @param {string} setName - Set name to shorten
 * @returns {object} - Shortening result
 */
function quickShortenSetName(setName) {
  const shortener = new PokemonNameShortener();

  return shortener.shortenSetName(setName);
}

/**
 * Format card name with proper fallbacks
 * @param {string} cardName - Card name
 * @param {string} cardNumber - Card number
 * @param {string} variety - Card variety
 * @returns {string} - Formatted name
 */
function formatCardName(cardName, cardNumber, variety) {
  if (!cardName || cardName === 'Unknown') {
    return cardNumber ? `#${cardNumber}` : 'Unknown Card';
  }
  
  const baseName = cardName;
  const number = cardNumber ? ` #${cardNumber}` : '';
  const variant = variety && variety !== 'Unknown' && variety !== 'Normal' ? ` ${variety}` : '';
  
  return `${baseName}${number}${variant}`;
}

/**
 * Format sealed product name with proper fallbacks for unknown values
 * @param {string} name - Product name
 * @param {string} setName - Set name
 * @returns {string} - Formatted name
 */
function formatSealedProductName(name, setName) {
  // Handle completely unknown products
  if ((!name || name === 'Unknown') && (!setName || setName === 'Unknown')) {
    return 'Sealed Product';
  }
  
  // Handle unknown set name but known product name
  if (!setName || setName === 'Unknown') {
    return name || 'Sealed Product';
  }
  
  // Handle known set name but unknown product name
  if (!name || name === 'Unknown') {
    const shortener = new PokemonNameShortener();
    const shortened = shortener.shortenSetName(setName);
    return `${shortened.shortenedName} Product`;
  }
  
  // Both are known - use shortened set name
  const shortener = new PokemonNameShortener();
  const shortened = shortener.shortenSetName(setName);
  return `${shortened.shortenedName} ${name}`;
}

/**
 * Get shortened set name using the shortener
 * @param {string} setName - Full set name
 * @returns {string} - Shortened name
 */
function getShortenedSetName(setName) {
  if (!setName || setName === 'Unknown') {
    return 'Unknown Set';
  }
  
  const shortener = new PokemonNameShortener();
  const result = shortener.shortenSetName(setName);
  return result.shortenedName;
}

/**
 * Check if set is Japanese
 * @param {string} setName - Set name
 * @returns {boolean} - True if Japanese set
 */
function isJapaneseSet(setName) {
  if (!setName) return false;
  const lowerName = setName.toLowerCase();
  return lowerName.includes('japanese') || 
         lowerName.includes('japan') || 
         lowerName.includes('jpn');
}

module.exports = {
  PokemonNameShortener,
  createPokemonNameShortener,
  quickShortenSetName,
  formatCardName,
  formatSealedProductName,
  getShortenedSetName,
  isJapaneseSet,
  POKEMON_ABBREVIATIONS,
  SPECIAL_RULES,
  SHORTENER_CONFIG,
};