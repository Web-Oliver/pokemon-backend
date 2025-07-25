const express = require('express');
const { cacheManager } = require('../middleware/enhancedSearchCache');
const { cacheWarmupService } = require('../services/cacheWarmupService');
const { getCacheStats, invalidateCacheByEntity, invalidateCacheByPattern } = require('../middleware/searchCache');

const router = express.Router();

router.get('/stats', (req, res) => {
  try {
    const enhancedMetrics = cacheManager.getMetrics();
    const legacyStats = getCacheStats();
    const warmupStats = cacheWarmupService.getWarmupStats();
    
    res.json({
      success: true,
      data: {
        enhanced: enhancedMetrics,
        legacy: legacyStats,
        warmup: warmupStats,
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

router.post('/warmup', async (req, res) => {
  try {
    const { strategies, queries, entityType } = req.body;
    
    let result;
    
    if (strategies && Array.isArray(strategies)) {
      result = await cacheManager.warmupCache(strategies);
    } else if (queries && Array.isArray(queries)) {
      result = await cacheWarmupService.warmupSpecificQueries(queries);
    } else if (entityType) {
      const limit = req.body.limit || 10;

      result = await cacheWarmupService.warmupByEntityType(entityType, limit);
    } else {
      result = await cacheWarmupService.performStartupWarmup();
    }
    
    res.json({
      success: true,
      data: result
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
    const { pattern, entityType, entityId } = req.body;
    
    let invalidatedCount = 0;
    
    if (pattern) {
      if (typeof pattern === 'string') {
        invalidatedCount = cacheManager.invalidatePattern(pattern);
      } else {
        invalidatedCount = cacheManager.invalidatePattern(new RegExp(pattern));
      }
    } else if (entityType) {
      invalidatedCount = cacheManager.invalidateByEntity(entityType, entityId);
    } else {
      cacheManager.clearAllCaches();
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
    cacheManager.clearAllCaches();
    
    res.json({
      success: true,
      data: {
        message: 'All caches cleared successfully',
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

router.get('/warmup/history', (req, res) => {
  try {
    const stats = cacheWarmupService.getWarmupStats();
    
    res.json({
      success: true,
      data: {
        history: stats.history,
        lastWarmup: stats.lastWarmup,
        isWarming: stats.isWarming
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/warmup/schedule', (req, res) => {
  try {
    const { intervalMinutes = 60 } = req.body;
    
    cacheWarmupService.schedulePeriodicWarmup(intervalMinutes);
    
    res.json({
      success: true,
      data: {
        message: `Periodic warmup scheduled every ${intervalMinutes} minutes`,
        intervalMinutes
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/warmup/schedule', (req, res) => {
  try {
    cacheWarmupService.stopScheduledWarmups();
    
    res.json({
      success: true,
      data: {
        message: 'All scheduled warmups stopped'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;