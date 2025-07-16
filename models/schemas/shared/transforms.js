/**
 * Schema Transform Functions
 * 
 * Shared transform functions for converting data types in JSON responses.
 * Eliminates duplication of Decimal128 conversion logic across models.
 */

/**
 * Creates a transform function for converting Decimal128 to numbers
 * 
 * @param {Object} options - Transform options
 * @param {Array} options.priceFields - Array of price field names to convert
 * @param {Array} options.nestedPriceFields - Array of nested price field paths
 * @returns {Function} - Transform function for schema.set('toJSON')
 */
function createDecimal128Transform(options = {}) {
  const {
    priceFields = ['myPrice'],
    nestedPriceFields = [
      'saleDetails.actualSoldPrice',
      'priceHistory.price'
    ]
  } = options;

  return function transform(doc, ret) {
    // Convert main price fields
    priceFields.forEach(field => {
      if (ret[field]) {
        ret[field] = convertDecimal128ToNumber(ret[field]);
      }
    });

    // Convert nested price fields
    nestedPriceFields.forEach(fieldPath => {
      const fieldParts = fieldPath.split('.');
      let current = ret;
      
      // Navigate to the nested field
      for (let i = 0; i < fieldParts.length - 1; i++) {
        if (current[fieldParts[i]]) {
          current = current[fieldParts[i]];
        } else {
          return; // Field doesn't exist
        }
      }
      
      const finalField = fieldParts[fieldParts.length - 1];
      
      // Handle array fields (like priceHistory)
      if (Array.isArray(current)) {
        current.forEach(item => {
          if (item[finalField]) {
            item[finalField] = convertDecimal128ToNumber(item[finalField]);
          }
        });
      } else if (current[finalField]) {
        current[finalField] = convertDecimal128ToNumber(current[finalField]);
      }
    });

    return ret;
  };
}

/**
 * Converts a Decimal128 value to a number
 * 
 * @param {*} value - Value to convert
 * @returns {number} - Converted number value
 */
function convertDecimal128ToNumber(value) {
  if (value && value.$numberDecimal) {
    return parseFloat(value.$numberDecimal);
  } else if (value && value.toString) {
    return parseFloat(value.toString());
  }
  return value;
}

/**
 * Standard transform for collection items (cards)
 * Converts myPrice, saleDetails.actualSoldPrice, and priceHistory prices
 */
const collectionItemTransform = createDecimal128Transform({
  priceFields: ['myPrice'],
  nestedPriceFields: [
    'saleDetails.actualSoldPrice',
    'priceHistory.price'
  ]
});

/**
 * Transform for sealed products
 * Converts myPrice, cardMarketPrice, saleDetails.actualSoldPrice, and priceHistory prices
 */
const sealedProductTransform = createDecimal128Transform({
  priceFields: ['myPrice', 'cardMarketPrice'],
  nestedPriceFields: [
    'saleDetails.actualSoldPrice',
    'priceHistory.price'
  ]
});

/**
 * Standard transform for auction items
 * Converts totalValue and soldValue
 */
const auctionTransform = createDecimal128Transform({
  priceFields: ['totalValue', 'soldValue'],
  nestedPriceFields: []
});

/**
 * Standard transform for card market reference products
 * Converts price and cardMarketPrice
 */
const cardMarketTransform = createDecimal128Transform({
  priceFields: ['price', 'cardMarketPrice'],
  nestedPriceFields: []
});

module.exports = {
  createDecimal128Transform,
  convertDecimal128ToNumber,
  collectionItemTransform,
  sealedProductTransform,
  auctionTransform,
  cardMarketTransform
};