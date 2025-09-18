/**
 * Product Routes
 * Layer 4: Presentation - Modern route structure for Product operations (SetProduct → Product hierarchy)
 */

import express from 'express';
import { asyncHandler } from '@/system/middleware/CentralizedErrorHandler.js';
import ProductApiService from '@/pokemon/products/ProductApiService.js';
import { cachePresets } from '@/system/middleware/cachePresets.js';

const router = express.Router();
/**
 * @route   GET /api/products/search
 * @desc    Search products with pagination (SetProduct → Product hierarchy)
 * @access  Public
 * @query   {number} page - Page number (optional, default 1)
 * @query   {number} limit - Results per page (optional, default 20)
 * @query   {string} category - Filter by category (optional)
 * @query   {string} setName - Filter by set name (optional)
 * @query   {boolean} availableOnly - Show only available products (optional)
 */
router.get('/search', cachePresets.productSearch, asyncHandler(async (req, res) => {
    const { page, limit, category, setName, availableOnly } = req.query;

    const results = await ProductApiService.searchProducts({
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        category,
        setName,
        availableOnly: availableOnly === 'true'
    });

    res.json(results);
}));

/**
 * @route   GET /api/products/categories
 * @desc    Get all product categories with counts
 * @access  Public
 */
router.get('/categories', cachePresets.productData, asyncHandler(async (req, res) => {
    const categories = await ProductApiService.getCategories();

    res.json({
        success: true,
        data: categories
    });
}));

/**
 * @route   GET /api/products/categories/:category
 * @desc    Get detailed information about a specific category
 * @access  Public
 */
router.get('/categories/:category', cachePresets.productData, asyncHandler(async (req, res) => {
    const details = await ProductApiService.getCategoryDetails(req.params.category);

    res.json({
        success: true,
        data: details
    });
}));

export default router;
