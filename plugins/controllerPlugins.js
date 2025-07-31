const Logger = require('../utils/Logger');
const { cacheManager } = require('../middleware/searchCache');

/**
 * Collection of reusable controller plugins
 * 
 * These plugins implement common cross-cutting concerns that can be
 * applied to any BaseController instance following the Open/Closed principle.
 */

/**
 * Audit Trail Plugin
 * Tracks all operations performed on entities for compliance and debugging
 */
const auditTrailPlugin = {
  beforeOperation: async (operation, data, context) => {
    const auditEntry = {
      timestamp: new Date(),
      operation,
      entityType: context.entityType || 'unknown',
      entityId: context.entityId,
      userId: context.req?.user?.id || 'anonymous',
      ipAddress: context.req?.ip,
      userAgent: context.req?.get('User-Agent'),
      requestData: operation === 'getAll' || operation === 'getById' ? null : data
    };
    
    Logger.debug('AuditTrail', `Operation ${operation} started`, auditEntry);
    context.auditEntry = auditEntry;
  },
  
  afterOperation: async (operation, result, context) => {
    if (context.auditEntry) {
      context.auditEntry.success = true;
      context.auditEntry.resultId = result?._id || result?.id;
      context.auditEntry.duration = Date.now() - context.auditEntry.timestamp.getTime();
      
      Logger.info('AuditTrail', `Operation ${operation} completed`, context.auditEntry);
    }
  },
  
  onError: async (operation, error, context) => {
    if (context.auditEntry) {
      context.auditEntry.success = false;
      context.auditEntry.error = error.message;
      context.auditEntry.duration = Date.now() - context.auditEntry.timestamp.getTime();
      
      Logger.warn('AuditTrail', `Operation ${operation} failed`, context.auditEntry);
    }
  }
};

/**
 * Rate Limiting Plugin
 * Implements basic rate limiting per IP address
 */
const rateLimitingPlugin = (() => {
  const requestCounts = new Map();
  const WINDOW_SIZE = 60000; // 1 minute
  const MAX_REQUESTS = 100;
  
  return {
    beforeOperation: async (operation, data, context) => {
      const clientIp = context.req?.ip || 'unknown';
      const now = Date.now();
      
      if (!requestCounts.has(clientIp)) {
        requestCounts.set(clientIp, []);
      }
      
      const requests = requestCounts.get(clientIp);
      
      // Remove old requests outside the window
      const validRequests = requests.filter(timestamp => now - timestamp < WINDOW_SIZE);

      requestCounts.set(clientIp, validRequests);
      
      if (validRequests.length >= MAX_REQUESTS) {
        const error = new Error('Rate limit exceeded. Please try again later.');

        error.statusCode = 429;
        throw error;
      }
      
      // Add current request
      validRequests.push(now);
      
      Logger.debug('RateLimit', `Request from ${clientIp}: ${validRequests.length}/${MAX_REQUESTS}`);
    }
  };
})();

/**
 * Data Validation Plugin
 * Provides additional validation beyond basic schema validation
 */
const dataValidationPlugin = {
  beforeOperation: async (operation, data, context) => {
    if (['create', 'update'].includes(operation)) {
      // Check for suspicious data patterns
      if (data && typeof data === 'object') {
        const dataString = JSON.stringify(data).toLowerCase();
        
        // Basic XSS detection
        const xssPatterns = ['<script', 'javascript:', 'onload=', 'onerror='];
        const hasXSS = xssPatterns.some(pattern => dataString.includes(pattern));
        
        if (hasXSS) {
          const error = new Error('Invalid data: potential security risk detected');

          error.statusCode = 400;
          throw error;
        }
        
        // Check for excessively large payloads
        if (dataString.length > 1000000) { // 1MB limit
          const error = new Error('Payload too large');

          error.statusCode = 413;
          throw error;
        }
      }
    }
  }
};

/**
 * Performance Monitoring Plugin
 * Tracks detailed performance metrics for operations
 */
const performanceMonitoringPlugin = (() => {
  const performanceMetrics = new Map();
  
  return {
    beforeOperation: async (operation, data, context) => {
      context.performanceStart = process.hrtime.bigint();
      context.memoryStart = process.memoryUsage();
    },
    
    afterOperation: async (operation, result, context) => {
      if (context.performanceStart) {
        const duration = Number(process.hrtime.bigint() - context.performanceStart) / 1000000; // Convert to ms
        const memoryEnd = process.memoryUsage();
        const memoryDelta = memoryEnd.heapUsed - context.memoryStart.heapUsed;
        
        const entityType = context.entityType || 'unknown';
        const key = `${entityType}_${operation}`;
        
        if (!performanceMetrics.has(key)) {
          performanceMetrics.set(key, {
            count: 0,
            totalDuration: 0,
            maxDuration: 0,
            minDuration: Infinity,
            totalMemoryDelta: 0
          });
        }
        
        const metrics = performanceMetrics.get(key);

        metrics.count++;
        metrics.totalDuration += duration;
        metrics.maxDuration = Math.max(metrics.maxDuration, duration);
        metrics.minDuration = Math.min(metrics.minDuration, duration);
        metrics.totalMemoryDelta += memoryDelta;
        
        Logger.debug('Performance', `${key} completed in ${duration.toFixed(2)}ms`, {
          memoryDelta: `${(memoryDelta / 1024 / 1024).toFixed(2)}MB`,
          avgDuration: `${(metrics.totalDuration / metrics.count).toFixed(2)}ms`
        });
      }
    },
    
    getMetrics: () => {
      const result = {};

      for (const [key, metrics] of performanceMetrics) {
        result[key] = {
          ...metrics,
          avgDuration: metrics.count > 0 ? metrics.totalDuration / metrics.count : 0,
          avgMemoryDelta: metrics.count > 0 ? metrics.totalMemoryDelta / metrics.count : 0
        };
      }
      return result;
    }
  };
})();

/**
 * Response Caching Plugin
 * Implements intelligent response caching for read operations
 */
const responseCachingPlugin = (() => {
  const responseCache = new Map();
  const CACHE_TTL = 300000; // 5 minutes
  
  return {
    beforeOperation: async (operation, data, context) => {
      if (['getAll', 'getById'].includes(operation)) {
        const cacheKey = `${context.entityType || 'unknown'}_${operation}_${JSON.stringify(data)}`;
        const cached = responseCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          Logger.debug('ResponseCache', `Cache hit for ${cacheKey}`);
          context.cachedResponse = cached.data;
          context.skipOperation = true;
        }
      }
    },
    
    afterOperation: async (operation, result, context) => {
      if (['getAll', 'getById'].includes(operation) && !context.skipOperation) {
        const cacheKey = `${context.entityType || 'unknown'}_${operation}_${JSON.stringify(context.operationData)}`;

        responseCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });
        
        Logger.debug('ResponseCache', `Cached response for ${cacheKey}`);
      }
    },
    
    beforeResponse: (operation, data, context) => {
      if (context.cachedResponse) {
        return {
          ...data,
          data: context.cachedResponse,
          meta: {
            ...data.meta,
            cached: true,
            cacheSource: 'response-plugin'
          }
        };
      }
      return data;
    }
  };
})();

/**
 * Error Recovery Plugin
 * Implements retry logic and graceful degradation
 */
const errorRecoveryPlugin = {
  onError: async (operation, error, context) => {
    // Implement retry logic for transient errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      if (!context.retryCount) {
        context.retryCount = 0;
      }
      
      if (context.retryCount < 3) {
        context.retryCount++;
        Logger.warn('ErrorRecovery', `Retrying ${operation} (attempt ${context.retryCount})`, {
          error: error.message,
          entityType: context.entityType
        });
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 2**context.retryCount * 1000));
        
        // Signal that the operation should be retried
        context.shouldRetry = true;
        return;
      }
    }
    
    // Log error for monitoring
    Logger.error('ErrorRecovery', `Operation ${operation} failed after retries`, {
      error: error.message,
      stack: error.stack,
      entityType: context.entityType,
      retryCount: context.retryCount || 0
    });
  }
};

module.exports = {
  auditTrailPlugin,
  rateLimitingPlugin,
  dataValidationPlugin,
  performanceMonitoringPlugin,
  responseCachingPlugin,
  errorRecoveryPlugin
};