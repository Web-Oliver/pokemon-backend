# Technology Stack - Pokemon Collection Backend

## Core Runtime & Framework
- **Node.js 18+**: Modern JavaScript runtime with ES Modules support
- **Express.js 5.x**: Web framework with enterprise-grade middleware
- **ES Modules**: Modern `import/export` syntax throughout (`"type": "module"`)
- **Path Aliases**: `@/*` imports mapping to `src/*` for clean module resolution

## Database & Data Layer
- **MongoDB**: Primary database with flexible document storage
- **Mongoose ODM**: Object modeling with schema validation and middleware
- **Connection Pooling**: Standard MongoDB connection management
- **Query Optimization**: Repository pattern with consistent data access

## Search Architecture
- **FlexSearch**: High-performance full-text search indexing (primary)
- **FuseJS**: Advanced fuzzy string matching (secondary)
- **FuzzSort**: Performance-optimized fuzzy sorting (tertiary)
- **MongoDB Text Search**: Complex query fallback (quaternary)

## Image Processing & OCR
- **Google Vision API**: Cloud-based OCR text extraction
- **Sharp**: High-performance image processing and manipulation
- **Image Stitching**: Custom implementation for multi-card processing
- **PSA Label Detection**: Automated grading label recognition

## Caching & Performance
- **Node-cache**: In-memory caching with TTL management
- **Multi-layer Strategy**: Search indices + API responses + query cache
- **Performance Monitoring**: Built-in metrics collection
- **Cache Invalidation**: Entity-based invalidation patterns

## Development Tools
- **ESLint**: Code quality and style enforcement
- **Nodemon**: Development server with hot reload
- **ES2022**: Modern JavaScript features and syntax
- **Module Loader**: Custom `loader.js` for path alias resolution

## External Integrations
- **Google Cloud Platform**: Vision API for OCR processing
- **DBA.dk API**: Marketplace listing automation
- **Facebook Marketplace**: Automated listing creation
- **Pokemon API**: Reference data for card/set information

## Architecture Patterns
- **Domain-Driven Design**: Business domain separation
- **Dependency Injection**: Service container with lazy instantiation
- **Repository Pattern**: Data access abstraction layer
- **Service Layer Pattern**: Business logic encapsulation
- **Plugin Architecture**: Extensible controller system

## File & Upload Handling
- **Multer**: Multipart form data handling
- **File Processing**: 200MB upload limit for batch OCR
- **Image Optimization**: Sharp for resizing and format conversion
- **Storage Management**: Local file system with organized structure

## Logging & Monitoring
- **Winston**: Structured logging with multiple transports
- **Performance Metrics**: Built-in controller and service metrics
- **Error Tracking**: Centralized error handling and reporting

## **NO TESTING FRAMEWORK USAGE**
- **Mocha/Jest**: Configured but not used (personal project requirement)
- **No Test Coverage**: No testing requirements for personal use
- **No Test Automation**: Development speed prioritized over testing

## **NO SECURITY IMPLEMENTATIONS**
- **No Authentication**: Personal use system requires no user management
- **No Authorization**: Single-user environment with full access
- **Open CORS**: All origins allowed for development flexibility
- **No Rate Limiting**: Personal use eliminates DoS concerns
- **No Security Headers**: Private environment with no external threats

## Performance Characteristics
- **Response Times**: <100ms for search operations
- **Memory Usage**: ~200MB baseline with efficient caching
- **Concurrent Requests**: Optimized for single-user load
- **Database Performance**: Standard MongoDB performance patterns

## Development Configuration
```bash
# Core Environment Variables
MONGODB_URI=mongodb://localhost:27017/pokemon_collection
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
PORT=3000
NODE_ENV=development
```

## Technology Decisions

### Why ES Modules?
- Modern JavaScript standard with better static analysis
- Clean import/export syntax improving code readability
- Better tree-shaking support for bundle optimization

### Why Multiple Search Engines?
- **FlexSearch**: Fastest for exact and prefix matching
- **FuseJS**: Best fuzzy matching algorithms
- **MongoDB**: Complex query support with aggregation
- **Performance Layering**: Query routing for optimal speed

### Why Dependency Injection?
- Testable code architecture (future consideration)
- Flexible service configuration and swapping
- Clear dependency management and lifecycle control
- Enterprise-grade pattern for maintainability

### Why Repository Pattern?
- Consistent data access patterns across domains
- Database abstraction for future flexibility
- Centralized query optimization and caching
- Clean separation between business logic and data access

## Future Technology Considerations
- **Redis**: For distributed caching if scaling needed
- **Docker**: For deployment standardization
- **TypeScript**: For enhanced development experience
- **GraphQL**: For flexible API queries if multi-client support needed