1# Pokemon Collection Backend - Comprehensive System Documentation
2
3## **1. Core System Overview**
4
5### **Purpose and Goals**
6
7The Pokemon Collection Backend is a comprehensive Node.js/Express.js REST API designed to manage a Pokemon card collection database. The system serves as the backend for a full-stack Pokemon card collection management application, providing complete CRUD operations for PSA graded cards, raw cards, sealed products, and auction management with integrated pricing analytics and sales tracking.
8
9**Primary Objectives:**
10- **Collection Management**: Complete lifecycle management of Pokemon cards (PSA graded, raw condition) and sealed products
11- **Financial Tracking**: Comprehensive price history, sales analytics, and profit/loss calculations
12- **Auction Management**: Sophisticated auction system with polymorphic item relationships
13- **External Integration**: Platform-specific formatters for DBA and Facebook marketplace integration
14- **Search & Discovery**: Advanced fuzzy search with caching and performance optimization
15- **Data Integrity**: Referential integrity maintenance across complex relationships
16
17### **Architectural Style**
18
19**Monolithic Architecture** with layered service-oriented design principles and domain-driven design patterns.
20
21**Rationale for Architectural Choice:**
22- **Simplicity**: Single deployable unit reduces complexity for a focused domain
23- **Data Consistency**: Centralized database ensures referential integrity across Pokemon cards, sets, and pricing data
24- **Development Speed**: Unified codebase accelerates feature development and debugging
25- **Performance**: Local service calls avoid network latency of microservices
26- **Testing**: Simplified integration testing with single database instance
27- **Domain Cohesion**: Pokemon card collection represents a cohesive business domain
28
29### **Key Components/Services**
30
31
|
 Component 
|
 Primary Responsibility 
|
 Advanced Features 
|
32
|
-----------
|
----------------------
|
-------------------
|
33
|
**
Controllers
**
|
 HTTP request handling, input validation, response formatting 
|
 Modular sub-controllers for complex domains 
|
34
|
**
Services
**
|
 Business logic implementation, data processing, external integrations 
|
 Query/CRUD separation, analytics services 
|
35
|
**
Models
**
|
 MongoDB schema definitions, data validation, relationships 
|
 Polymorphic references, transform functions 
|
36
|
**
Middleware
**
|
 Request compression, error handling, search caching 
|
 Request deduplication, performance monitoring 
|
37
|
**
Routes
**
|
 API endpoint routing and parameter handling 
|
 Versioned routing with middleware composition 
|
38
|
**
Utils
**
|
 Data import coordination, name formatting, error handling utilities 
|
 Multi-phase import system, platform formatters 
|
39

40### **Technology Stack**
41
42
|
 Category 
|
 Technology 
|
 Version 
|
 Purpose 
|
 Configuration Notes 
|
43
|
----------
|
------------
|
---------
|
---------
|
-------------------
|
44
|
**
Runtime
**
|
 Node.js 
|
 Latest LTS 
|
 JavaScript runtime environment 
|
 Development & production deployment 
|
45
|
**
Web Framework
**
|
 Express.js 
|
 5.1.0 
|
 HTTP server and middleware 
|
 200MB body limit, 50K parameter limit 
|
46
|
**
Database
**
|
 MongoDB 
|
 Latest 
|
 Document database for flexible schema 
|
 Text search indexes, compound indexes 
|
47
|
**
ODM
**
|
 Mongoose 
|
 8.16.1 
|
 MongoDB object modeling and validation 
|
 Schema transforms, middleware hooks 
|
48
|
**
Search
**
|
 Fuse.js 
|
 7.1.0 
|
 Fuzzy search and text matching 
|
 Weighted scoring, threshold tuning 
|
49
|
**
Caching
**
|
 node-cache 
|
 5.1.2 
|
 In-memory caching for search results 
|
 5-minute TTL, hit rate tracking 
|
50
|
**
File Upload
**
|
 Multer 
|
 2.0.1 
|
 Multipart form data handling 
|
 Large file support (200MB) 
|
51
|
**
Performance
**
|
 compression 
|
 1.7.4 
|
 Gzip response compression 
|
 Intelligent binary detection 
|
52
|
**
Security
**
|
 cors 
|
 2.8.5 
|
 Cross-origin resource sharing 
|
 Development CORS configuration 
|
53
|
**
Configuration
**
|
 dotenv 
|
 17.0.1 
|
 Environment variable management 
|
 Environment-aware configuration 
|
54

55**Development Stack:**
56- **Testing**: Mocha 11.7.1, Chai 5.2.0, Supertest 7.1.1, Sinon 21.0.0
57- **Code Quality**: ESLint 9.30.1 (200+ rules), NYC 15.1.0 for coverage
58- **Development**: Nodemon 3.1.10 for auto-restart
59- **Test Database**: MongoDB Memory Server 10.1.4 for isolated testing
60
61---
62
63## **2. Data Management**
64
65### **Database Schemas**
66
67#### **Sets Collection**
68
69```javascript
70{
71  setName: String (required, unique),      // "Base Set", "Jungle", etc.
72  year: Number (required),                 // 1998, 1999, etc.
73  setUrl: String (required),               // PSA set reference URL
74  totalCardsInSet: Number (required),      // Total cards in set
75  totalPsaPopulation: Number (required)    // Total PSA graded cards
76}
77```
78
79**Indexes:**
80- Unique index on `setName`
81- Compound index: `{year: 1, setName: 1}` for year-based queries
82
83#### **Cards Collection**
84
85```javascript
86{
87  setId: ObjectId (required),              // Reference to Sets collection
88  pokemonNumber: String,                   // Card number in set
89  cardName: String (required),             // Full card name
90  baseName: String (required),             // Pokemon base name
91  variety: String,                         // Holo, Non-Holo, etc.
92  psaGrades: {                            // PSA population by grade
93    psa_1: Number, psa_2: Number, ..., psa_10: Number
94  },
95  psaTotalGradedForCard: Number (required)
96}
97```
98
99**Indexes:**
100- **Unique Compound**: `{setId, cardName, pokemonNumber, variety}` - Prevents duplicate cards
101- **Text Search Index**: `{cardName, baseName, pokemonNumber, variety}` with weights:
102  - `cardName`: 10 (highest priority)
103  - `baseName`: 8
104  - `pokemonNumber`: 5
105  - `variety`: 3
106- **Query Optimization**: `{setId: 1, cardName: 1}`, `{setId: 1, pokemonNumber: 1}`
107
108#### **PsaGradedCards Collection**
109
110```javascript
111{
112  cardId: ObjectId (required),             // Reference to Cards collection
113  grade: String (required),                // PSA grade (1-10)
114  images: [String],                        // Array of image URLs
115  myPrice: Decimal128 (required),          // Purchase/current price
116  priceHistory: [{                         // Price tracking
117    price: Decimal128,
118    dateUpdated: Date
119  }],
120  dateAdded: Date (default: now),
121  sold: Boolean (default: false),
122  saleDetails: {                           // Comprehensive sale tracking
123    payment: String (enum),                // Payment method
124    price: Decimal128,                     // Sale price
125    delivery: String (enum),               // Delivery method
126    source: String (enum),                 // Sale platform
127    buyerInfo: {                           // Buyer details
128      name: String,
129      address: {                           // Full address object
130        street: String,
131        city: String,
132        state: String,
133        postalCode: String,
134        country: String
135      }
136    },
137    tracking: String,                      // Shipping tracking
138    dateOfSale: Date
139  }
140}
141```
142
143**Schema Features:**
144- **Transform Functions**: Automatic Decimal128 to Number conversion in JSON responses
145- **Enum Validation**: Standardized payment methods, delivery options, sale sources
146- **Middleware Hooks**: Pre/post-save hooks for automatic timestamp management
147
148#### **RawCards Collection**
149
150```javascript
151{
152  cardId: ObjectId (required),             // Reference to Cards collection
153  condition: String (required),            // Card condition
154  // Identical structure to PsaGradedCards for pricing/sales
155  images: [String],
156  myPrice: Decimal128 (required),
157  priceHistory: [...],
158  dateAdded: Date,
159  sold: Boolean,
160  saleDetails: {...}                       // Same structure as PSA cards
161}
162```
163
164#### **CardMarketReferenceProducts Collection**
165
166```javascript
167{
168  name: String (required),                 // Product name
169  setName: String (required),              // Associated Pokemon set
170  available: Number (required),            // Stock availability
171  price: String (required),                // Market price (string format)
172  category: String (required),             // Product category
173  url: String (required),                  // CardMarket URL
174  lastUpdated: Date                        // Data freshness tracking
175}
176```
177
178**Indexes:**
179- **Unique Compound**: `{name, setName, category}` - Prevents duplicate products
180- **Text Search Index**: `{name, setName}` with weights:
181  - `name`: 10
182  - `setName`: 5
183
184#### **SealedProducts Collection**
185
186```javascript
187{
188  productId: ObjectId (required),          // Reference to CardMarketReferenceProducts
189  category: String (enum),                 // Booster Box, ETB, etc.
190  setName: String (required),
191  name: String (required),
192  availability: Number (required),
193  cardMarketPrice: Decimal128 (required),  // External reference price
194  myPrice: Decimal128 (required),          // Personal pricing
195  // Same pricing/sales structure as cards
196  priceHistory: [...],
197  images: [String],
198  dateAdded: Date,
199  sold: Boolean,
200  saleDetails: {...}
201}
202```
203
204#### **Auctions Collection - Polymorphic Design**
205
206```javascript
207{
208  topText: String (required),              // Auction description header
209  bottomText: String (required),           // Auction description footer
210  auctionDate: Date,                       // Scheduled auction date
211  status: String (enum),                   // draft, active, sold, expired
212  generatedFacebookPost: String,           // Auto-generated marketing content
213  isActive: Boolean (legacy),              // Legacy field
214  items: [{                               // Polymorphic item references
215    itemId: ObjectId,                      // Reference to any collection item
216    itemCategory: String,                  // Type: PSA, Raw, Sealed
217    sold: Boolean,                         // Individual item sale status
218    salePrice: Decimal128                  // Item-specific sale price
219  }],
220  totalValue: Number,                      // Calculated total value
221  soldValue: Number,                       // Total sold value
222  createdAt: Date,
223  updatedAt: Date
224}
225```
226
227**Advanced Features:**
228- **Polymorphic References**: `refPath` configuration enables dynamic model referencing
229- **Virtual Fields**: Computed fields for auction value calculations
230- **Population Strategy**: Multi-level population for complete item details
231
232### **Data Models and Relationships**
233
234```mermaid
235graph TD
236    A[Set] -->|1:Many| B[Card]
237    B -->|1:Many| C[PsaGradedCard]
238    B -->|1:Many| D[RawCard]
239    E[CardMarketReferenceProduct] -->|1:Many| F[SealedProduct]
240    G[Auction] -->|Many:Many| C
241    G -->|Many:Many| D
242    G -->|Many:Many| F
243```
244
245**Key Relationships:**
246- **Set → Cards**: One-to-many relationship tracking cards within sets
247- **Card → Collection Items**: One-to-many for both PSA and raw cards
248- **CardMarket → Sealed Products**: Reference data relationship for pricing
249- **Auction → Items**: Polymorphic many-to-many for flexible auction composition
250
251### **Data Flow**
252
253#### **Card Creation Process**
254
255```mermaid
256sequenceDiagram
257    participant Client
258    participant Controller
259    participant Service
260    participant Validator
261    participant Database
262    
263    Client->>Controller: POST /api/psa-graded-cards
264    Controller->>Service: Create PSA Card
265    Service->>Validator: Validate Reference Data
266    Validator->>Database: Find/Create Set
267    Validator->>Database: Find/Create Card
268    Service->>Database: Create PSA Card
269    Service->>Service: Initialize Price History
270    Database-->>Service: Return Created Item
271    Service-->>Controller: Populated Response
272    Controller-->>Client: Success Response
273```
274
275**Process Steps:**
2761. **Validation**: Input validation → Reference data verification
2772. **Find-or-Create**: Automatic Set/Card creation if non-existent
2783. **Population**: Link collection item to Card/Set references
2794. **Price Tracking**: Initialize price history
2805. **Response**: Return populated item with full relationship data
281
282#### **Search Data Flow**
283
284```mermaid
285sequenceDiagram
286    participant Client
287    participant Cache
288    participant Search
289    participant Database
290    participant Fuzzy
291    
292    Client->>Cache: Search Request
293    Cache-->>Client: Cache Hit (if available)
294    Cache->>Search: Cache Miss
295    Search->>Database: MongoDB Text Search
296    Database-->>Search: Initial Results
297    Search->>Fuzzy: Fuse.js Processing
298    Fuzzy-->>Search: Scored Results
299    Search->>Cache: Store Results
300    Search-->>Client: Final Response
301```
302
303**Process Steps:**
3041. **Cache Check**: Search cache lookup (5-minute TTL)
3052. **Database Query**: MongoDB aggregation with text search
3063. **Population**: Mongoose population of references
3074. **Fuzzy Processing**: Fuse.js scoring and ranking
3085. **Post-Processing**: Filtering and final scoring
3096. **Cache Store**: Store results for future requests
3107. **Response**: Return with cache metadata
311
312#### **Sales Tracking Flow**
313
3141. **Sale Initiation**: Mark item as sold with sale details
3152. **Price History**: Record final sale price
3163. **Analytics Update**: Update sales metrics
3174. **Auction Sync**: Update auction sold values if applicable
318
319### **Caching Strategy**
320
321#### **Search Cache Implementation**
322
323**Technology**: node-cache with in-memory storage
324
325**TTL Configuration:**
326- Search results: 5 minutes
327- Search suggestions: 10 minutes
328- General API responses: 1 minute
329
330**Cache Key Strategy:**
331```javascript
332const createCacheKey = (req) => {
333  const { q, limit, category, setId, setName, year, pokemonNumber } = req.query;
334  return `${req.route.path}:${JSON.stringify({ q, limit, category, setId, setName, year, pokemonNumber })}`;
335};
336```
337
338**Statistics Tracking**: Hit rate, miss count, performance metrics
339
340**Invalidation**: Manual cache clearing functions available
341
342#### **Cache Performance**
343
344```javascript
345// Example cache configuration
346{
347  stdTTL: 300,        // 5-minute default TTL
348  checkperiod: 60,    // Check for expired keys every minute
349  useClones: false    // Performance optimization
350}
351```
352
353**Performance Monitoring:**
354- Real-time hit rate calculation
355- Memory usage tracking
356- Request deduplication prevention
357
358### **Data Persistence**
359
360#### **Mongoose ODM Features**
361
362**Schema Validation**: Comprehensive field validation and constraints
363
364**Middleware Hooks**: Pre/post-save hooks for automatic timestamp management
365
366**Virtual Fields**: Computed fields for display formatting
367
368**Population**: Automatic reference resolution with optimized queries
369
370**Indexing**: Optimized query performance with compound indexes
371
372**Aggregation**: Complex queries with MongoDB aggregation framework
373
374#### **Advanced Mongoose Patterns**
375
376**Transform Functions for Decimal128:**
377```javascript
378psaGradedCardSchema.set('toJSON', {
379  transform(doc, ret) {
380    if (ret.myPrice?.$numberDecimal) {
381      ret.myPrice = parseFloat(ret.myPrice.$numberDecimal);
382    }
383    ret.priceHistory = ret.priceHistory?.map(item => ({
384      ...item,
385      price: parseFloat(item.price?.toString())
386    }));
387  }
388});
389```
390
391#### **Data Integrity Measures**
392
393- **Unique Constraints**: Prevent duplicate cards and sets
394- **Referential Integrity**: ObjectId references with validation
395- **Enum Validation**: Standardized categories and statuses
396- **Decimal128 Precision**: Financial accuracy for pricing data
397- **Automatic Timestamping**: Created/updated tracking
398
399### **Search Indexing Strategy**
400
401#### **Multi-Field Text Search**
402
403**Index Configuration:**
404```javascript
405cardSchema.index({
406  cardName: 'text',
407  baseName: 'text', 
408  pokemonNumber: 'text',
409  variety: 'text'
410}, {
411  weights: { cardName: 10, baseName: 8, pokemonNumber: 5, variety: 3 }
412});
413```
414
415**Indexing Features:**
416- **Weighted Relevance**: CardName highest priority, variety lowest
417- **Language Support**: Default English text analysis
418- **Compound Queries**: Multiple field search with relevance scoring
419
420#### **Performance Indexes**
421
422**Query Optimization Patterns:**
423- Single-field indexes for common filter patterns
424- Compound indexes for frequent query combinations
425- Sparse indexes for optional fields
426- TTL indexes for temporary data (future enhancement)
427
428---
429
430## **3. API Endpoints (External & Internal)**
431
432### **Express.js Specifics**
433
434#### **Middleware Stack (Execution Order)**
435
436**Performance Middleware:**
4371. **Custom Compression**: 1KB threshold, level 6 compression
438   ```javascript
439   // Intelligent compression with binary type detection
440   filter: (req, res) => {
441     const contentType = res.getHeader('content-type');
442     const binaryTypes = ['image/', 'video/', 'audio/', 'application/pdf'];
443     return !binaryTypes.some(type => contentType?.startsWith(type));
444   }
445   ```
4462. **Cache Headers**: 5 min API, 1 min search
447
448**Standard Middleware:**
4493. **CORS**: Cross-origin resource sharing
4504. **JSON Parsing**: `express.json({ limit: '200mb' })`
4515. **URL Encoding**: `express.urlencoded({ limit: '200mb', extended: true, parameterLimit: 50000 })`
452
453**Static File Serving:**
4546. **Uploads**: `/uploads` serves uploaded images
455
456**Route Handlers:**
4577. **API Routes**: Versioned routes with `/api/` prefix
458
459**Error Handling:**
4608. **Centralized Error Middleware**: Executed last
461
462#### **Routing Structure**
463
464**Modular Design Features:**
465- Separate route files for each entity
466- Controller sub-modules for complex domains
467- Middleware composition at route level
468- RESTful conventions with custom extensions
469
470**Versioning Strategy:**
471- `/api/` prefix for all endpoints
472- Future v2 support planned
473- Backward compatibility maintenance
474
475### **Public API Endpoints**
476
477#### **Cards API (`/api/cards`)**
478
479
|
 Method 
|
 Endpoint 
|
 Purpose 
|
 Parameters 
|
 Response 
|
480
|
--------
|
----------
|
---------
|
------------
|
----------
|
481
|
 GET 
|
`/api/cards`
|
 Get cards with filtering 
|
`setId`
, 
`cardName`
, 
`baseName`
|
 Card array with pagination 
|
482
|
 GET 
|
`/api/cards/search`
|
 Fuzzy search cards 
|
`q`
 (required), 
`limit`
, 
`setName`
|
 Search results with scoring 
|
483
|
 GET 
|
`/api/cards/suggestions`
|
 Search autocomplete 
|
`q`
 (required), 
`limit`
|
 Suggestion array 
|
484
|
 GET 
|
`/api/cards/search-best-match`
|
 Advanced search with scoring 
|
`q`
 (required) 
|
 Best match with relevance 
|
485
|
 GET 
|
`/api/cards/:id`
|
 Get specific card 
|
`id`
 (ObjectId) 
|
 Single card with population 
|
486

487**Search Response Format:**
488```javascript
489{
490  "success": true,
491  "data": [...],
492  "meta": {
493    "cached": boolean,
494    "cacheKey": "truncated_key",
495    "hitRate": number,
496    "queryTime": number,
497    "pagination": {
498      "currentPage": number,
499      "totalPages": number,
500      "hasNextPage": boolean,
501      "hasPrevPage": boolean
502    }
503  }
504}
505```
506
507**Advanced Search Features:**
508- **Multi-Stage Processing**: MongoDB text search → Fuse.js fuzzy matching
509- **Popularity Weighting**: PSA grade distribution influences ranking
510- **Request Deduplication**: Prevents duplicate concurrent searches
511- **Performance Optimization**: Early filtering, projection limits
512
513#### **Search Endpoints (Expanded)**
514
515**Search Query Parameters:**
516- **Primary**: `q` (query string, required)
517- **Pagination**: `limit` (default: 20, max: 50), `offset`/`page`
518- **Filtering**: `setName`, `setId`, `category`, `year`
519- **Sorting**: `sort_by` (relevance, name, year), `order` (asc, desc)
520
521**Complex Search Examples:**
522```bash
523# Multi-field search with filters
524GET /api/cards/search?q=charizard&setName=Base Set&limit=10
525
526# Best match with popularity scoring
527GET /api/cards/search-best-match?q=pikachu promo
528
529# Autocomplete suggestions
530GET /api/cards/suggestions?q=char&limit=5
531```
532
533**Search Result Structure:**
534```javascript
535{
536  "data": [{
537    "_id": "ObjectId",
538    "cardName": "Charizard",
539    "baseName": "Charizard",
540    "setId": { /* populated set data */ },
541    "score": 95.5,         // Combined relevance score
542    "psaPopularity": 8.2,  // PSA grade distribution score
543    "exactMatch": true     // Perfect name match bonus
544  }],
545  "meta": {
546    "totalHits": 45,
547    "searchTime": "120ms",
548    "algorithm": "hybrid"   // Text + Fuzzy
549  }
550}
551```
552
553#### **Sets API (`/api/sets`)**
554
555
|
 Method 
|
 Endpoint 
|
 Purpose 
|
 Parameters 
|
 Response 
|
556
|
--------
|
----------
|
---------
|
------------
|
----------
|
557
|
 GET 
|
`/api/sets`
|
 Get all sets 
|
 None 
|
 Complete sets array 
|
558
|
 GET 
|
`/api/sets/paginated`
|
 Get sets with pagination 
|
`page`
, 
`limit`
, 
`year`
, 
`search`
|
 Paginated sets 
|
559
|
 GET 
|
`/api/sets/:id`
|
 Get specific set 
|
`id`
 (ObjectId) 
|
 Single set 
|
560

561#### **PSA Graded Cards API (`/api/psa-graded-cards`)**
562
563
|
 Method 
|
 Endpoint 
|
 Purpose 
|
 Parameters 
|
 Response 
|
564
|
--------
|
----------
|
---------
|
------------
|
----------
|
565
|
 GET 
|
`/api/psa-graded-cards`
|
 Get PSA cards 
|
`grade`
, 
`setName`
, 
`cardName`
, 
`sold`
|
 PSA cards array 
|
566
|
 GET 
|
`/api/psa-graded-cards/:id`
|
 Get specific PSA card 
|
`id`
 (ObjectId) 
|
 Single PSA card 
|
567
|
 POST 
|
`/api/psa-graded-cards`
|
 Create PSA card 
|
 Card data in body 
|
 Created PSA card 
|
568
|
 PUT 
|
`/api/psa-graded-cards/:id`
|
 Update PSA card 
|
`id`
, update data 
|
 Updated PSA card 
|
569
|
 DELETE 
|
`/api/psa-graded-cards/:id`
|
 Delete PSA card 
|
`id`
 (ObjectId) 
|
 Deletion confirmation 
|
570
|
 PATCH 
|
`/api/psa-graded-cards/:id/mark-sold`
|
 Mark as sold 
|
`id`
, sale details 
|
 Updated PSA card 
|
571

572**Create/Update Request Body:**
573```javascript
574{
575  "cardId": "ObjectId",
576  "grade": "10",
577  "myPrice": 150.00,
578  "images": ["url1", "url2"],
579  "condition": "Mint"  // For raw cards
580}
581```
582
583#### **Raw Cards API (`/api/raw-cards`)**
584
585Identical structure to PSA Graded Cards API with `condition` instead of `grade`.
586
587#### **Sealed Products API (`/api/sealed-products`)**
588
589
|
 Method 
|
 Endpoint 
|
 Purpose 
|
 Parameters 
|
 Response 
|
590
|
--------
|
----------
|
---------
|
------------
|
----------
|
591
|
 GET 
|
`/api/sealed-products`
|
 Get sealed products 
|
`category`
, 
`setName`
, 
`sold`
|
 Products array 
|
592
|
 GET 
|
`/api/sealed-products/:id`
|
 Get specific product 
|
`id`
 (ObjectId) 
|
 Single product 
|
593
|
 POST 
|
`/api/sealed-products`
|
 Create product 
|
 Product data 
|
 Created product 
|
594
|
 PUT 
|
`/api/sealed-products/:id`
|
 Update product 
|
`id`
, update data 
|
 Updated product 
|
595
|
 DELETE 
|
`/api/sealed-products/:id`
|
 Delete product 
|
`id`
 (ObjectId) 
|
 Deletion confirmation 
|
596
|
 PATCH 
|
`/api/sealed-products/:id/mark-sold`
|
 Mark as sold 
|
`id`
, sale details 
|
 Updated product 
|
597

598#### **Auctions API (`/api/auctions`)**
599
600
|
 Method 
|
 Endpoint 
|
 Purpose 
|
 Parameters 
|
 Response 
|
601
|
--------
|
----------
|
---------
|
------------
|
----------
|
602
|
 GET 
|
`/api/auctions`
|
 Get auctions 
|
`status`
 filter 
|
 Auctions array 
|
603
|
 GET 
|
`/api/auctions/:id`
|
 Get specific auction 
|
`id`
 (ObjectId) 
|
 Auction with populated items 
|
604
|
 POST 
|
`/api/auctions`
|
 Create auction 
|
 Auction data 
|
 Created auction 
|
605
|
 PUT 
|
`/api/auctions/:id`
|
 Update auction 
|
`id`
, update data 
|
 Updated auction 
|
606
|
 DELETE 
|
`/api/auctions/:id`
|
 Delete auction 
|
`id`
 (ObjectId) 
|
 Deletion confirmation 
|
607
|
 POST 
|
`/api/auctions/:id/items`
|
 Add item to auction 
|
`id`
, item data 
|
 Updated auction 
|
608
|
 DELETE 
|
`/api/auctions/:id/items`
|
 Remove item 
|
`id`
, 
`itemId`
|
 Updated auction 
|
609
|
 PATCH 
|
`/api/auctions/:id/items/sold`
|
 Mark item sold 
|
`id`
, sale data 
|
 Updated auction 
|
610

611**Polymorphic Item Management:**
612```javascript
613// Add item request
614{
615  "itemId": "ObjectId",
616  "itemCategory": "PsaGradedCard", // or "RawCard", "SealedProduct"
617  "startingPrice": 25.00
618}
619```
620
621#### **Sales API (`/api/sales`)**
622
623
|
 Method 
|
 Endpoint 
|
 Purpose 
|
 Parameters 
|
 Response 
|
624
|
--------
|
----------
|
---------
|
------------
|
----------
|
625
|
 GET 
|
`/api/sales`
|
 Get sales data 
|
`startDate`
, 
`endDate`
, 
`category`
|
 Sales array 
|
626
|
 GET 
|
`/api/sales/summary`
|
 Get sales summary 
|
 Date range filters 
|
 Aggregated metrics 
|
627
|
 GET 
|
`/api/sales/graph-data`
|
 Get graph data 
|
 Date range filters 
|
 Time-series data 
|
628

629**Sales Summary Response:**
630```javascript
631{
632  "totalRevenue": 1250.00,
633  "totalProfit": 340.50,
634  "averageMargin": 27.2,
635  "totalItems": 45,
636  "categoryBreakdown": {
637    "psaGradedCard": { "count": 20, "revenue": 800.00 },
638    "rawCard": { "count": 15, "revenue": 300.00 },
639    "sealedProduct": { "count": 10, "revenue": 150.00 }
640  }
641}
642```
643
644#### **Upload API (`/api/upload`)**
645
646
|
 Method 
|
 Endpoint 
|
 Purpose 
|
 Parameters 
|
 Response 
|
647
|
--------
|
----------
|
---------
|
------------
|
----------
|
648
|
 POST 
|
`/api/upload/image`
|
 Upload single image 
|
`image`
 (file) 
|
 Image URL 
|
649
|
 POST 
|
`/api/upload/images`
|
 Upload multiple images 
|
`images`
 (files) 
|
 Image URLs array 
|
650
|
 DELETE 
|
`/api/upload/cleanup`
|
 Cleanup specific images 
|
 Image URLs 
|
 Cleanup result 
|
651
|
 DELETE 
|
`/api/upload/cleanup-all`
|
 Cleanup orphaned images 
|
 None 
|
 Cleanup summary 
|
652

653### **Internal API Endpoints/Service-to-Service Communication**
654
655Currently, the system uses internal service-to-service communication via direct function calls rather than HTTP APIs:
656
657**Service Communication Patterns:**
658- **Controller → Service**: Direct method invocation
659- **Service → Service**: Function imports and calls
660- **Service → Model**: Mongoose model operations
661- **Utility → Service**: Helper function usage
662
663**Future Enhancement Opportunities:**
664- Message queue implementation for background jobs
665- Event-driven communication between services
666- Internal API endpoints for microservice migration
667
668### **Error Handling**
669
670#### **Standard Error Response Format**
671
672```javascript
673{
674  "success": false,
675  "status": "error",
676  "message": "Human-readable error description",
677  "details": "Additional technical details (optional)",
678  "stack": "Stack trace (development only)"
679}
680```
681
682#### **HTTP Status Codes**
683
684- **400**: Validation errors, malformed requests
685- **404**: Resource not found
686- **409**: Duplicate resource conflicts
687- **500**: Internal server errors
688- **200**: Successful operations
689- **201**: Successful resource creation
690
691#### **Error Types**
692
693- **ValidationError**: Input validation failures
694- **NotFoundError**: Resource lookup failures
695- **AppError**: Custom business logic errors
696- **MongoError**: Database operation errors
697
698---
699
700## **4. Business Logic & Core Functionality**
701
702### **Key Business Processes**
703
704#### **Card Collection Management Process**
705
706**Reference Data Validation:**
7071. Verify card exists in PSA database
7082. Validate set information consistency
7093. Ensure data consistency across references
710
711**Find-or-Create Logic:**
712```javascript
713const findOrCreateCard = async (cardData) => {
714  // 1. Find or create Set
715  let set = await Set.findOne({ setName });
716  if (!set) {
717    set = new Set({ setName, year: year || new Date().getFullYear() });
718    await set.save();
719  }
720  
721  // 2. Find or create Card with PSA data updates
722  let card = await Card.findOne({ cardName, setId: set._id });
723  if (!card) {
724    card = new Card({ cardName, setId: set._id, baseName, psaTotalGradedForCard });
725  } else if (psaTotalGraded && card.psaTotalGradedForCard !== psaTotalGraded) {
726    card.psaTotalGradedForCard = psaTotalGraded;
727    await card.save();
728  }
729  
730  return card._id;
731};
732```
733
734**Price History Tracking:**
735- Automatic price change detection
736- Historical price trend analysis
737- Investment performance calculation
738
739**Sale Processing:**
740- Comprehensive sale detail collection
741- Automatic profit/loss calculation
742- Analytics data aggregation
743
744### **Algorithms & Logic**
745
746#### **Advanced Search Algorithm**
747
748**Fuzzy Search with Weighted Scoring:**
749```javascript
750const fuzzySearchAlgorithm = {
751  exactMatchBonus: {
752    cardName: 100,
753    baseName: 50
754  },
755  
756  psaPopularityScore: (card) => {
757    return (card.psaGrades.psa_10 * 10) + 
758           (card.psaGrades.psa_9 * 5) + 
759           (card.psaGrades.psa_8 * 2);
760  },
761  
762  combinedScore: (fuseScore, exactBonus, popularityScore) => {
763    return (1 - fuseScore) * 100 + exactBonus + (popularityScore * 0.1);
764  }
765};
766```
767
768### **Search Logic and Algorithms (Expanded)**
769
770#### **Multi-Layer Search Architecture**
771
772**Tier 1: MongoDB Text Search**
773```javascript
774// Optimized aggregation pipeline with early filtering
775const pipeline = [
776  { $match: { $text: { $search: query } } },
777  { $addFields: { score: { $meta: 'textScore' } } },
778  { $lookup: { 
779    from: 'sets',
780    localField: 'setId',
781    foreignField: '_id',
782    as: 'setId'
783  }},
784  { $match: setNameFilter }, // Post-lookup filtering
785  { $limit: maxResults }
786];
787```
788
789**Tier 2: Fuse.js Fuzzy Processing**
790- **Weighted Scoring**: CardName (40%), BaseName (30%), Variety (20%), SetName (10%)
791- **Threshold Tuning**: 0.4 threshold for precision/recall balance
792- **Popularity Integration**: PSA grade distribution scoring
793
794**Tier 3: Request Optimization**
795- **Deduplication**: Prevents identical concurrent searches
796- **Caching**: Multi-layer cache with performance monitoring
797- **Result Enhancement**: Popularity scoring and exact match bonuses
798
799#### **Search Query Processing**
800
801**Raw Query Transformation:**
8021. **Tokenization**: Split query into individual terms
8032. **Normalization**: Lowercase, trim whitespace
8043. **Stop Word Filtering**: Remove common words (future enhancement)
8054. **Synonym Expansion**: Pokemon-specific synonyms (future enhancement)
806
807**Core Search Algorithms:**
808- **Keyword Matching**: Direct field matching with weights
809- **Fuzzy Matching**: Levenshtein distance with configurable threshold
810- **Phonetic Search**: Soundex-like matching (future enhancement)
811- **Relevance Ranking**: Combined scoring algorithm
812
813**Filter Application:**
814```javascript
815const applyFilters = (results, filters) => {
816  return results.filter(item => {
817    if (filters.setName && item.setId?.setName !== filters.setName) return false;
818    if (filters.year && item.setId?.year !== filters.year) return false;
819    if (filters.grade && item.grade !== filters.grade) return false;
820    return true;
821  });
822};
823```
824
825**Pagination Logic:**
826- **Offset Calculation**: `(page - 1) * limit`
827- **Result Limiting**: Database-level limits for performance
828- **Metadata Generation**: Total pages, next/previous indicators
829
830#### **Search Performance Optimizations**
831
832**Request Deduplication:**
833```javascript
834async deduplicateRequest(key, requestFn) {
835  if (this.requestDeduplication.has(key)) {
836    return this.requestDeduplication.get(key);
837  }
838  
839  const promise = requestFn();
840  this.requestDeduplication.set(key, promise);
841  
842  try {
843    return await promise;
844  } finally {
845    this.requestDeduplication.delete(key);
846  }
847}
848```
849
850**Parallel Search Execution:**
851- Global search runs card and product searches concurrently
852- Result merging with category identification
853- Score normalization across different result types
854
855#### **Auction Management Process**
856
857**Auction Creation:**
8581. Draft status initialization
8592. Item validation and addition
8603. Value calculation and verification
861
862**Item Management:**
863- Polymorphic item addition (PSA/Raw/Sealed)
864- Duplicate prevention logic
865- Individual item sale tracking
866
867**Status Lifecycle:**
868- Draft → Active → Sold/Expired
869- Automatic value calculations
870- Facebook post generation
871
872#### **Sales Analytics Engine**
873
874```javascript
875const salesAnalytics = {
876  revenueCalculation: (sales) => {
877    return sales.reduce((total, sale) => 
878      total + parseFloat(sale.saleDetails.price), 0);
879  },
880  
881  profitAnalysis: (sales) => {
882    return sales.map(sale => ({
883      profit: parseFloat(sale.saleDetails.price) - parseFloat(sale.myPrice),
884      margin: ((parseFloat(sale.saleDetails.price) - parseFloat(sale.myPrice)) / 
885               parseFloat(sale.saleDetails.price)) * 100
886    }));
887  },
888  
889  timeSeriesAggregation: (sales) => {
890    const dailySales = sales.reduce((acc, sale) => {
891      const date = sale.saleDetails.dateOfSale.toISOString().split('T')[0];
892      acc[date] = (acc[date] || 0) + parseFloat(sale.saleDetails.price);
893      return acc;
894    }, {});
895    return dailySales;
896  }
897};
898```
899
900**Advanced Analytics Features:**
901- **Cross-Category Analysis**: Multi-collection sales aggregation
902- **Trend Analysis**: Time-series data processing
903- **Profitability Metrics**: Margin calculations and ROI analysis
904- **Market Performance**: Comparative pricing analysis
905
906### **Additional Core Algorithms**
907
908#### **Search Deduplication Algorithm**
909
910```javascript
911const searchDeduplication = {
912  pendingSearches: new Map(),
913  
914  createKey: (route, params) => {
915    return `${route}_${JSON.stringify(params)}`;
916  },
917  
918  deduplicate: async (key, searchFunction) => {
919    if (this.pendingSearches.has(key)) {
920      return await this.pendingSearches.get(key);
921    }
922    
923    const promise = searchFunction();
924    this.pendingSearches.set(key, promise);
925    
926    try {
927      const result = await promise;
928      return result;
929    } finally {
930      this.pendingSearches.delete(key);
931    }
932  }
933};
934```
935
936#### **Price History Management**
937
938```javascript
939const priceHistoryManager = {
940  shouldUpdateHistory: (currentPrice, newPrice) => {
941    return parseFloat(currentPrice) !== parseFloat(newPrice);
942  },
943  
944  addPriceEntry: (priceHistory, newPrice) => {
945    return [...priceHistory, {
946      price: newPrice,
947      dateUpdated: new Date()
948    }];
949  }
950};
951```
952
953### **Event Handling**
954
955**Current Implementation:**
956- **Mongoose Middleware**: Pre/post-save hooks for automatic timestamps
957- **Express Middleware**: Request/response lifecycle management
958- **Cache Events**: Automatic cache invalidation on TTL expiration
959
960**Future Event-Driven Enhancements:**
961- Price change events for notification system
962- Auction status change events
963- Sales completion events for analytics
964- Import completion events for verification
965
966---
967
968## **5. Background Jobs & Asynchronous Processes**
969
970### **Current Implementation Status**
971
972The system includes sophisticated data import functionality but no scheduled background jobs or task queues are currently implemented.
973
974### **Data Import Operations**
975
976#### **Import Coordination System**
977
978Located in `/utils/dataImporter.js` with modular structure:
979
980```javascript
981const importCoordinator = {
982  importAllData: async (options = {}) => {
983    const results = {
984      psaFiles: 0,
985      cardMarketFiles: 0,
986      setsProcessed: 0,
987      cardsProcessed: 0,
988      productsProcessed: 0,
989      errors: []
990    };
991    
992    // Parallel import execution
993    const importPromises = [];
994    
995    if (options.includePsa) {
996      importPromises.push(importPsaData(options));
997    }
998    
999    if (options.includeCardMarket) {
1000      importPromises.push(importCardMarketData(options));
1001    }
1002    
1003    const importResults = await Promise.allSettled(importPromises);
1004    // Process results and aggregate statistics
1005    
1006    return results;
1007  }
1008};
1009```
1010
1011#### **Three-Phase Import Process**
1012
1013**Phase 1: Set Metadata Import**
1014- Summary files processing
1015- Set creation with metadata
1016- Year and URL association
1017
1018**Phase 2: Individual Card Data Import**
1019- Card-specific data processing
1020- PSA population statistics
1021- Reference relationship establishment
1022
1023**Phase 3: Totals Recalculation**
1024- Set card count validation
1025- PSA population aggregation
1026- Data integrity verification
1027
1028#### **File Processing Utilities**
1029
1030**Dynamic File Discovery:**
1031- Recursive JSON file scanning
1032- Type classification (PSA vs CardMarket)
1033- Cross-platform path handling
1034
1035**Processing Features:**
1036- **PSA Data Import**: Pokemon set and card data from JSON files
1037- **CardMarket Import**: External reference product data
1038- **Sealed Product Import**: Sealed product inventory data
1039- **Error Handling**: Comprehensive error tracking and reporting
1040
1041### **Testing Infrastructure**
1042
1043```javascript
1044const testDataImport = async () => {
1045  const mongoServer = await MongoMemoryServer.create();
1046  
1047  // Limited import testing
1048  const psaResults = await importAllData({
1049    includePsa: true,
1050    includeCardMarket: false,
1051    limitPsaFiles: 1
1052  });
1053  
1054  // Verification and cleanup
1055  await verifyImportResults();
1056  await mongoServer.stop();
1057};
1058```
1059
1060### **Manual Process Scripts**
1061
1062**Available Scripts:**
1063- `importToLocalMongoDB.js`: Full database population
1064- `importAllPhases.js`: Phased import operations
1065- `verifyDataImport.js`: Data integrity verification
1066- `updateSetCardTotals.js`: Statistics recalculation
1067
1068### **Recommendations for Background Job Implementation**
1069
1070**Task Queue Implementation:**
1071- **Technology**: BullMQ or Agenda for job scheduling
1072- **Redis Integration**: Job state management and monitoring
1073- **Worker Processes**: Separate worker instances for job processing
1074
1075**Scheduled Jobs (Recommended):**
10761. **CardMarket Price Updates** (Daily at 2 AM)
1077   - Fetch latest pricing data
1078   - Update reference product prices
1079   - Trigger price change notifications
1080
10812. **PSA Population Refresh** (Weekly on Sundays)
1082   - Update PSA grade distribution data
1083   - Recalculate popularity scores
1084   - Sync with PSA database changes
1085
10863. **Sales Analytics Aggregation** (Nightly at midnight)
1087   - Generate daily sales summaries
1088   - Update trend calculations
1089   - Prepare dashboard metrics
1090
10914. **Database Cleanup Operations** (Monthly)
1092   - Remove orphaned images
1093   - Clean up expired cache entries
1094   - Archive old log files
1095
1096**Job Monitoring Features:**
1097- Failed job retry mechanisms with exponential backoff
1098- Job progress tracking and logging
1099- Error notification system
1100- Performance metrics collection
1101
1102---
1103
1104## **6. Observability & Monitoring**
1105
1106### **Logging Implementation**
1107
1108#### **Application Logging**
1109
1110**Current Logging Patterns:**
1111```javascript
1112// Standard logging patterns found across services
1113console.log('='.repeat(80));
1114console.log('PROCESS BOUNDARY MARKER');
1115console.log('='.repeat(80));
1116
1117// Error logging in middleware
1118console.error('Error in searchService:', error.message);
1119console.error('Stack trace:', error.stack);
1120
1121// Debug logging in services
1122console.log('Operation completed:', {
1123  operation: 'createPsaCard',
1124  cardId: result._id,
1125  timestamp: new Date().toISOString()
1126});
1127```
1128
1129#### **Logging Categories**
1130
1131**Application Logs**: Service operations, business logic execution
1132
1133**Error Logs**: Caught exceptions, validation failures, database errors
1134
1135**Debug Logs**: Detailed operation tracing, data flow analysis
1136
1137**Import Logs**: Data import progress, file processing status
1138
1139#### **Log Storage and Analysis**
1140
1141**Current State:**
1142- Console output to terminal/process managers
1143- File output: Some operations write to `backend.log`, `import.log`
1144- No centralized logging framework implemented
1145
1146**Storage Locations:**
1147- `backend.log`: General application logging
1148- `import.log`: Data import operation logs
1149- Console output: Real-time development logging
1150
1151### **Performance Monitoring**
1152
1153#### **Health Check Endpoint**
1154
1155The `/api/health` endpoint provides comprehensive system status:
1156
1157```javascript
1158{
1159  "status": "healthy",
1160  "timestamp": "2024-01-01T12:00:00.000Z",
1161  "uptime": 3600,
1162  "database": "connected",
1163  "cache": {
1164    "hitRate": 85.5,
1165    "totalKeys": 150,
1166    "hits": 1250,
1167    "misses": 200,
1168    "size": "2.5MB"
1169  },
1170  "memory": {
1171    "used": 45.2,
1172    "total": 128.0,
1173    "percentage": 35.3
1174  }
1175}
1176```
1177
1178#### **Cache Performance Metrics**
1179
1180**Real-time Statistics:**
1181```javascript
1182const cacheStats = {
1183  hits: number,
1184  misses: number,
1185  keys: number,
1186  hitRate: percentage,
1187  memory: {
1188    size: "bytes",
1189    count: "entries"
1190  }
1191};
1192```
1193
1194**Performance Features:**
1195- Real-time hit rate calculation
1196- Memory usage tracking per cache instance
1197- TTL expiration monitoring
1198- Request deduplication metrics
1199
1200#### **Database Monitoring**
1201
1202**Connection Health:**
1203- MongoDB connection status
1204- Query performance timing
1205- Index usage statistics (available via MongoDB tools)
1206- Connection pool monitoring
1207
1208### **Error Monitoring**
1209
1210**Centralized Error Handling**: Express error middleware captures all errors
1211
1212**Error Classification**: Custom error types (ValidationError, NotFoundError, AppError)
1213
1214**Stack Trace Logging**: Full error context in development mode
1215
1216**HTTP Error Mapping**: Proper status codes for different error types
1217
1218### **Monitoring Recommendations**
1219
1220**Enhanced Observability Stack:**
1221
12221. **Structured Logging**: Winston or Pino for structured JSON logs
12232. **Application Monitoring**: New Relic, DataDog, or similar APM tools
12243. **Database Monitoring**: MongoDB Atlas monitoring or custom metrics
12254. **Performance Metrics**: Request timing, throughput monitoring
12265. **Business Metrics**: Collection growth, sales trends, user activity
1227
1228**Metrics to Track:**
1229- Request latency percentiles (P50, P95, P99)
1230- Error rates by endpoint
1231- Cache hit rates and performance
1232- Database query performance
1233- Business KPIs (sales volume, collection growth)
1234
1235---
1236
1237## **7. Error Handling & Resilience**
1238
1239### **Global Error Handling**
1240
1241#### **Express Error Middleware**
1242
1243Centralized error processing in `/middleware/errorHandler.js`:
1244
1245```javascript
1246const errorHandler = (error, req, res, next) => {
1247  // Mongoose-specific error handling
1248  if (error.name === 'ValidationError') {
1249    return res.status(400).json({
1250      success: false,
1251      status: 'error',
1252      message: 'Validation failed',
1253      details: Object.values(error.errors).map(e => e.message)
1254    });
1255  }
1256  
1257  // MongoDB duplicate key errors
1258  if (error.code === 11000) {
1259    return res.status(409).json({
1260      success: false,
1261      status: 'error',
1262      message: 'Duplicate resource',
1263      details: `Resource already exists`
1264    });
1265  }
1266  
1267  // Generic error response
1268  res.status(error.statusCode || 500).json({
1269    success: false,
1270    status: 'error',
1271    message: error.message || 'Internal server error',
1272    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
1273  });
1274};
1275```
1276
1277#### **Async Handler Wrapper**
1278
1279Consistent error handling for async operations:
1280
1281```javascript
1282const asyncHandler = (fn) => (req, res, next) => {
1283  Promise.resolve(fn(req, res, next)).catch(next);
1284};
1285
1286// Usage across all controllers
1287router.get('/cards/:id', asyncHandler(async (req, res) => {
1288  const card = await cardService.findById(req.params.id);
1289  res.json({ success: true, data: card });
1290}));
1291```
1292
1293### **Specific Error Cases**
1294
1295#### **Database Errors**
1296
1297```javascript
1298// MongoDB connection errors
1299mongoose.connection.on('error', (error) => {
1300  console.error('MongoDB connection error:', error);
1301  if (process.env.NODE_ENV !== 'test') {
1302    process.exit(1);
1303  }
1304});
1305
1306// Query errors
1307const handleDatabaseError = (error) => {
1308  if (error.name === 'CastError') {
1309    throw new ValidationError('Invalid ID format');
1310  }
1311  if (error.name === 'MongoNetworkError') {
1312    throw new AppError('Database connection lost', 503);
1313  }
1314};
1315```
1316
1317#### **Validation Errors**
1318
1319```javascript
1320// Custom validation error class
1321class ValidationError extends Error {
1322  constructor(message, field = null) {
1323    super(message);
1324    this.name = 'ValidationError';
1325    this.statusCode = 400;
1326    this.field = field;
1327  }
1328}
1329
1330// Usage in services
1331if (!mongoose.Types.ObjectId.isValid(cardId)) {
1332  throw new ValidationError('Invalid card ID format', 'cardId');
1333}
1334```
1335
1336#### **Business Logic Errors**
1337
1338```javascript
1339// Reference data validation
1340const validateReferenceData = async (cardData) => {
1341  const existingCard = await Card.findOne({
1342    setId: cardData.setId,
1343    cardName: cardData.cardName
1344  });
1345  
1346  if (!existingCard) {
1347    throw new NotFoundError(
1348      `Card not found in reference database: ${cardData.cardName}`
1349    );
1350  }
1351};
1352```
1353
1354### **Resilience Features**
1355
1356#### **Request Deduplication**
1357
1358Prevents duplicate concurrent operations:
1359
1360```javascript
1361const pendingRequests = new Map();
1362
1363const deduplicateRequest = async (key, operation) => {
1364  if (pendingRequests.has(key)) {
1365    return await pendingRequests.get(key);
1366  }
1367  
1368  const promise = operation();
1369  pendingRequests.set(key, promise);
1370  
1371  try {
1372    return await promise;
1373  } finally {
1374    pendingRequests.delete(key);
1375  }
1376};
1377```
1378
1379#### **Cache Fallback Strategy**
1380
1381Graceful degradation when cache is unavailable:
1382
1383```javascript
1384const getCachedData = async (key, fetchFunction) => {
1385  try {
1386    const cached = cache.get(key);
1387    if (cached) return cached;
1388  } catch (cacheError) {
1389    console.warn('Cache unavailable, falling back to database');
1390  }
1391  
1392  const data = await fetchFunction();
1393  
1394  try {
1395    cache.set(key, data);
1396  } catch (cacheError) {
1397    console.warn('Could not cache result');
1398  }
1399  
1400  return data;
1401};
1402```
1403
1404#### **Database Connection Resilience**
1405
1406Environment-aware connection handling:
1407
1408```javascript
1409const connectToDatabase = async () => {
1410  try {
1411    await mongoose.connect(process.env.MONGO_URI);
1412    console.log('✅ Connected to MongoDB');
1413  } catch (error) {
1414    console.error('❌ MongoDB connection failed:', error.message);
1415    
1416    // Don't exit in test environment
1417    if (process.env.NODE_ENV !== 'test') {
1418      process.exit(1);
1419    }
1420    throw error;
1421  }
1422};
1423```
1424
1425### **Custom Error Class Hierarchy**
1426
1427```javascript
1428class AppError extends Error {
1429  constructor(message, statusCode) {
1430    super(message);
1431    this.statusCode = statusCode;
1432    this.isOperational = true;
1433  }
1434}
1435
1436class ValidationError extends AppError {
1437  constructor(message) {
1438    super(message, 400);
1439  }
1440}
1441
1442class NotFoundError extends AppError {
1443  constructor(message = 'Resource not found') {
1444    super(message, 404);
1445  }
1446}
1447```
1448
1449### **Circuit Breakers/Retries**
1450
1451**Current State**: Not implemented
1452
1453**Missing Features:**
1454- Automatic retry mechanisms for failed operations
1455- Circuit breaker pattern for external service calls
1456- Rate limiting for API endpoints
1457- Timeout handling for long-running operations
1458
1459### **Recommendations for Enhanced Resilience**
1460
14611. **Circuit Breakers**: Use libraries like opossum for external API calls
14622. **Retry Logic**: Exponential backoff for transient failures
14633. **Rate Limiting**: Express-rate-limit for API protection
14644. **Timeout Handling**: Request timeouts for all operations
14655. **Health Checks**: Deep health monitoring with dependency checks
14666. **Graceful Shutdown**: Proper cleanup on process termination
1467
1468---
1469
1470## **8. File Structure and Module Organization**
1471
1472### **Overall Directory Structure**
1473
1474```
1475pokemon-collection-backend/
1476├── config/                   # Configuration files
1477│   └── db.js                # Database connection configuration
1478├── controllers/             # HTTP request handlers
1479│   ├── auctions/           # Auction management (modular)
1480│   ├── auctionsController.js
1481│   ├── cardMarketRefProductsController.js
1482│   ├── cardsController.js
1483│   ├── externalListingController.js
1484│   ├── psaGradedCardsController.js
1485│   ├── rawCardsController.js
1486│   ├── salesController.js
1487│   ├── sealedProductsController.js
1488│   ├── setsController.js
1489│   └── uploadController.js
1490├── data/                    # Static data files
1491├── middleware/              # Express middleware
1492│   ├── compression.js      # Performance compression
1493│   ├── errorHandler.js     # Centralized error handling
1494│   └── searchCache.js      # Search result caching
1495├── models/                  # Mongoose schemas
1496│   ├── Auction.js
1497│   ├── Card.js
1498│   ├── CardMarketReferenceProduct.js
1499│   ├── PsaGradedCard.js
1500│   ├── RawCard.js
1501│   ├── SealedProduct.js
1502│   └── Set.js
1503├── public/                  # Static file serving
1504│   └── uploads/            # Image upload storage
1505├── routes/                  # API route definitions
1506│   ├── auctions.js
1507│   ├── cardMarketRefProducts.js
1508│   ├── cards.js
1509│   ├── externalListing.js
1510│   ├── import.js
1511│   ├── psaGradedCards.js
1512│   ├── rawCards.js
1513│   ├── sales.js
1514│   ├── sealedProducts.js
1515│   ├── sets.js
1516│   └── upload.js
1517├── scripts/                 # Utility scripts
1518│   └── testDataImport.js   # Import testing
1519├── services/                # Business logic layer
1520│   ├── dbaFormatter.js     # DBA platform formatting
1521│   ├── facebookPostFormatter.js # Social media formatting
1522│   ├── itemFetcher.js      # Cross-collection item fetching
1523│   ├── psaGradedCardCrudService.js
1524│   ├── psaGradedCardQueryService.js
1525│   ├── rawCardCrudService.js
1526│   ├── rawCardQueryService.js
1527│   ├── referenceDataValidator.js
1528│   ├── salesAnalyticsService.js
1529│   ├── salesDataService.js
1530│   ├── sealedProductCrudService.js
1531│   └── searchService.js    # Advanced search logic
1532├── test/                    # Test suite
1533│   └── controllers/        # Controller-specific tests
1534├── utils/                   # Utility functions
1535│   ├── dataImporter.js     # Data import coordination
1536│   ├── errorHandler.js     # Error handling utilities
1537│   └── nameShortener.js    # Name formatting utilities
1538├── .env                     # Environment variables
1539├── eslint.config.js         # ESLint configuration
1540├── package.json             # Dependencies and scripts
1541└── server.js               # Application entry point
1542```
1543
1544### **Module Responsibilities**
1545
1546#### **Controllers Directory**
1547
1548**Primary Responsibility**: HTTP request handling, input validation, response formatting
1549
1550**Advanced Organization**:
1551- **Modular Controllers**: Complex domains (auctions) have sub-modules
1552- **Consistent Patterns**: All controllers follow identical structure
1553- **Validation Integration**: Request parameter validation at controller level
1554- **Response Formatting**: Standardized success/error response formats
1555
1556**Controller Sub-Modules** (Auctions Example):
1557```
1558controllers/auctions/
1559├── index.js                 # Main controller orchestration
1560├── auctionCrudOperations.js # Basic CRUD handlers
1561├── auctionItemHelpers.js    # Item manipulation utilities
1562└── auctionItemOperations.js # Complex item business logic
1563```
1564
1565#### **Services Directory**
1566
1567**Primary Responsibility**: Business logic implementation, data processing
1568
1569**Service Categories**:
1570
15711. **Query Services**: Read-only operations with optimized queries
1572   - `psaGradedCardQueryService.js`
1573   - `rawCardQueryService.js`
1574
15752. **CRUD Services**: Write operations with validation
1576   - `psaGradedCardCrudService.js`
1577   - `rawCardCrudService.js`
1578   - `sealedProductCrudService.js`
1579
15803. **Analytics Services**: Business intelligence and reporting
1581   - `salesAnalyticsService.js`
1582   - `salesDataService.js`
1583
15844. **Formatting Services**: External platform integration
1585   - `dbaFormatter.js`
1586   - `facebookPostFormatter.js`
1587
15885. **Utility Services**: Cross-cutting concerns
1589   - `itemFetcher.js`
1590   - `referenceDataValidator.js`
1591   - `searchService.js`
1592
1593#### **Models Directory**
1594
1595**Primary Responsibility**: MongoDB schema definitions, data validation, relationships
1596
1597**Schema Features**:
1598- Comprehensive field validation
1599- Transform functions for JSON output
1600- Virtual fields for computed properties
1601- Pre/post-save middleware hooks
1602- Optimized indexing strategies
1603
1604#### **Middleware Directory**
1605
1606**Primary Responsibility**: Request processing, performance optimization
1607
1608**Middleware Types**:
1609- **Performance**: `compression.js` - intelligent compression
1610- **Error Handling**: `errorHandler.js` - centralized error processing
1611- **Caching**: `searchCache.js` - search result optimization
1612
1613#### **Routes Directory**
1614
1615**Primary Responsibility**: API endpoint routing and parameter handling
1616
1617**Routing Features**:
1618- RESTful conventions with extensions
1619- Middleware composition per route
1620- Versioned API structure
1621- Consistent error handling integration
1622
1623#### **Utils Directory**
1624
1625**Primary Responsibility**: Utility functions and cross-cutting concerns
1626
1627**Utility Categories**:
1628- **Data Import**: `dataImporter.js` - multi-phase import coordination
1629- **Error Handling**: `errorHandler.js` - custom error classes
1630- **Name Formatting**: `nameShortener.js` - platform-specific formatting
1631
1632### **Naming Conventions**
1633
1634#### **File Naming**
1635
1636- **Controllers**: `entityController.js` (e.g., `cardsController.js`)
1637- **Services**: `entityServiceType.js` (e.g., `psaGradedCardCrudService.js`)
1638- **Models**: `Entity.js` with PascalCase (e.g., `PsaGradedCard.js`)
1639- **Routes**: `entity.js` matching controller names
1640- **Middleware**: `functionalityName.js` (e.g., `searchCache.js`)
1641
1642#### **Variable and Function Naming**
1643
1644- **camelCase**: Variables and functions (`cardData`, `findOrCreate`)
1645- **PascalCase**: Classes and constructors (`ValidationError`, `Card`)
1646- **UPPER_SNAKE_CASE**: Constants (`MAX_SEARCH_RESULTS`, `CACHE_TTL`)
1647- **kebab-case**: URL paths (`/api/psa-graded-cards`)
1648
1649#### **Database Naming**
1650
1651- **Collections**: PascalCase singular (`Card`, `PsaGradedCard`)
1652- **Fields**: camelCase (`cardName`, `psaTotalGradedForCard`)
1653- **Indexes**: Descriptive names with field references
1654
1655### **Module Interaction**
1656
1657#### **Request Flow**
1658
1659```mermaid
1660sequenceDiagram
1661    participant Client
1662    participant Route
1663    participant Controller
1664    participant Service
1665    participant Model
1666    participant Database
1667    
1668    Client->>Route: HTTP Request
1669    Route->>Controller: Route Handler
1670    Controller->>Service: Business Logic
1671    Service->>Model: Data Operations
1672    Model->>Database: Query Execution
1673    Database-->>Model: Result Set
1674    Model-->>Service: Processed Data
1675    Service-->>Controller: Business Result
1676    Controller-->>Route: HTTP Response
1677    Route-->>Client: JSON Response
1678```
1679
1680#### **Inter-Service Communication**
1681
1682**Direct Function Calls**: Services communicate via direct method imports
1683```javascript
1684// Example: Controller using multiple services
1685const psaService = require('../services/psaGradedCardCrudService');
1686const searchService = require('../services/searchService');
1687const analytics = require('../services/salesAnalyticsService');
1688```
1689
1690**Shared Utilities**: Common functions accessed across modules
1691```javascript
1692// Example: Multiple controllers using name shortener
1693const { shortenForDBA } = require('../utils/nameShortener');
1694```
1695
1696#### **Dependency Injection Patterns**
1697
1698**Model Dependencies**: Services depend on models, not controllers
1699```javascript
1700// Service layer model usage
1701const PsaGradedCard = require('../models/PsaGradedCard');
1702const Card = require('../models/Card');
1703```
1704
1705**Configuration Dependencies**: Centralized configuration access
1706```javascript
1707// Database configuration usage
1708const connectDB = require('../config/db');
1709```
1710
1711### **Entry Points**
1712
1713#### **Main Application Entry: `server.js`**
1714
1715**Bootstrap Process:**
17161. **Environment Setup**: Load environment variables via dotenv
17172. **Database Connection**: Establish MongoDB connection
17183. **Middleware Configuration**: Apply compression, CORS, parsing
17194. **Route Registration**: Mount all API routes
17205. **Error Handling**: Apply global error middleware
17216. **Server Startup**: Start Express server on configured port
1722
1723**Server Configuration:**
1724```javascript
1725// Core application setup
1726const express = require('express');
1727const cors = require('cors');
1728const mongoose = require('mongoose');
1729
1730// Middleware setup
1731app.use(cors());
1732app.use(compression(compressionConfig));
1733app.use(express.json({ limit: '200mb' }));
1734
1735// Route mounting
1736app.use('/api/cards', require('./routes/cards'));
1737app.use('/api/auctions', require('./routes/auctions'));
1738
1739// Error handling
1740app.use(require('./middleware/errorHandler'));
1741```
1742
1743#### **Database Entry: `config/db.js`**
1744
1745**Connection Management:**
1746- Environment-aware connection strings
1747- Error handling and retry logic
1748- Test environment isolation
1749- Connection event monitoring
1750
1751### **Configuration Files**
1752
1753#### **Environment Configuration: `.env`**
1754
1755**Configuration Categories:**
1756```bash
1757# Database
1758MONGO_URI=mongodb://localhost:27017/pokemon-collection
1759
1760# Server
1761PORT=5000
1762NODE_ENV=development
1763
1764# File Upload
1765UPLOAD_DIR=./public/uploads
1766MAX_FILE_SIZE=200mb
1767
1768# Cache
1769SEARCH_CACHE_TTL=300
1770CACHE_CHECK_PERIOD=60
1771```
1772
1773#### **ESLint Configuration: `eslint.config.js`**
1774
1775**Comprehensive Rule Set** (200+ rules):
1776```javascript
1777{
1778  files: ['**/*.js'],
1779  rules: {
1780    'no-console': 'warn',           // Allow console in development
1781    'no-underscore-dangle': 'off',  // MongoDB _id compatibility
1782    'max-len': ['error', { 'code': 120 }],
1783    'prefer-const': 'error',        // Enforce immutability
1784    'no-var': 'error'               // Modern JavaScript practices
1785  }
1786}
1787```
1788
1789**Environment-Specific Overrides:**
1790```javascript
1791{
1792  files: ['test/**/*.js'],
1793  rules: {
1794    'no-unused-expressions': 'off',  // Chai assertions
1795    'func-names': 'off',             // Anonymous test functions
1796    'prefer-arrow-callback': 'off'   // Mocha context binding
1797  }
1798}
1799```
1800
1801#### **Package Configuration: `package.json`**
1802
1803**Script Categories:**
1804```json
1805{
1806  "scripts": {
1807    "start": "nodemon server.js",           // Development server
1808    "start:prod": "node server.js",         // Production server
1809    "test": "NODE_ENV=test mocha test --timeout 10000 --recursive --exit",
1810    "test:coverage": "NODE_ENV=test nyc mocha test --timeout 10000 --recursive --exit",
1811    "lint": "eslint .",                     // Code quality check
1812    "lint:fix": "eslint . --fix"            // Automatic fixes
1813  }
1814}
1815```
1816
1817---
1818
1819## **9. Advanced Utility Systems & Configuration**
1820
1821### **Name Shortening System**
1822
1823#### **Modular Configuration System**
1824
1825**Rarity Mapping**: 50+ rarity variant standardizations
1826```javascript
1827RARITY_VARIANTS = {
1828  'holofoil': 'HOLO',
1829  'first edition': '1ST EDITION',
1830  'shadowless': 'SHADOWLESS',
1831  'secret rare': 'SECRET RARE'
1832}
1833```
1834
1835**Set Name Mappings**: Comprehensive Pokemon set abbreviations
1836```javascript
1837SET_NAMES = {
1838  'Base Set': 'Base',
1839  'Neo Genesis': 'Neo Gen',
1840  'Team Rocket': 'Rocket'
1841}
1842```
1843
1844#### **Platform-Specific Formatters**
1845
1846**DBA Title Generator**:
1847- Platform optimization for marketplace character limits
1848- Category-specific formatting patterns
1849- Japanese variant handling
1850- Price integration with currency symbols
1851
1852**Facebook Post Builder**:
1853- Social media optimization with emoji categorization
1854- Group formatting by item category (🎁 Sealed, 🏆 PSA, 🃏 Raw)
1855- Price display with local currency (Kr.)
1856- Year integration for vintage items
1857
1858### **External Listing Formatters**
1859
1860#### **Multi-Platform Optimization**
1861
1862```javascript
1863const formatters = {
1864  dba: (name) => shortenName(name, DBA_CHAR_LIMIT),
1865  facebook: (name) => formatWithEmojis(name),
1866  standard: (name) => cleanFormat(name)
1867};
1868```
1869
1870**Configuration Categories**:
1871- **Character Limit Handling**: Platform-specific restrictions
1872- **Emoji Integration**: Visual appeal for social media
1873- **Japanese Detection**: Pattern-based identification
1874- **Currency Formatting**: Localized pricing display
1875
1876---
1877
1878## **10. Advanced Data Import & Migration System**
1879
1880### **Import Coordination Architecture**
1881
1882#### **Three-Phase Import Process**
1883
1884**Phase 1: Set Metadata Import**
1885- Summary files processing from PSA data
1886- Set creation with metadata (year, URL, card totals)
1887- Initial population statistics
1888
1889**Phase 2: Individual Card Data Import**
1890- Card-specific data processing
1891- PSA population statistics integration
1892- Reference relationship establishment
1893
1894**Phase 3: Totals Recalculation and Validation**
1895- Set card count validation
1896- PSA population aggregation
1897- Data integrity verification
1898
1899#### **Parallel Processing Features**
1900
1901```javascript
1902const totalResults = {
1903  psaFiles: 0,
1904  sealedProductFiles: 0,
1905  setsCreated: 0,
1906  setsUpdated: 0,
1907  cardsProcessed: 0,
1908  sealedProductsProcessed: 0,
1909  errors: []
1910};
1911```
1912
1913**Advanced Features**:
1914- Concurrent PSA and CardMarket data processing
1915- Error aggregation across all operations
1916- Progress monitoring with real-time statistics
1917- Configurable limits for testing environments
1918
1919### **Data Verification Suite**
1920
1921**Verification Components**:
1922- **Count Calculator**: Expected vs actual document verification
1923- **Data Validator**: Schema and business rule validation
1924- **Database Verifier**: Referential integrity checking
1925- **Verification Reporter**: Pass/fail status with actionable errors
1926
1927### **File Processing Utilities**
1928
1929**Dynamic File Discovery**:
1930- Recursive JSON file scanning in nested directories
1931- Type classification (PSA metadata vs individual files vs CardMarket)
1932- Cross-platform absolute path handling
1933
1934---
1935
1936## **11. Comprehensive Testing Infrastructure**
1937
1938### **Test Organization & Hierarchy**
1939
1940```
1941test/
1942├── controllers/
1943│   ├── auctions/          # Auction system tests
1944│   ├── cards/             # Card search and CRUD tests
1945│   ├── sales/             # Sales analytics tests
1946│   ├── psaGradedCards/    # PSA card management tests
1947│   └── helpers/           # Reusable test utilities
1948```
1949
1950### **Test Categories**
1951
1952**Unit Tests**: Individual function and method testing
1953**Integration Tests**: Service layer and database interaction testing
1954**Controller Tests**: HTTP endpoint and middleware testing
1955**Setup Helpers**: Specialized fixtures for different entity types
1956
1957### **Test Data Management**
1958
1959**MongoDB Memory Server**: In-memory testing for complete isolation
1960```javascript
1961// Mocha configuration with extended timeouts for database operations
1962"test": "NODE_ENV=test mocha test --timeout 10000 --recursive --exit"
1963```
1964
1965**Features**:
1966- Fixture system organized by entity type
1967- Automated test data cleanup between runs
1968- Population testing for relationship verification
1969
1970---
1971
1972## **12. Development & Maintenance Scripts**
1973
1974### **Database Maintenance Scripts**
1975
1976**Collection Inspection**:
1977- `checkCollections.js`: Database structure validation
1978- `updateSetCardTotals.js`: Recalculate card counts
1979- `cleanupListingFields.js`: Schema migration field removal
1980- `cleanupPersonalCollection.js`: Data sanitization
1981
1982**Data Verification Scripts**:
1983- `verifyDataImport.js`: Post-import integrity validation
1984- `verifyImport.js`: Import process verification
1985- `testDataImport.js`: Automated import testing
1986
1987### **Development Utilities**
1988
1989**Debug Scripts**:
1990- `debugImport.js`: Import process debugging with verbose logging
1991- `debug_set.js`: Set-specific data structure debugging
1992
1993**Import Management**:
1994- `importToLocalMongoDB.js`: Local development database population
1995- `importAllPhases.js`: Coordinated multi-phase import execution
1996- `setupAndImportData.js`: Complete setup and data import automation
1997
1998---
1999
2000## **13. Advanced Security & Performance**
2001
2002### **Request Security & Performance**
2003
2004#### **Request Deduplication System**
2005
2006```javascript
2007async deduplicateRequest(key, requestFn) {
2008  if (this.requestDeduplication.has(key)) {
2009    return this.requestDeduplication.get(key);
2010  }
2011  
2012  const promise = requestFn();
2013  this.requestDeduplication.set(key, promise);
2014  
2015  try {
2016    return await promise;
2017  } finally {
2018    this.requestDeduplication.delete(key);
2019  }
2020}
2021```
2022
2023**Features**:
2024- In-flight request tracking
2025- Promise sharing for identical requests
2026- Resource optimization and reduced database load
2027
2028#### **CORS & Body Parsing Configuration**
2029
2030```javascript
2031app.use(cors());
2032app.use(express.json({ limit: '200mb' }));
2033app.use(express.urlencoded({ 
2034  limit: '200mb', 
2035  extended: true, 
2036  parameterLimit: 50000 
2037}));
2038```
2039
2040### **Static File Serving & Upload Management**
2041
2042#### **Upload Directory Configuration**
2043
2044```javascript
2045app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
2046```
2047
2048**Upload API Features**:
2049- Single and multiple image upload endpoints
2050- Large file support (200MB limit)
2051- Automatic image URL generation
2052- Orphaned file cleanup utilities
2053
2054---
2055
2056## **Summary**
2057
2058This Pokemon Collection Backend represents a comprehensive, production-ready API system with sophisticated data management, search capabilities, and financial tracking. The architecture demonstrates strong adherence to software engineering principles with clear separation of concerns, robust error handling, and performance optimizations.
2059
2060### **Key Architectural Strengths**
2061
2062**Comprehensive Data Modeling**:
2063- Referential integrity with polymorphic auction system
2064- Advanced Mongoose features with transform functions
2065- Multi-layer indexing strategy for optimal query performance
2066
2067**Advanced Search Architecture**:
2068- Three-tier search system (MongoDB text search + Fuse.js + caching)
2069- Weighted scoring with PSA popularity integration
2070- Request deduplication and performance optimization
2071
2072**Sophisticated Import System**:
2073- Three-phase import with parallel processing
2074- Comprehensive error tracking and verification
2075- Dynamic file discovery and processing
2076
2077**Modular Service Architecture**:
2078- Domain-driven design with query/CRUD separation
2079- Business logic encapsulation with cross-cutting concerns
2080- Platform-specific formatters for external integration
2081
2082**Performance Optimization**:
2083- Multi-layer caching with hit rate monitoring
2084- Intelligent compression with binary detection
2085- Database query optimization with early filtering
2086
2087**Robust Error Handling**:
2088- Custom error class hierarchy
2089- Environment-aware error reporting
2090- Comprehensive validation and business rule enforcement
2091
2092**External Integration**:
2093- Platform-specific formatters for DBA and Facebook
2094- Name shortening system with configurable mappings
2095- Multi-platform optimization strategies
2096
2097**Comprehensive Testing**:
2098- Hierarchical test structure with entity-specific fixtures
2099- MongoDB Memory Server for isolated testing
2100- Controller, service, and integration test coverage
2101
2102**Development Tooling**:
2103- 200+ ESLint rules with environment-specific overrides
2104- Extensive utility scripts for maintenance
2105- Automated import testing and verification
2106
2107### **Advanced Technical Features**
2108
2109**Search Performance Optimizations**:
2110- Request deduplication prevents duplicate operations
2111- Search cache system with 5-minute TTL and hit rate monitoring
2112- Parallel search execution for global queries
2113
2114**Data Integrity Systems**:
2115- Find-or-create patterns for referential integrity
2116- Automatic price history tracking
2117- Polymorphic auction system with flexible item references
2118
2119**Monitoring & Observability**:
2120- Multi-dimensional health endpoint with cache and memory metrics
2121- Comprehensive error classification and logging
2122- Performance monitoring with query timing
2123
2124### **Areas for Future Enhancement**
2125
2126**Authentication & Authorization**:
2127- User management system implementation
2128- Role-based access control (RBAC)
2129- JWT token authentication
2130
2131**Background Job Processing**:
2132- Automated price updates from external sources
2133- Scheduled analytics aggregation
2134- Database maintenance automation
2135
2136**Enhanced Resilience**:
2137- Circuit breaker pattern for external service calls
2138- Rate limiting for API protection
2139- Structured logging with correlation IDs
2140
2141**API Documentation**:
2142- OpenAPI/Swagger specification generation
2143- Interactive API documentation
2144- API versioning strategy
2145
2146**Advanced Analytics**:
2147- Machine learning integration for price prediction
2148- Market trend analysis
2149- Investment performance tracking
2150
2151The system successfully serves as the backbone for a professional Pokemon card collection management application with sophisticated features rivaling commercial solutions, while maintaining clean architecture principles and extensive testing coverage. The modular design enables easy enhancement and scaling as requirements evolve.