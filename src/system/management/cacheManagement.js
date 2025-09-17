import express from 'express';
import {clearCache, getCacheStats, invalidateCache} from '@/search/middleware/searchCache.js';

const router = express.Router();

router.get('/stats', (req, res) => {
    try {
        const stats = getCacheStats();
        res.json({
            success: true,
            data: {
                cache: stats,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.delete('/invalidate', (req, res) => {
    try {
        const {pattern} = req.body;
        let invalidatedCount = 0;

        if (pattern) {
            invalidatedCount = invalidateCache(pattern);
        } else {
            clearCache();
            invalidatedCount = 'all';
        }

        res.json({
            success: true,
            data: {
                invalidatedCount,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.delete('/clear', (req, res) => {
    try {
        clearCache();
        res.json({
            success: true,
            data: {
                message: 'Cache cleared successfully',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router;