const compression = require('compression');
const zlib = require('zlib');

// Enhanced compression middleware with optimized settings
const compressionMiddleware = compression({
  // Only compress responses above 1kb
  threshold: 1024,

  // Compression level (1-9, where 6 is good balance of speed/compression)
  level: 6,

  // Memory level (1-9, where 8 is default)
  memLevel: 8,

  // Compression strategy
  strategy: zlib.constants.Z_DEFAULT_STRATEGY,

  // Filter function to determine what to compress
  filter: (req, res) => {
    // Don't compress if the request includes a cache-control header
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress images and other binary files
    const contentType = res.getHeader('content-type');

    if (contentType) {
      const type = contentType.split(';')[0].toLowerCase();
      const binaryTypes = [
        'image/',
        'video/',
        'audio/',
        'application/octet-stream',
        'application/pdf',
        'application/zip',
        'application/gzip',
      ];

      if (binaryTypes.some((binaryType) => type.startsWith(binaryType))) {
        return false;
      }
    }

    // Compress text-based responses
    return compression.filter(req, res);
  },
});

// Middleware for setting cache headers for static content
const setCacheHeaders = (req, res, next) => {
  // Set cache headers for API responses
  if (req.url.includes('/api/')) {
    // NO CACHE for auction operations that modify data
    if (req.url.includes('/auctions') && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    }
    // NO CACHE for auction data to ensure real-time updates
    else if (req.url.includes('/auctions')) {
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    }
    // Short cache for search results only
    else if (req.url.includes('/search')) {
      res.set({
        'Cache-Control': 'public, max-age=60', // 1 minute
        'Vary': 'Accept-Encoding',
      });
    }
    // Moderate cache for other less dynamic data
    else {
      res.set({
        'Cache-Control': 'public, max-age=300', // 5 minutes
        'Vary': 'Accept-Encoding',
      });
    }
  }

  next();
};

module.exports = {
  compressionMiddleware,
  setCacheHeaders,
};
