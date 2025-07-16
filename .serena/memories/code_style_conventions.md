# Code Style and Conventions

## JavaScript Style
- Uses modern JavaScript ES6+ features
- Consistent use of async/await for asynchronous operations
- Requires strict mode handling
- Uses destructuring and arrow functions where appropriate

## File Structure
- Controllers handle HTTP requests/responses
- Models define database schemas
- Routes define API endpoints
- Middleware handles cross-cutting concerns
- Utils contain helper functions
- Tests are organized by feature/controller

## Testing Conventions
- Integration tests using Mocha, Chai, and Supertest
- MongoDB Memory Server for isolated test databases
- Before/after hooks for setup/teardown
- Test setup files for reusable test configurations
- Comprehensive test coverage expected

## Database Patterns
- Mongoose for MongoDB interaction
- Schema validation at model level
- Proper error handling for database operations
- Connection management with connection state checking

## Error Handling
- Centralized error handling middleware
- Proper HTTP status codes
- Consistent error response formats