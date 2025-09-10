/**
 * API Endpoints Configuration
 * 
 * Static configuration file containing all available API endpoints.
 * Used by StatusController to display hardcoded endpoint information.
 * 
 * This file is completely standalone - no database connections,
 * no dynamic queries, just static endpoint documentation.
 */

export const API_ENDPOINTS = {
  status: {
    "GET /api/status": "System status and API endpoint information",
    "GET /api/endpoints": "List all endpoints",
    "GET /api/endpoints/summary": "Endpoint summary",
    "GET /api/endpoints/openapi": "OpenAPI specification",
    "GET /api/endpoints/category/:categoryName": "Endpoints by category",
    "DELETE /api/endpoints/cache": "Clear endpoint cache"
  },

  health: {
    "GET /api/health": "Comprehensive system health check with dependency status",
    "GET /api/health/detailed": "Detailed health information for monitoring systems",
    "GET /api/health/ready": "Readiness probe - checks if service is ready to accept traffic",
    "GET /api/health/live": "Liveness probe - checks if service is alive and responsive"
  },
  
  search: {
    "GET /api/search": "Unified search across all entities",
    "GET /api/search/suggest": "Search suggestions and autocomplete",
    "GET /api/search/cards": "Search Pokemon cards",
    "GET /api/search/products": "Search Pokemon products",
    "GET /api/search/sets": "Search Pokemon sets",
    "GET /api/search/set-products": "Search set products",
    "GET /api/search/stats": "Search statistics and metrics"
  },
  
  cards: {
    "GET /api/cards": "Get all Pokemon cards with pagination",
    "GET /api/cards/metrics": "Card collection metrics and statistics",
    "GET /api/cards/:id": "Get specific card by ID"
  },
  
  sets: {
    "GET /api/sets": "Get all Pokemon sets with pagination",
    "GET /api/sets/:setId/cards": "Get all cards in a specific set",
    "GET /api/sets/:id": "Get specific set by ID"
  },
  
  products: {
    "GET /api/products": "Get all Pokemon products with pagination",
    "GET /api/products/:id": "Get specific product by ID",
    "GET /api/products/set-names": "Get all available product set names",
    "GET /api/products/search": "Search products with filters",
    "GET /api/products/categories": "Get all product categories",
    "GET /api/products/categories/:category": "Get products by category"
  },
  
  setProducts: {
    "GET /api/set-products": "Get set products with pagination",
    "GET /api/set-products/search": "Search set products with filters",
    "GET /api/set-products/stats": "Set product statistics",
    "GET /api/set-products/with-counts": "Set products with item counts",
    "GET /api/set-products/name/:name": "Get set product by name",
    "GET /api/set-products/:id": "Get specific set product by ID",
    "GET /api/set-products/:id/products": "Get products within a set product"
  },
  
  collection: {
    "GET /api/collections/:type": "Get collection items by type (cards, products, etc.)",
    "GET /api/collections/:type/:id": "Get specific collection item by ID",
    "POST /api/collections/:type": "Create new collection item",
    "PUT /api/collections/:type/:id": "Update collection item (full replace)",
    "PATCH /api/collections/:type/:id": "Update collection item (partial)",
    "DELETE /api/collections/:type/:id": "Delete collection item",
    "POST /api/collections/social-exports": "Export collection for social media",
    "POST /api/collections/:type/exports": "Export collection data",
    "GET /api/collections/exports/:exportId": "Get export status and download"
  },
  
  activities: {
    "GET /api/activities": "Get activity history with filters",
    "GET /api/activities/stats": "Activity statistics and metrics",
    "GET /api/activities/types": "Available activity types",
    "GET /api/activities/recent": "Get recent activities",
    "GET /api/activities/entity/:entityType/:entityId": "Get activities for specific entity",
    "GET /api/activities/search": "Search activities",
    "GET /api/activities/:id": "Get specific activity by ID",
    "POST /api/activities": "Create new activity entry",
    "PATCH /api/activities/:id/read": "Mark activity as read",
    "PUT /api/activities/:id/read": "Update activity read status",
    "DELETE /api/activities/:id": "Delete activity",
    "POST /api/activities/generate-historical": "Generate historical activity data"
  },
  
  icr: {
    "POST /api/icr/upload": "Upload images for OCR processing",
    "POST /api/icr/extract-labels": "Extract PSA labels from images",
    "POST /api/icr/stitch": "Stitch multiple card images together",
    "POST /api/icr/ocr": "Perform OCR text extraction",
    "POST /api/icr/distribute": "Distribute OCR results to individual cards",
    "POST /api/icr/match": "Match extracted text to card database",
    "GET /api/icr/scans/:id": "Get specific scan batch by ID",
    "GET /api/icr/scans": "Get all scan batches",
    "GET /api/icr/stitched": "Get stitched image results",
    "POST /api/icr/sync-statuses": "Sync scan processing statuses",
    "GET /api/icr/status": "Get ICR system status",
    "POST /api/icr/status/check": "Check processing status of batch",
    "GET /api/icr/images/full/:filename": "Get full resolution image",
    "GET /api/icr/images/labels/:filename": "Get extracted label image",
    "GET /api/icr/images/stitched/:filename": "Get stitched image file",
    "DELETE /api/icr/scans": "Delete scan batch data",
    "DELETE /api/icr/stitched/:id": "Delete stitched image",
    "PUT /api/icr/batch/:scanId/select-match": "Select best card match for scan",
    "POST /api/icr/create-psa": "Create PSA graded card from OCR result"
  },
  
  auctions: {
    "GET /api/auctions": "Get all auctions with pagination",
    "GET /api/auctions/:id": "Get specific auction by ID",
    "POST /api/auctions": "Create new auction",
    "PUT /api/auctions/:id": "Update auction (full replace)",
    "PATCH /api/auctions/:id": "Update auction (partial)",
    "DELETE /api/auctions/:id": "Delete auction",
    "POST /api/auctions/:id/items": "Add item to auction",
    "DELETE /api/auctions/:id/items/:itemId": "Remove item from auction",
    "PATCH /api/auctions/:id/items/:itemId": "Mark auction item as sold"
  },
  
  sales: {
    "GET /api/sales": "Get sales data with filters",
    "GET /api/sales/summary": "Get sales summary statistics",
    "GET /api/sales/graph-data": "Get sales data for charts and graphs"
  },
  
  marketplace: {
    "GET /api/dba-selection": "Get DBA marketplace selections",
    "POST /api/dba-selection": "Add items to DBA selection",
    "DELETE /api/dba-selection": "Remove items from DBA selection",
    "GET /api/dba-selection/stats": "DBA selection statistics",
    "GET /api/dba-selection/:itemType/:itemId": "Get DBA selection for specific item",
    "PUT /api/dba-selection/:itemType/:itemId/notes": "Update DBA selection notes",
    "POST /api/dba/posts": "Post items to DBA marketplace",
  },
  
  uploads: {
    "POST /api/upload/image": "Upload single image file",
    "POST /api/upload/images": "Upload multiple image files",
    "DELETE /api/upload/cleanup": "Cleanup uploaded images",
    "DELETE /api/upload/cleanup-all": "Cleanup all orphaned image files"
  },
  
  workflow: {
  },
  
  management: {
    "GET /api/cache/stats": "Get cache statistics and metrics",
  }
};

/**
 * API Categories for organization
 */
export const API_CATEGORIES = {
  core: ['status', 'health', 'search'],
  pokemon: ['cards', 'sets', 'products', 'setProducts'],
  collection: ['collection', 'activities'],
  processing: ['icr', 'workflow'],
  marketplace: ['auctions', 'sales', 'marketplace'],
  system: ['uploads', 'management']
};

/**
 * System information that doesn't require database access
 */
export const SYSTEM_INFO = {
  name: "Pokemon Collection Backend API",
  version: "1.0.0",
  description: "Enterprise-grade Pokemon card collection management system",
  features: [
    "Pokemon card and set management",
    "OCR processing for PSA graded cards", 
    "Multi-engine search capabilities",
    "Marketplace integrations (DBA, Facebook)",
    "Collection activity tracking",
    "Auction management",
    "Image processing and upload handling",
    "Advanced caching system",
  ],
  architecture: {
    framework: "Express.js",
    database: "MongoDB",
    search: "FlexSearch + FuseJS + MongoDB",
    ocr: "Google Vision API",
    caching: "Multi-layer (FlexSearch + Node-cache)",
    patterns: ["Repository Pattern", "Dependency Injection", "Domain-Driven Design"]
  }
};

export default {
  API_ENDPOINTS,
  API_CATEGORIES, 
  SYSTEM_INFO
};