/**
 * Cache Presets for different types of data
 */

export const cachePresets = {
  search: {
    ttl: 300000, // 5 minutes
    maxSize: 1000
  },
  
  entities: {
    ttl: 600000, // 10 minutes
    maxSize: 500
  },
  
  metadata: {
    ttl: 3600000, // 1 hour
    maxSize: 100
  },
  
  short: {
    ttl: 60000, // 1 minute
    maxSize: 100
  },
  
  medium: {
    ttl: 300000, // 5 minutes
    maxSize: 500
  },
  
  long: {
    ttl: 1800000, // 30 minutes
    maxSize: 200
  }
};

export const createCachePreset = (ttl, maxSize) => ({ ttl, maxSize });

export const createCollectionCache = (entityType) => {
  switch (entityType) {
    case 'card':
      return cachePresets.entities;
    case 'set':
      return cachePresets.long;
    case 'product':
      return cachePresets.medium;
    default:
      return cachePresets.short;
  }
};

export const CACHE_TTL = {
  SHORT: 60000,
  MEDIUM: 300000,
  LONG: 1800000
};

export default cachePresets;