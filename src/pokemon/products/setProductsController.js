import SetProduct from '@/pokemon/products/SetProduct.js';
import {asyncHandler, NotFoundError, ValidationError} from '@/system/middleware/CentralizedErrorHandler.js';
import SearchService from '@/search/services/SearchService.js';
import ValidatorFactory from '@/system/validation/ValidatorFactory.js';

const searchService = new SearchService();
const getAllSetProducts = asyncHandler(async (req, res) => {
    const setProducts = await SetProduct.find();

    res.status(200).json(setProducts);
});

const getSetProductsWithPagination = asyncHandler(async (req, res) => {
    const {page = 1, limit = 15, q, name} = req.query;

    // Validate pagination parameters
    const {pageNum, limitNum} = ValidatorFactory.validatePagination(page, limit, 100);

    // Build base query
    const baseQuery = {};

    // Handle search query for set product name
    if (q || name) {
        const searchQuery = q || name;

        baseQuery.$or = [
            {setProductName: {$regex: searchQuery, $options: 'i'}}
        ];
    }

    // Execute query with pagination
    const [setProducts, totalCount] = await Promise.all([
        SetProduct.find(baseQuery)
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .sort({setProductName: 1})
            .lean(),
        SetProduct.countDocuments(baseQuery)
    ]);

    res.status(200).json({
        setProducts,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            pages: Math.ceil(totalCount / limitNum)
        }
    });
});

const getSetProductById = asyncHandler(async (req, res) => {
    const {id} = req.params;

    // Validate ObjectId format
    if (!ValidatorFactory.isValidObjectId(id)) {
        throw new ValidationError('Invalid set product ID format');
    }

    const setProduct = await SetProduct.findById(id).lean();

    if (!setProduct) {
        throw new NotFoundError(`Set product not found with ID: ${id}`);
    }

    res.status(200).json(setProduct);
});

const getSetProductByName = asyncHandler(async (req, res) => {
    const {name} = req.params;

    if (!name || name.trim() === '') {
        throw new ValidationError('Set product name is required');
    }

    const setProduct = await SetProduct.findOne({
        setProductName: {$regex: `^${name.trim()}$`, $options: 'i'}
    }).lean();

    if (!setProduct) {
        throw new NotFoundError(`Set product not found with name: ${name}`);
    }

    res.status(200).json(setProduct);
});

const getSetProductStats = asyncHandler(async (req, res) => {
    const stats = await SetProduct.aggregate([
        {
            $group: {
                _id: null,
                totalSetProducts: {$sum: 1},
                avgUniqueSetProductId: {$avg: '$uniqueSetProductId'},
                maxUniqueSetProductId: {$max: '$uniqueSetProductId'},
                minUniqueSetProductId: {$min: '$uniqueSetProductId'}
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: stats[0] || {
            totalSetProducts: 0,
            avgUniqueSetProductId: 0,
            maxUniqueSetProductId: 0,
            minUniqueSetProductId: 0
        }
    });
});

export {
    getAllSetProducts,
    getSetProductsWithPagination,
    getSetProductById,
    getSetProductByName,
    getSetProductStats
};
export default getAllSetProducts;

