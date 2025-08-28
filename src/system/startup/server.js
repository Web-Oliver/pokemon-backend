// src/Infrastructure/Startup/server.js

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
// Use the ES module syntax for dotenv
import 'dotenv/config.js';

// Define __dirname and __filename for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import all dependencies using the @ alias
import connectDB from '@/system/database/db.js';
import { enhancedErrorMiddleware } from '@/system/middleware/CentralizedErrorHandler.js';
import { compressionMiddleware, setCacheHeaders } from '@/system/middleware/compression.js';
import { getCacheStats, cacheManager } from '@/search/middleware/searchCache.js';
import { initializeCacheSystem, shutdownCacheSystem } from '@/system/cache/initializeCacheSystem.js';
// REMOVED: Legacy response transformer - unified response formatter used instead
import { createVersioningMiddleware } from '@/system/middleware/versioning.js';
import { paginationPresets } from '@/system/middleware/pagination.js';
// NEW: Unified response formatting
import { responseFormatter } from '@/system/middleware/responseFormatter.js';
// Import all routes using the @ alias
import unifiedSearchRoute from '@/search/routes/unifiedSearch.js';
import collectionsRoute from '@/collection/items/collections.js';
import apiRoute from '@/system/routing/api.js';
import imagesRoute from '@/uploads/images/index.js';
import setsRoute from '@/pokemon/sets/sets.js';
import cardsRoute from '@/pokemon/cards/cards.js';
import setProductsRoute from '@/pokemon/products/setProducts.js';
import activityRoutes from '@/collection/activities/index.js';
import dbaSelection from '@/marketplace/dba/dbaSelection.js';
import productsRoute from '@/pokemon/products/products.js';
import cacheManagement from '@/system/management/cacheManagement.js';
import pluginManagement from '@/system/management/pluginManagement.js';
// NEW: Import service bootstrap for dependency injection
import { bootstrapServices, shutdownServices } from '@/system/startup/serviceBootstrap.js';

// Connect to MongoDB
connectDB();

// NEW: Bootstrap dependency injection system BEFORE importing routes
console.log('🚀 [SERVER] Bootstrapping services...');
await bootstrapServices();

// Import ICR routes AFTER services are bootstrapped
const { default: icrBatchRoute } = await import('@/icr/routes/icrBatch.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Simple request logging (production-safe)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// Performance middleware (applied early)
app.use(compressionMiddleware);
app.use(setCacheHeaders);

// CORS and body parsing middleware
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true, parameterLimit: 1000 }));

// Pagination middleware for API routes
app.use('/api', paginationPresets.api);

// Request ID and tracking middleware
app.use('/api', (req, res, next) => {
  req.requestId = Date.now() + Math.random().toString(36).substr(2, 9);
  next();
});

// NEW: Unified response formatting middleware (applies to all API routes)
app.use('/api', responseFormatter({
  version: '2.0',
  includeProcessingTime: true,
  includeMetrics: process.env.NODE_ENV !== 'production'
}));

// REMOVED: Legacy response transformer - causes conflicts with unified response formatter

// Serve static files (images) - SINGLE STANDARDIZED LOCATION
const uploadsPath = path.join(__dirname, '../../../uploads');

console.log('📁 [SERVER] Serving uploads from standardized location:', uploadsPath);

// Collection images: /uploads/collection/
app.use('/uploads', express.static(path.join(uploadsPath, 'collection')));

// ICR images: /uploads/icr/ with organized subdirectories
app.use('/uploads/icr', express.static(path.join(uploadsPath, 'icr')));

// Modern REST-compliant API routes
app.use('/api/search', unifiedSearchRoute);
app.use('/api', collectionsRoute);
app.use('/api', apiRoute);
app.use('/api/images', imagesRoute);
app.use('/api/sets', setsRoute);
app.use('/api/cards', cardsRoute);
app.use('/api/set-products', setProductsRoute);

// Specialized routes that remain separate
app.use('/api/activities', activityRoutes);
app.use('/api/dba-selection', dbaSelection);
app.use('/api/products', productsRoute);
app.use('/api/cache', cacheManagement);
app.use('/api/plugins', pluginManagement);
app.use('/api/icr', icrBatchRoute);

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

// Enhanced error handling middleware (must be last)
app.use(enhancedErrorMiddleware);

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
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  shutdownCacheSystem();
  await shutdownServices(); // NEW: Cleanup DI services
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  shutdownCacheSystem();
  await shutdownServices(); // NEW: Cleanup DI services
  process.exit(0);
});
