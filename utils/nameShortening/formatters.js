const { RARITY_VARIANTS, SET_NAMES, JAPANESE_SET_PATTERNS } = require('./configurations');

/**
 * Checks if a set is Japanese based on set name
 * @param {string} setName - The set name to check
 * @returns {boolean} - True if the set is Japanese
 */
function isJapaneseSet(setName) {
  if (!setName) {
    return false;
  }

  const lowerSetName = setName.toLowerCase();

  return JAPANESE_SET_PATTERNS.some((pattern) => lowerSetName.includes(pattern));
}

/**
 * Gets shortened variety name for external listings
 * @param {string} variety - The variety/rarity to shorten
 * @returns {string} - Shortened variety name or original if no match
 */
function getShortenedVariety(variety) {
  if (!variety) {
    return '';
  }

  // Case-insensitive matching
  const lowerVariety = variety.toLowerCase();

  // Find exact match first
  if (RARITY_VARIANTS[lowerVariety]) {
    return RARITY_VARIANTS[lowerVariety];
  }

  // Find partial match
  for (const [key, value] of Object.entries(RARITY_VARIANTS)) {
    if (lowerVariety.includes(key)) {
      return value;
    }
  }

  // Return original if no match found
  return variety;
}

/**
 * Gets shortened set name for external listings (prioritizing longest matches)
 * @param {string} setName - The set name to shorten
 * @returns {string} - Shortened set name or original if no match
 */
function getShortenedSetName(setName) {
  if (!setName) {
    return '';
  }

  // Clean the set name by removing common prefixes first
  let cleanedSetName = setName;
  
  // Remove "Pokemon Japanese " prefix (case-insensitive)
  cleanedSetName = cleanedSetName.replace(/^pokemon japanese\s+/i, '');
  
  // Remove "Pokemon " prefix (case-insensitive)  
  cleanedSetName = cleanedSetName.replace(/^pokemon\s+/i, '');

  const lowerSetName = cleanedSetName.toLowerCase();
  let bestMatch = '';
  let bestMatchLength = 0;

  // Find the longest matching key
  for (const [key, value] of Object.entries(SET_NAMES)) {
    const lowerKey = key.toLowerCase();

    if (lowerSetName.includes(lowerKey) && lowerKey.length > bestMatchLength) {
      bestMatch = value;
      bestMatchLength = lowerKey.length;
    }
  }

  // Return best match or cleaned name if no match found
  return bestMatch || cleanedSetName;
}

/**
 * Formats a card name for external listings
 * @param {string} cardName - The card name
 * @param {string} pokemonNumber - The pokemon number
 * @param {string} variety - The variety/rarity
 * @returns {string} - Formatted card name
 */
function formatCardName(cardName, pokemonNumber, variety) {
  let formattedName = cardName || '';
  
  // Replace all dashes with spaces in card name
  formattedName = formattedName.replace(/-/g, ' ');
  
  // Replace "1st Edition" with "1st Ed" in card name
  formattedName = formattedName.replace(/1st Edition/gi, '1st Ed');
  formattedName = formattedName.replace(/1ST EDITION/gi, '1st Ed');
  formattedName = formattedName.replace(/First Edition/gi, '1st Ed');

  if (pokemonNumber && pokemonNumber !== 'N/A') {
    formattedName += ` #${pokemonNumber}`;
  }

  if (variety) {
    const shortenedVariety = getShortenedVariety(variety);

    if (shortenedVariety) {
      // Replace dashes with spaces in variety too
      const cleanedVariety = shortenedVariety.replace(/-/g, ' ');

      formattedName += ` ${cleanedVariety}`;
    }
  }

  return formattedName;
}

/**
 * Formats a sealed product name for external listings
 * @param {string} name - The product name
 * @param {string} setName - The set name
 * @returns {string} - Formatted product name
 */
function formatSealedProductName(name, setName) {
  const shortenedSetName = getShortenedSetName(setName);
  const isJapanese = isJapaneseSet(setName);

  let formattedName = '';

  if (isJapanese) {
    formattedName += 'Japanese ';
  }

  // Use shortened set name if different from original, otherwise use product name
  if (shortenedSetName && shortenedSetName !== setName) {
    formattedName += `${shortenedSetName} ${name}`;
  } else {
    formattedName += name;
  }

  return formattedName;
}

module.exports = {
  isJapaneseSet,
  getShortenedVariety,
  getShortenedSetName,
  formatCardName,
  formatSealedProductName,
};
