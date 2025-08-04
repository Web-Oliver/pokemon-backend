/**
 * SetProduct Service
 * Layer 3: Business Logic - SetProduct-specific operations
 * 
 * Provides business logic for SetProduct entities including:
 * - SetProduct management operations
 * - Search and filtering
 * - Statistics and analytics
 * - Validation and data integrity
 */

const SetProduct = require('../../models/SetProduct');
const Product = require('../../models/Product');
const { ValidationError, NotFoundError } = require('../../middleware/errorHandler');

class SetProductService {
  
  /**
   * Search SetProducts with advanced filtering and pagination
   * @param {Object} options - Search options
   * @param {string} options.query - Search query for set product name
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.limit - Results per page (default: 20)
   * @param {string} options.sortBy - Sort field (default: 'setProductName')
   * @param {string} options.sortOrder - Sort order: 'asc' or 'desc' (default: 'asc')
   * @returns {Object} Search results with pagination metadata
   */
  async searchSetProducts(options = {}) {
    const {
      query = '',
      page = 1,
      limit = 20,
      sortBy = 'setProductName',
      sortOrder = 'asc'
    } = options;

    // Build MongoDB query
    const mongoQuery = {};
    
    if (query && query.trim()) {
      mongoQuery.$or = [
        { setProductName: { $regex: query.trim(), $options: 'i' } }
      ];
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries in parallel
    const [setProducts, totalCount] = await Promise.all([
      SetProduct.find(mongoQuery)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .lean(),
      SetProduct.countDocuments(mongoQuery)
    ]);

    return {
      setProducts,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      },
      query: {
        searchQuery: query,
        sortBy,
        sortOrder
      }
    };
  }

  /**
   * Get SetProduct by ID with error handling
   * @param {string} setProductId - SetProduct ObjectId
   * @returns {Object} SetProduct document
   */
  async getSetProductById(setProductId) {
    if (!setProductId) {
      throw new ValidationError('SetProduct ID is required');
    }

    const setProduct = await SetProduct.findById(setProductId).lean();
    
    if (!setProduct) {
      throw new NotFoundError(`SetProduct not found with ID: ${setProductId}`);
    }

    return setProduct;
  }

  /**
   * Get SetProduct by name with case-insensitive search
   * @param {string} setProductName - SetProduct name
   * @returns {Object} SetProduct document
   */
  async getSetProductByName(setProductName) {
    if (!setProductName || !setProductName.trim()) {
      throw new ValidationError('SetProduct name is required');
    }

    const setProduct = await SetProduct.findOne({
      setProductName: { $regex: `^${setProductName.trim()}$`, $options: 'i' }
    }).lean();

    if (!setProduct) {
      throw new NotFoundError(`SetProduct not found with name: ${setProductName}`);
    }

    return setProduct;
  }

  /**
   * Get all products for a specific SetProduct
   * @param {string} setProductId - SetProduct ObjectId
   * @param {Object} options - Query options
   * @returns {Object} Products with pagination
   */
  async getProductsBySetProduct(setProductId, options = {}) {
    const { page = 1, limit = 20, category, availableOnly = false } = options;

    // Verify SetProduct exists
    await this.getSetProductById(setProductId);

    // Build product query
    const productQuery = { setProductId };
    
    if (category) {
      productQuery.category = { $regex: category, $options: 'i' };
    }
    
    if (availableOnly) {
      productQuery.available = { $gt: 0 };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [products, totalCount] = await Promise.all([
      Product.find(productQuery)
        .populate('setProductId', 'setProductName')
        .sort({ productName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(productQuery)
    ]);

    return {
      products,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      filters: {
        category,
        availableOnly
      }
    };
  }

  /**
   * Get SetProduct statistics and analytics
   * @returns {Object} Statistics object
   */
  async getSetProductStatistics() {
    const [basicStats, productStats] = await Promise.all([
      // Basic SetProduct statistics
      SetProduct.aggregate([
        {
          $group: {
            _id: null,
            totalSetProducts: { $sum: 1 },
            avgUniqueId: { $avg: '$uniqueSetProductId' },
            maxUniqueId: { $max: '$uniqueSetProductId' },
            minUniqueId: { $min: '$uniqueSetProductId' }
          }
        }
      ]),
      
      // Product count per SetProduct
      Product.aggregate([
        {
          $group: {
            _id: '$setProductId',
            productCount: { $sum: 1 },
            totalAvailable: { $sum: '$available' },
            avgPrice: { $avg: { $toDouble: '$price' } }
          }
        },
        {
          $group: {
            _id: null,
            setProductsWithProducts: { $sum: 1 },
            avgProductsPerSet: { $avg: '$productCount' },
            totalProducts: { $sum: '$productCount' },
            avgAvailablePerSet: { $avg: '$totalAvailable' },
            avgPriceOverall: { $avg: '$avgPrice' }
          }
        }
      ])
    ]);

    return {
      setProducts: basicStats[0] || {
        totalSetProducts: 0,
        avgUniqueId: 0,
        maxUniqueId: 0,
        minUniqueId: 0
      },
      products: productStats[0] || {
        setProductsWithProducts: 0,
        avgProductsPerSet: 0,
        totalProducts: 0,
        avgAvailablePerSet: 0,
        avgPriceOverall: 0
      }
    };
  }

  /**
   * Get SetProducts with their product counts
   * @param {Object} options - Query options
   * @returns {Array} SetProducts with product counts
   */
  async getSetProductsWithCounts(options = {}) {
    const { limit = 50, sortBy = 'productCount', sortOrder = 'desc' } = options;

    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const setProductsWithCounts = await SetProduct.aggregate([
      // Lookup products for each SetProduct
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: 'setProductId',
          as: 'products'
        }
      },
      // Add computed fields
      {
        $addFields: {
          productCount: { $size: '$products' },
          totalAvailable: {
            $sum: {
              $map: {
                input: '$products',
                as: 'product',
                in: '$$product.available'
              }
            }
          }
        }
      },
      // Remove products array to reduce payload size
      {
        $project: {
          products: 0
        }
      },
      // Sort and limit
      { $sort: sortObj },
      { $limit: limit }
    ]);

    return setProductsWithCounts;
  }
}

module.exports = SetProductService;