# Project Structure & Organization Standards

## Directory Structure

### Root Level Organization
```
pokemon-collection-backend/
├── .claude/                    # Claude Code workflow configuration
├── config/                     # Database and environment configuration
├── controllers/                # HTTP request handlers
├── models/                     # Mongoose schema definitions
├── services/                   # Business logic implementation
├── repositories/               # Data access layer
├── routes/                     # Express route definitions
├── middleware/                 # Express middleware functions
├── utils/                      # Utility functions and helpers
├── scripts/                    # Database maintenance and setup scripts
├── startup/                    # Application initialization modules
├── public/                     # Static file serving
├── backups/                    # Automated backup storage
├── data/                       # Reference data and import files
├── test/                       # Test suites and fixtures
└── node_modules/               # Dependencies
```

## File Naming Conventions

### Controller Files
- **Pattern**: `{entity}Controller.js` (camelCase)
- **Examples**: `psaGradedCardsController.js`, `auctionsController.js`
- **Specialized**: `UnifiedSearchController.js` for search operations

### Service Files
- **Pattern**: `{entity}Service.js` or `{domain}{Purpose}Service.js`
- **Examples**: `salesAnalyticsService.js`, `backupService.js`
- **Domain Services**: `CollectionService.js` for cross-entity operations

### Model Files
- **Pattern**: `{Entity}.js` (PascalCase)
- **Examples**: `Card.js`, `PsaGradedCard.js`, `SealedProduct.js`
- **Shared**: `schemas/shared/` for reusable schema components

### Route Files
- **Pattern**: `{entity}.js` (camelCase) or `{purpose}Routes.js`
- **Examples**: `cards.js`, `psaGradedCards.js`, `activityRoutes.js`
- **Special**: `unifiedSearch.js` for search endpoints

### Utility Files
- **Pattern**: `{purpose}.js` or `{domain}/{purpose}.js`
- **Examples**: `errorHandler.js`, `importers/psaDataImporter.js`
- **Namespacing**: Use subdirectories for related utilities

## Code Organization Patterns

### Controller Structure
```javascript
// controllers/{entity}Controller.js
const express = require('express');
const { {Entity}Service } = require('../services/{entity}Service');
const { asyncHandler } = require('../utils/errorHandler');

class {Entity}Controller {
  static async getAll(req, res) {
    // Implementation
  }
  
  static async getById(req, res) {
    // Implementation
  }
  
  static async create(req, res) {
    // Implementation
  }
  
  static async update(req, res) {
    // Implementation
  }
  
  static async delete(req, res) {
    // Implementation
  }
}

module.exports = { {Entity}Controller };
```

### Service Structure
```javascript
// services/{entity}Service.js
const { {Entity}Repository } = require('../repositories/{Entity}Repository');
const { ValidationError, NotFoundError } = require('../utils/errorHandler');

class {Entity}Service {
  static async findAll(filters = {}) {
    // Business logic implementation
  }
  
  static async findById(id) {
    // Validation and retrieval
  }
  
  static async create(data) {
    // Validation and creation
  }
  
  static async update(id, data) {
    // Validation and update
  }
  
  static async delete(id) {
    // Validation and deletion
  }
}

module.exports = { {Entity}Service };
```

### Model Structure
```javascript
// models/{Entity}.js
const mongoose = require('mongoose');
const { priceHistorySchema, saleDetailsSchema } = require('./schemas/shared');

const {entity}Schema = new mongoose.Schema({
  // Schema definition
}, {
  timestamps: true,
  versionKey: false
});

// Indexes
{entity}Schema.index({ field: 1 });

// Virtual fields
{entity}Schema.virtual('computed').get(function() {
  // Virtual field logic
});

// Static methods
{entity}Schema.statics.findByCustom = function(criteria) {
  // Custom query methods
};

module.exports = mongoose.model('{Entity}', {entity}Schema);
```

## Hierarchical Dependencies

### Layer 1: Core Infrastructure
```
config/
├── db.js                       # Database connection
middleware/
├── errorHandler.js             # Global error handling
├── compression.js              # Performance middleware
└── searchCache.js              # Caching middleware
utils/
├── errorHandler.js             # Error utilities
└── constants.js                # Application constants
```

### Layer 2: Data Access
```
models/
├── {Entity}.js                 # Schema definitions
└── schemas/
    └── shared/                 # Reusable schema components
repositories/
├── base/
│   └── BaseRepository.js       # Common data access patterns
└── {Entity}Repository.js       # Entity-specific data access
```

### Layer 3: Business Logic
```
services/
├── domain/                     # Cross-entity business logic
│   └── CollectionService.js
├── search/                     # Search-specific services
│   ├── SearchFactory.js
│   ├── FuseSearchAdapter.js
│   └── SearchUtilities.js
├── shared/                     # Shared business logic
│   ├── imageManager.js
│   └── saleService.js
└── {entity}Service.js          # Entity-specific business logic
```

### Layer 4: Presentation
```
controllers/
├── base/
│   └── BaseController.js       # Common HTTP patterns
├── {entity}/                   # Complex entity controllers
│   ├── {entity}CrudOperations.js
│   └── {entity}Helpers.js
└── {entity}Controller.js       # Standard controllers
routes/
├── factories/
│   └── crudRouteFactory.js     # Route generation utilities
└── {entity}.js                 # Route definitions
```

## Import/Export Conventions

### ES6 Module Pattern (when using)
```javascript
// Named exports (preferred)
export { EntityService };
export { validateInput, formatResponse };

// Default exports (for single-purpose modules)
export default EntityController;

// Imports
import { EntityService } from '../services/EntityService.js';
import EntityController from '../controllers/EntityController.js';
```

### CommonJS Pattern (current standard)
```javascript
// Multiple exports
module.exports = {
  EntityService,
  EntityRepository,
  validateEntity
};

// Single export
module.exports = EntityController;

// Imports
const { EntityService, EntityRepository } = require('../services');
const EntityController = require('../controllers/EntityController');
```

## Testing Organization

### Test Directory Structure
```
test/
├── controllers/                # Controller-specific tests
│   ├── {entity}/
│   │   ├── crud.test.js
│   │   └── validation.test.js
│   └── helpers/                # Test utilities
├── services/                   # Service layer tests
│   ├── {entity}/
│   └── integration/            # Cross-service tests
├── models/                     # Schema and validation tests
├── utils/                      # Utility function tests
├── fixtures/                   # Test data
│   ├── {entity}Fixtures.js
│   └── testDataHelper.js
└── setup/                      # Test configuration
    ├── testSetup.js
    └── mockData.js
```

### Test File Naming
- **Pattern**: `{component}.test.js` or `{feature}.test.js`
- **Integration**: `{workflow}.integration.test.js`
- **Fixtures**: `{entity}Fixtures.js` for test data

## Utility Organization

### Data Processing Utilities
```
utils/
├── dataImporter.js             # Main import coordinator
├── importers/                  # Specialized importers
│   ├── psaDataImporter.js
│   ├── cardMarketImporter.js
│   └── sealedProductImporter.js
├── dataVerification/           # Data integrity tools
│   ├── dataValidator.js
│   ├── countCalculator.js
│   └── verificationReporter.js
└── cleanup/                    # Maintenance utilities
    └── sealedProductCleaner.js
```

### External Integration Utilities
```
utils/
├── nameShortening/             # External listing formatters
│   ├── configurations.js
│   ├── formatters.js
│   └── index.js
└── externalFormatters/         # Platform-specific formatting
    ├── dbaFormatter.js
    └── facebookPostFormatter.js
```

## Configuration Management

### Environment Configuration
```
config/
├── db.js                       # Database configuration
├── cache.js                    # Cache configuration
├── upload.js                   # File upload configuration
└── environments/               # Environment-specific configs
    ├── development.js
    ├── test.js
    └── production.js
```

### Application Startup
```
startup/
├── initializeBackupSystem.js   # Backup system initialization
├── initializeCache.js          # Cache system setup
└── initializeDatabase.js       # Database connection setup
```

## Asset Organization

### Static Files
```
public/
├── uploads/                    # User-uploaded images
│   ├── cards/                  # Card images
│   ├── products/               # Product images
│   └── temp/                   # Temporary uploads
└── assets/                     # Application assets
    ├── images/
    └── documents/
```

### Backup Structure
```
backups/
├── manual/                     # Manual backup operations
├── daily/                      # Automated daily backups
├── weekly/                     # Automated weekly backups
├── archive/                    # Long-term storage
└── backup-history.json         # Backup metadata tracking
```

## Documentation Structure

### Code Documentation
- **Inline Comments**: JSDoc format for functions and classes
- **README Files**: Setup and usage instructions in each major directory
- **API Documentation**: Endpoint documentation with examples
- **Changelog**: Version history with breaking changes

### Documentation Files
```
docs/ (if created)
├── api/                        # API endpoint documentation
├── setup/                      # Installation and configuration
├── development/                # Development workflow guides
└── deployment/                 # Production deployment guides
```

## Naming Best Practices

### Variable Naming
- **camelCase**: For variables and functions (`cardService`, `validateInput`)
- **PascalCase**: For classes and constructors (`CardService`, `ValidationError`)
- **SNAKE_CASE**: For constants (`MAX_UPLOAD_SIZE`, `DEFAULT_CACHE_TTL`)
- **kebab-case**: For file names and URLs (`psa-graded-cards`, `card-market-ref`)

### Function Naming
- **Verbs**: Use action verbs (`findById`, `createCard`, `validateInput`)
- **Boolean Functions**: Use is/has/can prefixes (`isValid`, `hasPermission`)
- **Async Functions**: Clear async indication (`fetchCardData`, `saveToDatabase`)

### Database Field Naming
- **camelCase**: For field names (`cardName`, `myPrice`, `dateAdded`)
- **Consistent Patterns**: Use consistent naming across schemas
- **Clear Intent**: Field names should clearly indicate their purpose