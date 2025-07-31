const { cacheWarmupService } = require('../services/cacheWarmupService');
const { cacheManager } = require('../middleware/searchCache');

const initializeCacheSystem = async () => {
  console.log('🚀 Initializing enhanced cache system...');
  
  try {
    console.log('📋 Registering cache invalidation patterns...');
    
    cacheManager.addInvalidationPattern('/api/cards', ['search']);
    cacheManager.addInvalidationPattern('/api/sets', ['search']);
    cacheManager.addInvalidationPattern('/api/sealed-products', ['search']);
    cacheManager.addInvalidationPattern('/api/psa-graded-cards', ['search']);
    cacheManager.addInvalidationPattern('/api/unified-search', ['search']);
    
    console.log('⏰ Setting up periodic cache warmup...');
    cacheWarmupService.schedulePeriodicWarmup(120);
    
    console.log('🔥 Performing initial cache warmup...');
    const warmupResult = await cacheWarmupService.performStartupWarmup();
    
    if (warmupResult.success) {
      console.log('✅ Cache system initialization completed successfully');
      console.log(`📊 Cache metrics:`, cacheManager.getMetrics());
    } else {
      console.warn('⚠️ Cache system initialized with warnings:', warmupResult.error);
    }
    
    return warmupResult;
  } catch (error) {
    console.error('❌ Cache system initialization failed:', error);
    return { success: false, error: error.message };
  }
};

const shutdownCacheSystem = () => {
  console.log('🛑 Shutting down cache system...');
  
  try {
    cacheWarmupService.stopScheduledWarmups();
    cacheManager.clearAllCaches();
    
    console.log('✅ Cache system shutdown completed');
  } catch (error) {
    console.error('❌ Cache system shutdown failed:', error);
  }
};

module.exports = {
  initializeCacheSystem,
  shutdownCacheSystem
};