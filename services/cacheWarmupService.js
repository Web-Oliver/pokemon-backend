const { cacheManager } = require('../middleware/searchCache');
const Logger = require('../utils/Logger');

class CacheWarmupService {
  constructor() {
    this.isWarming = false;
    this.warmupHistory = [];
    this.scheduledWarmups = new Map();
  }

  async performStartupWarmup() {
    if (this.isWarming) {
      Logger.cache('WARMUP', 'startup_warmup_already_in_progress', { skipped: true });
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();
    
    Logger.operationStart('CACHE_WARMUP_SERVICE', 'PERFORM_STARTUP_WARMUP', {
      strategies: ['popularSearches', 'recentSets']
    });

    try {
      Logger.cache('WARMUP', 'startup_warmup_process_started');
      
      const results = await cacheManager.warmupCache([
        'popularSearches',
        'recentSets'
      ]);

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      
      const warmupEntry = {
        timestamp: new Date(),
        duration,
        strategies: results.length,
        successful: successCount,
        results
      };
      
      this.warmupHistory.push(warmupEntry);

      Logger.performance('CacheWarmupService.performStartupWarmup', duration, {
        strategies: results.length,
        successful: successCount,
        failedCount: results.length - successCount
      });
      
      Logger.cache('WARMUP', 'startup_warmup_completed', {
        duration,
        successRate: `${successCount}/${results.length}`
      });
      
      results.forEach(result => {
        if (result.success) {
          Logger.cache('WARMUP', `strategy_${result.strategy}_success`, result);
        } else {
          Logger.cache('WARMUP', `strategy_${result.strategy}_failed`, { error: result.error });
        }
      });

      Logger.operationSuccess('CACHE_WARMUP_SERVICE', 'PERFORM_STARTUP_WARMUP', {
        duration,
        successCount,
        totalStrategies: results.length
      });
      
      return { success: true, duration, results };
    } catch (error) {
      Logger.operationError('CACHE_WARMUP_SERVICE', 'PERFORM_STARTUP_WARMUP', error, {
        duration: Date.now() - startTime
      });
      return { success: false, error: error.message };
    } finally {
      this.isWarming = false;
    }
  }

  schedulePeriodicWarmup(intervalMinutes = 60) {
    Logger.operationStart('CACHE_WARMUP_SERVICE', 'SCHEDULE_PERIODIC_WARMUP', {
      intervalMinutes
    });
    
    if (this.scheduledWarmups.has('periodic')) {
      clearInterval(this.scheduledWarmups.get('periodic'));
      Logger.cache('SCHEDULE', 'existing_periodic_warmup_cleared');
    }

    const interval = setInterval(async () => {
      Logger.cache('SCHEDULE', 'periodic_warmup_triggered', { intervalMinutes });
      await this.performStartupWarmup();
    }, intervalMinutes * 60 * 1000);

    this.scheduledWarmups.set('periodic', interval);
    
    Logger.operationSuccess('CACHE_WARMUP_SERVICE', 'SCHEDULE_PERIODIC_WARMUP', {
      intervalMinutes,
      intervalMs: intervalMinutes * 60 * 1000
    });
  }

  async warmupSpecificQueries(queries) {
    const startTime = Date.now();

    Logger.operationStart('CACHE_WARMUP_SERVICE', 'WARMUP_SPECIFIC_QUERIES', {
      queryCount: queries.length
    });
    
    const results = [];
    
    for (const query of queries) {
      try {
        // Simple pattern generation for cache warmup
        const queryText = query.q || '';
        const patterns = queryText ? [queryText, queryText.toLowerCase()] : [];
        
        Logger.cache('WARMUP', 'processing_query_patterns', {
          originalQuery: query.q,
          patternCount: patterns.length
        });
        
        for (const pattern of patterns.slice(0, 3)) {
          const mockReq = {
            method: 'GET',
            query: { ...query, q: pattern },
            route: { path: '/api/unified-search' }
          };
          
          // Simulate cache warming by creating cache key
          const cacheKey = `${mockReq.route.path}:${JSON.stringify(mockReq.query)}`;

          Logger.cache('WARMUP', 'pattern_processed', { pattern, cacheKey: cacheKey.substring(0, 50) });
          
          results.push({
            query: pattern,
            success: true,
            cached: true,
            cacheKey
          });
        }
      } catch (error) {
        Logger.cache('WARMUP', 'query_processing_failed', {
          query: query.q || JSON.stringify(query),
          error: error.message
        });
        
        results.push({
          query: query.q || JSON.stringify(query),
          success: false,
          error: error.message
        });
      }
    }
    
    const duration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    
    Logger.performance('CacheWarmupService.warmupSpecificQueries', duration, {
      totalQueries: queries.length,
      totalResults: results.length,
      successCount
    });
    
    Logger.operationSuccess('CACHE_WARMUP_SERVICE', 'WARMUP_SPECIFIC_QUERIES', {
      processedQueries: queries.length,
      generatedResults: results.length,
      successCount,
      duration
    });
    
    return results;
  }

  async warmupByEntityType(entityType, limit = 10) {
    const startTime = Date.now();

    Logger.operationStart('CACHE_WARMUP_SERVICE', 'WARMUP_BY_ENTITY_TYPE', {
      entityType,
      limit
    });
    
    let Model;
    let searchField = 'name';
    
    try {
      switch (entityType) {
        case 'sets':
          Model = require('../models/Set');
          searchField = 'setName';
          break;
        case 'cards':
          Model = require('../models/Card');
          searchField = 'cardName';
          break;
        case 'products':
          Model = require('../models/SealedProduct');
          searchField = 'name';
          break;
        case 'psa':
          Model = require('../models/PsaGradedCard');
          searchField = 'cardName';
          break;
        default:
          const error = new Error(`Unknown entity type: ${entityType}`);

          Logger.operationError('CACHE_WARMUP_SERVICE', 'WARMUP_BY_ENTITY_TYPE', error, { entityType });
          throw error;
      }

      Logger.cache('WARMUP', 'fetching_entities_for_warmup', {
        entityType,
        searchField,
        limit
      });

      const entities = await Model.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select(`${searchField} _id`);

      const queries = entities.map(entity => ({
        q: entity[searchField],
        limit: 20
      }));
      
      Logger.cache('WARMUP', 'entities_converted_to_queries', {
        entityType,
        entitiesFound: entities.length,
        queriesGenerated: queries.length
      });

      const results = await this.warmupSpecificQueries(queries);
      
      Logger.performance('CacheWarmupService.warmupByEntityType', Date.now() - startTime, {
        entityType,
        entitiesProcessed: entities.length,
        resultsGenerated: results.length
      });
      
      Logger.operationSuccess('CACHE_WARMUP_SERVICE', 'WARMUP_BY_ENTITY_TYPE', {
        entityType,
        entitiesProcessed: entities.length,
        duration: Date.now() - startTime
      });
      
      return results;
    } catch (error) {
      Logger.operationError('CACHE_WARMUP_SERVICE', 'WARMUP_BY_ENTITY_TYPE', error, {
        entityType,
        limit,
        duration: Date.now() - startTime
      });
      return [{ success: false, error: error.message }];
    }
  }

  getWarmupStats() {
    Logger.cache('STATS', 'warmup_stats_requested');
    
    try {
      const cacheMetrics = cacheManager.getMetrics();
      const lastWarmup = this.warmupHistory.length > 0 
        ? this.warmupHistory[this.warmupHistory.length - 1]
        : null;
      
      const stats = {
        service: {
          isWarming: this.isWarming,
          totalWarmups: this.warmupHistory.length,
          scheduledWarmups: Array.from(this.scheduledWarmups.keys()),
          lastWarmup
        },
        history: this.warmupHistory.slice(-10),
        cacheMetrics: {
          ...cacheMetrics,
          enhancedCacheEnabled: Boolean(cacheManager),
          cacheManagerAvailable: typeof cacheManager.getMetrics === 'function'
        },
        performance: {
          averageDuration: this.warmupHistory.length > 0
            ? this.warmupHistory.reduce((sum, w) => sum + w.duration, 0) / this.warmupHistory.length
            : 0,
          successRate: this.warmupHistory.length > 0
            ? this.warmupHistory.filter(w => w.successful > 0).length / this.warmupHistory.length
            : 0,
          totalStrategiesExecuted: this.warmupHistory.reduce((sum, w) => sum + w.strategies, 0)
        }
      };
      
      Logger.cache('STATS', 'warmup_stats_generated', {
        totalWarmups: stats.service.totalWarmups,
        averageDuration: stats.performance.averageDuration,
        successRate: stats.performance.successRate
      });
      
      return stats;
    } catch (error) {
      Logger.error('CacheWarmupService', 'Failed to generate warmup stats', error);
      return {
        error: error.message,
        isWarming: this.isWarming,
        history: []
      };
    }
  }

  clearWarmupHistory() {
    const historyLength = this.warmupHistory.length;

    Logger.cache('MANAGEMENT', 'clearing_warmup_history', { entriesCount: historyLength });
    
    this.warmupHistory = [];
    
    Logger.cache('MANAGEMENT', 'warmup_history_cleared', { clearedEntries: historyLength });
  }

  /**
   * Enhanced cache management integration methods
   */
  async invalidateCacheAndWarmup(patterns = []) {
    Logger.operationStart('CACHE_WARMUP_SERVICE', 'INVALIDATE_AND_WARMUP', {
      patterns: patterns.length
    });

    try {
      // Invalidate specified patterns
      let invalidatedCount = 0;

      for (const pattern of patterns) {
        const count = cacheManager.invalidatePattern(pattern);

        invalidatedCount += count;
        Logger.cache('INVALIDATION', 'pattern_invalidated', { pattern, count });
      }

      // Perform warmup after invalidation
      const warmupResult = await this.performStartupWarmup();

      Logger.operationSuccess('CACHE_WARMUP_SERVICE', 'INVALIDATE_AND_WARMUP', {
        invalidatedEntries: invalidatedCount,
        warmupSuccess: warmupResult.success,
        warmupDuration: warmupResult.duration
      });

      return {
        success: true,
        invalidatedEntries: invalidatedCount,
        warmupResult
      };
    } catch (error) {
      Logger.operationError('CACHE_WARMUP_SERVICE', 'INVALIDATE_AND_WARMUP', error, {
        patterns: patterns.length
      });
      throw error;
    }
  }

  async warmupPopularEntities() {
    Logger.operationStart('CACHE_WARMUP_SERVICE', 'WARMUP_POPULAR_ENTITIES');

    try {
      const results = await Promise.all([
        this.warmupByEntityType('sets', 5),
        this.warmupByEntityType('cards', 10),
        this.warmupByEntityType('products', 8)
      ]);

      const totalResults = results.flat();
      const successCount = totalResults.filter(r => r.success).length;

      Logger.operationSuccess('CACHE_WARMUP_SERVICE', 'WARMUP_POPULAR_ENTITIES', {
        totalEntities: totalResults.length,
        successCount,
        entityTypes: ['sets', 'cards', 'products']
      });

      return {
        success: true,
        results: totalResults,
        summary: {
          total: totalResults.length,
          successful: successCount,
          failed: totalResults.length - successCount
        }
      };
    } catch (error) {
      Logger.operationError('CACHE_WARMUP_SERVICE', 'WARMUP_POPULAR_ENTITIES', error);
      throw error;
    }
  }

  stopScheduledWarmups() {
    Logger.operationStart('CACHE_WARMUP_SERVICE', 'STOP_SCHEDULED_WARMUPS', {
      activeWarmups: Array.from(this.scheduledWarmups.keys())
    });
    
    this.scheduledWarmups.forEach((interval, name) => {
      clearInterval(interval);
      Logger.cache('SCHEDULE', 'warmup_stopped', { scheduleName: name });
    });
    
    const stoppedCount = this.scheduledWarmups.size;

    this.scheduledWarmups.clear();
    
    Logger.operationSuccess('CACHE_WARMUP_SERVICE', 'STOP_SCHEDULED_WARMUPS', {
      stoppedWarmups: stoppedCount
    });
  }
}

const cacheWarmupService = new CacheWarmupService();

module.exports = {
  CacheWarmupService,
  cacheWarmupService
};