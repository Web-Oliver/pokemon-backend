const express = require('express');
const cors = require('cors');
const path = require('path');

require('dotenv').config();

const connectDB = require('./config/db');
const { errorHandler } = require('./utils/errorHandler');
const { compressionMiddleware, setCacheHeaders } = require('./middleware/compression');
const { getCacheStats } = require('./middleware/searchCache');

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

// Serve static files (images)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/status', require('./routes/status'));
app.use('/api/search', require('./routes/unifiedSearch')); // New unified search architecture
app.use('/api/search-legacy', require('./routes/hierarchicalSearch')); // Legacy hierarchical search (for backward compatibility)
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
app.use('/api', require('./routes/externalListing'));

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Server Running' });
});

// Health check endpoint with performance metrics
app.get('/api/health', (req, res) => {
  const cacheStats = getCacheStats();

  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    cache: {
      hitRate: Math.round(cacheStats.hitRate * 100) / 100,
      totalKeys: cacheStats.keys,
      hits: cacheStats.hits,
      misses: cacheStats.misses,
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
    },
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
