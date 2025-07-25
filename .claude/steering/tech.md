# Technical Architecture & Standards

## Technology Stack

### Core Runtime & Framework
- **Node.js**: Latest LTS for JavaScript runtime environment
- **Express.js 5.1.0**: Web framework with comprehensive middleware support
- **Mongoose 8.16.1**: MongoDB ODM for schema validation and relationship management

### Database & Storage
- **MongoDB**: Document database for flexible schema and relationship modeling
- **Decimal128**: Financial precision for all pricing data
- **Compound Indexes**: Optimized queries with unique constraints
- **GridFS**: Large file storage for image management

### Performance & Caching
- **node-cache 5.1.2**: In-memory caching with TTL support
  - Search results: 5-minute TTL
  - API responses: 1-minute TTL
  - Search suggestions: 10-minute TTL
- **Compression Middleware**: Gzip compression with 1KB threshold
- **Request Deduplication**: Prevents duplicate concurrent operations

### Search & Data Processing
- **Fuse.js 7.1.0**: Fuzzy search with weighted scoring algorithms
- **Text Indexes**: MongoDB text search with field weights
- **Search Pipeline**: Multi-stage search with caching and optimization

### File Management
- **Multer 2.0.1**: File upload handling with 200MB limit support
- **Static File Serving**: Express static middleware for image serving
- **Image Optimization**: Automated cleanup and orphan detection

## Architectural Patterns

### SOLID Principles Implementation

#### Single Responsibility Principle (SRP)
- **Controllers**: HTTP request/response handling only
- **Services**: Business logic encapsulation
- **Repositories**: Data access abstraction
- **Models**: Schema definition and validation

#### Open/Closed Principle (OCP)
- **Factory Pattern**: SearchFactory for extensible search implementations
- **Middleware Pipeline**: Extensible request processing
- **Plugin Architecture**: Activity tracking and audit plugins

#### Liskov Substitution Principle (LSP)
- **Base Classes**: BaseController and BaseRepository for consistent interfaces
- **Polymorphic References**: Auction items support PSA/Raw/Sealed types
- **Service Interfaces**: Consistent service method signatures

#### Interface Segregation Principle (ISP)
- **Specialized Controllers**: Separate controllers for each entity type
- **Focused Services**: Single-purpose service classes
- **Modular Utilities**: Specific utility functions for distinct operations

#### Dependency Inversion Principle (DIP)
- **Repository Pattern**: Controllers depend on service abstractions
- **Service Injection**: Services depend on repository interfaces
- **Configuration Abstraction**: Environment-based configuration management

### DRY (Don't Repeat Yourself) Implementation
- **Shared Schemas**: Common price history and sale details schemas
- **Utility Functions**: Centralized name shortening and formatting
- **Base Classes**: Shared CRUD operations through inheritance
- **Middleware Functions**: Reusable compression, caching, and error handling

### Hierarchical Architecture Layers

#### Layer 1: Core Infrastructure
- **Database Connection**: MongoDB connection management
- **Error Handling**: Custom error classes and global error middleware
- **Configuration**: Environment variable management
- **Logging**: Structured logging with performance tracking

#### Layer 2: Data Access Layer
- **Models**: Mongoose schema definitions with validation
- **Repositories**: Data access abstraction with query optimization
- **Migrations**: Database schema versioning and updates

#### Layer 3: Business Logic Layer
- **Services**: Domain-specific business logic implementation
- **Validation**: Business rule validation and data integrity
- **Search Logic**: Advanced search algorithms and optimization
- **Analytics**: Sales and collection analytics processing

#### Layer 4: Presentation Layer
- **Controllers**: HTTP endpoint handlers with input validation
- **Routes**: Express routing with middleware integration
- **Middleware**: Request processing pipeline
- **Response Formatting**: Consistent API response structures

## Database Design Standards

### Schema Conventions
- **ObjectId References**: Consistent foreign key relationships
- **Timestamps**: Automatic createdAt/updatedAt fields
- **Enum Validation**: Standardized status and category values
- **Index Strategy**: Compound indexes for query optimization

### Data Integrity Rules
- **Unique Constraints**: Prevent duplicate cards and products
- **Referential Integrity**: Validated ObjectId references
- **Cascade Operations**: Proper cleanup of dependent records
- **Data Validation**: Mongoose schema validation with custom validators

### Performance Optimization
- **Lean Queries**: Minimal data retrieval for list operations
- **Population Strategy**: Selective field population for relationships
- **Aggregation Pipeline**: Complex queries with MongoDB aggregation
- **Index Coverage**: Covered queries for maximum performance

## API Design Standards

### RESTful Conventions
- **HTTP Methods**: Standard GET, POST, PUT, DELETE, PATCH usage
- **URL Structure**: Resource-based URLs with consistent naming
- **Status Codes**: Appropriate HTTP status codes for all responses
- **Content Negotiation**: JSON content type with UTF-8 encoding

### Request/Response Formats
```json
{
  "success": boolean,
  "data": object|array,
  "meta": {
    "cached": boolean,
    "pagination": object,
    "timestamp": "ISO-8601"
  }
}
```

### Error Response Standards
```json
{
  "success": false,
  "status": "error",
  "message": "Human-readable description",
  "details": "Technical details (optional)",
  "stack": "Stack trace (development only)"
}
```

## Security & Validation Standards

### Input Validation
- **Express Validator**: Comprehensive input validation middleware
- **Mongoose Validation**: Schema-level validation with custom rules
- **File Upload Validation**: Type and size restrictions for uploads
- **SQL Injection Prevention**: Parameterized queries through Mongoose

### Data Protection
- **Sensitive Data Handling**: No hardcoded credentials or secrets
- **Environment Variables**: Secure configuration management
- **Error Sanitization**: No sensitive data in error responses
- **Audit Logging**: Complete operation tracking for security

## Performance Standards

### Response Time Requirements
- **Search Operations**: < 500ms with caching enabled
- **CRUD Operations**: < 200ms for single item operations
- **Bulk Operations**: < 5 seconds for batch processing
- **File Uploads**: Progress tracking for large file operations

### Caching Strategy
- **Cache Hit Rate**: Target 85%+ hit rate for search operations
- **TTL Configuration**: Appropriate cache expiration based on data volatility
- **Cache Invalidation**: Intelligent cache clearing on data updates
- **Memory Management**: Automatic cache cleanup and size monitoring

## Testing Standards

### Test Organization
- **Unit Tests**: Individual function and method testing
- **Integration Tests**: Service layer and database interaction testing
- **Controller Tests**: HTTP endpoint and middleware testing
- **End-to-End Tests**: Complete workflow validation

### Test Data Management
- **MongoDB Memory Server**: Isolated testing environment
- **Test Fixtures**: Reusable test data organized by entity type
- **Cleanup Utilities**: Automatic test data cleanup between runs
- **Mock Strategies**: External service mocking for reliable tests

### Coverage Requirements
- **Line Coverage**: Minimum 80% line coverage for all services
- **Branch Coverage**: Minimum 70% branch coverage for business logic
- **Function Coverage**: 100% function coverage for public APIs
- **Integration Coverage**: All API endpoints must have test coverage

## Code Quality Standards

### ESLint Configuration
- **Rule Set**: 200+ ESLint rules with strict enforcement
- **Code Style**: Consistent formatting with Prettier integration
- **Error Prevention**: No-console warnings, strict variable declarations
- **Performance Rules**: Max line length (120), efficient patterns

### Documentation Standards
- **Code Comments**: JSDoc comments for all public functions
- **API Documentation**: Comprehensive endpoint documentation
- **README Files**: Clear setup and usage instructions
- **Changelog**: Version history with breaking change notifications

## Deployment & Environment Standards

### Environment Configuration
- **Development**: Nodemon auto-restart with verbose logging
- **Testing**: MongoDB Memory Server with isolated data
- **Production**: PM2 process management with cluster mode
- **Environment Variables**: Secure configuration for all environments

### Monitoring & Observability
- **Health Checks**: Comprehensive system status endpoint
- **Performance Metrics**: Cache hit rates, response times, memory usage
- **Error Tracking**: Structured error logging with stack traces
- **Backup Monitoring**: Automated backup verification and alerts