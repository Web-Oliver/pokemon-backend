const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const connectDB = require('./config/db');
const { errorHandler } = require('./utils/errorHandler');
const { compressionMiddleware, setCacheHeaders } = require('./middleware/compression');
const { getCacheStats } = require('./middleware/searchCache');
const { initializeBackupSystem } = require('./startup/initializeBackupSystem');
const { initializeCacheSystem, shutdownCacheSystem } = require('./startup/initializeCacheSystem');
const { presets } = require('./middleware/responseTransformer');

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

// Response transformation middleware (after body parsing, before routes)
app.use(presets.api);

// Serve static files (images)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/status', require('./routes/status'));
app.use('/api/search', require('./routes/unifiedSearch')); // Unified search architecture
app.use('/api/sets', require('./routes/sets'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/cardmarket-ref-products', require('./routes/cardMarketRefProducts'));
app.use('/api/sealed-products', require('./routes/sealedProducts'));
app.use('/api/psa-graded-cards', require('./routes/psaGradedCards'));
app.use('/api/raw-cards', require('./routes/rawCards'));
app.use('/api/sales', require('./routes/sales'));
app.use('/api/auctions', require('./routes/auctions'));
app.use('/api/activities', require('./routes/activityRoutes')); // Context7 Activity Tracking
app.use('/api/export', require('./routes/export')); // Export functionality
app.use('/api/import', require('./routes/import'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/dba-selection', require('./routes/dbaSelection')); // DBA selection tracking
app.use('/api/backup', require('./routes/backup')); // Automatic backup system
app.use('/api/cache', require('./routes/cacheManagement')); // Enhanced cache management
app.use('/api/plugins', require('./routes/pluginManagement')); // Plugin management
app.use('/api', require('./routes/externalListing'));

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Server Running' });
});

// Health check endpoint with performance metrics
app.get('/api/health', (req, res) => {
  const cacheStats = getCacheStats();
  
  let enhancedCacheMetrics = {};

  try {
    const { cacheManager } = require('./middleware/enhancedSearchCache');

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
      await initializeBackupSystem();
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
