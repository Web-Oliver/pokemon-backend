# Service Interface Contracts Documentation

## Overview

This document describes the service interface contracts implemented in the Pokemon Collection Backend system. These contracts ensure consistent behavior across service implementations and provide clear documentation for expected method signatures and behaviors.

## Purpose

The interface contracts serve several important purposes:

1. **SOLID Principle Compliance**: Implements Interface Segregation Principle (ISP) and Dependency Inversion Principle (DIP)
2. **Liskov Substitution**: Ensures all implementations can be substituted without breaking functionality
3. **Documentation**: Provides clear contracts for expected behavior
4. **Type Safety**: Enables better IDE support and error detection
5. **Testing**: Facilitates mock creation and contract testing

## Interface Contracts

### ICollectionService

The `ICollectionService` interface defines the standard contract for all collection management services (PSA, Raw, Sealed products).

**Key Responsibilities:**
- CRUD operations for collection items
- Sale tracking and management
- Search and filtering capabilities
- Price history management
- Statistics and analytics

**Implementation Requirements:**
- All methods must handle validation errors appropriately
- Database errors must be propagated with proper error types
- Business rules must be enforced consistently
- Activity logging should be integrated where appropriate

**Example Implementation:**
```javascript
class PsaGradedCardService extends CollectionService {
  constructor(repository, options = {}) {
    super(repository, {
      entityName: 'PsaGradedCard',
      enableImageManagement: true,
      enableSaleTracking: true,
      ...options
    });
  }

  // All ICollectionService methods are inherited from CollectionService
  // Entity-specific validations can be overridden
  validateCreateData(data) {
    super.validateCreateData(data);
    
    // PSA-specific validation
    if (!data.grade || data.grade < 1 || data.grade > 10) {
      throw new ValidationError('PSA grade must be between 1 and 10');
    }
  }
}
```

### IActivityService

The `IActivityService` interface defines the contract for activity tracking services.

**Key Responsibilities:**
- Activity creation and management
- Card lifecycle activity logging
- Batch processing for performance
- Activity querying and statistics

**Implementation Requirements:**
- Must support batch processing for performance
- Should handle activity validation
- Must provide consistent activity metadata
- Should support activity archiving

**Example Usage:**
```javascript
// Log card addition
await ActivityService.logCardAdded(cardData, 'psa');

// Log price update
await ActivityService.logPriceUpdate(cardData, 'raw', oldPrice, newPrice);

// Get activities with filtering
const activities = await ActivityService.getActivities({
  type: 'card_added',
  limit: 20,
  dateRange: 'week'
});
```

### ISearchService

The `ISearchService` interface defines the contract for search services.

**Key Responsibilities:**
- Unified search across collection types
- Query normalization and processing
- Relevance scoring and ranking
- Search suggestions and autocomplete

**Implementation Requirements:**
- Must handle empty or invalid queries gracefully
- Should provide relevance scoring
- Must support different search strategies
- Should cache results when appropriate

**Example Implementation:**
```javascript
class EnhancedSearchService {
  async search(query, options = {}) {
    // Validate query
    if (!query || query.trim() === '') {
      throw new ValidationError('Search query cannot be empty');
    }

    // Normalize query
    const normalizedQuery = this.normalizeQuery(query);
    
    // Perform search with caching
    const cacheKey = `search:${normalizedQuery}:${JSON.stringify(options)}`;
    let results = await cache.get(cacheKey);
    
    if (!results) {
      results = await this.performSearch(normalizedQuery, options);
      await cache.set(cacheKey, results, 300); // 5 minute cache
    }
    
    return results;
  }
}
```

### IImageManager

The `IImageManager` interface defines the contract for image management services.

**Key Responsibilities:**
- Image file deletion and cleanup
- URL validation and path conversion
- Error handling for file operations

**Implementation Requirements:**
- Must handle file system errors gracefully
- Should validate URLs before processing
- Must provide detailed logging for operations
- Should continue processing even if individual files fail

### IRepository

The `IRepository` interface defines the contract for data access repositories.

**Key Responsibilities:**
- Database CRUD operations
- Query building and execution
- Pagination and filtering
- Bulk operations

**Implementation Requirements:**
- Must handle database connection errors
- Should provide consistent error types
- Must support pagination
- Should optimize queries for performance

## Error Handling Contracts

All service interfaces define specific error types that implementations must throw:

### ValidationError
- Thrown when input data is invalid
- Should include descriptive error messages
- Used for client-side validation feedback

### NotFoundError
- Thrown when requested resources don't exist
- Should include resource type and ID
- Used for 404 HTTP responses

### DatabaseError
- Thrown when database operations fail
- Should preserve original error information
- Used for 500 HTTP responses

### BusinessRuleError
- Thrown when business rules are violated
- Should explain the rule violation
- Used for 400 HTTP responses

## JSDoc Contract Annotations

All service methods include comprehensive JSDoc annotations:

```javascript
/**
 * Creates a new collection item
 * @param {Object} data - Item data to create
 * @param {QueryOptions} options - Creation options
 * @returns {Promise<Object>} Created collection item
 * @throws {ValidationError} When data is invalid or incomplete
 * @throws {DuplicateError} When item already exists
 * @throws {DatabaseError} When database operation fails
 */
async create(data, options = {}) {
  // Implementation
}
```

### JSDoc Benefits

1. **IDE Support**: Provides autocomplete and type checking
2. **Documentation Generation**: Can generate API documentation
3. **Contract Validation**: Clearly defines expected behavior
4. **Error Documentation**: Documents all possible error conditions

## Testing Interface Contracts

Interface contracts facilitate comprehensive testing:

### Contract Testing
```javascript
describe('ICollectionService Contract', () => {
  let service;
  
  beforeEach(() => {
    service = new PsaGradedCardService(mockRepository);
  });
  
  it('should implement all required methods', () => {
    expect(service.getAll).toBeDefined();
    expect(service.create).toBeDefined();
    expect(service.update).toBeDefined();
    expect(service.delete).toBeDefined();
    // ... test all interface methods
  });
  
  it('should throw ValidationError for invalid data', async () => {
    await expect(service.create({})).rejects.toThrow(ValidationError);
  });
});
```

### Mock Creation
```javascript
const mockCollectionService = {
  getAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  // ... implement all interface methods
};
```

## Migration and Adoption

### Existing Services

All existing services have been updated with interface contracts:

1. **CollectionService**: Implements `ICollectionService`
2. **ActivityService**: Implements `IActivityService`
3. **SearchUtility**: Implements `ISearchService`
4. **ImageManager**: Implements `IImageManager`

### New Services

When creating new services:

1. Choose the appropriate interface contract
2. Implement all required methods
3. Add comprehensive JSDoc annotations
4. Include proper error handling
5. Write contract compliance tests

## Benefits Realized

### Code Quality
- Consistent method signatures across services
- Clear documentation of expected behavior
- Better error handling and reporting

### Maintainability
- Easier to understand service responsibilities
- Simplified testing and mocking
- Clear upgrade paths for service enhancements

### Developer Experience
- Better IDE support with autocomplete
- Clear documentation of service capabilities
- Reduced learning curve for new developers

### System Reliability
- Consistent error handling across services
- Predictable service behavior
- Better integration between components

## Future Enhancements

### Planned Improvements

1. **TypeScript Migration**: Convert interfaces to TypeScript for compile-time checking
2. **Runtime Validation**: Add runtime contract validation in development
3. **Performance Contracts**: Add performance expectations to interface contracts
4. **Monitoring Integration**: Add contract compliance monitoring

### Extension Points

The interface contracts are designed to be extensible:

1. **New Methods**: Can be added with default implementations
2. **Optional Parameters**: Can be added without breaking existing code
3. **Metadata Extensions**: Contracts support metadata for future features

## Conclusion

The service interface contracts provide a solid foundation for the Pokemon Collection Backend system. They ensure consistent behavior, improve code quality, and facilitate future enhancements while maintaining backward compatibility.

By following these contracts, all services provide predictable behavior, comprehensive error handling, and clear documentation, resulting in a more maintainable and reliable system.