# Project Structure - Pokemon Collection Backend

## Domain-Driven Architecture

The codebase follows enterprise-grade Domain-Driven Design with clear business domain separation:

```
src/
├── collection/           # Collection Management Domain
├── pokemon/             # Pokemon Reference Data Domain  
├── icr/                # Image Character Recognition Domain
├── marketplace/        # Marketplace Integration Domain
├── search/             # Search Functionality Domain
├── system/             # Core Infrastructure
├── workflow/           # Business Process Management
└── infrastructure/     # Static Resources
```

## Domain Organization

### collection/ - Collection Management Domain
```
collection/
├── activities/         # Activity tracking and audit trails
├── auctions/          # Auction management and bidding history
├── items/             # Collection items (cards, products)
├── sales/             # Sales tracking and analytics
├── services/          # OCR collection processing services
└── shared/            # Collection utilities (ItemFetcher)
```

### pokemon/ - Pokemon Reference Data Domain
```
pokemon/
├── cards/             # Pokemon card data and operations
├── products/          # Pokemon product catalog
├── sets/              # Pokemon set information
└── shared/            # Pokemon utilities and helpers
```

### icr/ - Image Character Recognition Domain
```
icr/
├── application/       # OCR business logic and workflows
├── infrastructure/    # OCR technical components (Google Vision)
├── presentation/      # OCR controllers and API endpoints
├── routes/           # ICR routing configuration
└── shared/           # ICR utilities (IcrPathManager)
```

### system/ - Core Infrastructure
```
system/
├── constants/        # System constants (ItemTypeMapper)
├── database/         # Database layer (BaseRepository)
├── dependency-injection/  # DI container and service registration
├── errors/           # Error definitions and types
├── factories/        # Controller factories (reducing duplication)
├── logging/          # Centralized logging (Logger)
├── middleware/       # Express middleware (BaseController)
├── routing/          # Route factories and utilities
├── schemas/          # Data transformations and validation
├── startup/          # Application bootstrap and server setup
├── utilities/        # Generic system utilities
└── validation/       # Input validation utilities
```

## File Naming Conventions

### Classes and Services
- **Services**: `*Service.js` (e.g., `CardService.js`, `IcrBatchService.js`)
- **Repositories**: `*Repository.js` (e.g., `CardRepository.js`, `PsaGradedCardRepository.js`)
- **Controllers**: `*Controller.js` (e.g., `cardController.js`, `icrBatchController.js`)
- **Base Classes**: `Base*.js` (e.g., `BaseController.js`, `BaseRepository.js`)

### Utilities and Helpers
- **Utilities**: `*Utility.js` or descriptive names (e.g., `ItemTypeMapper.js`)
- **Helpers**: `*Helper.js` (e.g., `searchHelper.js`)
- **Managers**: `*Manager.js` (e.g., `IcrPathManager.js`)

### Configuration and Setup
- **Routes**: `routes.js` or `*Routes.js`
- **Config**: `config.js` or `*Config.js`
- **Index**: `index.js` for module exports

## Code Organization Patterns

### Service Layer Pattern
```javascript
// src/pokemon/cards/CardService.js
import { BaseService } from '@/system/services/BaseService.js';
import { ValidationError } from '@/system/errors/ErrorTypes.js';

export class CardService extends BaseService {
    constructor(cardRepository, logger) {
        super();
        this.cardRepository = cardRepository;
        this.logger = logger;
    }
    
    async findCardsBySet(setId) {
        // Business logic implementation
    }
}
```

### Repository Pattern
```javascript
// src/pokemon/cards/CardRepository.js
import { BaseRepository } from '@/system/database/BaseRepository.js';
import { Card } from './Card.js';

export class CardRepository extends BaseRepository {
    constructor() {
        super(Card);
    }
    
    async findBySet(setId) {
        return this.findAll({ setId });
    }
}
```

### Controller Pattern
```javascript
// src/pokemon/cards/cardController.js
import { BaseController } from '@/system/middleware/BaseController.js';
import { body } from 'express-validator';

export class CardController extends BaseController {
    constructor(cardService) {
        super();
        this.cardService = cardService;
    }
    
    getValidationRules() {
        return [
            body('setId').isString().notEmpty()
        ];
    }
    
    async handleRequest(req, res) {
        const cards = await this.cardService.findCardsBySet(req.params.setId);
        this.sendSuccessResponse(res, cards);
    }
}
```

## Import/Export Conventions

### Path Aliases
```javascript
// Use @/* for all src imports
import { ServiceContainer } from '@/system/dependency-injection/ServiceContainer.js';
import { Logger } from '@/system/logging/Logger.js';
import { CardService } from '@/pokemon/cards/CardService.js';
```

### Import Organization
```javascript
// 1. External dependencies first
import express from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';

// 2. Internal imports with @/* aliases
import { BaseController } from '@/system/middleware/BaseController.js';
import { serviceContainer } from '@/system/dependency-injection/index.js';

// 3. Local relative imports (same domain)
import { CardRepository } from './CardRepository.js';
```

### Module Exports
```javascript
// Named exports preferred
export class CardService { }
export const cardServiceFactory = () => new CardService();

// Default exports for single-purpose modules
export default router;
```

## Dependency Injection Structure

### Service Registration
```javascript
// src/system/dependency-injection/ServiceContainer.js
export class ServiceContainer {
    register(name, factory) {
        this.services.set(name, { factory, instance: null });
    }
    
    resolve(name) {
        // Lazy instantiation with dependency resolution
    }
}
```

### Service Bootstrap
```javascript
// src/system/startup/serviceBootstrap.js
import { serviceContainer } from './ServiceContainer.js';

// Register all services
serviceContainer.register('CardService', () => new CardService(
    serviceContainer.resolve('CardRepository'),
    serviceContainer.resolve('Logger')
));
```

## Error Handling Structure

### Centralized Error Types
```javascript
// src/system/errors/ErrorTypes.js
export const ERROR_TYPES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    DATABASE_ERROR: 'DATABASE_ERROR'
};

export class ValidationError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.type = ERROR_TYPES.VALIDATION_ERROR;
        this.context = context;
    }
}
```

### Error Usage Pattern
```javascript
// Throw specific errors with context
if (!card) {
    throw new NotFoundError('Card not found', { cardId });
}

if (grade < 1 || grade > 10) {
    throw new ValidationError('Invalid grade value', { grade, cardId });
}
```

## Route Organization

### Domain-Based Routing
```javascript
// src/pokemon/cards/routes.js
import express from 'express';
import { serviceContainer } from '@/system/dependency-injection/index.js';

const router = express.Router();
const controller = serviceContainer.resolve('CardController');

router.get('/sets/:setId/cards', 
    controller.getValidationRules(),
    controller.handleRequest.bind(controller)
);

export default router;
```

### Route Assembly
```javascript
// src/system/startup/server.js
import cardRoutes from '@/pokemon/cards/routes.js';
import collectionRoutes from '@/collection/items/routes.js';

app.use('/api/cards', cardRoutes);
app.use('/api/collection', collectionRoutes);
```

## **NO TESTING STRUCTURE**
- **No Test Directories**: `/test` folders not used for personal project
- **No Test Conventions**: No testing patterns required
- **Development Focus**: All effort on feature implementation

## **NO SECURITY PATTERNS**
- **No Auth Middleware**: Authentication patterns not implemented
- **No Permission Checks**: Authorization logic not required
- **Open Access**: All endpoints publicly accessible for personal use

## Code Style Guidelines

### Formatting Standards
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes preferred (`'`)
- **Semicolons**: Required (`;`)
- **Line Width**: 120 characters maximum
- **Trailing Commas**: Required for multi-line structures

### Naming Standards
- **Variables/Functions**: camelCase (`cardService`, `findById`)
- **Classes**: PascalCase (`ServiceContainer`, `BaseRepository`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `ERROR_TYPES`)
- **Files**: PascalCase for classes, camelCase for utilities

### Documentation Standards
- **JSDoc**: For public methods and classes
- **Inline Comments**: Minimal, only for complex business logic
- **Architecture Docs**: Domain-level README files for complex areas

## Performance Patterns

### Caching Organization
```javascript
// src/search/middleware/searchCache.js
export class EnhancedSearchCache {
    constructor() {
        this.cache = new NodeCache({ stdTTL: 3600 });
        this.searchIndices = new Map();
    }
}
```

### Lazy Loading Structure
```javascript
// Services instantiated only when needed
const cardService = serviceContainer.resolve('CardService');
```

## Development Workflow

### Adding New Features
1. **Domain Analysis**: Determine appropriate domain (`collection/`, `pokemon/`, etc.)
2. **Service Creation**: Implement business logic in service class
3. **Repository Layer**: Add data access if needed
4. **Controller Layer**: Create Express controller extending BaseController
5. **Route Definition**: Wire up API endpoints
6. **Service Registration**: Add to dependency injection container
7. **Validation**: Add input validation rules
8. **Error Handling**: Use centralized error types

### File Creation Order
1. Model (if new entity needed)
2. Repository (data access layer)
3. Service (business logic)
4. Controller (HTTP layer)
5. Routes (endpoint configuration)
6. Service registration (dependency injection)