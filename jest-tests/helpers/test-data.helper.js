const mongoose = require('mongoose');

/**
 * Test data generators for Pokemon collection models
 */

// Set test data
const createTestSet = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  setName: 'Base Set',
  year: 1998,
  setUrl: 'https://example.com/base-set',
  totalCardsInSet: 102,
  totalPsaPopulation: 50000,
  ...overrides
});

// Card test data
const createTestCard = (setId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  setId: setId || new mongoose.Types.ObjectId(),
  pokemonNumber: '25',
  cardName: 'Pikachu',
  baseName: 'Pikachu',
  variety: 'Holo',
  psaGrades: {
    '1': 10,
    '2': 15,
    '3': 25,
    '4': 50,
    '5': 100,
    '6': 200,
    '7': 300,
    '8': 400,
    '9': 500,
    '10': 100
  },
  psaTotalGradedForCard: 1700,
  ...overrides
});

// PSA Graded Card test data
const createTestPsaGradedCard = (cardId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  cardId: cardId || new mongoose.Types.ObjectId(),
  grade: 10,
  images: ['https://example.com/image1.jpg'],
  myPrice: 100.00,
  priceHistory: [
    { price: 90.00, date: new Date('2024-01-01') },
    { price: 100.00, date: new Date('2024-01-15') }
  ],
  dateAdded: new Date(),
  sold: false,
  saleDetails: {
    paymentStatus: null,
    salePrice: null,
    deliveryStatus: null,
    source: null,
    buyerName: null,
    buyerPhone: null,
    buyerAddress: null,
    trackingNumber: null
  },
  ...overrides
});

// Raw Card test data
const createTestRawCard = (cardId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  cardId: cardId || new mongoose.Types.ObjectId(),
  condition: 'Near Mint',
  images: ['https://example.com/image1.jpg'],
  myPrice: 50.00,
  priceHistory: [
    { price: 45.00, date: new Date('2024-01-01') },
    { price: 50.00, date: new Date('2024-01-15') }
  ],
  dateAdded: new Date(),
  sold: false,
  saleDetails: {
    paymentStatus: null,
    salePrice: null,
    deliveryStatus: null,
    source: null,
    buyerName: null,
    buyerPhone: null,
    buyerAddress: null,
    trackingNumber: null
  },
  ...overrides
});

// CardMarket Reference Product test data
const createTestCardMarketRefProduct = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  name: 'Base Set Booster Box',
  setName: 'Base Set',
  available: true,
  price: 5000.00,
  category: 'Sealed Product',
  url: 'https://cardmarket.com/example',
  lastUpdated: new Date(),
  ...overrides
});

// Sealed Product test data
const createTestSealedProduct = (productId, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  productId: productId || new mongoose.Types.ObjectId(),
  category: 'Booster Box',
  setName: 'Base Set',
  name: 'Base Set Booster Box',
  availability: 'in-stock',
  cardMarketPrice: 5000.00,
  myPrice: 4500.00,
  priceHistory: [
    { price: 4200.00, date: new Date('2024-01-01') },
    { price: 4500.00, date: new Date('2024-01-15') }
  ],
  images: ['https://example.com/box1.jpg'],
  dateAdded: new Date(),
  sold: false,
  saleDetails: {
    paymentStatus: null,
    salePrice: null,
    deliveryStatus: null,
    source: null,
    buyerName: null,
    buyerPhone: null,
    buyerAddress: null,
    trackingNumber: null
  },
  ...overrides
});

// Auction test data
const createTestAuction = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  topText: 'Pokemon Collection Auction',
  bottomText: 'Rare cards and sealed products',
  auctionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  status: 'draft',
  generatedFacebookPost: null,
  isActive: false,
  items: [],
  totalValue: 0,
  soldValue: 0,
  ...overrides
});

// Activity test data
const createTestActivity = (overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  action: 'CREATE',
  collection: 'psaGradedCards',
  itemId: new mongoose.Types.ObjectId(),
  itemName: 'Pikachu PSA 10',
  details: {
    grade: 10,
    price: 100.00
  },
  timestamp: new Date(),
  ...overrides
});

// Bulk data creators
const createTestDataSet = async () => {
  const set = createTestSet();
  const card1 = createTestCard(set._id, { cardName: 'Pikachu', pokemonNumber: '25' });
  const card2 = createTestCard(set._id, { cardName: 'Charizard', pokemonNumber: '6' });
  
  const psaCard1 = createTestPsaGradedCard(card1._id, { grade: 10 });
  const psaCard2 = createTestPsaGradedCard(card2._id, { grade: 9 });
  
  const rawCard1 = createTestRawCard(card1._id, { condition: 'Near Mint' });
  const rawCard2 = createTestRawCard(card2._id, { condition: 'Lightly Played' });
  
  const refProduct = createTestCardMarketRefProduct();
  const sealedProduct = createTestSealedProduct(refProduct._id);
  
  return {
    set,
    cards: [card1, card2],
    psaCards: [psaCard1, psaCard2],
    rawCards: [rawCard1, rawCard2],
    refProduct,
    sealedProduct
  };
};

module.exports = {
  createTestSet,
  createTestCard,
  createTestPsaGradedCard,
  createTestRawCard,
  createTestCardMarketRefProduct,
  createTestSealedProduct,
  createTestAuction,
  createTestActivity,
  createTestDataSet
};