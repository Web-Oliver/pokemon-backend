const SealedProduct = require('../models/SealedProduct');
const PsaGradedCard = require('../models/PsaGradedCard');
const RawCard = require('../models/RawCard');

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

  return transformedData.sort(
    (a, b) => new Date(b.saleDetails?.dateSold || 0) - new Date(a.saleDetails?.dateSold || 0),
  );
}

/**
 * Build date filter for sales queries
 */
function buildDateFilter(startDate, endDate) {
  const filter = { sold: true };

  if (startDate || endDate) {
    filter['saleDetails.dateSold'] = {};
    if (startDate) {
      const start = new Date(startDate);

      if (isNaN(start.getTime())) {
        throw new Error('Invalid startDate format');
      }
      filter['saleDetails.dateSold'].$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);

      if (isNaN(end.getTime())) {
        throw new Error('Invalid endDate format');
      }
      filter['saleDetails.dateSold'].$lte = end;
    }
  }

  return filter;
}

module.exports = {
  fetchSalesData,
  buildDateFilter,
};
