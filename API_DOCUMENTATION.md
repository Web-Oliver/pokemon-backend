# Pokemon Collection Backend API Documentation

## Overview

This document provides comprehensive documentation for the Pokemon Collection Backend API, a sophisticated Node.js/Express API built for managing Pokemon card collections. The system follows SOLID principles and implements modern patterns including CRUD factories, plugin architecture, and comprehensive activity tracking.

**Base URL**: `http://localhost:3000/api`

## Architecture Overview

### Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **File Processing**: Sharp (image processing)
- **Caching**: Advanced multi-layer caching system
- **Architecture**: Service Layer Pattern, CRUD Factory Pattern, Plugin Architecture

### Core Features
- Pokemon card collection management (PSA graded, raw cards, sealed products)
- Auction system for selling collections
- Advanced search with caching and suggestions
- Image upload with automatic thumbnail generation
- Export functionality (ZIP, DBA marketplace integration)
- Comprehensive activity tracking
- Automated backup system

---

## Data Models

### 1. Set Model
**Purpose**: Defines Pokemon card sets with metadata and PSA population data

**Schema**:
```javascript
{
  setName: String (required, unique),
  year: Number (required), 
  setUrl: String (required),
  totalCardsInSet: Number (required),
  totalPsaPopulation: Number (required)
}
```

**Indexes**: `setName` (unique)

### 2. Card Model  
**Purpose**: Reference data for Pokemon cards with PSA grading statistics

**Schema**:
```javascript
{
  setId: ObjectId (ref: 'Set', required),
  pokemonNumber: String,
  cardName: String (required),
  baseName: String (required), 
  variety: String,
  psaGrades: {
    psa_1: Number (default: 0),
    psa_2: Number (default: 0),
    // ... psa_3 through psa_10
    psa_10: Number (default: 0)
  },
  psaTotalGradedForCard: Number (required)
}
```

**Relationships**: Belongs to Set

### 3. PsaGradedCard Model
**Purpose**: User's PSA graded cards in their collection

**Schema**:
```javascript
{
  cardId: ObjectId (ref: 'Card', required),
  grade: String (required),
  images: [String],
  myPrice: Decimal128 (required),
  priceHistory: [{
    price: Decimal128,
    date: Date (default: Date.now),
    source: String,
    notes: String
  }],
  dateAdded: Date (default: Date.now),
  sold: Boolean (default: false),
  saleDetails: {
    payment: String,
    price: Decimal128,
    delivery: String,  
    source: String,
    buyerFirstName: String,
    buyerLastName: String,
    trackingNumber: String,
    trackingUrl: String,
    notes: String,
    saleDate: Date
  }
}
```

**Relationships**: References Card model

### 4. RawCard Model
**Purpose**: User's ungraded cards in their collection

**Schema**: Similar to PsaGradedCard but with `condition` instead of `grade`
```javascript
{
  cardId: ObjectId (ref: 'Card', required),
  condition: String (required), // Instead of grade
  // ... same fields as PsaGradedCard
}
```

### 5. SealedProduct Model
**Purpose**: User's sealed Pokemon products (booster boxes, ETBs, etc.)

**Schema**:
```javascript
{
  productId: ObjectId (ref: 'CardMarketReferenceProduct', required),
  category: String (enum: [
    'Blisters', 'Booster-Boxes', 'Boosters', 'Box-Sets', 
    'Elite-Trainer-Boxes', 'Theme-Decks', 'Tins', 'Trainer-Kits'
  ]),
  setName: String (required),
  name: String (required),
  availability: Number (required),
  cardMarketPrice: Decimal128 (required),
  myPrice: Decimal128 (required),
  priceHistory: PriceHistorySchema,
  images: [String],
  dateAdded: Date (default: Date.now),
  sold: Boolean (default: false),
  saleDetails: SaleDetailsSchema
}
```

### 6. CardMarketReferenceProduct Model
**Purpose**: Reference data for sealed products from CardMarket

**Schema**:
```javascript
{
  name: String (required),
  setName: String (required),
  available: Number (required),
  price: String (required),
  category: String (required),
  url: String (required),
  lastUpdated: Date
}
```

### 7. Auction Model
**Purpose**: Auction events containing various collection items

**Schema**:
```javascript
{
  topText: String (required),
  bottomText: String (required),
  auctionDate: Date,
  status: String (enum: ['draft', 'active', 'sold', 'expired']),
  generatedFacebookPost: String,
  isActive: Boolean (default: true),
  items: [{
    itemId: ObjectId (required, refPath: 'items.itemCategory'),
    itemCategory: String (enum: ['SealedProduct', 'PsaGradedCard', 'RawCard']),
    sold: Boolean (default: false),
    soldPrice: Number,
    soldDate: Date
  }],
  totalValue: Number,
  soldValue: Number,
  createdAt: Date (default: Date.now),
  updatedAt: Date (default: Date.now)
}
```

**Features**: Dynamic references using `refPath` for polymorphic relationships

### 8. Activity Model
**Purpose**: Comprehensive activity tracking for all user actions

**Schema**:
```javascript
{
  type: String (required), // 'create', 'update', 'delete', 'sold', etc.
  entityType: String (required), // 'PsaGradedCard', 'RawCard', etc.
  entityId: ObjectId (required),
  title: String (required),
  description: String,
  metadata: Mixed, // Rich contextual data
  priority: String (enum: ['low', 'medium', 'high', 'critical']),
  read: Boolean (default: false),
  archived: Boolean (default: false),
  timestamp: Date (default: Date.now)
}
```

**Features**: Timeline-based organization, flexible filtering, auto-generated relative timestamps

### 9. DbaSelection Model
**Purpose**: Tracks items selected for DBA (Danish marketplace) listing

**Schema**:
```javascript
{
  itemId: ObjectId (required),
  itemType: String (required),
  selectionDate: Date (default: Date.now),
  expirationDate: Date, // 60 days from selection
  status: String (enum: ['selected', 'posted', 'sold', 'expired'])
}
```

**Features**: 60-day countdown system for marketplace listings

---

## API Endpoints

### 1. Sets API (`/api/sets`)

#### GET `/api/sets`
**Purpose**: Get all Pokemon sets with pagination  
**Caching**: 20 minutes  
**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "setName": "Base Set",
      "year": 1998,
      "setUrl": "https://...",
      "totalCardsInSet": 102,
      "totalPsaPopulation": 125000
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "pages": 3
  }
}
```

#### GET `/api/sets/:id`
**Purpose**: Get specific set by ID  
**Caching**: 20 minutes  
**Response**: Single Set object

#### GET `/api/sets/:setId/cards`
**Purpose**: Get all cards for a specific set  
**Caching**: 10 minutes  
**Response**: Array of Card objects with populated set information

### 2. Cards API (`/api/cards`)

#### GET `/api/cards`
**Purpose**: Get all cards with advanced filtering and plugin support  
**Caching**: 8 minutes  
**Query Parameters**: Standard pagination and filtering

#### GET `/api/cards/:id`
**Purpose**: Get card by ID with enhanced details  
**Caching**: 10 minutes

#### GET `/api/cards/search-best-match`
**Purpose**: Advanced search with improved algorithms and scoring  
**Caching**: 5 minutes  
**Query Parameters**:
- `q`: Search term
- `pokemonNumber`: Filter by Pokemon number
- `setName`: Filter by set name
- `year`: Filter by year

#### GET `/api/cards/metrics`
**Purpose**: Card metrics and statistics  
**Caching**: 15 minutes

#### POST `/api/cards`
**Purpose**: Create new card  
**Request Body**:
```json
{
  "setId": "ObjectId",
  "cardName": "Charizard",
  "baseName": "Charizard",
  "pokemonNumber": "4",
  "variety": "Holo",
  "psaTotalGradedForCard": 5000
}
```

#### PUT `/api/cards/:id`
**Purpose**: Update existing card

#### DELETE `/api/cards/:id`
**Purpose**: Delete card

### 3. Collection Items APIs

The following APIs use the **CRUD Factory Pattern** for consistency:

#### PSA Graded Cards (`/api/psa-graded-cards`)
#### Raw Cards (`/api/raw-cards`)  
#### Sealed Products (`/api/sealed-products`)

**Standard CRUD Operations for all collection types**:

##### GET `/api/{collection-type}`
**Purpose**: Get all items with filtering  
**Caching**: 5 minutes for collection items  
**Query Parameters**:
- `sold`: Filter by sold status
- `grade`: Filter by grade (PSA cards only)
- `condition`: Filter by condition (raw cards only)
- `category`: Filter by category (sealed products only)
- `setName`: Filter by set name
- `sort`: Sort field
- `order`: Sort direction (asc/desc)

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "_id": "ObjectId",
      "cardId": "ObjectId", // or productId for sealed products
      "grade": "PSA 10", // or condition for raw cards
      "images": ["image1.jpg", "image2.jpg"],
      "myPrice": "150.00",
      "sold": false,
      "dateAdded": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

##### GET `/api/{collection-type}/:id`
**Purpose**: Get item by ID  
**Caching**: 10 minutes

##### POST `/api/{collection-type}`
**Purpose**: Create new item  
**Request Body** (PSA Graded Card example):
```json
{
  "cardId": "ObjectId",
  "grade": "PSA 10",
  "myPrice": 150.00,
  "images": ["image1.jpg"]
}
```

##### PUT `/api/{collection-type}/:id`
**Purpose**: Update existing item

##### DELETE `/api/{collection-type}/:id`
**Purpose**: Delete item

##### POST `/api/{collection-type}/:id/mark-sold`
**Purpose**: Mark item as sold  
**Request Body**:
```json
{
  "saleDetails": {
    "payment": "PayPal",
    "price": 145.00,
    "delivery": "DHL",
    "source": "eBay",
    "buyerFirstName": "John",
    "buyerLastName": "Doe",
    "trackingNumber": "123456789",
    "notes": "Quick sale"
  }
}
```

### 4. Unified Search API (`/api/search`)

#### GET `/api/search`
**Purpose**: Unified search across all entity types  
**Query Parameters**:
- `query`: Search term (required)
- `types`: Comma-separated entity types to search (optional)
- `limit`: Results per page (default: 20)
- `page`: Page number (default: 1)
- `sort`: Sort field (default: relevance)
- `filters`: JSON-encoded filter object

**Response**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "_id": "ObjectId",
        "type": "Card",
        "cardName": "Charizard",
        "setName": "Base Set",
        "relevanceScore": 0.95
      }
    ],
    "pagination": { /* pagination info */ },
    "facets": {
      "types": { "Card": 15, "PsaGradedCard": 8 },
      "sets": { "Base Set": 10, "Jungle": 5 }
    }
  }
}
```

#### GET `/api/search/suggest`
**Purpose**: Search suggestions and auto-complete  
**Caching**: 15 minutes  
**Query Parameters**:
- `query`: Partial search term
- `limit`: Number of suggestions (default: 5)

#### GET `/api/search/cards`
**Purpose**: Card-specific search  
**Caching**: 8 minutes

#### GET `/api/search/products`
**Purpose**: Product-specific search  
**Caching**: 5 minutes

#### GET `/api/search/sets`
**Purpose**: Set-specific search  
**Caching**: 20 minutes

#### GET `/api/search/types`
**Purpose**: Get available search entity types

#### GET `/api/search/stats`
**Purpose**: Search factory statistics and performance metrics

### 5. Auctions API (`/api/auctions`)

#### GET `/api/auctions`
**Purpose**: Get all auctions  
**Query Parameters**:
- `status`: Filter by auction status
- `active`: Filter by active status

#### GET `/api/auctions/:id`
**Purpose**: Get auction by ID with populated items

#### POST `/api/auctions`
**Purpose**: Create new auction  
**Request Body**:
```json
{
  "topText": "Pokemon Collection Auction",
  "bottomText": "High-grade cards and sealed products",
  "auctionDate": "2024-02-01T10:00:00.000Z",
  "status": "draft"
}
```

#### PUT `/api/auctions/:id`
**Purpose**: Update auction

#### DELETE `/api/auctions/:id`
**Purpose**: Delete auction

#### POST `/api/auctions/:id/add-item`
**Purpose**: Add item to auction  
**Request Body**:
```json
{
  "itemId": "ObjectId",
  "itemCategory": "PsaGradedCard"
}
```

#### POST `/api/auctions/:id/items`
**Purpose**: Alternative route for adding items

#### DELETE `/api/auctions/:id/remove-item`
**Purpose**: Remove item from auction  
**Request Body**:
```json
{
  "itemId": "ObjectId"
}
```

#### POST `/api/auctions/:id/mark-item-sold`
**Purpose**: Mark auction item as sold  
**Request Body**:
```json
{
  "itemId": "ObjectId",
  "soldPrice": 150.00,
  "soldDate": "2024-01-15T14:30:00.000Z"
}
```

#### PATCH `/api/auctions/:id/items/sold`
**Purpose**: Alternative route for marking items sold

### 6. Upload API (`/api/upload`)

#### POST `/api/upload/image`
**Purpose**: Upload single image with automatic thumbnail generation  
**File Size Limit**: 200MB  
**Supported Formats**: JPEG, PNG  
**Request**: Multipart form data with `image` field

**Response**:
```json
{
  "success": true,
  "data": {
    "filename": "unique-filename.jpg",
    "originalName": "card-image.jpg",
    "size": 1024000,
    "thumbnail": "unique-filename-thumb.jpg",
    "url": "/uploads/unique-filename.jpg",
    "thumbnailUrl": "/uploads/unique-filename-thumb.jpg"
  }
}
```

#### POST `/api/upload/images`
**Purpose**: Upload multiple images  
**Request**: Multipart form data with `images` field (array)

**Response**:
```json
{
  "success": true,
  "data": [
    { /* individual image response */ },
    { /* individual image response */ }
  ]
}
```

#### DELETE `/api/upload/cleanup`
**Purpose**: Cleanup orphaned uploaded images  
**Query Parameters**:
- `filename`: Specific file to cleanup
- `olderThan`: Cleanup files older than specified hours

#### DELETE `/api/upload/cleanup-all`
**Purpose**: Cleanup all orphaned images

**Features**:
- Automatic thumbnail generation using Sharp
- Unique filename generation to prevent conflicts
- File validation (type, size)
- Orphaned file cleanup utilities

### 7. Sales API (`/api/sales`)

#### GET `/api/sales`
**Purpose**: Get sales data with filtering  
**Query Parameters**:
- `startDate`: Filter sales from date
- `endDate`: Filter sales to date
- `itemType`: Filter by item type

**Response**:
```json
{
  "success": true,
  "data": {
    "sales": [
      {
        "itemId": "ObjectId",
        "itemType": "PsaGradedCard",
        "salePrice": 150.00,
        "saleDate": "2024-01-15T14:30:00.000Z",
        "source": "eBay",
        "profit": 25.00
      }
    ],
    "summary": {
      "totalSales": 10,
      "totalRevenue": 1500.00,
      "totalProfit": 250.00
    }
  }
}
```

#### GET `/api/sales/summary`
**Purpose**: Get sales summary statistics

#### GET `/api/sales/graph-data`
**Purpose**: Get sales data formatted for charts/graphs

### 8. Export API (`/api/export`)

#### ZIP Export Routes:

##### GET `/api/export/zip/psa-cards`
**Purpose**: Export PSA card images as ZIP  
**Query Parameters**:
- `ids`: Comma-separated card IDs (optional, exports all if not specified)

**Response**: ZIP file download with organized folder structure

##### GET `/api/export/zip/raw-cards`
**Purpose**: Export raw card images as ZIP

##### GET `/api/export/zip/sealed-products`
**Purpose**: Export sealed product images as ZIP

#### DBA Integration Routes:

##### POST `/api/export/dba`
**Purpose**: Export to DBA (Danish marketplace) format  
**Request Body**:
```json
{
  "items": [
    {
      "itemId": "ObjectId",
      "itemType": "PsaGradedCard",
      "price": 150.00,
      "description": "Custom description"
    }
  ]
}
```

##### GET `/api/export/dba/download`
**Purpose**: Download prepared DBA export as ZIP

##### POST `/api/export/dba/post`
**Purpose**: Post directly to DBA marketplace  
**Request Body**:
```json
{
  "exportId": "ObjectId",
  "credentials": {
    "username": "user",
    "password": "pass"
  }
}
```

##### GET `/api/export/dba/status`
**Purpose**: Get DBA integration status and statistics

##### POST `/api/export/dba/test`
**Purpose**: Test DBA integration without posting

### 9. Activity Tracking API (`/api/activities`)

#### GET `/api/activities`
**Purpose**: Get activities with comprehensive filtering  
**Query Parameters**:
- `limit`: Number of activities (default: 50)
- `offset`: Skip activities (default: 0)
- `type`: Filter by activity type
- `entityType`: Filter by entity type
- `entityId`: Filter by specific entity
- `priority`: Filter by priority level
- `dateRange`: JSON-encoded date range object
- `search`: Full-text search in titles and descriptions
- `read`: Filter by read status
- `archived`: Filter by archived status

**Response**:
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "_id": "ObjectId",
        "type": "create",
        "entityType": "PsaGradedCard",
        "entityId": "ObjectId",
        "title": "Added PSA 10 Charizard",
        "description": "Added PSA 10 Charizard from Base Set",
        "metadata": {
          "cardName": "Charizard",
          "grade": "PSA 10",
          "price": 150.00
        },
        "priority": "medium",
        "read": false,
        "timestamp": "2024-01-15T14:30:00.000Z",
        "relativeTime": "2 hours ago"
      }
    ],
    "pagination": { /* pagination info */ },
    "stats": {
      "total": 150,
      "unread": 25,
      "byType": { "create": 50, "update": 30, "delete": 10 }
    }
  }
}
```

#### GET `/api/activities/stats`
**Purpose**: Activity statistics and metrics

#### GET `/api/activities/types`
**Purpose**: Get available activity types

#### GET `/api/activities/recent`
**Purpose**: Get recent activities (last 24 hours)

#### GET `/api/activities/entity/:entityType/:entityId`
**Purpose**: Get activities for specific entity

#### GET `/api/activities/search`
**Purpose**: Full-text search in activity titles and descriptions  
**Query Parameters**:
- `query`: Search term
- `entityType`: Limit search to entity type

#### GET `/api/activities/:id`
**Purpose**: Get specific activity details

#### POST `/api/activities`
**Purpose**: Create manual activity entry  
**Request Body**:
```json
{
  "type": "custom",
  "entityType": "System",
  "entityId": "manual",
  "title": "Manual activity",
  "description": "Custom activity created manually",
  "priority": "medium",
  "metadata": {
    "source": "manual",
    "user": "admin"
  }
}
```

#### PATCH `/api/activities/:id/read`
**Purpose**: Mark activity as read

#### DELETE `/api/activities/:id`
**Purpose**: Archive activity (soft delete)

#### POST `/api/activities/archive-old`
**Purpose**: Archive activities older than specified days  
**Request Body**:
```json
{
  "days": 30
}
```

### 10. Backup System API (`/api/backup`)

#### GET `/api/backup/health`
**Purpose**: Health check for backup system

#### GET `/api/backup/status`
**Purpose**: Backup service status and configuration

#### GET `/api/backup/config`
**Purpose**: Get backup configuration

#### POST `/api/backup/initialize`
**Purpose**: Initialize backup service

#### POST `/api/backup/start-scheduled`
**Purpose**: Start scheduled backups

#### POST `/api/backup/stop-scheduled`
**Purpose**: Stop scheduled backups

#### POST `/api/backup/manual`
**Purpose**: Trigger manual backup  
**Request Body**:
```json
{
  "type": "full", // or "incremental"
  "compression": true,
  "description": "Manual backup before update"
}
```

#### POST `/api/backup/test`
**Purpose**: Test backup system without creating actual backup

#### GET `/api/backup/history`
**Purpose**: Get backup history with filtering

#### GET `/api/backup/:backupId`
**Purpose**: Get specific backup details

### 11. Additional APIs

#### Card Market Reference Products (`/api/cardmarket-ref-products`)
**Purpose**: Read-only access to CardMarket reference data  
**Standard GET operations with caching**

#### DBA Selection (`/api/dba-selection`)
**Purpose**: Manage DBA marketplace selection with 60-day countdown

#### Status & Health (`/api/status`, `/api/health`)
**Purpose**: System health monitoring and status checks

---

## Middleware & System Features

### 1. Caching System

**Advanced Search Cache**:
- Intelligent caching with TTL (Time To Live)
- Cache invalidation on data changes
- Multiple cache layers for different data types

**Cache Configuration**:
- Sets: 20 minutes
- Cards: 8-10 minutes  
- Collection items: 5 minutes
- Search results: 5-15 minutes depending on type

### 2. Response Transformation

**Standard API Response Format**:
```json
{
  "success": true,
  "data": { /* response data */ },
  "pagination": { /* pagination info if applicable */ },
  "metadata": { /* additional metadata */ }
}
```

**Error Response Format**:
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": { /* additional error details */ }
  }
}
```

### 3. Error Handling

**Custom Error Classes**:
- `ValidationError`: Input validation failures
- `NotFoundError`: Resource not found
- `AppError`: General application errors

**Error Middleware**: Centralized error handling with appropriate HTTP status codes

### 4. Query Optimization

**Plugin System**:
- Automatic query optimization
- Performance tracking
- Index recommendations

**Features**:
- Automatic indexing suggestions
- Query performance monitoring
- Slow query detection

### 5. Activity Tracking

**Automatic Activity Generation**:
- All CRUD operations generate activities
- Rich metadata collection
- Configurable activity types and priorities

**Activity Types**:
- `create`: Item creation
- `update`: Item updates
- `delete`: Item deletion
- `sold`: Item sold
- `export`: Export operations
- `backup`: Backup operations

### 6. Image Management

**Image Processing with Sharp**:
- Automatic thumbnail generation
- Image compression and optimization
- Format conversion (JPEG/PNG)

**Image Management Features**:
- Unique filename generation
- Orphaned image detection and cleanup
- Image validation and size limits

---

## Security & Performance

### Security Features

**File Upload Security**:
- File type validation (JPEG/PNG only)
- File size limits (200MB maximum)
- Unique filename generation to prevent conflicts
- Input validation middleware

**Data Validation**:
- Mongoose schema validation
- Request body validation
- Query parameter sanitization

### Performance Features

**Caching Strategy**:
- Multi-layer caching system
- Intelligent cache invalidation
- Cache warming for frequently accessed data

**Database Optimization**:
- Optimized database queries
- Strategic indexing
- Query performance monitoring

**Image Optimization**:
- Automatic thumbnail generation
- Image compression
- Lazy loading support

**Response Optimization**:
- Response compression
- Pagination for large datasets
- Efficient data serialization

### Monitoring & Logging

**Health Monitoring**:
- Health check endpoints
- Performance metrics collection
- Error tracking and logging

**Activity Logging**:
- Comprehensive activity tracking
- System event logging
- Performance monitoring

---

## Architecture Patterns

### 1. CRUD Factory Pattern
**Used for**: Collection items (PSA cards, raw cards, sealed products)  
**Benefits**: Eliminates code duplication, ensures consistency across similar entities

### 2. Strategy Pattern  
**Used for**: Search functionality with different algorithms for different entity types  
**Benefits**: Flexible search implementations, easy to extend

### 3. Plugin Architecture
**Used for**: Query optimization, activity tracking  
**Benefits**: Modular functionality, easy to extend and configure

### 4. Service Layer Pattern
**Used for**: Business logic separation  
**Benefits**: Clean separation of concerns, testable business logic

### 5. Repository Pattern
**Used for**: Data access abstraction  
**Benefits**: Database abstraction, easier testing and maintenance

---

## Development and Deployment

### Environment Configuration
- Development, staging, and production environments
- Environment-specific configurations
- Database connection management

### API Versioning
- URL-based versioning (`/api/v1/`)
- Backward compatibility maintenance
- Deprecation handling

### Testing
- Unit tests for business logic
- Integration tests for API endpoints
- End-to-end testing for critical workflows

### Documentation
- Comprehensive API documentation
- Code documentation and comments
- Database schema documentation

---

This API provides a comprehensive solution for Pokemon card collection management with robust features for data management, search, export, analytics, and marketplace integration. The system is built with scalability, maintainability, and performance in mind, following modern software engineering practices and patterns.