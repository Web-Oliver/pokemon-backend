import SealedProduct from '@/collection/items/SealedProduct.js';
import PsaGradedCard from '@/collection/items/PsaGradedCard.js';
import RawCard from '@/collection/items/RawCard.js';
import Logger from '@/system/logging/Logger.js';
import { validateDateRange } from '@/system/validation/dateValidationHelpers.js';
import { getDisplayName } from '@/system/constants/ItemTypeMapper.js';
/**
 * Map item types to display categories using centralized ItemTypeMapper
 */
function getDisplayCategory(itemType) {
  try {
    return getDisplayName(itemType);
  } catch {
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
      SealedProduct.find(filter).populate('productId'),
      PsaGradedCard.find(filter).populate({
        path: 'cardId',
        populate: { path: 'setId' }
      }),
      RawCard.find(filter).populate({
        path: 'cardId',
        populate: { path: 'setId' }
      })
    ]);

    salesData = [
      ...sealedProducts.filter(item => item).map((item) => ({
        ...(item.toObject ? item.toObject() : item),
        itemType: 'sealedProduct'
      })),
      ...psaCards.filter(item => item).map((item) => ({
        ...(item.toObject ? item.toObject() : item),
        itemType: 'psaGradedCard'
      })),
      ...rawCards.filter(item => item).map((item) => ({
        ...(item.toObject ? item.toObject() : item),
        itemType: 'rawCard'
      }))
    ];
  } else {
    // Fetch from specific category
    switch (category) {
      case 'sealedProducts':
        salesData = await SealedProduct.find(filter).populate('productId');
        salesData = salesData.filter(item => item).map((item) => ({
          ...(item.toObject ? item.toObject() : item),
          itemType: 'sealedProduct'
        }));
        break;
      case 'psaGradedCards':
        salesData = await PsaGradedCard.find(filter).populate({
          path: 'cardId',
          populate: { path: 'setId' }
        });
        salesData = salesData.filter(item => item).map((item) => ({
          ...(item.toObject ? item.toObject() : item),
          itemType: 'psaGradedCard'
        }));
        break;
      case 'rawCards':
        salesData = await RawCard.find(filter).populate({
          path: 'cardId',
          populate: { path: 'setId' }
        });
        salesData = salesData.filter(item => item).map((item) => ({
          ...(item.toObject ? item.toObject() : item),
          itemType: 'rawCard'
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
    category: getDisplayCategory(item.itemType)
  }));

  const sortedData = transformedData.sort(
    (a, b) => new Date(b.saleDetails?.dateSold || 0) - new Date(a.saleDetails?.dateSold || 0)
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

  // Only validate date range if both dates are provided
  if (startDate && endDate) {
    validateDateRange(startDate, endDate);
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

export {
  fetchSalesData,
  buildDateFilter
};
export default fetchSalesData; ;
