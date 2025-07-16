// Main name shortening utilities entry point
const { RARITY_VARIANTS, SET_NAMES, JAPANESE_SET_PATTERNS } = require('./configurations');
const {
  isJapaneseSet,
  getShortenedVariety,
  getShortenedSetName,
  formatCardName,
  formatSealedProductName,
} = require('./formatters');

module.exports = {
  RARITY_VARIANTS,
  SET_NAMES,
  JAPANESE_SET_PATTERNS,
  isJapaneseSet,
  getShortenedVariety,
  getShortenedSetName,
  formatCardName,
  formatSealedProductName,
};
