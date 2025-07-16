# Pokemon Collection Backend - Search API Reference

## Overview

This document provides a comprehensive analysis of all search functionality and API calls in the Pokemon Collection Backend. The backend implements a sophisticated hierarchical search system with multiple search types, caching, and fuzzy matching capabilities.

## Search Architecture

### Core Components

1. **Hierarchical Search System** - Multi-level context-aware search (sets → cards/products → categories)
2. **Fuzzy Matching Engine** - Advanced search with word order independence and typo tolerance
3. **Search Caching** - NodeCache-based caching with TTL and statistics
4. **Multiple Search Types** - Cards, Products, Sets, Categories, Activity search
5. **Database Optimization** - Text indexes, aggregation pipelines, and compound indexes

## Search API Endpoints

### 1. Hierarchical Search API

**Endpoint:** `GET /api/search/`

**Purpose:** Unified hierarchical search system supporting contextual filtering

**Parameters:**
- `type` (required): Search type - `sets`, `cards`, `products`, `categories`, `productSets`
- `q` (required): Search query string (1-100 characters)
- `setContext` (optional): Filter by set name for hierarchical search
- `categoryContext` (optional): Filter by category for hierarchical search
- `limit` (optional): Result limit (1-50, default: 15)

**Response Format:**
```json
{
  "success": true,
  "type": "cards",
  "query": "pikachu",
  "setContext": "Base Set",
  "categoryContext": null,
  "results": [...],
  "count": 10,
  "meta": {
    "hierarchical": true,
    "contextApplied": {
      "set": true,
      "category": false
    }
  }
}
```

**Search Types:**

#### 1.1 Sets Search (`type=sets`)
- Searches both card sets and product sets
- Aggregates card counts and product counts
- Merges results prioritizing card sets
- Includes pricing information from products

**Database Query:** MongoDB aggregation with:
- Text search on `setName`
- Lookup from `cards` collection for card counts
- Lookup from `cardmarketreferenceproducts` for product counts
- Scoring based on exact match, relevance, and popularity

#### 1.2 Cards Search (`type=cards`)
- Searches card names, base names, pokemon numbers, varieties
- Supports set context filtering
- Includes set information when requested

**Database Query:** MongoDB aggregation with:
- Fuzzy pattern matching on multiple fields
- Set lookup for filtering and information
- Scoring based on exact match, starts with, and contains
- Sorting by score and card name

#### 1.3 Products Search (`type=products`)
- Searches sealed product names with hierarchical filtering
- Supports set context and category context
- Includes availability and pricing scores

**Database Query:** MongoDB aggregation with:
- Text search on product names
- Set context filtering
- Category context filtering
- Combined scoring (text + availability + price)

#### 1.4 Categories Search (`type=categories`)
- Searches product categories
- Returns category names with product counts
- No hierarchical filtering

**Database Query:** MongoDB distinct + aggregation:
- Distinct categories from products
- Filter by query string
- Count products per category

#### 1.5 Product Sets Search (`type=productSets`)
- Searches product sets (grouped by setName)
- Used for sealed product selection
- Returns set names with product counts and pricing

**Database Query:** MongoDB aggregation with:
- Group by `setName`
- Product count and average price calculation
- Relevance scoring

### 2. Card Search API

**Endpoint:** `GET /api/cards/search-best-match`

**Purpose:** Advanced card search with fuzzy matching and popularity scoring

**Parameters:**
- `q` (optional): Search query string
- `pokemonNumber` (optional): Filter by pokemon number
- `setName` (optional): Filter by set name
- `year` (optional): Filter by set year

**Response Format:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "cardName": "Pikachu",
      "baseName": "Pikachu",
      "pokemonNumber": "25",
      "variety": "Holo",
      "set": {
        "setName": "Base Set",
        "year": 1998
      },
      "psaGrades": {...},
      "psaTotalGradedForCard": 1500
    }
  ]
}
```

**Search Algorithm:**
1. **Pre-filtering:** Pokemon number, set name, year filters applied first
2. **Fuzzy Search:** Fuse.js with weighted field matching
3. **Popularity Scoring:** PSA grade data influences ranking
4. **Exact Match Bonuses:** Prioritizes exact matches
5. **Combined Scoring:** Exact matches + fuzzy relevance + popularity

**Database Query:** MongoDB aggregation with:
- Lookup to sets collection for filtering
- Fuse.js post-processing for fuzzy matching
- Custom scoring algorithm combining multiple factors

### 3. Card Market Products Search API

**Endpoint:** `GET /api/cardmarket/`

**Purpose:** Search CardMarket reference products with advanced filtering

**Parameters:**
- `q` or `search` (optional): Search query string
- `name` (optional): Filter by product name
- `setName` (optional): Filter by set name
- `category` (optional): Filter by category
- `available` (optional): Filter by availability (true/false)
- `page` (optional): Page number for pagination
- `limit` (optional): Results per page (0 = no limit)

**Response Format:**
```json
{
  "products": [...],
  "total": 150,
  "currentPage": 1,
  "totalPages": 10,
  "hasNextPage": true,
  "hasPrevPage": false
}
```

**Search Features:**
- **Fuzzy Matching:** Uses SearchUtility for word order independence
- **Combined Scoring:** Text score + fuzzy score + availability + price
- **Pagination Support:** Optional pagination with metadata
- **Backward Compatibility:** Maintains old response format when no pagination

**Database Query:** MongoDB aggregation with:
- Text search index utilization
- Fuzzy pattern matching
- Availability and price scoring
- Sorting by combined relevance score

### 4. Activity Search API

**Endpoint:** `GET /api/activities/search`

**Purpose:** Full-text search across activity logs

**Parameters:**
- `q` (required): Search term (minimum 2 characters)
- `type` (optional): Activity type filter
- `priority` (optional): Priority filter
- `entityType` (optional): Entity type filter

**Response Format:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "searchTerm": "pikachu",
    "resultCount": 25
  }
}
```

**Search Features:**
- **Full-text Search:** Searches title, description, details, and metadata
- **Search Vector:** Pre-computed search vector for performance
- **Filter Support:** Combines search with activity filters
- **Relevance Scoring:** Based on text match relevance

**Database Query:** MongoDB find with:
- Text search across multiple fields
- Search vector optimization
- Filter combination with $and/$or operators
- Timestamp-based sorting

### 5. Sets Search API

**Endpoint:** `GET /api/sets/`

**Purpose:** Search and paginate Pokemon card sets

**Parameters:**
- Standard pagination parameters
- Set filtering options

**Response Format:**
```json
{
  "success": true,
  "data": {
    "sets": [...],
    "currentPage": 1,
    "totalPages": 5,
    "totalSets": 50,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Search Service Layer

### SearchService Class

**Location:** `/services/searchService.js`

**Core Features:**
1. **Request Deduplication:** Prevents duplicate search requests
2. **Performance Optimization:** Aggregation pipelines and indexes
3. **Fuzzy Matching:** Advanced search utilities
4. **Caching Integration:** Works with search cache middleware

**Key Methods:**

#### `searchCards(query, options)`
- Optimized card search with set context filtering
- Fuzzy pattern matching using SearchUtility
- Aggregation pipeline with scoring and sorting
- Set information lookup when requested

#### `searchCardMarketProducts(query, options)`
- Independent product search (no hierarchical filtering)
- Text search with fuzzy pattern enhancement
- Availability and pricing consideration
- Combined relevance scoring

#### `globalSearch(query, options)`
- Searches across multiple collections simultaneously
- Parallel execution for performance
- Unified result format

#### `getSearchSuggestions(query, options)`
- Autocomplete functionality
- Prefix matching with fuzzy enhancement
- Relevance scoring for suggestions
- Deduplication and ranking

### SearchUtility Class

**Location:** `/services/searchService.js`

**Core Features:**
1. **Query Normalization:** Handles special characters and spacing
2. **Fuzzy Patterns:** Word order independence
3. **MongoDB Regex:** Optimized regex patterns for database queries
4. **Relevance Scoring:** Multi-factor relevance calculation

**Key Methods:**

#### `normalizeQuery(query)`
- Removes special characters while preserving spaces
- Converts to lowercase
- Handles multiple spaces

#### `createFuzzyPatterns(query)`
- Generates word permutations for order independence
- Creates partial matching patterns
- Limits permutations to prevent explosion

#### `createMongoRegexPatterns(query)`
- Converts fuzzy patterns to MongoDB regex
- Escapes special regex characters
- Adds word boundary patterns

#### `calculateRelevanceScore(text, originalQuery)`
- Exact match bonuses
- Starts-with bonuses
- Word match ratio calculation
- Length similarity scoring

## Database Indexes and Optimization

### Card Model Indexes

```javascript
// Text search index for full-text search
{
  cardName: 'text',
  baseName: 'text',
  pokemonNumber: 'text',
  variety: 'text'
}

// Compound indexes for efficient queries
{ setId: 1, cardName: 1, pokemonNumber: 1, variety: 1 } // Unique constraint
{ cardName: 1 }
{ baseName: 1 }
{ setId: 1, cardName: 1 }
{ setId: 1, pokemonNumber: 1 }
```

### CardMarketReferenceProduct Model Indexes

```javascript
// Text search index
{
  name: 'text',
  setName: 'text'
}

// Compound and single field indexes
{ name: 1, setName: 1, category: 1 } // Unique constraint
{ category: 1 }
{ name: 1 }
{ setName: 1 }
```

### Activity Model Indexes

```javascript
// Text search index
{
  title: 'text',
  description: 'text',
  details: 'text'
}

// Compound indexes for filtering
{ type: 1, timestamp: -1 }
{ entityType: 1, entityId: 1 }
{ priority: 1, status: 1 }
{ timestamp: -1, isArchived: 1 }
```

## Search Caching System

### Cache Configuration

**Location:** `/middleware/searchCache.js`

**Settings:**
- **TTL:** 5 minutes (300 seconds)
- **Check Period:** 1 minute (60 seconds)
- **Storage:** In-memory using NodeCache
- **Clone Mode:** Disabled for performance

### Cache Key Strategy

**Format:** `{route}:{serialized_query_params}`

**Included Parameters:**
- `q` (query string)
- `limit` (result limit)
- `category` (category filter)
- `setId` (set ID filter)
- `setName` (set name filter)
- `setContext` (hierarchical search context)
- `categoryContext` (hierarchical search context)
- `type` (search type)
- `year` (year filter)
- `pokemonNumber` (pokemon number filter)

### Cache Statistics

**Metrics Tracked:**
- Hit rate percentage
- Total hits and misses
- Cache gets and sets
- Key count and size

### Cache Management

**Methods:**
- `clearSearchCache()` - Flush all cached results
- `getCacheStats()` - Get cache performance metrics
- `warmupCache(queries)` - Pre-populate cache with common queries

## Error Handling

### Validation Errors

**Hierarchical Search:**
- Invalid search type
- Query length validation (1-100 characters)
- Context parameter validation
- Limit validation (1-50)

**Card Search:**
- Invalid ObjectId format
- Missing required parameters
- Invalid filter values

**Activity Search:**
- Minimum search term length (2 characters)
- Invalid activity type/priority values
- Invalid date ranges

### Response Format

**Error Response:**
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Query must be between 1 and 100 characters",
  "details": [...] // Optional validation details
}
```

**Success Response:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "query": "pikachu",
    "totalResults": 25,
    "queryTime": 45,
    "cached": false,
    "optimized": true
  }
}
```

## Performance Considerations

### Query Optimization

1. **Aggregation Pipelines:** Used for complex searches with scoring
2. **Index Utilization:** Text indexes for full-text search
3. **Limit Application:** Early result limiting in pipelines
4. **Projection:** Only required fields returned
5. **Parallel Execution:** Multiple collections searched simultaneously

### Search Performance Metrics

**Typical Response Times:**
- Card search: 15-50ms
- Product search: 20-60ms
- Hierarchical search: 25-75ms
- Activity search: 10-30ms

**Optimization Techniques:**
- Pre-computed search vectors
- Fuzzy pattern caching
- Request deduplication
- Result caching with TTL
- Index-optimized queries

### Memory Usage

**Cache Memory:**
- 5-minute TTL reduces memory footprint
- Automatic cleanup of expired entries
- Configurable cache size limits

**Query Memory:**
- Aggregation pipeline memory limits
- Result set size limitations
- Efficient projection to reduce data transfer

## Search Types and Use Cases

### 1. Hierarchical Search Use Cases

**Set → Cards Flow:**
1. User searches for "Base Set"
2. System returns matching sets
3. User selects "Base Set"
4. Subsequent card searches filtered to "Base Set"

**Category → Products Flow:**
1. User searches for "Booster Box"
2. System returns matching categories
3. User selects "Booster Box"
4. Subsequent product searches filtered to "Booster Box"

### 2. Best Match Search Use Cases

**Card Collection:**
- Finding specific cards by name
- Fuzzy matching for misspellings
- Popularity-based ranking
- Set and year filtering

### 3. Product Search Use Cases

**Sealed Product Management:**
- Finding products by name or set
- Availability-based filtering
- Price range considerations
- Category-specific searches

### 4. Activity Search Use Cases

**Activity Monitoring:**
- Finding specific activities
- Filtering by type and priority
- Full-text search across metadata
- Timeline-based queries

## Search Algorithm Details

### Fuzzy Matching Algorithm

**Step 1: Query Normalization**
- Remove special characters
- Convert to lowercase
- Normalize whitespace

**Step 2: Pattern Generation**
- Create word permutations
- Generate partial matches
- Build regex patterns

**Step 3: Database Query**
- Use text indexes where possible
- Apply fuzzy patterns as fallback
- Combine with exact match queries

**Step 4: Relevance Scoring**
- Exact match: 100 points
- Starts with: 50 points
- Contains: 10-30 points
- Word match ratio: 0-30 points

### Hierarchical Search Algorithm

**Level 1: Set Search**
- Search both card sets and product sets
- Aggregate counts and metadata
- Merge results with deduplication

**Level 2: Card/Product Search**
- Apply set context filtering
- Use optimized queries for filtered results
- Include autofill information

**Level 3: Category Search**
- Filter by category context
- Apply hierarchical constraints
- Maintain search relevance

## API Integration Examples

### Frontend Integration

**Hierarchical Search Example:**
```javascript
// Step 1: Search sets
const setsResponse = await fetch('/api/search/?type=sets&q=base');

// Step 2: Search cards in selected set
const cardsResponse = await fetch('/api/search/?type=cards&q=pikachu&setContext=Base Set');

// Step 3: Handle autofill
// If user selects card, automatically fill set information
```

**Best Match Search Example:**
```javascript
// Advanced card search with multiple filters
const searchResponse = await fetch('/api/cards/search-best-match?q=charizard&setName=Base Set&year=1998');
```

### Mobile App Integration

**Autocomplete Example:**
```javascript
// Get search suggestions
const suggestions = await fetch('/api/search/suggestions?q=pika&type=cards&limit=10');
```

**Offline Search Example:**
```javascript
// Cache search results for offline use
const results = await fetch('/api/search/?type=cards&q=common');
localStorage.setItem('searchResults', JSON.stringify(results));
```

## Security Considerations

### Input Validation

**Query Sanitization:**
- Maximum length limits
- Special character handling
- SQL injection prevention
- XSS prevention

**Parameter Validation:**
- Enum validation for types
- Range validation for limits
- Format validation for IDs

### Rate Limiting

**Search Rate Limits:**
- Per-IP rate limiting
- Per-user rate limiting
- Cache-based rate limiting
- Burst protection

### Data Protection

**Sensitive Data:**
- No sensitive data in search responses
- Audit logging for searches
- Access control for admin searches

## Monitoring and Analytics

### Search Metrics

**Performance Metrics:**
- Average response time
- Cache hit rates
- Query frequency
- Error rates

**Usage Analytics:**
- Most searched terms
- Popular search types
- User search patterns
- Conversion rates

### Logging

**Search Logging:**
- Query performance logging
- Error logging with stack traces
- Cache performance logging
- User activity logging

### Health Checks

**Search Health:**
- Database connectivity
- Cache availability
- Index health
- Response time monitoring

## Future Enhancements

### Planned Features

1. **Machine Learning Integration**
   - Personalized search results
   - Query suggestion improvements
   - Relevance scoring optimization

2. **Advanced Filtering**
   - Date range filtering
   - Price range filtering
   - Advanced boolean queries

3. **Search Analytics**
   - Real-time search metrics
   - User behavior analysis
   - Performance optimization

4. **Multi-language Support**
   - International card names
   - Localized search terms
   - Language-specific relevance

### Technical Improvements

1. **Elasticsearch Integration**
   - Advanced full-text search
   - Better relevance scoring
   - Faceted search capabilities

2. **Search Optimization**
   - Query plan optimization
   - Index tuning
   - Caching improvements

3. **API Enhancements**
   - GraphQL search endpoint
   - Streaming search results
   - Real-time search updates

## Conclusion

The Pokemon Collection Backend implements a comprehensive search system with hierarchical filtering, fuzzy matching, and performance optimization. The system supports multiple search types, advanced caching, and provides detailed analytics for monitoring and optimization.

Key strengths include:
- Hierarchical context-aware search
- Advanced fuzzy matching with typo tolerance
- Comprehensive caching strategy
- Detailed performance monitoring
- Flexible API design

The search system is designed to handle the complex requirements of Pokemon card collection management while maintaining high performance and user experience.