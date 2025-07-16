# Task Completion Checklist

## When completing a coding task:

1. **Run Tests**
   - `npm test` - Ensure all tests pass
   - `npm run test:coverage` - Check test coverage if applicable

2. **Code Quality**
   - `npm run lint` - Check for linting errors
   - `npm run lint:fix` - Fix auto-fixable linting issues

3. **Manual Testing**
   - Test the specific functionality manually if applicable
   - Check API endpoints work correctly

4. **Database Operations**
   - Verify database connections are properly managed
   - Ensure no database connection leaks in tests

5. **Documentation**
   - Update comments in code if needed
   - Document any new API endpoints or significant changes

## Important Notes
- Always ensure mongoose connections are properly closed in tests
- Use MongoDB Memory Server for test isolation
- Check that all async operations are properly awaited