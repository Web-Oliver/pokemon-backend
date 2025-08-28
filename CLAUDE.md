# Pokemon Collection Backend - Claude Configuration

A sophisticated Node.js Express backend for Pokemon card collection management featuring OCR processing, marketplace integrations, and advanced search capabilities.

## Project Architecture

This is an **enterprise-grade Express.js backend** with:
- **Domain-Driven Design** architecture 
- **Dependency Injection** system with ServiceContainer
- **Repository Pattern** for data access
- **Advanced Error Handling** with centralized error management
- **Sophisticated Caching** (multi-layer with FlexSearch)
- **OCR Pipeline** for PSA card grading automation
- **Marketplace Integrations** (DBA, Facebook) 
- **Real-time Search** with fuzzy matching

## Development Standards

### Core Architecture Patterns
- **Domain Separation**: `/src` organized by business domains (`collection/`, `pokemon/`, `icr/`, `marketplace/`, `search/`)
- **Service Layer**: Business logic isolated in service classes (`*Service.js`)
- **Repository Pattern**: Data access through repositories (`*Repository.js`)
- **Controller Pattern**: Express controllers extend `BaseController`
- **Dependency Injection**: Services registered in `ServiceContainer.js`
- **Error Handling**: Centralized via `CentralizedErrorHandler.js`

### Code Quality Rules
- **ES6+ Modules**: Use `import/export` syntax (configured in package.json)
- **Path Aliases**: Use `@/*` imports for src files (configured via loader.js)
- **Error Propagation**: Throw domain-specific errors from `ErrorTypes.js`
- **Async/Await**: Use modern Promise patterns throughout
- **Logging**: Use `Logger.js` instead of console.log
- **Validation**: Input validation via `express-validator`

## Tech Stack & Key Components

### Core Technologies
- **Runtime**: Node.js with ES Modules
- **Framework**: Express.js 5.x
- **Database**: MongoDB with Mongoose ODM
- **Search**: FlexSearch + FuseJS + FuzzSort
- **OCR**: Google Vision API
- **Image Processing**: Sharp
- **Caching**: Node-cache (in-memory)
- **Validation**: express-validator
- **Logging**: Winston

### Key Architectural Components
- **ServiceContainer**: `src/system/dependency-injection/ServiceContainer.js` - DI container
- **BaseRepository**: `src/system/database/BaseRepository.js` - Data access base
- **BaseController**: `src/system/middleware/BaseController.js` - Controller base
- **Logger**: `src/system/logging/Logger.js` - Centralized logging
- **ErrorHandler**: `src/system/middleware/CentralizedErrorHandler.js`

## Development Commands

| Command | Purpose | Example |
|---------|---------|----------|
| `npm run dev` | Start development server with nodemon | Hot reload on changes |
| `npm run start` | Start production server | Uses loader.js for path resolution |
| `npm run test` | Run Mocha tests | Currently no tests written |
| `npm run test:jest` | Run Jest tests | Alternative test runner |
| `npm run lint` | Run ESLint | Check code style |
| `npm run lint:fix` | Fix ESLint issues | Auto-fix styling issues |

### Key Scripts
- **Entry Point**: `src/system/startup/server.js`
- **Module Loader**: `loader.js` (enables @/* path aliases)
- **Service Bootstrap**: `src/system/startup/serviceBootstrap.js`

## Domain Structure

### Core Domains
- **collection/**: Card collection management, sales, activities, auctions
- **pokemon/**: Pokemon card/set/product data management
- **icr/**: Image Character Recognition (OCR pipeline for PSA cards)
- **marketplace/**: External platform integrations (DBA, Facebook)
- **search/**: Advanced search with multiple engines
- **system/**: Infrastructure (DB, DI, middleware, caching)
- **uploads/**: File upload handling and image processing
- **workflow/**: Business process management

## Database Architecture

### Models & Schemas
- **PsaGradedCard**: PSA graded cards with OCR data
- **RawCard**: Ungraded raw cards
- **SealedProduct**: Sealed Pokemon products
- **Card**: Pokemon card reference data
- **Set**: Pokemon set information
- **Product**: Pokemon product catalog
- **Auction**: Marketplace auction data
- **Activity**: Collection activity tracking

### Repository Pattern
All data access goes through repositories:
```javascript
// Example: CardRepository extends BaseRepository
const cardRepo = serviceContainer.resolve('CardRepository');
const cards = await cardRepo.findBySet('base-set');
```

## ICR (Image Character Recognition) Pipeline

### OCR Workflow
1. **Upload**: Images uploaded to `/uploads/icr/`
2. **Stitching**: Multiple card images stitched together
3. **Label Extraction**: PSA labels detected and extracted
4. **OCR Processing**: Google Vision API extracts text
5. **Card Matching**: Text matched to Pokemon card database
6. **Graded Card Creation**: Final PSA graded card record

### Key Components
- **IcrBatchController**: Main OCR endpoint
- **IcrStitchingService**: Image stitching logic
- **PsaLabelDetectionService**: Label detection
- **GoogleVisionOcrProvider**: OCR processing
- **CardMatchingDomainService**: Card matching algorithm

## Search Architecture

### Multi-Engine Search
- **FlexSearch**: Fast full-text indexing
- **FuseJS**: Fuzzy string matching
- **FuzzSort**: High-performance fuzzy sorting
- **MongoDB**: Database query fallback

### Search Endpoints
- `/api/search/unified`: Cross-domain search
- `/api/search/cards`: Pokemon card search
- `/api/search/products`: Product catalog search
- `/api/search/collection`: Collection item search

## Caching Strategy

### Multi-Layer Caching
- **Search Cache**: FlexSearch indexes cached in memory
- **API Response Cache**: Node-cache for frequent queries
- **Database Query Cache**: Mongoose query result caching
- **Image Cache**: Processed images cached to disk

### Cache Management
```javascript
// Access cache through cacheManager
const { cacheManager } = require('@/search/middleware/searchCache.js');
const cached = cacheManager.get('search:key');
```

## Error Handling

### Centralized Error Management
All errors flow through `CentralizedErrorHandler.js`:

```javascript
// Throw domain-specific errors
throw new ValidationError('Invalid card data', { cardId });
throw new NotFoundError('Card not found');
throw new DatabaseError('Connection failed');
```

### Error Types
- **ValidationError**: Input validation failures
- **NotFoundError**: Resource not found
- **DatabaseError**: Database operation failures
- **ExternalServiceError**: Third-party API failures
- **AuthenticationError**: Auth failures (not implemented)

## Dependency Injection

### Service Container
All services registered in `ServiceContainer.js`:

```javascript
// Register service
serviceContainer.register('CardService', () => new CardService(dependencies));

// Resolve service
const cardService = serviceContainer.resolve('CardService');
```

### Key Services
- **CardService**: Pokemon card operations
- **CollectionService**: Collection management
- **SearchService**: Search operations
- **IcrBatchService**: OCR processing
- **ActivityService**: Activity tracking
- **CacheManager**: Cache operations

## Security Considerations

### Current Security Gaps (CRITICAL)
- **No Authentication**: All endpoints are public
- **No Authorization**: No role-based access control
- **CORS**: Currently allows all origins (security risk)
- **File Uploads**: 200MB limit with basic validation
- **No Rate Limiting**: Vulnerable to DoS attacks
- **Exposed Credentials**: Google service account in repo

### Immediate Security Actions Needed
1. Remove `google-service-account.json` from repo
2. Implement JWT authentication
3. Add proper CORS configuration
4. Add rate limiting middleware
5. Implement Helmet.js security headers

## Performance Optimizations Needed

### Database Performance
- **Missing Indexes**: Add indexes on frequently queried fields
- **Connection Pooling**: Optimize MongoDB connection settings
- **Query Optimization**: Implement lean queries for list operations

### Caching Improvements
- **Redis Integration**: Replace in-memory cache with Redis
- **HTTP Caching**: Add proper cache headers for static content
- **Query Result Caching**: Cache expensive database operations

### Response Optimization
- **Pagination**: Enhanced pagination with proper indexing
- **Data Serialization**: Optimize JSON responses
- **Image Processing**: Stream processing for large images

## Testing Strategy (Currently Missing)

### Test Framework Setup
- **Mocha**: Configured but no tests written
- **Jest**: Alternative test runner available
- **Supertest**: For API endpoint testing
- **NYC**: Code coverage reporting

### Testing Priorities
1. **Unit Tests**: Core business logic (Services, Repositories)
2. **Integration Tests**: API endpoints and database operations
3. **OCR Pipeline Tests**: Image processing workflows
4. **Search Tests**: Multi-engine search accuracy
5. **Error Handling Tests**: Centralized error scenarios

## Development Workflow

### Adding New Features
1. **Analyze Domain**: Determine which domain the feature belongs to
2. **Check Existing Code**: Look for similar patterns and reusable components
3. **Create Service**: Implement business logic in a service class
4. **Create Repository**: Add data access layer if needed
5. **Create Controller**: Add Express controller extending BaseController
6. **Register Dependencies**: Add services to ServiceContainer
7. **Add Routes**: Wire up endpoints in appropriate route files
8. **Add Validation**: Use express-validator for input validation
9. **Handle Errors**: Use centralized error handling
10. **Add Logging**: Use Logger.js for operational visibility

## Code Examples

### Creating a New Service
```javascript
// src/pokemon/cards/NewFeatureService.js
import { BaseService } from '@/system/services/BaseService.js';
import { ValidationError } from '@/system/errors/ErrorTypes.js';

export class NewFeatureService extends BaseService {
    constructor(cardRepository, logger) {
        super();
        this.cardRepository = cardRepository;
        this.logger = logger;
    }
    
    async processCard(cardData) {
        try {
            this.logger.info('Processing card', { cardId: cardData.id });
            // Implementation here
        } catch (error) {
            this.logger.error('Card processing failed', error);
            throw new ValidationError('Invalid card data');
        }
    }
}
```

### Creating a New Controller
```javascript
// src/pokemon/cards/newFeatureController.js
import { BaseController } from '@/system/middleware/BaseController.js';
import { body, validationResult } from 'express-validator';

export class NewFeatureController extends BaseController {
    constructor(newFeatureService) {
        super();
        this.newFeatureService = newFeatureService;
    }
    
    getValidationRules() {
        return [
            body('cardId').isString().notEmpty(),
            body('name').isString().isLength({ min: 1, max: 100 })
        ];
    }
    
    async handleRequest(req, res) {
        const result = await this.newFeatureService.processCard(req.body);
        this.sendSuccessResponse(res, result);
    }
}
```

### Adding New Routes
```javascript
// src/pokemon/cards/routes.js
import express from 'express';
import { NewFeatureController } from './newFeatureController.js';
import { serviceContainer } from '@/system/dependency-injection/index.js';

const router = express.Router();
const controller = serviceContainer.resolve('NewFeatureController');

router.post('/new-feature', 
    controller.getValidationRules(),
    controller.handleRequest.bind(controller)
);

export default router;
```

## Project File Structure

```
src/
├── collection/           # Card collection management
│   ├── activities/      # Activity tracking
│   ├── auctions/        # Auction management
│   ├── items/          # Collection items (PSA cards, raw cards, sealed)
│   ├── sales/          # Sales tracking
│   └── shared/         # Collection utilities
├── pokemon/             # Pokemon reference data
│   ├── cards/          # Pokemon card data
│   ├── products/       # Pokemon products
│   ├── sets/           # Pokemon sets
│   └── shared/         # Pokemon utilities
├── icr/                 # Image Character Recognition
│   ├── application/    # OCR business logic
│   ├── infrastructure/ # OCR technical components
│   └── presentation/   # OCR controllers
├── marketplace/         # External integrations
│   ├── dba/           # DBA marketplace
│   ├── facebook/      # Facebook marketplace
│   └── exports/       # Export functionality
├── search/             # Search functionality
│   ├── controllers/   # Search endpoints
│   ├── middleware/    # Search caching
│   └── services/      # Search engines
├── system/             # Core infrastructure
│   ├── database/      # Database layer
│   ├── dependency-injection/ # DI container
│   ├── errors/        # Error definitions
│   ├── logging/       # Logging system
│   ├── middleware/    # Express middleware
│   └── startup/       # Application bootstrap
└── uploads/            # File upload handling
    ├── images/        # Image processing
    └── utils/         # Upload utilities
```

## Environment Configuration

### Required Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/pokemon_collection

# Google Cloud (OCR)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Server
PORT=3000
NODE_ENV=development

# External APIs
POKEAPI_BASE_URL=https://pokeapi.co/api/v2/

# File Uploads
MAX_FILE_SIZE=209715200  # 200MB
UPLOAD_PATH=./uploads/
```

### Development Setup
```bash
npm install
npm run dev  # Starts with nodemon and path aliases
```

## Current System Status

### Architecture Overview
The backend uses enterprise patterns with dependency injection, repository pattern, and domain separation. All endpoints are currently open access with comprehensive OCR processing capabilities.

### Performance Characteristics
- **Caching**: Multi-layer in-memory caching with FlexSearch indexing
- **Database**: MongoDB with Mongoose ODM, standard connection pooling
- **Search**: Triple-engine search (FlexSearch + FuseJS + MongoDB)
- **OCR**: Google Vision API integration for PSA card processing

### Development Environment
- **Testing**: Jest and Mocha configured, ready for test implementation
- **Linting**: ESLint with modern ES2022 configuration
- **Development**: Nodemon with hot reload and path alias support

## Quick Reference

### Common Operations
```javascript
// Service Resolution
const cardService = serviceContainer.resolve('CardService');

// Repository Access
const cardRepo = serviceContainer.resolve('CardRepository');
const cards = await cardRepo.findBySet('base-set');

// Error Handling
if (!card) throw new NotFoundError('Card not found', { cardId });

// Logging
logger.info('Processing card', { cardId, operation: 'grading' });

// Validation
const validationRules = [
  body('cardId').isString().notEmpty(),
  body('grade').isInt({ min: 1, max: 10 })
];
```

### File Locations
- **Entry Point**: `src/system/startup/server.js`
- **Service Container**: `src/system/dependency-injection/ServiceContainer.js`
- **Base Classes**: `src/system/middleware/BaseController.js`, `src/system/database/BaseRepository.js`
- **Error Types**: `src/system/errors/ErrorTypes.js`
- **Logger**: `src/system/logging/Logger.js`

## Architecture Summary

This Pokemon Collection Backend demonstrates **enterprise-grade architecture** with:

### Strengths
- **Domain-Driven Design**: Clear business domain separation
- **Dependency Injection**: Professional DI container implementation
- **Repository Pattern**: Consistent data access abstraction
- **Advanced Error Handling**: Centralized error management
- **Multi-Engine Search**: FlexSearch + FuseJS + MongoDB
- **OCR Pipeline**: Google Vision API integration
- **Marketplace Integration**: DBA + Facebook automation

### Critical Gaps
- **Security**: No authentication, exposed credentials, open CORS
- **Testing**: Zero tests despite comprehensive framework setup
- **Performance**: Missing DB indexes, in-memory caching only
- **Production**: No Docker, CI/CD, or monitoring

**Assessment**: Excellent foundation requiring security hardening and testing before production deployment.

## Implementation Priorities

### Authentication Implementation
```javascript
// JWT middleware example
import jwt from 'jsonwebtoken';

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid token' });
  }
};
```

### Database Optimization Examples
```javascript
// Adding indexes to PsaGradedCard model
psaGradedCardSchema.index({ cardId: 1, grade: 1 });
psaGradedCardSchema.index({ dateAdded: -1 });
psaGradedCardSchema.index({ sold: 1 });
psaGradedCardSchema.index({ 'saleDetails.saleDate': -1 });

// Lean queries for list operations
const cards = await PsaGradedCard.find().lean().limit(50);
```

### Redis Caching Setup
```javascript
// Redis integration example
import redis from 'redis';
const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

// Cache middleware
const cacheMiddleware = (duration) => async (req, res, next) => {
  const key = `cache:${req.originalUrl}`;
  const cached = await client.get(key);
  if (cached) return res.json(JSON.parse(cached));
  
  res.sendResponse = res.json;
  res.json = (body) => {
    client.setex(key, duration, JSON.stringify(body));
    res.sendResponse(body);
  };
  next();
};
```

## Development Guidelines

### Adding New Features
1. **Service First**: Create business logic in service classes
2. **Repository Pattern**: Data access through repositories
3. **Dependency Injection**: Register services in ServiceContainer
4. **Error Handling**: Use centralized error types
5. **Input Validation**: express-validator middleware
6. **Logging**: Use Logger.js, not console.log

### Code Quality Standards
- **ES6+ Modules**: import/export syntax
- **Path Aliases**: @/* for src imports
- **Async/Await**: Modern Promise patterns
- **Type Validation**: Runtime input validation
- **Error Context**: Detailed error information
