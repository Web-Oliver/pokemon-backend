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
 * Standard cache TTL presets
 */
const CACHE_TTL = {
  VERY_SHORT: 300,   // 5 minutes - for frequently changing data
  SHORT: 480,        // 8 minutes - standard data
  MEDIUM: 600,       // 10 minutes - details/individual items
  LONG: 900,         // 15 minutes - metrics/suggestions
  VERY_LONG: 1200,   // 20 minutes - rarely changing data
  NO_CACHE: 0,       // No caching for mutations
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
 */
const cachePresets = {
  // Collection data caching
  collectionList: (entityType) => createCachePreset('list', `${entityType}-data`, CACHE_TTL.VERY_SHORT),
  collectionDetails: (entityType) => createCachePreset('details', `${entityType}-details`, CACHE_TTL.MEDIUM),
  
  // Search result caching
  search: createCachePreset('search', 'unified-search', CACHE_TTL.MEDIUM),
  searchSuggestions: createCachePreset('suggestions', 'search-suggestions', CACHE_TTL.LONG),
  searchCards: createCachePreset('card-search', 'card-search', CACHE_TTL.SHORT),
  searchProducts: createCachePreset('product-search', 'product-search', CACHE_TTL.VERY_SHORT),
  searchSets: createCachePreset('set-search', 'set-search', CACHE_TTL.VERY_LONG),
  
  // Entity-specific caching
  cardData: createCachePreset('cards', 'card-data', CACHE_TTL.SHORT),
  cardDetails: createCachePreset('card-details', 'card-details', CACHE_TTL.MEDIUM),
  cardMetrics: createCachePreset('metrics', 'card-metrics', CACHE_TTL.LONG),
  
  setData: createCachePreset('sets', 'set-data', CACHE_TTL.VERY_LONG),
  setDetails: createCachePreset('set-details', 'set-details', CACHE_TTL.VERY_LONG),
  setCards: createCachePreset('set-cards', 'set-cards', CACHE_TTL.MEDIUM),
  
  // Mutation operations (no caching)
  mutation: createCachePreset('mutation', 'no-cache', CACHE_TTL.NO_CACHE),
};

/**
 * Factory function to create collection-specific cache middleware
 * @param {string} entityType - Type of entity (e.g., 'psa-card', 'raw-card')
 * @param {string} operation - Operation type ('list', 'details', 'mutation')
 * @returns {Function} Configured cache middleware
 */
const createCollectionCache = (entityType, operation) => {
  const ttlMap = {
    list: CACHE_TTL.VERY_SHORT,
    details: CACHE_TTL.MEDIUM,
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