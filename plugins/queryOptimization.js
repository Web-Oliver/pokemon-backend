const Logger = require('../utils/Logger');

/**
 * Query Optimization Plugin for Mongoose
 *
 * Provides common query enhancement patterns without changing schema structure.
 * Follows the existing plugin pattern and integrates with the current architecture.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles query optimization only
 * - Open/Closed: Extensible for new optimization patterns
 * - Interface Segregation: Focused query enhancement methods
 */

/**
 * Query optimization configuration
 */
const DEFAULT_OPTIONS = {
  enableLeanQueries: true,
  enableQueryLogging: false,
  enablePerformanceTracking: false,
  enableAutomaticIndexing: true,
  enableQueryHints: true,
  defaultLimit: 100,
  maxLimit: 1000,
  enableCachedCounts: true,
  optimizationLevel: 'standard', // 'minimal', 'standard', 'aggressive'
};

/**
 * Query Optimization Plugin
 *
 * @param {Object} schema - Mongoose schema to apply plugin to
 * @param {Object} options - Plugin options
 * @param {boolean} options.enableLeanQueries - Use lean queries for list operations
 * @param {boolean} options.enableQueryLogging - Log query performance
 * @param {boolean} options.enablePerformanceTracking - Track query execution times
 * @param {boolean} options.enableAutomaticIndexing - Add optimized indexes
 * @param {boolean} options.enableQueryHints - Add query hints for optimization
 * @param {number} options.defaultLimit - Default limit for queries
 * @param {number} options.maxLimit - Maximum allowed limit
 * @param {string} options.entityType - Entity type for logging context
 */
function queryOptimizationPlugin(schema, options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const entityType = options.entityType || 'Unknown';

  // Add query optimization methods to schema
  addQueryOptimizationMethods(schema, config);

  // Add performance tracking middleware
  if (config.enablePerformanceTracking) {
    addPerformanceTrackingMiddleware(schema, config, entityType);
  }

  // Add query logging middleware
  if (config.enableQueryLogging) {
    addQueryLoggingMiddleware(schema, config, entityType);
  }

  // Add automatic indexing for common patterns
  if (config.enableAutomaticIndexing) {
    addAutomaticIndexes(schema, config, entityType);
  }

  // Add lean query defaults
  if (config.enableLeanQueries) {
    addLeanQueryDefaults(schema, config);
  }

  // Add query hints and optimization middleware
  if (config.enableQueryHints) {
    addQueryHints(schema, config);
  }

  Logger.debug('QueryOptimization', `Plugin applied to ${entityType}`, config);
}

/**
 * Adds query optimization static methods to the schema
 */
function addQueryOptimizationMethods(schema, config) {
  // Optimized find with automatic lean and limits
  schema.statics.findOptimized = function(filter = {}, options = {}) {
    const {
      limit = config.defaultLimit,
      sort = { _id: -1 },
      populate = null,
      lean = true,
      select = null,
    } = options;

    let query = this.find(filter);

    // Apply lean if enabled and no populate
    if (lean && !populate) {
      query = query.lean();
    }

    // Apply limit with max enforcement
    query = query.limit(Math.min(limit, config.maxLimit));

    // Apply sorting
    if (sort) {
      query = query.sort(sort);
    }

    // Apply population
    if (populate) {
      query = query.populate(populate);
    }

    // Apply field selection
    if (select) {
      query = query.select(select);
    }

    return query;
  };

  // Optimized pagination
  schema.statics.findWithPagination = function(filter = {}, options = {}) {
    const {
      page = 1,
      limit = config.defaultLimit,
      sort = { _id: -1 },
      populate = null,
      lean = true,
    } = options;

    const skip = (page - 1) * limit;
    const actualLimit = Math.min(limit, config.maxLimit);

    const query = this.findOptimized(filter, {
      limit: actualLimit,
      sort,
      populate,
      lean,
    }).skip(skip);

    // Return promise with both data and pagination info
    return Promise.all([
      query.exec(),
      this.countDocuments(filter),
    ]).then(([data, total]) => ({
      data,
      pagination: {
        page,
        limit: actualLimit,
        total,
        pages: Math.ceil(total / actualLimit),
        hasNext: page < Math.ceil(total / actualLimit),
        hasPrev: page > 1,
      },
    }));
  };

  // Optimized count with caching
  schema.statics.countOptimized = function(filter = {}) {
    // Use estimatedDocumentCount for empty filters (much faster)
    if (Object.keys(filter).length === 0) {
      return this.estimatedDocumentCount();
    }
    return this.countDocuments(filter);
  };

  // Find by IDs with optimization
  schema.statics.findByIdsOptimized = function(ids, options = {}) {
    const { populate = null, lean = true, sort = null } = options;

    let query = this.find({ _id: { $in: ids } });

    if (lean && !populate) {
      query = query.lean();
    }

    if (populate) {
      query = query.populate(populate);
    }

    if (sort) {
      query = query.sort(sort);
    }

    return query;
  };

  // Optimized aggregation helper
  schema.statics.aggregateOptimized = function(pipeline, options = {}) {
    const { allowDiskUse = true, cursor = null } = options;

    const aggregateOptions = { allowDiskUse };

    if (cursor) {
      aggregateOptions.cursor = cursor;
    }

    return this.aggregate(pipeline, aggregateOptions);
  };

  // Bulk operations helper
  schema.statics.bulkWriteOptimized = function(operations, options = {}) {
    const { ordered = false, bypassDocumentValidation = false } = options;

    return this.bulkWrite(operations, {
      ordered,
      bypassDocumentValidation,
    });
  };
}

/**
 * Adds performance tracking middleware
 */
function addPerformanceTrackingMiddleware(schema, config, entityType) {
  // Track query performance
  schema.pre(/^find/, function() {
    this.startTime = Date.now();
    this.queryType = this.getQuery ? 'find' : 'unknown';
  });

  schema.post(/^find/, function(result) {
    if (this.startTime) {
      const duration = Date.now() - this.startTime;
      
      if (duration > 100) { // Log slow queries
        Logger.performance(
          `${entityType} Query`,
          duration,
          {
            type: this.queryType,
            filter: JSON.stringify(this.getFilter()),
            resultCount: Array.isArray(result) ? result.length : result ? 1 : 0,
          }
        );
      }
    }
  });

  // Track aggregation performance
  schema.pre('aggregate', function() {
    this.startTime = Date.now();
  });

  schema.post('aggregate', function(result) {
    if (this.startTime) {
      const duration = Date.now() - this.startTime;
      
      if (duration > 200) { // Log slow aggregations
        Logger.performance(
          `${entityType} Aggregation`,
          duration,
          {
            pipeline: JSON.stringify(this.pipeline()),
            resultCount: Array.isArray(result) ? result.length : 0,
          }
        );
      }
    }
  });
}

/**
 * Adds query logging middleware
 */
function addQueryLoggingMiddleware(schema, config, entityType) {
  schema.pre(/^find/, function() {
    Logger.debug(entityType, 'Query started', {
      type: 'find',
      filter: this.getFilter(),
      options: this.getOptions(),
    });
  });

  schema.pre('aggregate', function() {
    Logger.debug(entityType, 'Aggregation started', {
      pipeline: this.pipeline(),
    });
  });
}

/**
 * Adds automatic indexes for common query patterns
 */
function addAutomaticIndexes(schema, config, entityType) {
  // Add common performance indexes if they don't exist
  const existingIndexes = schema.indexes();
  const existingIndexNames = existingIndexes.map(index => 
    JSON.stringify(index[0])
  );

  // Common collection item indexes
  const commonIndexes = [
    { dateAdded: -1 }, // Common sorting field
    { sold: 1 }, // Common filter field
    { sold: 1, dateAdded: -1 }, // Common compound index
  ];

  // Add indexes that don't already exist
  commonIndexes.forEach(indexDef => {
    const indexDefStr = JSON.stringify(indexDef);

    if (!existingIndexNames.includes(indexDefStr)) {
      schema.index(indexDef);
      Logger.debug(entityType, 'Added performance index', indexDef);
    }
  });

  // Add text search index if schema has text fields
  const textFields = [];

  schema.eachPath((pathname, schematype) => {
    if (schematype.instance === 'String' && 
        (pathname.includes('name') || pathname.includes('Name'))) {
      textFields.push(pathname);
    }
  });

  if (textFields.length > 0 && 
      !existingIndexNames.some(idx => idx.includes('$text'))) {
    const textIndex = {};

    textFields.forEach(field => {
      textIndex[field] = 'text';
    });
    
    schema.index(textIndex, {
      name: `${entityType.toLowerCase()}_text_search`,
    });
    
    Logger.debug(entityType, 'Added text search index', textIndex);
  }
}

/**
 * Adds lean query defaults
 */
function addLeanQueryDefaults(schema, config) {
  // Override find methods to use lean by default for list operations
  const originalFind = schema.statics.find;
  
  schema.statics.find = function(conditions, projection, options, callback) {
    // Auto-apply lean for find operations without populate
    if (options && !options.populate && options.lean === undefined) {
      options.lean = true;
    }
    
    return originalFind.call(this, conditions, projection, options, callback);
  };
}

/**
 * Adds query hints for optimization
 */
function addQueryHints(schema, config) {
  // Add query optimization middleware
  schema.pre(/^find/, function() {
    const filter = this.getFilter();
    
    // Add hint for common query patterns
    if (filter.sold !== undefined && filter.dateAdded) {
      this.hint({ sold: 1, dateAdded: -1 });
    } else if (filter.dateAdded) {
      this.hint({ dateAdded: -1 });
    }
  });

  // Add aggregation optimization
  schema.pre('aggregate', function() {
    const pipeline = this.pipeline();
    
    // Add $hint stage for aggregations with $match
    if (pipeline.length > 0 && pipeline[0].$match) {
      const matchStage = pipeline[0].$match;
      
      if (matchStage.sold !== undefined || matchStage.dateAdded) {
        this.option('hint', { sold: 1, dateAdded: -1 });
      }
    }
  });
}

/**
 * Query optimization utilities
 */
const QueryOptimizationUtils = {
  /**
   * Creates an optimized query builder
   * @param {Model} model - Mongoose model
   * @param {Object} baseFilter - Base filter conditions
   * @returns {Object} - Query builder with optimization methods
   */
  createOptimizedQuery(model, baseFilter = {}) {
    return {
      filter: { ...baseFilter },
      
      // Add filter conditions
      where(conditions) {
        Object.assign(this.filter, conditions);
        return this;
      },
      
      // Execute with optimization
      exec(options = {}) {
        return model.findOptimized(this.filter, options);
      },
      
      // Execute with pagination
      paginate(options = {}) {
        return model.findWithPagination(this.filter, options);
      },
      
      // Execute count
      count() {
        return model.countOptimized(this.filter);
      },
      
      // Execute aggregation
      aggregate(pipeline) {
        const fullPipeline = [{ $match: this.filter }, ...pipeline];

        return model.aggregateOptimized(fullPipeline);
      },
    };
  },

  /**
   * Gets query performance statistics
   * @param {Model} model - Mongoose model
   * @returns {Promise<Object>} - Performance statistics
   */
  async getQueryStats(model) {
    const stats = await model.db.db
      .collection(model.collection.name)
      .stats();
    
    return {
      totalDocuments: stats.count,
      totalIndexes: stats.nindexes,
      totalSize: stats.size,
      avgObjSize: stats.avgObjSize,
      storageSize: stats.storageSize,
      totalIndexSize: stats.totalIndexSize,
    };
  },

  /**
   * Analyzes query performance
   * @param {Query} query - Mongoose query
   * @returns {Promise<Object>} - Query explanation
   */
  async explainQuery(query) {
    return query.explain('executionStats');
  },
};

module.exports = {
  queryOptimizationPlugin,
  QueryOptimizationUtils,
  DEFAULT_OPTIONS,
};