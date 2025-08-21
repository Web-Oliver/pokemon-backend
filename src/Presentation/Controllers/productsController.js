import Product from '@/Domain/Entities/Product.js';
import SetProduct from '@/Domain/Entities/SetProduct.js';
import { asyncHandler, NotFoundError, ValidationError   } from '@/Infrastructure/Utilities/errorHandler.js';
import searchService from '@/Application/UseCases/Search/searchService.js';
import ValidatorFactory from '@/Application/Validators/ValidatorFactory.js';
/**
 * Products Controller
 */
const getAllProducts = asyncHandler(async (req, res) => {
  const { name, setName, category, page, limit, q, search, available } = req.query;

  // Handle search query (support both 'q' and 'search' for compatibility)
  const searchQuery = q || search || name || setName;

  if (searchQuery) {
    // Build filters
    const filters = {};

    if (category) filters.category = category;
    if (available === 'true') filters.available = { $gt: 0 };

    const { pageNum: searchPageNum, limitNum: searchLimitNum } =
      ValidatorFactory.validatePagination(page || 1, limit || 50, 100);
    const searchOptions = {
      limit: searchLimitNum,
      page: searchPageNum
    };

    const { results, total, page: resultPage, totalPages } = await searchService.searchProducts(searchQuery, filters, searchOptions);

    return res.status(200).json({
      success: true,
      status: 'success',
      data: {
        products: results,
        total,
        currentPage: resultPage || searchPageNum,
        totalPages,
        hasNextPage: (resultPage || searchPageNum) < totalPages,
        hasPrevPage: (resultPage || searchPageNum) > 1,
        count: results.length,
        limit: searchLimitNum,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        duration: '0ms',
        query: searchQuery,
        filters,
        pagination: {
          page: searchPageNum,
          limit: searchLimitNum,
          total: results.length,
          pages: Math.ceil(results.length / searchLimitNum)
        }
      }
    });
  }

  // Fallback to standard filtering if no search query
  const query = {};

  if (category) query.category = category;
  if (available === 'true') query.available = { $gt: 0 };

  const { pageNum, limitNum } = ValidationUtils.validatePagination(page || 1, limit || 20, 100);
  const skip = (pageNum - 1) * limitNum;

  const [products, totalProducts] = await Promise.all([
    Product.find(query)
      .populate('setProductId', 'setProductName')
      .skip(skip)
      .limit(limitNum)
      .sort({ available: -1, price: 1, _id: 1 })
      .lean(),
    Product.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalProducts / limitNum);

  res.status(200).json({
    success: true,
    status: 'success',
    data: {
      products,
      total: totalProducts,
      currentPage: pageNum,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      count: products.length,
      limit: limitNum
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      duration: '0ms',
      filters: query,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: products.length,
        pages: totalPages
      }
    }
  });
});

const getProductById = asyncHandler(async (req, res) => {
  ValidationUtils.validateObjectId(req.params.id, 'Product ID');

  const product = await Product.findById(req.params.id)
    .populate('setProductId', 'setProductName');

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  res.status(200).json({
    success: true,
    status: 'success',
    data: product,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      duration: '0ms'
    }
  });
});

const getProductSetNames = asyncHandler(async (req, res) => {
  const { q, search } = req.query;
  const searchQuery = q || search;

  if (searchQuery) {
    // Search products by set name and extract set names with metadata
    const searchResults = await searchService.searchProducts(searchQuery, {}, { limit: 100 });
    const products = Array.isArray(searchResults) ? searchResults : searchResults.results || [];

    // Group products by setName and calculate metadata
    const setNameStats = {};

    products.forEach(product => {
      if (!setNameStats[product.setName]) {
        setNameStats[product.setName] = {
          setName: product.setName,
          count: 0,
          totalAvailable: 0,
          categories: new Set(),
          totalPrice: 0,
          productCount: 0
        };
      }

      const stats = setNameStats[product.setName];

      stats.count++;
      stats.totalAvailable += product.available || 0;
      stats.categories.add(product.category);

      if (product.price) {
        stats.totalPrice += parseFloat(product.price) || 0;
        stats.productCount++;
      }
    });

    // Transform to final format with calculated averages
    const setNamesWithStats = Object.values(setNameStats).map(stats => ({
      setName: stats.setName,
      count: stats.count,
      totalAvailable: stats.totalAvailable,
      categoryCount: stats.categories.size,
      averagePrice: stats.productCount > 0 ? (stats.totalPrice / stats.productCount) : 0
    })).sort((a, b) => a.setName.localeCompare(b.setName));

    return res.status(200).json({
      success: true,
      status: 'success',
      data: setNamesWithStats,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        duration: '0ms',
        totalResults: setNamesWithStats.length,
        query: searchQuery
      },
    });
  }

  // Fallback to aggregation with metadata using Product + SetProduct join
  const aggregationPipeline = [
    {
      $lookup: {
        from: 'setproducts',
        localField: 'setProductId',
        foreignField: '_id',
        as: 'setProduct'
      }
    },
    {
      $unwind: '$setProduct'
    },
    {
      $group: {
        _id: '$setProduct.setProductName',
        count: { $sum: 1 },
        totalAvailable: { $sum: '$available' },
        categories: { $addToSet: '$category' },
        averagePrice: { $avg: { $toDouble: '$price' } }
      }
    },
    {
      $project: {
        setName: '$_id',
        count: 1,
        totalAvailable: 1,
        categoryCount: { $size: '$categories' },
        averagePrice: { $round: ['$averagePrice', 2] },
        _id: 0
      }
    },
    { $sort: { setName: 1 } }
  ];

  const setNamesWithStats = await Product.aggregate(aggregationPipeline);

  res.status(200).json({
    success: true,
    status: 'success',
    data: setNamesWithStats,
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      duration: '0ms',
      count: setNamesWithStats.length
    },
  });
});

export {
  getAllProducts,
  getProductById,
  getProductSetNames
};
export default getAllProducts;;
