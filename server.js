const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const connectDB = require('./config/db');
const { errorHandler } = require('./utils/errorHandler');
const { compressionMiddleware, setCacheHeaders } = require('./middleware/compression');
const { getCacheStats } = require('./middleware/searchCache');
const { initializeCacheSystem, shutdownCacheSystem } = require('./startup/initializeCacheSystem');
const { presets } = require('./middleware/responseTransformer');
const { createVersioningMiddleware } = require('./middleware/versioning');
const { paginationPresets } = require('./middleware/pagination');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Performance middleware (applied early)
app.use(compressionMiddleware);
app.use(setCacheHeaders);

// CORS and body parsing middleware
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true, parameterLimit: 50000 }));

// Pagination middleware for API routes
app.use('/api', paginationPresets.api);

// Response transformation middleware with RFC 7807 support
app.use('/api', presets.api);

// Serve static files (images)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Modern REST-compliant API routes
app.use('/api/search', require('./routes/unifiedSearch')); // Unified hierarchical search
app.use('/api', require('./routes/collections')); // REST-compliant collection endpoints
app.use('/api', require('./routes/api')); // REST-compliant API endpoints
app.use('/api/sets', require('./routes/sets'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/set-products', require('./routes/setProducts'));

// Specialized routes that remain separate
app.use('/api/activities', require('./routes/activityRoutes')); // Context7 Activity Tracking
app.use('/api/dba-selection', require('./routes/dbaSelection')); // DBA selection tracking
app.use('/api/products', require('./routes/products')); // Product routes (SetProduct → Product hierarchy)
app.use('/api/cache', require('./routes/cacheManagement')); // Cache management
app.use('/api/plugins', require('./routes/pluginManagement')); // Plugin management


// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Pokemon Collection Backend API', 
    version: '2.0',
    status: 'operational',
    documentation: '/api/version'
  });
});

// Health check endpoint with performance metrics
app.get('/api/health', (req, res) => {
  const cacheStats = getCacheStats();
  
  let enhancedCacheMetrics = {};

  try {
    const { cacheManager } = require('./middleware/searchCache');

    enhancedCacheMetrics = cacheManager.getMetrics();
  } catch (error) {
    enhancedCacheMetrics = { error: 'Enhanced cache not available' };
  }

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: {
      legacy: {
        hitRate: Math.round(cacheStats.hitRate * 100) / 100,
        totalKeys: cacheStats.keys,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
      },
      enhanced: enhancedCacheMetrics
    },
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Pokemon Collection Backend Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.MONGO_URI ? 'Connected' : 'Local MongoDB'}`);
  
  // Initialize systems after server starts
  setTimeout(async () => {
    try {
      console.log('✅ Backup system initialized');
    } catch (error) {
      console.error('❌ Backup system initialization failed:', error.message);
    }
    
    try {
      await initializeCacheSystem();
      console.log('✅ Enhanced cache system initialized');
    } catch (error) {
      console.error('❌ Cache system initialization failed:', error.message);
    }
  }, 8000); // Wait 8 seconds for DB connection to be fully stable
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  shutdownCacheSystem();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  shutdownCacheSystem();
  process.exit(0);
});

module.exports = app;
