/**
 * CardMarket Search Service
 * Layer 3: Business Logic - CardMarket-specific search operations
 * 
 * Provides optimized CardMarket reference product search with:
 * - Full pagination support
 * - Flexible filtering
 * - Proper sorting
 * 
 * This is separate from the autosuggestion system which uses hierarchical search.
 */

const CardMarketReferenceProduct = require('../../models/CardMarketReferenceProduct');
const { ValidationError } = require('../../middleware/errorHandler');
const ValidationUtils = require('../../utils/validationUtils');

class CardMarketSearchService {
  /**
   * Search CardMarket reference products with pagination and filtering
   */
  static async searchProducts(params = {}) {
    const {
      page = 1,
      limit = 20,
      category,
      setName,
      availableOnly,
      sort = { available: -1, price: 1 }
    } = params;

    // Validate pagination
    const { pageNum, limitNum } = ValidationUtils.validatePagination(page, limit, 100);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query = {};
    if (category) query.category = category;
    if (setName) query.setName = new RegExp(setName, 'i');
    if (availableOnly === true) query.available = { $gt: 0 };

    // Execute queries in parallel for performance
    const [products, totalCount] = await Promise.all([
      CardMarketReferenceProduct.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      CardMarketReferenceProduct.countDocuments(query)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);

    return {
      success: true,
      data: {
        products,
        pagination: {
          currentPage: pageNum,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
          total: totalCount
        }
      }
    };
  }

  /**
   * Get unique categories with counts
   */
  static async getCategories() {
    const categories = await CardMarketReferenceProduct.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    return categories.map(cat => ({
      name: cat._id,
      count: cat.count
    }));
  }

  /**
   * Get category details including product counts and availability
   */
  static async getCategoryDetails(category) {
    const details = await CardMarketReferenceProduct.aggregate([
      { $match: { category } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          availableProducts: {
            $sum: { $cond: [{ $gt: ['$available', 0] }, 1, 0] }
          },
          totalAvailable: { $sum: '$available' },
          avgPrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' }
        }
      }
    ]);

    if (!details.length) {
      throw new ValidationError(`Category "${category}" not found`);
    }

    return details[0];
  }
}

module.exports = CardMarketSearchService;