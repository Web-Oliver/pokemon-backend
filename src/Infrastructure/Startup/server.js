// src/Infrastructure/Startup/server.js


import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath   } from 'url';
// Use the ES module syntax for dotenv
import 'dotenv/config.js';

// Define __dirname and __filename for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import all dependencies using the @ alias
import connectDB from '@/Infrastructure/Configuration/db.js';
import errorHandler from '@/Presentation/Middleware/errorHandler.js';
import { compressionMiddleware, setCacheHeaders   } from '@/Presentation/Middleware/compression.js';
import { getCacheStats, cacheManager   } from '@/Presentation/Middleware/searchCache.js';
import { initializeCacheSystem, shutdownCacheSystem   } from '@/Infrastructure/Startup/initializeCacheSystem.js';
import { presets   } from '@/Presentation/Middleware/responseTransformer.js';
import { createVersioningMiddleware   } from '@/Presentation/Middleware/versioning.js';
import { paginationPresets   } from '@/Presentation/Middleware/pagination.js';
// Import all routes using the @ alias
import unifiedSearchRoute from '@/Presentation/Routes/unifiedSearch.js';
import collectionsRoute from '@/Presentation/Routes/collections.js';
import apiRoute from '@/Presentation/Routes/api.js';
import imagesRoute from '@/Presentation/Routes/images.js';
import setsRoute from '@/Presentation/Routes/sets.js';
import cardsRoute from '@/Presentation/Routes/cards.js';
import setProductsRoute from '@/Presentation/Routes/setProducts.js';
import activityRoutes from '@/Presentation/Routes/activityRoutes.js';
import dbaSelection from '@/Presentation/Routes/dbaSelection.js';
import productsRoute from '@/Presentation/Routes/products.js';
import cacheManagement from '@/Presentation/Routes/cacheManagement.js';
import pluginManagement from '@/Presentation/Routes/pluginManagement.js';
import ocrRoute from '@/Presentation/Routes/ocr.js';
import psaLabelsRoute from '@/Presentation/Routes/psaLabels.js';
import stitchedLabelsRoute from '@/Presentation/Routes/stitchedLabels.js';

// NEW: Import service bootstrap for dependency injection
import { bootstrapServices, shutdownServices } from '@/Infrastructure/Startup/serviceBootstrap.js';
const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// NEW: Bootstrap dependency injection system
console.log('🚀 [SERVER] Bootstrapping services...');
await bootstrapServices();

// GLOBAL DEBUG LOGGING FOR ALL REQUESTS
app.use((req, res, next) => {
  console.log(`[GLOBAL DEBUG] ${req.method} ${req.url} - Request received`);
  if (req.method === 'DELETE') {
    console.log(`[GLOBAL DEBUG DELETE] ${req.method} ${req.url} - DELETE REQUEST DETECTED`);
  }
  next();
});

// Performance middleware (applied early)
app.use(compressionMiddleware);
app.use(setCacheHeaders);

// CORS and body parsing middleware
app.use(cors());

// DEBUG: Add logging BEFORE body parsing
app.use((req, res, next) => {
  if (req.method === 'DELETE') {
    console.log(`[DEBUG BEFORE BODY PARSER] ${req.method} ${req.url} - BEFORE body parsing`);
  }
  next();
});

app.use(express.json({ limit: '10mb' })); // Reduced from 200mb
app.use(express.urlencoded({ limit: '10mb', extended: true, parameterLimit: 1000 })); // Reduced limits

// DEBUG: Add logging AFTER body parsing
app.use((req, res, next) => {
  if (req.method === 'DELETE') {
    console.log(`[DEBUG AFTER BODY PARSER] ${req.method} ${req.url} - AFTER body parsing`);
  }
  next();
});

// Pagination middleware for API routes
app.use('/api', paginationPresets.api);

// DEBUG MIDDLEWARE FOR DELETE REQUESTS
app.use('/api', (req, res, next) => {
  if (req.method === 'DELETE') {
    console.log(`[DEBUG DELETE] ${req.method} ${req.path} - Before presets.api middleware`);
    console.log(`[DEBUG DELETE] Full URL: ${req.originalUrl}`);
  }
  next();
});

// Response transformation middleware with RFC 7807 support
app.use('/api', presets.api);

// Serve static files (images) - SINGLE STANDARDIZED LOCATION
const uploadsPath = path.join(__dirname, '../../../uploads');

console.log('📁 [SERVER] Serving uploads from standardized location:', uploadsPath);

// Collection images: /uploads/collection/
app.use('/uploads', express.static(path.join(uploadsPath, 'collection')));

// OCR images: /uploads/ocr/
app.use('/uploads/ocr', express.static(path.join(uploadsPath, 'ocr')));

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
app.use('/api/ocr', ocrRoute);
app.use('/api/psa-labels', psaLabelsRoute);
app.use('/api/stitched-labels', stitchedLabelsRoute);

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
