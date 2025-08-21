// Re-export all name shortening functionality from the service
export { 
  default,
  formatCardName,
  formatSealedProductName,
  getShortenedSetName,
  quickShortenSetName,
  PokemonNameShortener,
  createPokemonNameShortener,
  isJapaneseSet,
  POKEMON_ABBREVIATIONS,
  SPECIAL_RULES,
  SHORTENER_CONFIG
} from '@/Application/Services/Core/pokemonNameShortener.js';
