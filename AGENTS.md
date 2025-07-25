# AGENTS.md - Pokemon Collection Backend

## Build/Test Commands
- `npm run lint` - Run ESLint on all files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm test` - Run Mocha tests (legacy)
- `npm run test:jest` - Run Jest tests
- `npm run test:jest:watch` - Run Jest in watch mode
- `npm run test:jest:coverage` - Run Jest with coverage
- `npm run start` / `npm run dev` - Start development server with nodemon
- `npm run start:prod` - Start production server

## Code Style Guidelines
- **Formatting**: Use Prettier (120 char line length, 2-space indent, single quotes, trailing commas)
- **Linting**: Follow ESLint config with strict rules (camelCase, no-console allowed, prefer-const, arrow functions)
- **Imports**: Use CommonJS `require()` syntax, group Node.js modules first, then local modules
- **Error Handling**: Use `asyncHandler` wrapper for async routes, throw custom errors (NotFoundError, ValidationError)
- **Naming**: camelCase for variables/functions, PascalCase for classes/models, kebab-case for files
- **MongoDB**: Use Mongoose with proper ObjectId validation, populate relationships where needed
- **Structure**: Controllers use services/repositories pattern, separate concerns clearly
- **Comments**: Minimal comments, prefer self-documenting code