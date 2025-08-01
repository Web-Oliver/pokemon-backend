# Pokemon Collection API Specification

## 9. Sales API System

### Base Endpoint Configuration
- **Base Path**: `/sales`
- **Resource Type**: ISale
- **Generic Operations**: Full CRUD + Export + Batch operations enabled

### Type Definitions

#### SalesDataParams
```typescript
interface SalesDataParams {
  startDate?: string;
  endDate?: string;
  category?: string;
}
```

#### SalesSummaryParams
```typescript
interface SalesSummaryParams {
  startDate?: string;
  endDate?: string;
}
```

#### SalesGraphDataParams
```typescript
interface SalesGraphDataParams {
  startDate?: string;
  endDate?: string;
}
```

#### ISaleCreatePayload
```typescript
interface ISaleCreatePayload extends Omit<ISale, 'id'> {}
```

#### ISaleUpdatePayload
```typescript
interface ISaleUpdatePayload extends Partial<ISaleCreatePayload> {}
```

### Data Transformation

#### transformSalesData Function
Transforms backend sales data to ISale interface:
- Extracts itemName based on itemType (sealedProduct, psaGradedCard, rawCard)
- Handles Decimal128 conversion for myPrice and actualSoldPrice
- Generates thumbnail URLs with -thumb suffix from first image
- Maps _id to id field
- Handles nested object properties (cardId.cardName, cardId.setId.setName, saleDetails.*)

### Available Endpoints

#### Standard CRUD Operations (via createResourceOperations)
- `GET /sales` - Get all sales
- `GET /sales/:id` - Get sale by ID
- `POST /sales` - Create new sale
- `PUT /sales/:id` - Update existing sale
- `DELETE /sales/:id` - Delete sale

#### Export Operations (via createResourceOperations)
- `GET /sales/export` - Export sales data (returns Blob)


### API Functions

#### Standard Functions
- `getSalesData(params?: SalesDataParams)` - Get sales with data transformation
- `getSaleById` - Get single sale (from generic operations)
- `createSale` - Create new sale (from generic operations)
- `updateSale` - Update existing sale (from generic operations)
- `removeSale` - Delete sale (from generic operations)
- `searchSales` - Search sales (from generic operations)
- `exportSales` - Export sales data (from generic operations)

#### Analytics Functions
- `getSalesSummary(params?: SalesSummaryParams)` - Get sales summary analytics
- `getSalesGraphData(params?: SalesGraphDataParams)` - Get time-series sales data

### Backend Requirements

#### MongoDB Model
- Collection: `sales`
- Schema: ISale interface
- Fields: _id, itemCategory, itemName, myPrice (Decimal128), actualSoldPrice (Decimal128), dateSold, source, thumbnailUrl
- Nested references: cardId (Card), setId (Set), saleDetails object

#### Endpoints Implementation Needed
```bash
GET /sales - Get sales with optional filters (startDate, endDate, category)
GET /sales/:id - Single sale by ID
POST /sales - Create new sale
PUT /sales/:id - Update sale
DELETE /sales/:id - Delete sale
POST /sales/bulk - Bulk create sales
POST /sales/batch - Batch operations
GET /sales/export - Export functionality
GET /sales/summary - Sales summary analytics
```

#### Data Processing Requirements
- Decimal128 handling for monetary values (myPrice, actualSoldPrice)
- Item type differentiation (sealedProduct, psaGradedCard, rawCard)
- Nested object population (cardId with setId)
- Image thumbnail generation with -thumb suffix
- Date filtering support for analytics endpoints

#### Response Format
Standard new API format: `{success, status, data, meta}`
Analytics endpoints return ISalesSummary and ISalesGraphData[] types

## 10. Generic API Operations System

### Purpose
DRY Implementation - Eliminates repetitive CRUD patterns across 13+ API files. Central factory for all resource operations following SOLID principles.

### Core Interfaces

#### ResourceConfig
```typescript
interface ResourceConfig {
  endpoint: string; // e.g., '/auctions', '/cards'
  resourceName: string; // e.g., 'auction', 'card' - for logging/error messages
}
```

#### GenericParams
```typescript
interface GenericParams {
  [key: string]: any;
}
```

#### OperationOptions
```typescript
interface OperationOptions extends Partial<EnhancedRequestConfig> {
  transform?: (data: any) => any; // Optional data transformation
}
```

### Generic CRUD Operations

#### Core Functions
- `getCollection<T>(config, params?, options?)` - GET collection with filtering
- `getResource<T>(config, id, options?)` - GET single resource by ID
- `createResource<T>(config, resourceData, options?)` - POST create resource
- `updateResource<T>(config, id, resourceData, options?)` - PUT update resource
- `deleteResource(config, id, options?)` - DELETE resource
- `bulkCreateResources<T>(config, resourcesData[], options?)` - POST bulk create
- `searchResources<T>(config, searchParams, options?)` - GET search resources

#### Specialized Operations
- `markResourceSold<T>(config, id, saleDetails, options?)` - POST mark as sold
- `exportResource<T>(config, exportParams?, options?)` - GET export data
- `batchOperation<T>(config, operation, ids[], operationData?, options?)` - POST batch operations

### Resource Operations Factory

#### createResourceOperations Function
Creates complete CRUD interface for any resource type:

```typescript
function createResourceOperations<TResource, TCreatePayload, TUpdatePayload>(
  config: ResourceConfig,
  options: {
    includeSoldOperations?: boolean;
    includeExportOperations?: boolean;
    includeBatchOperations?: boolean;
  } = {}
): ResourceOperations<TResource, TCreatePayload, TUpdatePayload>
```

#### ResourceOperations Interface
```typescript
interface ResourceOperations<TResource, TCreatePayload, TUpdatePayload> {
  getAll: (params?, options?) => Promise<TResource[]>;
  getById: (id: string, options?) => Promise<TResource>;
  create: (data: TCreatePayload, options?) => Promise<TResource>;
  update: (id: string, data: TUpdatePayload, options?) => Promise<TResource>;
  remove: (id: string, options?) => Promise<void>;
  search: (searchParams, options?) => Promise<TResource[]>;
  bulkCreate: (items: TCreatePayload[], options?) => Promise<TResource[]>;
  markSold?: (id: string, saleDetails, options?) => Promise<TResource>;
  export?: (exportParams?, options?) => Promise<Blob>;
  batchOperation?: (operation: string, ids[], operationData?, options?) => Promise<TResource[]>;
}
```

### Utility Functions

#### ID Mapping System
- `createIdMapper()` - Creates transformation function for MongoDB _id to id mapping
- `mapSingleId(item)` - Maps _id to id for single object
- `shouldMapNestedObject(key, value)` - Determines if nested object needs ID mapping
- `idMapper` - Pre-created ID mapper instance

### Pre-configured Resource Configs

#### Available Configurations
- `AUCTION_CONFIG` - '/auctions', 'auction'
- `CARD_CONFIG` - '/cards/enhanced', 'card'
- `SET_CONFIG` - '/sets', 'set'
- `SALES_CONFIG` - '/sales', 'sale'
- `CARDMARKET_REF_PRODUCTS_CONFIG` - '/cardmarket-ref-products', 'CardMarket reference product'
- `DBA_SELECTION_CONFIG` - '/dba-selection', 'DBA selection'
- `EXPORT_CONFIG` - '/export', 'export'
- `ACTIVITY_CONFIG` - '/activities', 'activity'
- `PSA_CARD_CONFIG` - '/psa-graded-cards', 'PSA card'
- `RAW_CARD_CONFIG` - '/raw-cards', 'raw card'
- `SEALED_PRODUCT_CONFIG` - '/sealed-products', 'sealed product'

### Backend Requirements

#### Generic Endpoint Patterns
All resources following generic operations pattern must implement:
```bash
GET /{resource} - Get collection with optional query params
GET /{resource}/:id - Get single resource by ID
POST /{resource} - Create new resource
PUT /{resource}/:id - Update existing resource
DELETE /{resource}/:id - Delete resource
GET /{resource}/search - Search with query params
POST /{resource}/:id/mark-sold - Mark resource as sold (if includeSoldOperations)
GET /{resource}/export - Export resource data (if includeExportOperations)


#### Data Transformation Requirements
- MongoDB _id to id field conversion
- Nested object ID mapping (excluding metadata objects: saleDetails, psaGrades, priceHistory, etc.)
- Support for unifiedApiClient request/response transformations
- Decimal128 handling for monetary values

#### Error Handling
- Standard error messages using resourceName
- Operation-specific success messages
- Unified error handling through unifiedApiClient

#### Response Format
Standard new API format: `{success, status, data, meta}`

## 11. CardMarket Reference Products API System

### Base Endpoint Configuration
- **Base Path**: `/cardmarket-ref-products`
- **Resource Type**: ICardMarketReferenceProduct

### Type Definitions

#### CardMarketRefProductsParams
```typescript
interface CardMarketRefProductsParams {
  category?: string;
  setName?: string;
  available?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
```

#### PaginatedCardMarketRefProductsResponse
```typescript
interface PaginatedCardMarketRefProductsResponse {
  products: ICardMarketReferenceProduct[];
  total: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

#### ProductSearchParams
```typescript
interface ProductSearchParams {
  query: string;
  category?: string;
  setName?: string;
  minPrice?: number;
  maxPrice?: number;
  availableOnly?: boolean;
  limit?: number;
  page?: number;
}
```

#### OptimizedProductSearchResponse
```typescript
interface OptimizedProductSearchResponse {
  success: boolean;
  query: string;
  count: number;
  data: ICardMarketReferenceProduct[];
}
```


### Available Endpoints

#### Standard CRUD Operations (via createResourceOperations)
- `GET /cardmarket-ref-products` - Get all products
- `GET /cardmarket-ref-products/:id` - Get product by ID




#### CardMarket-Specific Operations
- `GET /cardmarket-ref-products` (with pagination) - Get paginated products with filters

### API Functions

#### Standard Functions
- `getCardMarketRefProducts(params?: CardMarketRefProductsParams)` - Get products with search/filter logic
- `getCardMarketRefProductById(id: string)` - Get single product with ID mapping
- `searchCardMarketRefProducts(searchParams: any)` - Search products using searchApi integration

#### CardMarket-Specific Functions
- `getPaginatedCardMarketRefProducts(params?: CardMarketRefProductsParams)` - Get paginated products with dual routing logic

### Intelligent Routing Logic

The CardMarket Reference Products API implements dual routing logic:

1. **Search Mode**: When `search` parameter provided
   - Routes to search API (`searchProducts`)
   - Uses `ProductSearchParams` with query, category, setName, price filters, availability
   - Returns search results with calculated pagination

2. **Browse Mode**: When no search parameter
   - Routes to main `/cardmarket-ref-products` endpoint
   - Uses direct unifiedApiClient call
   - Returns paginated response from backend

### Integration with Search API

The CardMarket API integrates with the Search API through:
- `searchCardMarketRefProducts` function - Uses `searchProducts` and returns `result.data`
- Imported search functions:
  - `searchProducts`
  - `getProductSuggestions`
  - `getBestMatchProduct`
  - `searchProductsInSet`
  - `searchProductsByCategory`
  - `getCardMarketSetNames`
  - `searchCardMarketSetNames`

### Backend Requirements

#### MongoDB Model
- Collection: `cardmarketreferenceproducts`
- Schema: ICardMarketReferenceProduct interface
- Fields: `_id` (converted to `id`), name, setName, available, price, category, url, lastUpdated

#### Endpoints Implementation Needed
```bash
GET /cardmarket-ref-products - Paginated products with query params (page, limit, category, setName, available)
GET /cardmarket-ref-products/:id - Single product by ID
POST /cardmarket-ref-products - Create new product
PUT /cardmarket-ref-products/:id - Update product
DELETE /cardmarket-ref-products/:id - Delete product
POST /cardmarket-ref-products/bulk - Bulk create products
POST /cardmarket-ref-products/batch - Batch operations
GET /cardmarket-ref-products/export - Export functionality
```

#### Search Integration
- Search service must support product-specific queries
- Category-based filtering
- Set name filtering
- Price range filtering (minPrice, maxPrice)
- Availability filtering
- Intelligent search routing for product name queries

#### Response Format
Standard new API format: `{success, status, data, meta}`
Pagination format includes: `total, currentPage, totalPages, hasNextPage, hasPrevPage`

## 12. Activity API System

### Base Endpoint Configuration
- **Base Path**: `/activities`
- **Resource Type**: Activity
- **Generic Operations**: Full CRUD + Export + Batch operations enabled

### Constants

#### ACTIVITY_TYPES
```typescript
const ACTIVITY_TYPES = {
  CARD_ADDED: 'card_added',
  CARD_UPDATED: 'card_updated',
  CARD_DELETED: 'card_deleted',
  PRICE_UPDATE: 'price_update',
  AUCTION_CREATED: 'auction_created',
  AUCTION_UPDATED: 'auction_updated',
  AUCTION_DELETED: 'auction_deleted',
  AUCTION_ITEM_ADDED: 'auction_item_added',
  AUCTION_ITEM_REMOVED: 'auction_item_removed',
  SALE_COMPLETED: 'sale_completed',
  SALE_UPDATED: 'sale_updated',
  MILESTONE: 'milestone',
  COLLECTION_STATS: 'collection_stats',
  SYSTEM: 'system',
}
```

#### ACTIVITY_PRIORITIES
```typescript
const ACTIVITY_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
}
```

### Type Definitions

#### ActivityMetadata
```typescript
interface ActivityMetadata {
  cardName?: string;
  setName?: string;
  grade?: string;
  condition?: string;
  category?: string;
  previousPrice?: number;
  newPrice?: number;
  priceChange?: number;
  priceChangePercentage?: number;
  auctionTitle?: string;
  itemCount?: number;
  estimatedValue?: number;
  salePrice?: number;
  paymentMethod?: string;
  source?: string;
  buyerName?: string;
  milestoneType?: string;
  milestoneValue?: number;
  milestoneUnit?: string;
  badges?: string[];
  tags?: string[];
  color?: string;
  icon?: string;
}
```

#### Activity
```typescript
interface Activity {
  _id?: string;
  id?: string;
  type: keyof typeof ACTIVITY_TYPES;
  title: string;
  description: string;
  details?: string;
  priority: keyof typeof ACTIVITY_PRIORITIES;
  status: 'active' | 'archived' | 'hidden';
  entityType?: string;
  entityId?: string;
  metadata?: ActivityMetadata;
  timestamp: string;
  relativeTime?: string;
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
```

#### ActivityFilters
```typescript
interface ActivityFilters {
  limit?: number;
  offset?: number;
  type?: keyof typeof ACTIVITY_TYPES;
  entityType?: string;
  entityId?: string;
  priority?: keyof typeof ACTIVITY_PRIORITIES;
  dateRange?: 'today' | 'week' | 'month' | 'quarter' | 'all';
  search?: string;
}
```

#### ActivityResponse
```typescript
interface ActivityResponse {
  success: boolean;
  data: Activity[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    page: number;
    totalPages: number;
  };
}
```

#### ActivityStats
```typescript
interface ActivityStats {
  total: number;
  today: number;
  week: number;
  month: number;
  lastActivity?: string;
}
```

#### ArchiveOldActivitiesRequest
```typescript
interface ArchiveOldActivitiesRequest {
  days: number;
}
```

#### ArchiveOldActivitiesResponse
```typescript
interface ArchiveOldActivitiesResponse {
  success: boolean;
  message: string;
  data: {
    archivedCount: number;
    oldestArchived: string;
    newestArchived: string;
    archiveDate: string;
  };
}
```

### Available Endpoints

#### Standard CRUD Operations (via createResourceOperations)
- `GET /activities` - Get all activities
- `GET /activities/:id` - Get activity by ID
- `POST /activities` - Create new activity
- `PUT /activities/:id` - Update existing activity
- `DELETE /activities/:id` - Delete activity

#### Activity-Specific Operations
- `GET /activities` (with filters) - Get activities with advanced filtering
- `GET /activities/recent` - Get recent activities
- `GET /activities/stats` - Get activity statistics
- `GET /activities/types` - Get activity types and metadata
- `GET /activities/search` - Full-text search activities
- `GET /activities/entity/:entityType/:entityId` - Get activities for specific entity
- `PUT /activities/:id/read` - Mark activity as read
- `DELETE /activities/:id` - Archive activity (soft delete)
- `POST /activities/archive-old` - Archive activities older than specified days

### API Functions

#### Standard Functions
- `getAllActivities(params?)` - Get all activities with ID mapping
- `getActivityById(id: string)` - Get single activity with ID mapping
- `createActivity(activityData)` - Create new activity with ID mapping
- `updateActivity` - Update existing activity (from generic operations)
- `removeActivity` - Delete activity (from generic operations)
- `searchActivitiesGeneric` - Search activities (from generic operations)
- `bulkCreateActivities` - Bulk create activities (from generic operations)
- `exportActivities` - Export activities data (from generic operations)
- `batchActivityOperation` - Batch operation on activities (from generic operations)

#### Specialized Functions
- `getActivities(filters?: ActivityFilters)` - Get activities with advanced filtering and pagination
- `getRecentActivities(limit?: number)` - Get recent activities (default limit 10)
- `getActivityStats()` - Get activity statistics and analytics
- `getActivityTypes()` - Get available activity types and metadata
- `searchActivities(searchTerm: string, filters?)` - Full-text search with filters
- `getActivitiesForEntity(entityType: string, entityId: string)` - Get activities for specific entity
- `markActivityAsRead(id: string)` - Mark activity as read
- `archiveActivity(id: string)` - Archive activity (soft delete)

#### Archive Functions
- `archiveOldActivities(days: number)` - Archive activities older than specified days
- `getArchivePreview(days: number)` - Get estimated count of activities to be archived
- `archiveOldActivitiesWithConfirmation(days, confirm)` - Archive with confirmation callback

### Backend Requirements

#### MongoDB Model
- Collection: `activities`
- Schema: Activity interface
- Fields: `_id` (converted to `id`), type, title, description, details, priority, status, entityType, entityId, metadata, timestamp, relativeTime, isRead, readAt, isArchived, archivedAt, createdAt, updatedAt

#### Endpoints Implementation Needed
```bash
GET /activities - Get activities with filtering (limit, offset, type, entityType, entityId, priority, dateRange, search)
GET /activities/:id - Single activity by ID
POST /activities - Create new activity
PUT /activities/:id - Update activity
DELETE /activities/:id - Delete activity
POST /activities/bulk - Bulk create activities
POST /activities/batch - Batch operations
GET /activities/export - Export functionality
GET /activities/recent - Recent activities with limit query param
GET /activities/stats - Activity statistics
GET /activities/types - Activity types and metadata
GET /activities/search - Full-text search with q param and filters
GET /activities/entity/:entityType/:entityId - Activities for specific entity
PUT /activities/:id/read - Mark activity as read
POST /activities/archive-old - Archive old activities with {days: number} payload
```

#### Data Processing Requirements
- Activity type validation against ACTIVITY_TYPES constants
- Priority validation against ACTIVITY_PRIORITIES constants
- Entity type and ID validation to prevent [object Object] URLs
- Date range filtering (today, week, month, quarter, all)
- Full-text search across title, description, details fields
- Archive functionality with soft delete (isArchived field)
- Statistics calculation for total, today, week, month counts

#### Response Format
Standard new API format: `{success, status, data, meta}`
Pagination includes: `total, limit, offset, hasMore, page, totalPages`

## 13. Backup API System

### Type Definitions

#### BackupConfig
```typescript
interface BackupConfig {
  scheduleEnabled: boolean;
  interval: string; // cron expression
  retentionDays: number;
  compression: boolean;
  encryptionEnabled: boolean;
  backupLocation: string;
  maxBackups: number;
}
```

#### BackupStatus
```typescript
interface BackupStatus {
  isRunning: boolean;
  lastBackupDate?: string;
  nextScheduledBackup?: string;
  scheduleEnabled: boolean;
  totalBackups: number;
  diskSpaceUsed: string;
  serviceName: string;
  version: string;
}
```

#### BackupHealth
```typescript
interface BackupHealth {
  status: 'healthy' | 'warning' | 'error';
  lastCheck: string;
  issues: string[];
  recommendations: string[];
  serviceUptime: string;
  diskSpaceAvailable: string;
}
```

#### ManualBackupRequest
```typescript
interface ManualBackupRequest {
  type: 'full' | 'incremental';
  compression?: boolean;
  description?: string;
  includeImages?: boolean;
}
```

#### BackupEntry
```typescript
interface BackupEntry {
  _id: string;
  backupId: string;
  type: 'full' | 'incremental' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  duration?: number;
  fileSize?: string;
  filePath?: string;
  description?: string;
  error?: string;
  compression: boolean;
  recordsBackedUp?: number;
  imagesBackedUp?: number;
}
```

#### BackupHistoryResponse
```typescript
interface BackupHistoryResponse {
  success: boolean;
  data: {
    backups: BackupEntry[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    summary: {
      totalBackups: number;
      successfulBackups: number;
      failedBackups: number;
      totalSizeUsed: string;
    };
  };
}
```

#### BackupHistoryParams
```typescript
interface BackupHistoryParams {
  page?: number;
  limit?: number;
  type?: 'full' | 'incremental' | 'manual';
  status?: 'pending' | 'running' | 'completed' | 'failed';
  startDate?: string;
  endDate?: string;
}
```

### API Functions

- `getBackupHealth()` - GET /backup/health
- `getBackupStatus()` - GET /backup/status
- `getBackupConfig()` - GET /backup/config
- `initializeBackupService()` - POST /backup/initialize
- `startScheduledBackups()` - POST /backup/start-scheduled
- `stopScheduledBackups()` - POST /backup/stop-scheduled
- `triggerManualBackup(request: ManualBackupRequest)` - POST /backup/manual
- `testBackupSystem()` - POST /backup/test
- `getBackupHistory(params?: BackupHistoryParams)` - GET /backup/history
- `getBackupById(backupId: string)` - GET /backup/:backupId
- `isBackupSystemHealthy()` - Health check convenience function
- `getLatestBackup()` - Get latest backup convenience function
- `getBackupStats()` - Get backup statistics convenience function


## 15. DBA Selection API System

### Type Definitions

#### DbaSelectionItem
```typescript
interface DbaSelectionItem {
  itemId: string;
  itemType: 'psa' | 'raw' | 'sealed';
  notes?: string;
}
```

#### DbaSelection
```typescript
interface DbaSelection {
  _id?: string;
  id?: string;
  itemId: string;
  itemType: 'psa' | 'raw' | 'sealed';
  selectedDate: string;
  isActive: boolean;
  notes: string;
  expiryDate: string;
  daysRemaining: number;
  daysSelected: number;
  createdAt: string;
  updatedAt: string;
  item?: any; // Populated item data
}
```

#### DbaSelectionStats
```typescript
interface DbaSelectionStats {
  totalActive: number;
  expiringSoon: number;
  expired: number;
  byType: {
    psa: number;
    raw: number;
    sealed: number;
  };
}
```

#### DbaSelectionResponse
```typescript
interface DbaSelectionResponse {
  success: boolean;
  count?: number;
  data: DbaSelection[] | DbaSelection | DbaSelectionStats;
  errors?: Array<{ itemId: string; error: string }>;
  message?: string;
}
```

#### DbaSelectionParams
```typescript
interface DbaSelectionParams {
  active?: boolean;
  expiring?: boolean;
  days?: number;
}
```

### API Functions

#### Standard CRUD Functions (via createResourceOperations)
- `getDbaSelections(params?: DbaSelectionParams)` - Get selections with filtering (active, expiring, days) and ID mapping
- `getDbaSelectionById(id: string)` - Get single selection with ID mapping
- `createDbaSelection` - Create new selection (from generic operations)
- `updateDbaSelection` - Update existing selection (from generic operations)
- `removeDbaSelection` - Delete selection (from generic operations)
- `searchDbaSelections` - Search selections (from generic operations)
- `exportDbaSelections` - Export selections data (from generic operations)

#### DBA-Specific Functions
- `addToDbaSelection(items: DbaSelectionItem[])` - POST /dba-selection with {items} payload
- `removeFromDbaSelection(items: Pick<DbaSelectionItem, 'itemId' | 'itemType'>[])` - DELETE /dba-selection with {items} payload
- `getDbaSelectionByItem(itemType: string, itemId: string)` - GET /dba-selection/:itemType/:itemId with ID mapping
- `updateDbaSelectionNotes(itemType: string, itemId: string, notes: string)` - PUT /dba-selection/:itemType/:itemId/notes
- `getDbaSelectionStats()` - GET /dba-selection/stats

## 16. CardMarket API System

### Type Definitions

#### CardMarketSearchParams
```typescript
interface CardMarketSearchParams {
  page?: number;
  limit?: number;
  category?: string;
  setName?: string;
  availableOnly?: boolean;
}
```

#### CardMarketSearchResponse
```typescript
interface CardMarketSearchResponse {
  success: boolean;
  data: {
    products: ICardMarketReferenceProduct[];
    pagination: {
      currentPage: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
      total: number;
    };
  };
}
```

#### CategoryDetails
```typescript
interface CategoryDetails {
  totalProducts: number;
  availableProducts: number;
  totalAvailable: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}
```

### API Functions

- `searchProducts(params: CardMarketSearchParams)` - GET /cardmarket/search with query params
- `getCategories()` - GET /cardmarket/categories returns Array<{name: string; count: number}>
- `getCategoryDetails(category: string)` - GET /cardmarket/categories/:category

### Constants
- BASE_URL: 'http://localhost:3000/api/cardmarket'

## 17. Caching System

### Cache Configuration (cacheConfig.ts)

#### CACHE_TTL Constants
```typescript
const CACHE_TTL = {
  SETS: 10 * 60 * 1000, // 10 minutes
  CATEGORIES: 15 * 60 * 1000, // 15 minutes
  COLLECTION_ITEMS: 2 * 60 * 1000, // 2 minutes
  PRICE_HISTORY: 5 * 60 * 1000, // 5 minutes
  CARDS: 5 * 60 * 1000, // 5 minutes
  PRODUCTS: 5 * 60 * 1000, // 5 minutes
  SEARCH_SUGGESTIONS: 3 * 60 * 1000, // 3 minutes
  UNIFIED_CLIENT_DEFAULT: 5 * 60 * 1000, // 5 minutes
  PREFETCH_DATA: 10 * 60 * 1000, // 10 minutes
  REQUEST_DEDUPLICATION: 30 * 1000, // 30 seconds
  AUTOCOMPLETE: 1 * 60 * 1000, // 1 minute
}
```

#### CACHE_PRESETS
```typescript
const CACHE_PRESETS = {
  STABLE: CACHE_TTL.SETS,
  MODERATE: CACHE_TTL.CARDS,
  DYNAMIC: CACHE_TTL.SEARCH_SUGGESTIONS,
  FRESH: CACHE_TTL.REQUEST_DEDUPLICATION,
}
```

#### API_CACHE_CONFIG
Maps API operations to TTL values:
- searchCards: CACHE_TTL.CARDS
- searchProducts: CACHE_TTL.PRODUCTS
- getPsaCards: CACHE_TTL.COLLECTION_ITEMS
- getSets: CACHE_TTL.SETS
- default: CACHE_TTL.UNIFIED_CLIENT_DEFAULT

#### Helper Functions
- `getCacheTTL(dataType: keyof typeof CACHE_TTL)`
- `getCachePreset(preset: keyof typeof CACHE_PRESETS)`
- `getApiCacheTTL(operation: keyof typeof API_CACHE_CONFIG)`
- `getEnvironmentCacheTTL(dataType)` - Uses DEV_CACHE_TTL in development

### Image Cache (imageCache.ts)

#### Functions
- `preloadImage(src: string)` - Preload image and cache in Map
- `preloadImages(srcs: string[])` - Preload multiple images
- `isImageCached(src: string)` - Check if image is cached
- `clearImageCache()` - Clear all cached images

#### Implementation
- Uses Map<string, HTMLImageElement> for caching
- Uses Map<string, Promise<HTMLImageElement>> for loading promises
- Prevents duplicate loading requests

### Cache Debug Utilities (cacheDebug.ts)

#### Functions
- `debugCache()` - Log React Query cache contents to console
- `clearCache()` - Clear React Query cache
- `showCacheStats()` - Show cache statistics (fresh, stale, loading)

#### Browser Console Access
Exposes functions to window object: `window.debugCache`, `window.clearCache`, `window.showCacheStats`

### React Query Client (queryClient.ts)

#### CACHE_TIMES Configuration
```typescript
const CACHE_TIMES = {
  STATIC_DATA: { staleTime: 1000 * 60 * 60, gcTime: 1000 * 60 * 60 * 4 }, // 1h/4h
  COLLECTION_DATA: { staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 30 }, // 15m/30m
  SEARCH_DATA: { staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 10 }, // 5m/10m
  ANALYTICS_DATA: { staleTime: 1000 * 60 * 30, gcTime: 1000 * 60 * 60 }, // 30m/1h
  USER_PREFERENCES: { staleTime: 1000 * 60 * 60 * 24, gcTime: 1000 * 60 * 60 * 48 }, // 24h/48h
  REALTIME_DATA: { staleTime: 1000 * 30, gcTime: 1000 * 60 * 2 }, // 30s/2m
}
```

#### Query Keys Factory
Comprehensive query keys for cache invalidation:
- `queryKeys.collection` - Collection data keys
- `queryKeys.reference` - Reference data keys (static, long cache)
- `queryKeys.search` - Search data keys
- `queryKeys.analytics` - Analytics data keys
- `queryKeys.activity` - Activity feed keys
- `queryKeys.auctions` - Auction data keys
- `queryKeys.user` - User preferences keys

#### Cache Invalidation Patterns
- `cacheInvalidation.onAddItem(itemType)` - Invalidate collection, stats, analytics
- `cacheInvalidation.onUpdateItem(itemType, itemId)` - Invalidate specific item and lists
- `cacheInvalidation.onDeleteItem(itemType, itemId)` - Remove from cache and invalidate lists
- `cacheInvalidation.onSaleItem(itemType, itemId)` - Invalidate collection, sold items, analytics
- `cacheInvalidation.clearSearchCache()` - Clear all search cache
- `cacheInvalidation.warmupCache()` - Prefetch critical data

#### Cache Utilities
- `cacheUtils.getCacheStats()` - Get cache statistics
- `cacheUtils.cleanupCache()` - Remove unused queries (1 hour old, no observers)
- `cacheUtils.logCachePerformance()` - Log cache performance metrics

### API Optimization (apiOptimization.ts)

#### Cache Entry Interface
```typescript
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}
```

#### Functions
- `getCachedData<T>(cacheKey: string)` - Get cached data if valid
- `setCacheData<T>(cacheKey, data, ttl = 5 * 60 * 1000)` - Set cache data with TTL
- `deduplicateRequest<T>(cacheKey, requestFn)` - Prevent duplicate requests
- `optimizedApiRequest<T>(requestFn, config, options)` - Wrapper with caching and deduplication

#### BatchProcessor Class
Generic batch processing with configurable batch size (default 10) and delay (default 100ms):
- `add(item: T)` - Add item to batch queue
- `processBatch()` - Process current batch

#### Cache Management
- `clearApiCache()` - Clear all cached data
- `cleanupExpiredCache()` - Remove expired entries
- `getCacheStats()` - Get cache statistics
- Auto-cleanup every 10 minutes

[Previous sections remain unchanged...]

## Collection Management System

### Base Configuration
- **Endpoint Base**: `/api`
- **Content Type**: `application/json`
- **Implementation**: Layer 1 Core/Foundation/API Client
- **Cache Strategy**: Configurable per endpoint
- **Logging**: API-level logging with conditional debug info

### Core Type Definitions

```typescript
// === COMMON TYPES ===

interface ISaleDetails {
    payment?: string;      // Payment method
    price?: number;        // Sale price
    delivery?: string;     // Delivery method
    source?: string;       // Sale source/platform
    buyerFirstName?: string;
    buyerLastName?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    notes?: string;
    saleDate?: string;    // ISO date string
}

// === PSA GRADED CARDS ===

interface IPsaGradedCard {
    id: string;           // Unique identifier
    cardId: string;       // Reference to base card
    grade: string;        // PSA grade
    images: string[];     // Image URLs
    myPrice: number;      // Listed price
    priceHistory: IPriceHistoryEntry[];
    dateAdded: string;    // ISO date
    sold: boolean;        // Sale status
    saleDetails?: ISaleDetails;
}

interface PsaGradedCardsParams {
    grade?: string;       // Filter by grade
    setName?: string;     // Filter by set
    cardName?: string;    // Filter by name
    sold?: boolean;       // Filter by sale status
}

// === RAW CARDS ===

interface IRawCard {
    id: string;           // Unique identifier
    cardId: string;       // Reference to base card
    condition: string;    // Card condition
    images: string[];     // Image URLs
    myPrice: number;      // Listed price
    priceHistory: IPriceHistoryEntry[];
    dateAdded: string;    // ISO date
    sold: boolean;        // Sale status
    saleDetails?: ISaleDetails;
}

interface RawCardsParams {
    condition?: string;   // Filter by condition
    setName?: string;     // Filter by set
    cardName?: string;    // Filter by name
    sold?: boolean;       // Filter by sale status
}

// === SEALED PRODUCTS ===

interface ISealedProduct {
    id: string;           // Unique identifier
    productId: string;    // Reference to CardMarket product
    category: string;     // Product category
    setName: string;      // Set name
    name: string;         // Product name
    availability: number; // Available quantity
    cardMarketPrice: number; // CardMarket price
    myPrice: number;      // Listed price
    priceHistory: IPriceHistoryEntry[];
    images: string[];     // Image URLs
    dateAdded: string;    // ISO date
    sold: boolean;        // Sale status
    saleDetails?: ISaleDetails;
}

interface SealedProductCollectionParams {
    category?: string;    // Filter by category
    setName?: string;     // Filter by set
    sold?: boolean;       // Filter by sale status
    search?: string;      // Search term
}
```

### Endpoints

#### 1. PSA Graded Cards
```typescript
// Get PSA graded cards collection
GET /api/psa-graded-cards
Parameters: PsaGradedCardsParams
Response: IPsaGradedCard[]
Cache: Disabled
Headers: Standard caching headers for no-cache

// Get PSA card by ID
GET /api/psa-graded-cards/:id
Response: IPsaGradedCard
Cache: 10 minutes

// Create PSA card
POST /api/psa-graded-cards
Payload: Partial<IPsaGradedCard>
Response: IPsaGradedCard

// Update PSA card
PUT /api/psa-graded-cards/:id
Payload: Partial<IPsaGradedCard>
Response: IPsaGradedCard

// Delete PSA card
DELETE /api/psa-graded-cards/:id
Response: void

// Mark PSA card as sold
POST /api/psa-graded-cards/:id/mark-sold
Payload: { saleDetails: ISaleDetails }
Response: IPsaGradedCard
```

#### 2. Raw Cards
```typescript
// Get raw cards collection
GET /api/raw-cards
Parameters: RawCardsParams
Response: IRawCard[]
Cache: Disabled
Headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
}

// Get raw card by ID
GET /api/raw-cards/:id
Response: IRawCard
Cache: 10 minutes

// Create raw card
POST /api/raw-cards
Payload: Partial<IRawCard>
Response: IRawCard

// Update raw card
PUT /api/raw-cards/:id
Payload: Partial<IRawCard>
Response: IRawCard

// Delete raw card
DELETE /api/raw-cards/:id
Response: void

// Mark raw card as sold
POST /api/raw-cards/:id/mark-sold
Payload: { saleDetails: ISaleDetails }
Response: IRawCard
```

#### 3. Sealed Products
```typescript
// Get sealed products collection
GET /api/sealed-products
Parameters: SealedProductCollectionParams
Response: ISealedProduct[]
Cache: Disabled
Optimization: {
    enableCache: false,
    enableDeduplication: false
}

// Get sealed product by ID
GET /api/sealed-products/:id
Response: ISealedProduct
Cache: 10 minutes

// Create sealed product
POST /api/sealed-products
Payload: Partial<ISealedProduct>
Response: ISealedProduct

// Update sealed product
PUT /api/sealed-products/:id
Payload: Partial<ISealedProduct>
Response: ISealedProduct

// Delete sealed product
DELETE /api/sealed-products/:id
Response: void

// Mark sealed product as sold
POST /api/sealed-products/:id/mark-sold
Payload: { saleDetails: ISaleDetails }
Response: ISealedProduct
```

### Implementation Details

#### 1. Caching Strategy
```typescript
// API Client Configuration
const apiClientConfig = {
    // Default configuration
    defaultConfig: {
        enableCache: true,
        enableDeduplication: true,
        cacheTime: 600000 // 10 minutes
    },

    // Collection endpoints override
    collectionEndpoints: {
        enableCache: false,
        enableDeduplication: false,
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        }
    }
};
```

#### 2. Logging System
```typescript
// API Logger Configuration
const loggerConfig = {
    enableDebug: process.env.NODE_ENV === 'development',
    logLevels: {
        API_CALL: true,    // Log API calls
        RESPONSE: true,    // Log responses
        PROCESSED: true,   // Log processed data
        ERROR: true       // Log errors
    }
};

// Logger Implementation
const logger = createApiLogger('COLLECTION API');
logger.logApiCall(endpoint, params);
logger.logResponse(endpoint, data);
logger.logProcessedData(endpoint, dataLength, description);
```

#### 3. Error Handling
```typescript
// Standard Error Types
type CollectionApiError = {
    status: number;
    message: string;
    details?: any;
    operation?: string;
};

// Error Handling Strategy
const errorHandling = {
    404: 'Item not found in collection',
    400: 'Invalid request parameters',
    409: 'Conflict with existing item',
    500: 'Internal server error'
};
```

### Backend Requirements

1. **Database Requirements**:
   - MongoDB for document storage
   - Proper indexing for queries
   - Data validation schemas
   - Referential integrity

2. **Performance Requirements**:
   - Response time < 200ms
   - Handle large collections
   - Efficient filtering
   - Proper pagination

3. **Data Validation**:
   - Validate all input data
   - Check reference integrity
   - Validate image URLs
   - Sanitize user input

4. **Sale Process**:
   - Atomic sale operations
   - Transaction handling
   - Sale history tracking
   - Prevent double sales

### Usage Examples

1. **Managing PSA Cards**:
```typescript
// Add PSA card to collection
const newCard = await createPsaGradedCard({
    cardId: "card123",
    grade: "PSA 10",
    images: ["url1", "url2"],
    myPrice: 1000
});

// Mark PSA card as sold
const soldCard = await markPsaGradedCardSold("card123", {
    payment: "PayPal",
    price: 950,
    delivery: "Tracked",
    saleDate: new Date().toISOString()
});
```

2. **Managing Raw Cards**:
```typescript
// Get raw cards with filters
const rawCards = await getRawCards({
    condition: "Near Mint",
    setName: "Base Set",
    sold: false
});

// Update raw card price
const updatedCard = await updateRawCard("card123", {
    myPrice: 150
});
```

3. **Managing Sealed Products**:
```typescript
// Search sealed products
const products = await getSealedProductCollection({
    category: "Booster Box",
    setName: "Sword & Shield",
    search: "ETB"
});

// Create sealed product
const newProduct = await createSealedProduct({
    productId: "product123",
    category: "Elite Trainer Box",
    setName: "Scarlet & Violet",
    myPrice: 49.99
});
```

## Unified API Client System

### Base Configuration
- **Implementation**: Layer 1 Core/Foundation/API Client
- **Base URL**: `http://localhost:3000/api`
- **Timeout**: 10 seconds
- **Content Type**: `application/json`
- **Cache Strategy**: Pure TanStack Query (no internal caching)
- **Error Handling**: Global interceptors with response transformation

### Core Architecture

```typescript
// === OPTIMIZATION INTERFACES ===

interface OptimizationConfig {
    enableCache?: boolean;        // Default: false (TanStack Query handles caching)
    cacheTTL?: number;           // Cache time-to-live
    enableDeduplication?: boolean; // Request deduplication
    enableBatching?: boolean;     // Batch operations
    batchSize?: number;          // Batch size limit
    batchDelay?: number;         // Batch delay in ms
}

interface EnhancedRequestConfig extends AxiosRequestConfig {
    operation?: string;          // Operation description for logging
    successMessage?: string;     // Success message
    errorMessage?: string;       // Error message
    logRequest?: boolean;        // Enable request logging
    logResponse?: boolean;       // Enable response logging
    suppressErrorToast?: boolean; // Suppress error notifications
    optimization?: OptimizationConfig; // Optimization settings
}

// === ID VALIDATION ===

interface IdValidationResult {
    isValid: boolean;
    sanitizedId: string;
    error?: string;
}
```

### Core Features

#### 1. ID Validation System
```typescript
// Prevents [object Object] URLs and validates all ID parameters
const validateAndSanitizeId = (id: any, paramName: string = 'id'): string => {
    // Validation Rules:
    - Reject null, undefined, empty values
    - Convert to string and trim
    - Reject '[object Object]', 'undefined', 'null'
    - Length limit: 100 characters
    - Sanitize problematic characters
}

// URL Building with Validation
const buildUrlWithId = (basePath: string, id: any, subPath?: string): string => {
    // Builds: /basePath/validatedId/subPath
    // Throws error if ID validation fails
}
```

#### 2. HTTP Methods with Optimization
```typescript
// GET Request
async get<T>(url: string, config: EnhancedRequestConfig = {}): Promise<T>
- Default optimization: { enableCache: false, enableDeduplication: false }
- Pure TanStack Query caching strategy
- Response transformation applied

// POST Request  
async post<T>(url: string, data?: any, config: EnhancedRequestConfig = {}): Promise<T>
- Request data transformation (ObjectId to string)
- FormData detection and bypass
- Default optimization: { enableCache: false, enableDeduplication: true }

// PUT Request
async put<T>(url: string, data?: any, config: EnhancedRequestConfig = {}): Promise<T>
- Request data transformation
- FormData detection and bypass
- Default optimization: { enableCache: false, enableDeduplication: true }

// DELETE Request
async delete<T = void>(url: string, config: EnhancedRequestConfig = {}): Promise<T>
- Special handling for empty responses
- Graceful transformation fallback
- Default optimization: { enableCache: false, enableDeduplication: true }
```

#### 3. ID-Validated Convenience Methods
```typescript
// GET by ID with validation
async getById<T>(basePath: string, id: any, subPath?: string, config?: EnhancedRequestConfig): Promise<T>
Usage: getById('/cards', cardId, 'details')
Result: GET /api/cards/validatedId/details

// PUT by ID with validation
async putById<T>(basePath: string, id: any, data: any, subPath?: string, config?: EnhancedRequestConfig): Promise<T>
Usage: putById('/cards', cardId, updateData, 'mark-sold')
Result: PUT /api/cards/validatedId/mark-sold

// POST by ID with validation
async postById<T>(basePath: string, id: any, data: any, subPath?: string, config?: EnhancedRequestConfig): Promise<T>
Usage: postById('/cards', cardId, saleData, 'mark-sold')
Result: POST /api/cards/validatedId/mark-sold

// DELETE by ID with validation
async deleteById<T = void>(basePath: string, id: any, subPath?: string, config?: EnhancedRequestConfig): Promise<T>
Usage: deleteById('/cards', cardId)
Result: DELETE /api/cards/validatedId
```
```


### Backend Requirements

1. **Response Format Consistency**:
   - Support both wrapped ({ success, data }) and direct responses
   - Handle empty responses for DELETE operations
   - Maintain consistent error response format

2. **ID Handling**:
   - Accept string IDs in all endpoints
   - Validate ID format and existence
   - Return consistent error messages for invalid IDs

3. **Performance Requirements**:
   - Handle batch operations efficiently
   - Support concurrent requests
   - Implement proper timeout handling
   - Optimize for high-frequency operations

4. **Error Response Format**:
   ```typescript
   {
     success: false,
     status: number,
     message: string,
     details?: any
   }
   ```

### Usage Examples

1. **Basic Operations**:
```typescript
// Simple GET request
const data = await unifiedApiClient.get<Card[]>('/cards');

// GET with ID validation
const card = await unifiedApiClient.getById<Card>('/cards', cardId);

// POST with data transformation
const newCard = await unifiedApiClient.post<Card>('/cards', cardData);
```

2. **Advanced Operations**:
```typescript
// Batch operations
const cards = await unifiedApiClient.batchGet<Card>(['/cards/1', '/cards/2', '/cards/3']);

// With optimization config
const data = await unifiedApiClient.get<Card[]>('/cards', {
    optimization: {
        enableCache: false,
        enableDeduplication: true
    }
});
```

3. **Specialized Wrappers**:
```typescript
// Standardized resource operations
const card = await unifiedApiClient.apiCreate<Card>('/cards', cardData, 'card');
const updated = await unifiedApiClient.apiUpdate<Card>('/cards/123', updateData, 'card');
await unifiedApiClient.apiDelete('/cards/123', 'card');
```

## Auction Management System

### Base Configuration
- **Endpoint Base**: `/api/auctions`
- **Content Type**: `application/json`
- **Implementation**: Layer 1 Core/Foundation/API Client using Generic Resource Operations
- **Error Handling**: Specialized handling for circular reference backend errors
- **Cache Strategy**: Disabled for dynamic auction data

### Core Type Definitions

```typescript
// === AUCTION MODELS ===

interface IAuction {
    id: string;                    // Unique identifier
    topText: string;               // Auction header text
    bottomText: string;            // Auction footer text
    auctionDate?: string;          // Auction date (ISO string)
    status: 'draft' | 'active' | 'sold' | 'expired'; // Auction status
    generatedFacebookPost?: string; // Generated social media content
    isActive: boolean;             // Active status flag
    items: IAuctionItem[];         // Array of auction items
    totalValue?: number;           // Total estimated value
    soldValue?: number;            // Total sold value
    createdAt: string;             // Creation timestamp
    updatedAt: string;             // Last update timestamp
}

interface IAuctionItem {
    itemId: string;                // Reference to collection item
    itemCategory: 'SealedProduct' | 'PsaGradedCard' | 'RawCard'; // Item type
    sold: boolean;                 // Sale status
    soldPrice?: number;            // Actual sold price
    soldDate?: string;             // Sale date
    itemData?: any;                // Populated item data
}

// === REQUEST INTERFACES ===

interface AuctionsParams {
    status?: string;               // Filter by auction status
}

interface AddItemToAuctionData {
    itemId: string;                // Collection item ID
    itemCategory: string;          // Item category/type
}

interface IAuctionCreatePayload {
    topText: string;               // Required: Header text
    bottomText: string;            // Required: Footer text
    auctionDate?: string;          // Optional: Scheduled date
    status?: 'draft' | 'active' | 'sold' | 'expired'; // Optional: Initial status
}

interface IAuctionUpdatePayload extends Partial<IAuctionCreatePayload> {}
```

### Endpoints

#### 1. Core Auction CRUD Operations
```typescript
// Get all auctions with filtering
GET /api/auctions
Parameters: AuctionsParams
Response: IAuction[]
Cache: Disabled
Error Handling: Circular reference protection

// Get auction by ID with populated items
GET /api/auctions/:id
Response: IAuction
Cache: Disabled
Population: Items with full collection data

// Create new auction
POST /api/auctions
Payload: IAuctionCreatePayload
Response: IAuction
Validation: Required fields (topText, bottomText)

// Update auction
PUT /api/auctions/:id
Payload: IAuctionUpdatePayload
Response: IAuction

// Delete auction
DELETE /api/auctions/:id
Response: void
```

#### 2. Auction Item Management
```typescript
// Add item to auction
PUT /api/auctions/:id/items
Payload: {
    itemId: string;
    itemCategory: 'SealedProduct' | 'PsaGradedCard' | 'RawCard';
}
Response: IAuction
Success Message: "Item added to auction successfully!"

// Remove item from auction
DELETE /api/auctions/:id/remove-item
Payload: {
    itemId: string;
    itemCategory?: string; // Default: 'PsaGradedCard'
}
Response: IAuction
Success Message: "Item removed from auction successfully!"

// Mark auction item as sold
PUT /api/auctions/:id/items/sold
Payload: {
    itemId: string;
    itemCategory: string;
    soldPrice: number;
}
Response: IAuction
Success Message: "Auction item marked as sold! 💰"
```

#### 3. Advanced Auction Operations
```typescript
// Search auctions
GET /api/auctions/search
Parameters: SearchParams
Response: IAuction[]

// Bulk create auctions
POST /api/auctions/bulk
Payload: IAuctionCreatePayload[]
Response: IAuction[]

// Export auctions data
GET /api/auctions/export
Parameters: ExportParams
Response: Blob (export file)

// Batch operations on auctions
POST /api/auctions/batch
Payload: {
    operation: string;
    ids: string[];
    data?: any;
}
Response: IAuction[]
```

### Implementation Details

#### 1. Circular Reference Protection
```typescript
// Backend Error Handling
const circularReferenceHandler = {
    detectError: (error) => {
        return error?.message?.includes('Maximum call stack size exceeded') ||
               error?.response?.data?.message?.includes('Maximum call stack size exceeded');
    },
    
    handleGetAll: () => {
        console.warn('Backend circular reference detected in auctions, returning empty array');
        return [];
    },
    
    handleGetById: (id) => {
        console.warn(`Backend circular reference detected for auction ${id}`);
        throw new Error(`Auction ${id} has corrupted data and cannot be loaded. Please contact support.`);
    },
    
    handleCreate: () => {
        console.warn('Backend circular reference detected during auction creation');
        throw new Error('Unable to create auction due to a server issue. Please contact support or try again later.');
    }
};
```

// Available Operations:
- getAll(params?: AuctionsParams): Promise<IAuction[]>
- getById(id: string): Promise<IAuction>
- create(data: IAuctionCreatePayload): Promise<IAuction>
- update(id: string, data: IAuctionUpdatePayload): Promise<IAuction>
- remove(id: string): Promise<void>
- search(params: any): Promise<IAuction[]>
- export(params: any): Promise<Blob>
- batchOperation(operation: string, ids: string[], data?: any): Promise<IAuction[]>
```

#### 3. Item Management Operations
```typescript
// Add Item Implementation
const addItemToAuction = async (id: string, itemData: AddItemToAuctionData) => {
    // Uses unifiedApiClient.putById with validation
    // URL: PUT /api/auctions/{validatedId}/items
    // Success feedback included
};

// Remove Item Implementation  
const removeItemFromAuction = async (id: string, itemId: string, itemCategory?: string) => {
    // Uses unifiedApiClient.deleteById with validation
    // URL: DELETE /api/auctions/{validatedId}/remove-item
    // Default category: 'PsaGradedCard'
    // Cache disabled for immediate updates
};

// Mark Sold Implementation
const markAuctionItemSold = async (id: string, saleData: SaleData) => {
    // Uses unifiedApiClient.putById with validation
    // URL: PUT /api/auctions/{validatedId}/items/sold
    // Success feedback with emoji
};
```

### Backend Requirements

1. **Data Model Requirements**:
   - MongoDB document structure for auctions
   - Embedded items array with references
   - Population of item data from collections
   - Status validation and transitions

2. **Circular Reference Prevention**:
   - Avoid deep population cycles
   - Implement population depth limits
   - Use lean queries where appropriate
   - Handle recursive references safely

3. **Item Management**:
   - Validate item existence before adding
   - Check item availability (not already in auction)
   - Handle concurrent item operations
   - Maintain item status consistency

4. **Performance Requirements**:
   - Efficient item population
   - Indexed queries for filtering
   - Bulk operation support
   - Export generation optimization

5. **Status Management**:
   - Enforce status transition rules
   - Auto-expire auctions based on date
   - Calculate total values accurately
   - Track sold items and revenues

### Usage Examples

1. **Basic Auction Management**:
```typescript
// Create new auction
const auction = await createAuction({
    topText: "🔥 Pokemon Card Auction! 🔥",
    bottomText: "All cards in excellent condition!",
    status: "draft"
});

// Add items to auction
await addItemToAuction(auction.id, {
    itemId: "card123",
    itemCategory: "PsaGradedCard"
});

// Activate auction
await updateAuction(auction.id, {
    status: "active",
    auctionDate: new Date().toISOString()
});
```

2. **Item Management**:
```typescript
// Add multiple items
const items = [
    { itemId: "psa1", itemCategory: "PsaGradedCard" },
    { itemId: "raw1", itemCategory: "RawCard" },
    { itemId: "box1", itemCategory: "SealedProduct" }
];

for (const item of items) {
    await addItemToAuction(auctionId, item);
}

// Mark item as sold
await markAuctionItemSold(auctionId, {
    itemId: "psa1",
    itemCategory: "PsaGradedCard",
    soldPrice: 150.00
});
```

3. **Bulk Operations**:
```typescript
// Get active auctions
const activeAuctions = await getAuctions({ status: "active" });

// Bulk create auctions
const newAuctions = await bulkCreateAuctions([
    { topText: "Auction 1", bottomText: "Description 1" },
    { topText: "Auction 2", bottomText: "Description 2" }
]);

// Export auction data
const exportBlob = await exportAuctions({ format: "csv" });
```

## Cards API System

### Base Configuration
- **Endpoint Base**: `/api/cards/enhanced`
- **Content Type**: `application/json`
- **Implementation**: Layer 1 Core/Foundation/API Client using Generic Resource Operations
- **Search Integration**: Integrated with unified search system
- **Cache Strategy**: 8-minute cache for cards, 15-minute cache for metrics

### Core Type Definitions

```typescript
// === CARD MODELS ===

interface ICard {
    id: string;                    // Unique identifier
    setId: string;                 // Reference to Set document
    pokemonNumber: string;         // Card number in set
    cardName: string;              // Full card name
    baseName: string;              // Base Pokemon name
    variety?: string;              // Card variety (e.g., 'Holo', 'Reverse Holo')
    psaGrades?: IPsaGrades;        // PSA grading distribution
    psaTotalGradedForCard?: number; // Total PSA graded population
    setName?: string;              // Populated set name
    year?: number;                 // Set release year
}

interface IPsaGrades {
    psa_1?: number;                // PSA Grade 1 count
    psa_2?: number;                // PSA Grade 2 count
    psa_3?: number;                // PSA Grade 3 count
    psa_4?: number;                // PSA Grade 4 count
    psa_5?: number;                // PSA Grade 5 count
    psa_6?: number;                // PSA Grade 6 count
    psa_7?: number;                // PSA Grade 7 count
    psa_8?: number;                // PSA Grade 8 count
    psa_9?: number;                // PSA Grade 9 count
    psa_10?: number;               // PSA Grade 10 count
}

// === REQUEST INTERFACES ===

interface CardsSearchParams {
    setId?: string;                // Filter by set ID
    cardName?: string;             // Filter by card name
    baseName?: string;             // Filter by base name
}

interface CardSearchParams {
    query: string;                 // Search query (required)
    setId?: string;                // Filter by set ID
    setName?: string;              // Filter by set name
    year?: number;                 // Filter by year
    pokemonNumber?: string;        // Filter by Pokemon number
    variety?: string;              // Filter by variety
    minPsaPopulation?: number;     // Minimum PSA population
    limit?: number;                // Results limit (default: 50)
    page?: number;                 // Page number
}

interface CardMetrics {
    totalCards: number;            // Total cards in database
    cardsBySet: Record<string, number>; // Cards count by set
    gradeDistribution: Record<string, number>; // Distribution by grades
    topPsaPopulations: Array<{     // Top PSA population cards
        cardId: string;
        cardName: string;
        setName: string;
        psaTotalGradedForCard: number;
    }>;
    recentlyAdded: ICard[];        // Recently added cards
    averagePsaPopulation: number;  // Average PSA population
}

interface SearchResponse {
    success: boolean;              // Operation success
    query: string;                 // Original query
    count: number;                 // Results count
    data: ICard[];                 // Card results
    searchMeta?: {                 // Search metadata
        cached?: boolean;
        hitRate?: number;
        queryTime?: number;
    };
}
```




#### 4. Integrated Search Operations
```typescript
// Search cards (integrated with search API)
GET /api/search/cards
Parameters: CardSearchParams
Response: SearchResponse<ICard>
Delegated to: Pure TanStack Query search API

// Get card suggestions for autocomplete
GET /api/search/suggest
Parameters: {
    query: string;
    types: 'cards';
    limit?: number;
}
Response: { suggestions: { cards: { data: ICard[] } } }

// Search cards in specific set
GET /api/search/cards
Parameters: {
    query: string;
    setName: string;
    limit?: number;
}
Response: SearchResponse<ICard>

// Search cards by Pokemon number
GET /api/search/cards
Parameters: {
    query: string;
    pokemonNumber: string;
    setName?: string;
    limit?: number;
}
Response: SearchResponse<ICard>

// Search cards by variety
GET /api/search/cards
Parameters: {
    query: string;
    variety: string;
    limit?: number;
}
Response: SearchResponse<ICard>
```

### Implementation Details

#### 1. Search Integration
```typescript
// Intelligent Search Routing
const getCards = async (params?: CardsSearchParams): Promise<ICard[]> => {
    // Route to search API if name-based queries
    if (params?.cardName || params?.baseName) {
        const searchParams: CardSearchParams = {
            query: params.cardName || params.baseName || '*',
            setId: params.setId,
            limit: 50
        };
        const response = await searchCardsApi(searchParams);
        return response.data;
    }
    
    // Use generic operations for other queries
    return cardOperations.getAll(params, {
        transform: idMapper
    });
};
```

#### 2. Generic Resource Operations Integration
```typescript
// CRUD Operations Configuration
const cardOperations = createResourceOperations<
    ICard,
    ICardCreatePayload,
    ICardUpdatePayload


// Available Operations:
- getAll(params?: CardsSearchParams): Promise<ICard[]>
- getById(id: string): Promise<ICard>
- search(params: any): Promise<ICard[]>

#### 3. ID Mapping and Transformation
```typescript
// MongoDB _id to id Transformation
const idMapper = (data: any): any => {
    if (Array.isArray(data)) {
        return data.map(idMapper);
    }
    if (data && typeof data === 'object' && '_id' in data && !('id' in data)) {
        data.id = data._id;
    }
    return data;
};

// Applied to all card operations for consistency
```

#### 4. Exported Search Functions
```typescript
// Re-exported from searchApi for consolidated access
export {
    searchCardsApi,              // Main card search function
    getCardSuggestions,          // Autocomplete suggestions
    getBestMatchCard,            // Single best match
    searchCardsInSet,            // Set-specific search
    searchCardsByPokemonNumber,  // Number-based search
    searchCardsByVariety,        // Variety-based search
} from './searchApi';
```

### Backend Requirements

1. **Data Model Requirements**:
   - MongoDB document structure for cards
   - Set reference population
   - PSA grades embedded object
   - Search index optimization
   - Year field derived from set data

2. **Search Integration**:
   - Full-text search on card names
   - Fuzzy matching for varieties
   - Number-based exact matching
   - Set-specific filtering

3. **Performance Requirements**:
   - Indexed queries on common fields
   - Cached metrics calculations
   - Optimized aggregate queries


5. **Export Functionality**:
   - CSV/JSON export formats
   - Large dataset handling
   - Streaming for big exports
   - Filtered export support

### Usage Examples

1. **Basic Card Operations**:
```typescript
// Get all cards with optional filtering
const cards = await getCards({
    setId: "set123",
    cardName: "Charizard"
});

// Get card with full data
const card = await getCardById("card123");

```

2. **Search Operations**:
```typescript
// Search cards with filters
const searchResults = await searchCards({
    query: "Charizard",
    setName: "Base Set",
    limit: 20
});

// Get autocomplete suggestions
const suggestions = await getCardSuggestions("Char", 10);

// Find best match
const bestMatch = await getBestMatchCard("Charizard VMAX", "Darkness Ablaze");
```



## Sets API System

### Base Configuration
- **Endpoint Base**: `/api/sets`
- **Content Type**: `application/json`
- **Implementation**: Layer 1 Core/Foundation/API Client using Generic Resource Operations
- **Search Integration**: Integrated with unified search system for text queries
- **Cache Strategy**: 20-minute cache for sets data
- **Pagination**: Built-in pagination support with search integration

### Core Type Definitions

```typescript
// === SET MODELS ===

interface ISet {
    id: string;                    // Unique identifier
    setName: string;               // Pokemon set name
    year: number;                  // Release year
    setUrl?: string;               // Reference URL (PSA/external)
    totalCardsInSet?: number;      // Total cards in the set
    totalPsaPopulation?: number;   // Total PSA graded cards in set
}

// === REQUEST INTERFACES ===

interface PaginatedSetsParams {
    page?: number;                 // Page number (default: 1)
    limit?: number;                // Results per page (default: 20)
    search?: string;               // Search term for set names
}

interface PaginatedSetsResponse {
    sets: ISet[];                  // Array of sets for current page
    total: number;                 // Total sets count
    currentPage: number;           // Current page number
    totalPages: number;            // Total pages available
    hasNextPage: boolean;          // Has next page flag
    hasPrevPage: boolean;          // Has previous page flag
}

interface SetSearchParams {
    query: string;                 // Search query (required)

    limit?: number;                // Results limit (default: 15)
    page?: number;                 // Page number
}
```

### Endpoints

#### 1. Core Set CRUD Operations
```typescript
// Get all sets with limit
GET /api/sets
Parameters: { limit?: number } // Default: 1000
Response: ISet[]
Cache: 20 minutes
Transform: MongoDB _id to id mapping

// Get set by ID
GET /api/sets/:id
Response: ISet
Cache: 20 minutes



#### 2. Paginated Sets Operations
```typescript
// Get paginated sets with filters
GET /api/sets
Parameters: {
    page?: string;     // Page number (default: "1")
    limit?: string;    // Results per page (default: "20")
    year?: string;     // Filter by year
}
Response: PaginatedSetsResponse
Cache: 20 minutes
Intelligent Routing: Uses search API when search term provided

// Implementation Logic:
- If search term provided: Routes to search API with pagination
- If no search term: Uses main sets endpoint with pagination
- Calculates pagination metadata automatically


#### 4. Integrated Search Operations
```typescript
// Search sets (integrated with search API)
GET /api/search/sets
Parameters: SetSearchParams
Response: SearchResponse<ISet>
Delegated to: Pure TanStack Query search API

// Get set suggestions for autocomplete
GET /api/search/suggest
Parameters: {
    query: string;
    types: 'sets';
    limit?: number;
}
Response: { suggestions: { sets: { data: ISet[] } } }



### Implementation Details

#### 1. Intelligent Pagination with Search
```typescript
// Dual Routing Logic
const getPaginatedSets = async (params?: PaginatedSetsParams): Promise<PaginatedSetsResponse> => {
    const { page = 1, limit = 20, year, search } = params || {};

    if (search && search.trim()) {
        // Route to search API for text searches
        const searchParams: SetSearchParams = {
            query: search.trim(),
            page,
            limit,
            ...(year && { year })
        };

        const response = await searchSetsApi(searchParams);

        // Calculate pagination metadata
        const totalPages = Math.ceil(response.count / limit);
        return {
            sets: response.data,
            total: response.count,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        };
    } else {
        // Use main sets endpoint for browsing
        const queryParams = {
            page: page.toString(),
            limit: limit.toString(),
        };

        return await unifiedApiClient.apiGet<PaginatedSetsResponse>(
            '/sets',
            'paginated sets',
            { params: queryParams }
        );
    }
};
```

#### 2. Generic Resource Operations Integration
```typescript
// CRUD Operations Configuration
    ISet,
// Available Operations:
- getAll(params?: { limit?: number }): Promise<ISet[]>
- getById(id: string): Promise<ISet>
- search(params: any): Promise<ISet[]>
```

#### 3. Search Integration
```typescript
// Search Delegation
const searchSets = async (searchParams: any): Promise<ISet[]> => {
    const result = await searchSetsApi(searchParams);
    return result.data;
};

// Exported Search Functions
export {
    getSetSuggestions,          // Autocomplete suggestions
    getBestMatchSet,            // Single best match
} from './searchApi';
```

#### 4. ID Mapping and Transformation
```typescript
// Consistent ID Transformation
- All operations use idMapper transform
- MongoDB _id converted to id field
- Applied to getAll and getById operations
- Ensures frontend compatibility
```

### Backend Requirements

1. **Data Model Requirements**:
   - MongoDB document structure for sets
   - Unique constraints on setName + year
   - Indexed fields for common queries
   - Aggregate calculations for totals

2. **Pagination Implementation**:
   - Efficient offset/limit queries
   - Total count calculation
   - Performance optimization for large datasets

3. **Search Integration**:
   - Full-text search on set names

4. **Performance Requirements**:
   - Cached total calculations
   - Efficient aggregation pipelines
   - Optimized pagination queries

5. **Data Consistency**:
   - Automatic total calculations

### Usage Examples

1. **Basic Set Operations**:
```typescript
// Get all sets with limit
const sets = await getSets({ limit: 500 });

// Get set with full data
const set = await getSetById("set123");

// Create new set
const newSet = await createSet({
    setName: "Scarlet & Violet",
    year: 2023,
    totalCardsInSet: 198
});
```

2. **Paginated Browsing**:
```typescript
// Browse sets with pagination
const page1 = await getPaginatedSets({
    page: 1,
    limit: 20,
    year: 2023
});

// Search sets with pagination
const searchResults = await getPaginatedSets({
    page: 1,
    limit: 20,
    search: "Base Set",
    year: 1999
});

console.log(`Found ${searchResults.total} sets`);
console.log(`Page ${searchResults.currentPage} of ${searchResults.totalPages}`);
```

3. **Search Operations**:
```typescript
// Search sets with filters
const searchResults = await searchSets({
    query: "Base",
    minYear: 1996,
    maxYear: 2000,
    minPsaPopulation: 5000,
    limit: 15
});

// Get autocomplete suggestions
const suggestions = await getSetSuggestions("Base", 10);

// Find best match
const bestMatch = await getBestMatchSet("Base Set");
```

4. **Advanced Operations**:
