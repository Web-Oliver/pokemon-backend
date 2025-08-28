import { cacheWarmupService } from '@/search/middleware/cacheWarmupService.js';
import { cacheManager } from '@/search/middleware/searchCache.js';
const initializeCacheSystem = async () => {

  try {

    cacheManager.addInvalidationPattern('/api/cards', ['search']);
    cacheManager.addInvalidationPattern('/api/sets', ['search']);
    cacheManager.addInvalidationPattern('/api/set-products', ['search']);
    cacheManager.addInvalidationPattern('/api/products', ['search']);
    cacheManager.addInvalidationPattern('/api/sealed-products', ['search']);
    cacheManager.addInvalidationPattern('/api/psa-graded-cards', ['search']);
    cacheManager.addInvalidationPattern('/api/unified-search', ['search']);

    cacheWarmupService.schedulePeriodicWarmup(120);

    const warmupResult = await cacheWarmupService.performStartupWarmup();

    if (warmupResult.success) {
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

  try {
    cacheWarmupService.stopScheduledWarmups();
    cacheManager.clearAllCaches();

  } catch (error) {
    console.error('❌ Cache system shutdown failed:', error);
  }
};

export {
  initializeCacheSystem,
  shutdownCacheSystem
};
export default initializeCacheSystem; ;
