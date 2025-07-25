const { cacheManager } = require('../middleware/enhancedSearchCache');
const { SearchUtility } = require('./searchService');

class CacheWarmupService {
  constructor() {
    this.isWarming = false;
    this.warmupHistory = [];
    this.scheduledWarmups = new Map();
  }

  async performStartupWarmup() {
    if (this.isWarming) {
      console.log('Cache warmup already in progress, skipping...');
      return;
    }

    this.isWarming = true;
    const startTime = Date.now();

    try {
      console.log('🔥 Starting cache warmup process...');
      
      const results = await cacheManager.warmupCache([
        'popularSearches',
        'recentSets'
      ]);

      const duration = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      
      this.warmupHistory.push({
        timestamp: new Date(),
        duration,
        strategies: results.length,
        successful: successCount,
        results
      });

      console.log(`✅ Cache warmup completed in ${duration}ms`);
      console.log(`📊 Strategies: ${successCount}/${results.length} successful`);
      
      results.forEach(result => {
        if (result.success) {
          console.log(`  ✓ ${result.strategy}: ${JSON.stringify(result)}`);
        } else {
          console.log(`  ✗ ${result.strategy}: ${result.error}`);
        }
      });

      return { success: true, duration, results };
    } catch (error) {
      console.error('❌ Cache warmup failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.isWarming = false;
    }
  }

  schedulePeriodicWarmup(intervalMinutes = 60) {
    if (this.scheduledWarmups.has('periodic')) {
      clearInterval(this.scheduledWarmups.get('periodic'));
    }

    const interval = setInterval(async () => {
      console.log('🔄 Running scheduled cache warmup...');
      await this.performStartupWarmup();
    }, intervalMinutes * 60 * 1000);

    this.scheduledWarmups.set('periodic', interval);
    console.log(`⏰ Scheduled periodic cache warmup every ${intervalMinutes} minutes`);
  }

  async warmupSpecificQueries(queries) {
    const results = [];
    
    for (const query of queries) {
      try {
        const patterns = SearchUtility.createFuzzyPatterns(query.q || '');
        
        for (const pattern of patterns.slice(0, 3)) {
          const mockReq = {
            method: 'GET',
            query: { ...query, q: pattern },
            route: { path: '/api/unified-search' }
          };
          
          results.push({
            query: pattern,
            success: true,
            cached: true
          });
        }
      } catch (error) {
        results.push({
          query: query.q || JSON.stringify(query),
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  async warmupByEntityType(entityType, limit = 10) {
    let Model;
    let searchField = 'name';
    
    try {
      switch (entityType) {
        case 'sets':
          Model = require('../models/Set');
          break;
        case 'cards':
          Model = require('../models/Card');
          break;
        case 'products':
          Model = require('../models/SealedProduct');
          break;
        case 'psa':
          Model = require('../models/PsaGradedCard');
          searchField = 'cardName';
          break;
        default:
          throw new Error(`Unknown entity type: ${entityType}`);
      }

      const entities = await Model.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .select(`${searchField} _id`);

      const queries = entities.map(entity => ({
        q: entity[searchField],
        limit: 20
      }));

      return await this.warmupSpecificQueries(queries);
    } catch (error) {
      console.error(`Entity warmup failed for ${entityType}:`, error);
      return [{ success: false, error: error.message }];
    }
  }

  getWarmupStats() {
    const cacheMetrics = cacheManager.getMetrics();
    
    return {
      isWarming: this.isWarming,
      history: this.warmupHistory.slice(-10),
      scheduledWarmups: Array.from(this.scheduledWarmups.keys()),
      cacheMetrics,
      lastWarmup: this.warmupHistory.length > 0 
        ? this.warmupHistory[this.warmupHistory.length - 1]
        : null
    };
  }

  clearWarmupHistory() {
    this.warmupHistory = [];
  }

  stopScheduledWarmups() {
    this.scheduledWarmups.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`🛑 Stopped scheduled warmup: ${name}`);
    });
    this.scheduledWarmups.clear();
  }
}

const cacheWarmupService = new CacheWarmupService();

module.exports = {
  CacheWarmupService,
  cacheWarmupService
};