/**
 * Cache Middleware Presets
 * 
 * Eliminates the massive duplication of searchCacheMiddleware configurations
 * across all route files. Provides standardized cache presets for common patterns.
 * 
 * Before: 15+ duplicate cache configurations across route files
 * After: Centralized presets with consistent TTL and naming
 */

const { searchCacheMiddleware } = require('./searchCache');

/**
 * Standard cache TTL presets (in seconds - aligned with frontend millisecond values)
 * Matching frontend cacheConfig.ts for consistency
 */
const CACHE_TTL = {
  // Reference data (rarely changes)
  SETS: 600,                    // 10 minutes - Set information doesn't change often
  CATEGORIES: 900,              // 15 minutes - Product categories are very stable
  
  // Collection data (moderate changes)
  COLLECTION_ITEMS: 120,        // 2 minutes - User's collection can change frequently
  PRICE_HISTORY: 300,           // 5 minutes - Price updates are moderately frequent
  
  // Search data (frequent changes)
  CARDS: 300,                   // 5 minutes - Card data updates regularly
  PRODUCTS: 300,                // 5 minutes - Product availability changes
  SEARCH_SUGGESTIONS: 180,      // 3 minutes - Suggestions can be dynamic
  
  // API optimizations
  UNIFIED_CLIENT_DEFAULT: 300,  // 5 minutes - Default for unified API client
  PREFETCH_DATA: 600,           // 10 minutes - Prefetched data can be cached longer
  
  // Short-term caching
  REQUEST_DEDUPLICATION: 30,    // 30 seconds - Prevent duplicate requests
  AUTOCOMPLETE: 60,             // 1 minute - Autocomplete suggestions
  
  // Legacy support (being phased out)
  VERY_SHORT: 120,              // 2 minutes - for frequently changing data
  SHORT: 300,                   // 5 minutes - standard data
  MEDIUM: 600,                  // 10 minutes - details/individual items
  LONG: 900,                    // 15 minutes - metrics/suggestions
  VERY_LONG: 1200,              // 20 minutes - rarely changing data
  NO_CACHE: 0,                  // No caching for mutations
};

/**
 * Create standardized cache middleware with preset configurations
 */
const createCachePreset = (type, cacheName, ttl = CACHE_TTL.MEDIUM) => searchCacheMiddleware({
    ttl,
    cacheName,
    invalidateOnMutation: true
  });

/**
 * Pre-configured cache middleware for common route patterns
 * Updated to use aligned TTL values and semantic naming
 */
const cachePresets = {
  // Collection data caching - updated to use COLLECTION_ITEMS TTL
  collectionList: (entityType) => createCachePreset('list', `${entityType}-data`, CACHE_TTL.COLLECTION_ITEMS),
  collectionDetails: (entityType) => createCachePreset('details', `${entityType}-details`, CACHE_TTL.COLLECTION_ITEMS),
  
  // Search result caching - using appropriate search TTL values
  search: createCachePreset('search', 'unified-search', CACHE_TTL.UNIFIED_CLIENT_DEFAULT),
  searchSuggestions: createCachePreset('suggestions', 'search-suggestions', CACHE_TTL.SEARCH_SUGGESTIONS),
  searchCards: createCachePreset('card-search', 'card-search', CACHE_TTL.CARDS),
  searchProducts: createCachePreset('product-search', 'product-search', CACHE_TTL.PRODUCTS),
  searchSets: createCachePreset('set-search', 'set-search', CACHE_TTL.SETS),
  
  // Entity-specific caching - using appropriate data type TTL values
  cardData: createCachePreset('cards', 'card-data', CACHE_TTL.CARDS),
  cardDetails: createCachePreset('card-details', 'card-details', CACHE_TTL.CARDS),
  cardMetrics: createCachePreset('metrics', 'card-metrics', CACHE_TTL.PREFETCH_DATA),
  
  setData: createCachePreset('sets', 'set-data', CACHE_TTL.SETS),
  setDetails: createCachePreset('set-details', 'set-details', CACHE_TTL.SETS),
  setCards: createCachePreset('set-cards', 'set-cards', CACHE_TTL.CARDS),
  
  // CardMarket caching - MISSING PRESETS ADDED
  cardMarketData: createCachePreset('cardmarket-data', 'cardmarket-data', CACHE_TTL.CATEGORIES),
  cardMarketSearch: createCachePreset('cardmarket-search', 'cardmarket-search', CACHE_TTL.PRODUCTS),
  
  // Activity caching
  activityData: createCachePreset('activity', 'activity-data', CACHE_TTL.COLLECTION_ITEMS),
  activityStats: createCachePreset('activity-stats', 'activity-stats', CACHE_TTL.PRICE_HISTORY),
  
  // Sales analytics caching
  salesData: createCachePreset('sales', 'sales-data', CACHE_TTL.PRICE_HISTORY),
  salesSummary: createCachePreset('sales-summary', 'sales-summary', CACHE_TTL.PRICE_HISTORY),
  salesGraphData: createCachePreset('sales-graph', 'sales-graph-data', CACHE_TTL.PRICE_HISTORY),
  
  // DBA selection caching
  dbaSelection: createCachePreset('dba-selection', 'dba-selection-data', CACHE_TTL.COLLECTION_ITEMS),
  
  // Mutation operations (no caching)
  mutation: createCachePreset('mutation', 'no-cache', CACHE_TTL.NO_CACHE),
};

/**
 * Factory function to create collection-specific cache middleware
 * Updated to use semantic TTL values instead of legacy VERY_SHORT/MEDIUM
 * @param {string} entityType - Type of entity (e.g., 'psa-card', 'raw-card')
 * @param {string} operation - Operation type ('list', 'details', 'mutation')
 * @returns {Function} Configured cache middleware
 */
const createCollectionCache = (entityType, operation) => {
  const ttlMap = {
    list: CACHE_TTL.COLLECTION_ITEMS,
    details: CACHE_TTL.COLLECTION_ITEMS,
    mutation: CACHE_TTL.NO_CACHE,
  };
  
  const cacheName = operation === 'list' 
    ? `${entityType}s-data` 
    : `${entityType}-${operation}`;
    
  return createCachePreset(operation, cacheName, ttlMap[operation]);
};

module.exports = {
  cachePresets,
  createCachePreset,
  createCollectionCache,
  CACHE_TTL,
};