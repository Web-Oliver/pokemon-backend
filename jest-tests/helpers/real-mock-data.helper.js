const mongoose = require('mongoose');

/**
 * Real Mock Data Helper
 * 
 * Provides realistic mock data that matches our actual database structure
 * and business logic. This ensures tests are representative of real-world scenarios.
 */

// Pokemon Set Mock Data
const createMockSet = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  setName: 'Pokemon Base Set',
  year: 1999,
  setUrl: 'https://www.tcgplayer.com/categories/trading-and-collectible-card-games/pokemon/price-guides/pokemon-base-set',
  totalCardsInSet: 102,
  totalPsaPopulation: 2500000,
  ...overrides
});

// Pokemon Card Mock Data
const createMockCard = (setId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  setId: setId || new mongoose.Types.ObjectId(),
  pokemonNumber: '25',
  cardName: 'Pikachu',
  baseName: 'Pikachu',
  variety: 'Red Cheeks',
  psaGrades: {
    psa_1: 150,
    psa_2: 800,
    psa_3: 1200,
    psa_4: 2500,
    psa_5: 3800,
    psa_6: 5200,
    psa_7: 8500,
    psa_8: 12000,
    psa_9: 15600,
    psa_10: 8200
  },
  psaTotalGradedForCard: 58050,
  ...overrides
});

// PSA Graded Card Mock Data
const createMockPsaGradedCard = (cardId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  cardId: cardId || new mongoose.Types.ObjectId(),
  grade: 'PSA 9',
  images: [
    'image-1752151241475-235568771.jpg',
    'image-1752151720087-159491721.jpg'
  ],
  myPrice: mongoose.Types.Decimal128.fromString('2500.00'),
  priceHistory: [
    {
      price: mongoose.Types.Decimal128.fromString('2000.00'),
      dateUpdated: new Date('2024-01-15')
    },
    {
      price: mongoose.Types.Decimal128.fromString('2500.00'),
      dateUpdated: new Date('2024-03-20')
    }
  ],
  dateAdded: new Date('2024-01-10'),
  sold: false,
  saleDetails: {
    paymentMethod: null,
    actualSoldPrice: null,
    deliveryMethod: null,
    source: null,
    dateSold: null,
    buyerFullName: null,
    buyerAddress: {
      streetName: null,
      postnr: null,
      city: null
    },
    buyerPhoneNumber: null,
    buyerEmail: null,
    trackingNumber: null
  },
  ...overrides
});

// Raw Card Mock Data
const createMockRawCard = (cardId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  cardId: cardId || new mongoose.Types.ObjectId(),
  condition: 'Near Mint',
  images: [
    'image-1752514439899-175529652.jpg'
  ],
  myPrice: mongoose.Types.Decimal128.fromString('150.00'),
  priceHistory: [
    {
      price: mongoose.Types.Decimal128.fromString('150.00'),
      dateUpdated: new Date('2024-02-01')
    }
  ],
  dateAdded: new Date('2024-02-01'),
  sold: false,
  saleDetails: {
    paymentMethod: null,
    actualSoldPrice: null,
    deliveryMethod: null,
    source: null,
    dateSold: null,
    buyerFullName: null,
    buyerAddress: {
      streetName: null,
      postnr: null,
      city: null
    },
    buyerPhoneNumber: null,
    buyerEmail: null,
    trackingNumber: null
  },
  ...overrides
});

// CardMarket Reference Product Mock Data
const createMockCardMarketProduct = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: 'Pokemon Base Set Booster Box',
  setName: 'Pokemon Base Set',
  available: 15,
  price: mongoose.Types.Decimal128.fromString('12500.00'),
  category: 'Booster-Boxes',
  url: 'https://www.cardmarket.com/en/Pokemon/Products/Booster-Boxes/Base-Set-Booster-Box',
  lastUpdated: new Date('2024-03-15'),
  ...overrides
});

// Sealed Product Mock Data
const createMockSealedProduct = (productId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  productId: productId || new mongoose.Types.ObjectId(),
  category: 'Booster-Boxes',
  setName: 'Pokemon Base Set',
  name: 'Pokemon Base Set Booster Box',
  availability: 15,
  cardMarketPrice: mongoose.Types.Decimal128.fromString('12500.00'),
  myPrice: mongoose.Types.Decimal128.fromString('15000.00'),
  priceHistory: [
    {
      price: mongoose.Types.Decimal128.fromString('12000.00'),
      dateUpdated: new Date('2024-01-01')
    },
    {
      price: mongoose.Types.Decimal128.fromString('15000.00'),
      dateUpdated: new Date('2024-03-01')
    }
  ],
  images: [
    'image-1752635674694-827982559.jpg',
    'image-1752635674708-314306084.jpg'
  ],
  dateAdded: new Date('2024-01-01'),
  sold: false,
  saleDetails: {
    paymentMethod: null,
    actualSoldPrice: null,
    deliveryMethod: null,
    source: null,
    dateSold: null,
    buyerFullName: null,
    buyerAddress: {
      streetName: null,
      postnr: null,
      city: null
    },
    buyerPhoneNumber: null,
    buyerEmail: null,
    trackingNumber: null
  },
  ...overrides
});

// Sold Item Mock Data - for testing sales functionality
const createMockSoldPsaCard = (cardId, overrides = {}) => ({
  ...createMockPsaGradedCard(cardId),
  sold: true,
  saleDetails: {
    paymentMethod: 'CASH',
    actualSoldPrice: mongoose.Types.Decimal128.fromString('2400.00'),
    deliveryMethod: 'Local Meetup',
    source: 'Facebook',
    dateSold: new Date('2024-03-25'),
    buyerFullName: 'John Doe',
    buyerAddress: {
      streetName: 'Main Street 123',
      postnr: '2100',
      city: 'Copenhagen'
    },
    buyerPhoneNumber: '+45 12 34 56 78',
    buyerEmail: 'john.doe@example.com',
    trackingNumber: null
  },
  ...overrides
});

// Auction Mock Data
const createMockAuction = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  topText: 'Pokemon Card Auction - High Grade Cards',
  bottomText: 'All cards are authentic and in excellent condition. Payment via MobilePay or cash.',
  auctionDate: new Date('2024-04-01'),
  status: 'draft',
  generatedFacebookPost: null,
  isActive: false,
  items: [
    {
      itemId: new mongoose.Types.ObjectId(),
      itemCategory: 'psa',
      reservePrice: mongoose.Types.Decimal128.fromString('2000.00'),
      currentBid: mongoose.Types.Decimal128.fromString('0.00'),
      bidCount: 0
    },
    {
      itemId: new mongoose.Types.ObjectId(),
      itemCategory: 'sealed',
      reservePrice: mongoose.Types.Decimal128.fromString('14000.00'),
      currentBid: mongoose.Types.Decimal128.fromString('0.00'),
      bidCount: 0
    }
  ],
  totalValue: mongoose.Types.Decimal128.fromString('16000.00'),
  soldValue: mongoose.Types.Decimal128.fromString('0.00'),
  ...overrides
});

// Collection Statistics Mock Data
const createMockCollectionStats = (overrides = {}) => ({
  totalItems: 125,
  totalValue: mongoose.Types.Decimal128.fromString('285000.00'),
  soldItems: 15,
  soldValue: mongoose.Types.Decimal128.fromString('42500.00'),
  averageValue: mongoose.Types.Decimal128.fromString('2280.00'),
  topValueItem: {
    _id: new mongoose.Types.ObjectId(),
    name: 'Charizard Base Set Holo PSA 10',
    value: mongoose.Types.Decimal128.fromString('25000.00')
  },
  categoryBreakdown: {
    psa: {
      count: 45,
      value: mongoose.Types.Decimal128.fromString('180000.00')
    },
    raw: {
      count: 35,
      value: mongoose.Types.Decimal128.fromString('25000.00')
    },
    sealed: {
      count: 45,
      value: mongoose.Types.Decimal128.fromString('80000.00')
    }
  },
  ...overrides
});

// Search Results Mock Data
const createMockSearchResults = (overrides = {}) => ({
  results: [
    {
      type: 'card',
      _id: new mongoose.Types.ObjectId(),
      setName: 'Pokemon Base Set',
      cardName: 'Pikachu',
      pokemonNumber: '25',
      variety: 'Red Cheeks',
      score: 0.95
    },
    {
      type: 'product',
      _id: new mongoose.Types.ObjectId(),
      name: 'Pokemon Base Set Booster Box',
      category: 'Booster-Boxes',
      setName: 'Pokemon Base Set',
      score: 0.88
    }
  ],
  totalResults: 2,
  searchTerm: 'pikachu',
  searchTypes: ['card', 'product'],
  executionTime: 15,
  ...overrides
});

// Test User Mock Data (for future authentication testing)
const createMockUser = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  username: 'pokemonmaster',
  email: 'pokemon@example.com',
  role: 'collector',
  createdAt: new Date('2024-01-01'),
  lastActive: new Date('2024-03-25'),
  preferences: {
    theme: 'dark',
    currency: 'DKK',
    notifications: true
  },
  ...overrides
});

// Validation Test Data - for testing validation failures
const invalidTestData = {
  invalidCard: {
    // Missing required fields
    pokemonNumber: '25',
    cardName: '', // Empty required field
    baseName: 'Pikachu'
    // Missing setId
  },
  invalidPsaCard: {
    // Missing required fields
    grade: 'PSA 11', // Invalid grade
    myPrice: mongoose.Types.Decimal128.fromString('-100.00'), // Negative price
    images: 'not-an-array' // Should be array
  },
  invalidSaleDetails: {
    paymentMethod: 'INVALID_METHOD', // Not in enum
    actualSoldPrice: mongoose.Types.Decimal128.fromString('-50.00'), // Negative price
    deliveryMethod: 'INVALID_DELIVERY', // Not in enum
    // Missing required fields like source
  }
};

// Activity Mock Data
const createMockActivity = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  itemType: 'psa',
  itemId: new mongoose.Types.ObjectId(),
  action: 'CREATE',
  userId: new mongoose.Types.ObjectId(),
  metadata: {
    itemName: 'Pikachu PSA 9',
    price: mongoose.Types.Decimal128.fromString('2500.00'),
    grade: 'PSA 9'
  },
  timestamp: new Date('2024-03-20'),
  ...overrides
});

module.exports = {
  // Creation helpers
  createMockSet,
  createMockCard,
  createMockPsaGradedCard,
  createMockRawCard,
  createMockCardMarketProduct,
  createMockSealedProduct,
  createMockSoldPsaCard,
  createMockAuction,
  createMockCollectionStats,
  createMockSearchResults,
  createMockUser,
  createMockActivity,
  
  // Test data collections
  invalidTestData,
  
  // Real-world scenarios
  scenarios: {
    // Complete collection item lifecycle
    completePsaCardLifecycle: (setId, cardId) => ({
      set: createMockSet({ _id: setId }),
      card: createMockCard(setId, { _id: cardId }),
      psaCard: createMockPsaGradedCard(cardId),
      soldPsaCard: createMockSoldPsaCard(cardId)
    }),
    
    // Auction with multiple items
    activeAuction: () => {
      const auction = createMockAuction({
        status: 'active',
        isActive: true,
        items: [
          {
            itemId: new mongoose.Types.ObjectId(),
            itemCategory: 'psa',
            reservePrice: mongoose.Types.Decimal128.fromString('2000.00'),
            currentBid: mongoose.Types.Decimal128.fromString('2300.00'),
            bidCount: 5
          }
        ]
      });

      return auction;
    },
    
    // Search scenario with multiple results
    searchScenario: () => ({
      searchTerm: 'charizard',
      results: createMockSearchResults({
        results: [
          {
            type: 'card',
            _id: new mongoose.Types.ObjectId(),
            setName: 'Pokemon Base Set',
            cardName: 'Charizard',
            pokemonNumber: '4',
            variety: 'Holo',
            score: 0.98
          },
          {
            type: 'product',
            _id: new mongoose.Types.ObjectId(),
            name: 'Charizard Theme Deck',
            category: 'Theme-Decks',
            setName: 'Pokemon Base Set',
            score: 0.85
          }
        ],
        searchTerm: 'charizard'
      })
    })
  }
};