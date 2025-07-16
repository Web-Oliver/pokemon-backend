// Configuration data for name shortening utilities

// Rarity variants shortening mappings (case-insensitive matching)
const RARITY_VARIANTS = {
  // Holofoil variations
  holofoil: 'HOLO',
  'holo foil': 'HOLO',
  holo: 'HOLO',
  holographic: 'HOLO',
  hologram: 'HOLO',

  // Reverse holo variations
  'reverse holofoil': 'REVERSE HOLO',
  'reverse holo foil': 'REVERSE HOLO',
  'reverse holo': 'REVERSE HOLO',
  'reverse holographic': 'REVERSE HOLO',
  'reverse hologram': 'REVERSE HOLO',

  // First edition variations
  'first edition': '1ST EDITION',
  '1st edition': '1ST EDITION',
  'first ed': '1ST EDITION',
  '1st ed': '1ST EDITION',

  // Shadowless variations
  shadowless: 'SHADOWLESS',
  'no shadow': 'SHADOWLESS',

  // Unlimited variations
  unlimited: 'UNLIMITED',
  'unlimited edition': 'UNLIMITED',

  // Promo variations
  promotional: 'PROMO',
  promo: 'PROMO',
  promotion: 'PROMO',

  // Japanese specific variations
  japanese: 'JAPANESE',
  jp: 'JAPANESE',
  nippon: 'JAPANESE',

  // Special variations
  'full art': 'FULL ART',
  'secret rare': 'SECRET RARE',
  'ultra rare': 'ULTRA RARE',
  rare: 'RARE',
  common: 'COMMON',
  uncommon: 'UNCOMMON',

  // Mint condition variations
  mint: 'MINT',
  'near mint': 'NM',
  'lightly played': 'LP',
  'moderately played': 'MP',
  'heavily played': 'HP',
  damaged: 'DMG',
};

// Set name shortening mappings (exact matches)
const SET_NAMES = {
  // Base sets
  'Base Set': 'Base',
  'Base Set 2': 'Base 2',
  Jungle: 'Jungle',
  Fossil: 'Fossil',
  'Team Rocket': 'Rocket',

  // Gym sets
  'Gym Heroes': 'Gym H',
  'Gym Challenge': 'Gym C',

  // Neo sets
  'Neo Genesis': 'Neo Gen',
  'Neo Discovery': 'Neo Disc',
  'Neo Revelation': 'Neo Rev',
  'Neo Destiny': 'Neo Dest',

  // E-card series
  'Expedition Base Set': 'Expedition',
  Aquapolis: 'Aquapolis',
  Skyridge: 'Skyridge',

  // EX series
  'Ruby & Sapphire': 'R&S',
  Sandstorm: 'Sandstorm',
  Dragon: 'Dragon',
  'Team Magma vs Team Aqua': 'TMA vs TA',
  'Hidden Legends': 'Hidden L',
  'FireRed & LeafGreen': 'FRLG',
  'Team Rocket Returns': 'TRR',
  Deoxys: 'Deoxys',
  Emerald: 'Emerald',
  'Unseen Forces': 'Unseen F',
  'Delta Species': 'Delta S',
  'Legend Maker': 'Legend M',
  'Holon Phantoms': 'Holon P',
  'Crystal Guardians': 'Crystal G',
  'Dragon Frontiers': 'Dragon F',
  'Power Keepers': 'Power K',

  // Diamond & Pearl series
  'Diamond & Pearl': 'D&P',
  'Mysterious Treasures': 'Mysterious T',
  'Secret Wonders': 'Secret W',
  'Great Encounters': 'Great E',
  'Majestic Dawn': 'Majestic D',
  'Legends Awakened': 'Legends A',
  Stormfront: 'Stormfront',

  // Platinum series
  Platinum: 'Platinum',
  'Rising Rivals': 'Rising R',
  'Supreme Victors': 'Supreme V',
  Arceus: 'Arceus',

  // HeartGold & SoulSilver series
  'HeartGold & SoulSilver': 'HGSS',
  Unleashed: 'Unleashed',
  Undaunted: 'Undaunted',
  Triumphant: 'Triumphant',
};

// Japanese set detection patterns (partial matching, case-insensitive)
const JAPANESE_SET_PATTERNS = ['japanese', 'jp', 'nippon', 'vending', 'gym heroes', 'gym challenge'];

module.exports = {
  RARITY_VARIANTS,
  SET_NAMES,
  JAPANESE_SET_PATTERNS,
};
