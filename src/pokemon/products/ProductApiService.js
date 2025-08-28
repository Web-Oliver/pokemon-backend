/**
 * Product Search Service
 * Layer 3: Business Logic - Product-specific search operations (SetProduct → Product hierarchy)
 *
 * Provides optimized product search with:
 * - Full pagination support
 * - Flexible filtering
 * - Proper sorting
 * - SetProduct → Product relationship support
 *
 * This is separate from the autosuggestion system which uses hierarchical search.
 */

import Product from '@/pokemon/products/Product.js';
import SetProduct from '@/pokemon/products/SetProduct.js';
import { ValidationError } from '@/system/middleware/errorHandler.js';
import ValidatorFactory from '@/system/validation/ValidatorFactory.js';
class ProductApiService {
  /**
   * Search products with pagination and filtering (SetProduct → Product hierarchy)
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
    const { pageNum, limitNum } = ValidatorFactory.validatePagination(page, limit, 100);
    const skip = (pageNum - 1) * limitNum;

    // Build query for Product model
    const query = {};

    if (category) query.category = category;
    if (availableOnly === true) query.available = { $gt: 0 };

    // Handle setName by looking up SetProduct and using its ID
    if (setName) {
      const setProduct = await SetProduct.findOne({
        setProductName: new RegExp(setName, 'i')
      });

      if (setProduct) {
        query.setProductId = setProduct._id;
      } else {
        // No matching set found - return empty results
        return {
          success: true,
          data: {
            products: [],
            pagination: {
              currentPage: pageNum,
              totalPages: 0,
              hasNextPage: false,
              hasPrevPage: false,
              total: 0
            }
          }
        };
      }
    }

    // Execute queries in parallel for performance
    const [products, totalCount] = await Promise.all([
      Product.find(query)
        .populate('setProductId', 'setProductName')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Product.countDocuments(query)
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
    const categories = await Product.aggregate([
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
    const details = await Product.aggregate([
      { $match: { category } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          availableProducts: {
            $sum: { $cond: [{ $gt: ['$available', 0] }, 1, 0] }
          },
          totalAvailable: { $sum: '$available' },
          avgPrice: { $avg: { $toDouble: '$price' } },
          minPrice: { $min: { $toDouble: '$price' } },
          maxPrice: { $max: { $toDouble: '$price' } }
        }
      }
    ]);

    if (!details.length) {
      throw new ValidationError(`Category "${category}" not found`);
    }

    return details[0];
  }
}

export default ProductApiService;
