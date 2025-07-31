const SealedProduct = require('../models/SealedProduct');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');
const Logger = require('../utils/Logger');
const ValidatorFactory = require('../utils/ValidatorFactory');

/**
 * Map item types to display categories
 */
function getDisplayCategory(itemType) {
  switch (itemType) {
    case 'sealedProduct':
      return 'Sealed Product';
    case 'psaGradedCard':
      return 'PSA Graded Card';
    case 'rawCard':
      return 'Raw Card';
    default:
      return 'Unknown';
  }
}

/**
 * Fetch sales data based on filters
 */
async function fetchSalesData(filter, category) {
  Logger.operationStart('FETCH_SALES_DATA', 'Fetching sales data from database', {
    filter,
    category: category || 'all'
  });
  
  let salesData = [];

  if (!category || category === 'all') {
    // Fetch from all categories
    const [sealedProducts, psaCards, rawCards] = await Promise.all([
      SealedProduct.find(filter),
      PsaGradedCard.find(filter).populate({
        path: 'cardId',
        populate: { path: 'setId' },
      }),
      RawCard.find(filter).populate({
        path: 'cardId',
        populate: { path: 'setId' },
      }),
    ]);

    salesData = [
      ...sealedProducts.map((item) => ({
        ...item.toObject(),
        itemType: 'sealedProduct',
      })),
      ...psaCards.map((item) => ({
        ...item.toObject(),
        itemType: 'psaGradedCard',
      })),
      ...rawCards.map((item) => ({ ...item.toObject(), itemType: 'rawCard' })),
    ];
  } else {
    // Fetch from specific category
    switch (category) {
      case 'sealedProducts':
        salesData = await SealedProduct.find(filter);
        salesData = salesData.map((item) => ({
          ...item.toObject(),
          itemType: 'sealedProduct',
        }));
        break;
      case 'psaGradedCards':
        salesData = await PsaGradedCard.find(filter).populate({
          path: 'cardId',
          populate: { path: 'setId' },
        });
        salesData = salesData.map((item) => ({
          ...item.toObject(),
          itemType: 'psaGradedCard',
        }));
        break;
      case 'rawCards':
        salesData = await RawCard.find(filter).populate({
          path: 'cardId',
          populate: { path: 'setId' },
        });
        salesData = salesData.map((item) => ({
          ...item.toObject(),
          itemType: 'rawCard',
        }));
        break;
      default:
        salesData = [];
        break;
    }
  }

  // Transform data for response
  const transformedData = salesData.map((item) => ({
    ...item,
    category: getDisplayCategory(item.itemType),
  }));

  const sortedData = transformedData.sort(
    (a, b) => new Date(b.saleDetails?.dateSold || 0) - new Date(a.saleDetails?.dateSold || 0),
  );
  
  Logger.operationSuccess('FETCH_SALES_DATA', 'Successfully fetched and transformed sales data', {
    category: category || 'all',
    totalItems: sortedData.length,
    itemTypeBreakdown: {
      sealedProducts: sortedData.filter(item => item.itemType === 'sealedProduct').length,
      psaGradedCards: sortedData.filter(item => item.itemType === 'psaGradedCard').length,
      rawCards: sortedData.filter(item => item.itemType === 'rawCard').length
    }
  });
  
  return sortedData;
}

/**
 * Build date filter for sales queries
 */
function buildDateFilter(startDate, endDate) {
  Logger.operationStart('BUILD_DATE_FILTER', 'Building date filter for sales query', {
    startDate,
    endDate
  });
  
  const filter = { sold: true };

  // Validate dates using ValidatorFactory before processing
  if (startDate && !ValidatorFactory.date().validate(startDate)) {
    const error = new Error('Invalid startDate format');

    Logger.operationError('INVALID_START_DATE', 'Invalid start date format provided', error, {
      startDate,
      endDate
    });
    throw error;
  }
  
  if (endDate && !ValidatorFactory.date().validate(endDate)) {
    const error = new Error('Invalid endDate format');

    Logger.operationError('INVALID_END_DATE', 'Invalid end date format provided', error, {
      startDate,
      endDate
    });
    throw error;
  }

  if (startDate || endDate) {
    filter['saleDetails.dateSold'] = {};
    if (startDate) {
      const start = new Date(startDate);

      filter['saleDetails.dateSold'].$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);

      filter['saleDetails.dateSold'].$lte = end;
    }
  }

  Logger.operationSuccess('BUILD_DATE_FILTER', 'Successfully built date filter', {
    filter,
    hasDateRange: Boolean(startDate || endDate),
    startDate,
    endDate
  });
  
  return filter;
}

module.exports = {
  fetchSalesData,
  buildDateFilter,
};
