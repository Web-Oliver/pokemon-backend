/**
 * Centralized Error Handler Usage Examples
 *
 * This file demonstrates how to use the CentralizedErrorHandler to replace
 * repeated try-catch blocks and eliminate DRY violations across the codebase.
 */

import { CentralizedErrorHandler, ERROR_CONTEXTS, withErrorHandler, withRouteErrorHandler   } from '@/Presentation/Middleware/CentralizedErrorHandler.js';
import { ErrorFactory, ERROR_TYPES   } from '@/Application/Common/ErrorTypes.js';
// ============================================================================
// Example 1: Basic Error Handling (replaces console.error + throw pattern)
// ============================================================================

// BEFORE: Repeated pattern found 40+ times across codebase
async function oldPattern_DatabaseOperation() {
  try {
    // Some database operation
    const result = await someDbOperation();

    return result;
  } catch (error) {
    console.error('[DATABASE] Database operation failed:', error);
    throw error;
  }
}

// AFTER: Using CentralizedErrorHandler
async function newPattern_DatabaseOperation() {
  try {
    // Some database operation
    const result = await someDbOperation();

    return result;
  } catch (error) {
    CentralizedErrorHandler.handle('DATABASE', 'Database operation', error, {
      operationType: 'SELECT',
      tableName: 'users'
    });
  }
}

// ============================================================================
// Example 2: Async Wrapper Pattern (cleanest approach)
// ============================================================================

// BEFORE: Try-catch in every async function
async function oldPattern_ComplexOperation(userId, data) {
  try {
    const validation = await validateData(data);
    const user = await fetchUser(userId);
    const result = await processData(user, validation);

    return result;
  } catch (error) {
    console.error('[COMPLEX_OP] Complex operation failed:', error);
    throw error;
  }
}

// AFTER: Using async wrapper
const newPattern_ComplexOperation = withErrorHandler('GENERAL', 'Complex operation processing')(
  async (userId, data) => {
    const validation = await validateData(data);
    const user = await fetchUser(userId);
    const result = await processData(user, validation);

    return result;
  }
);

// ============================================================================
// Example 3: Route Handler Pattern (for Express controllers)
// ============================================================================

// BEFORE: Manual error handling in routes
const oldPattern_RouteHandler = async (req, res, next) => {
  try {
    const { itemId, itemType } = req.params;
    const result = await processItem(itemId, itemType);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[ITEM_PROCESSING] Item processing failed:', error);
    next(error);
  }
};

// AFTER: Using route wrapper
const newPattern_RouteHandler = withRouteErrorHandler('COLLECTION_FETCH', 'Item processing')(
  async (req, res) => {
    const { itemId, itemType } = req.params;
    const result = await processItem(itemId, itemType);

    res.json({ success: true, data: result });
  }
);

// ============================================================================
// Example 4: Database Operation with Retry Logic
// ============================================================================

// BEFORE: Manual retry logic with error handling
async function oldPattern_DatabaseWithRetry() {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const result = await connectToDatabase();

      return result;
    } catch (error) {
      attempts++;
      console.error(`[DATABASE] Connection attempt ${attempts} failed:`, error);

      if (attempts >= maxAttempts) {
        console.error('[DATABASE] All connection attempts failed');
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
    }
  }
}

// AFTER: Using database operation handler
async function newPattern_DatabaseWithRetry() {
  return CentralizedErrorHandler.handleDatabaseOperation(
    'DATABASE',
    'Database connection with retry',
    () => connectToDatabase(),
    {
      maxRetries: 3,
      retryDelay: 1000,
      metadata: { operation: 'connect' }
    }
  );
}

// ============================================================================
// Example 5: Context-Specific Error Types
// ============================================================================

// BEFORE: Generic error messages
async function oldPattern_DbaExport(items) {
  try {
    if (!items || items.length === 0) {
      throw new Error('No items provided');
    }

    const result = await exportToDba(items);

    return result;
  } catch (error) {
    console.error('[DBA_EXPORT] Export failed:', error);
    throw error;
  }
}

// AFTER: Using standardized error types
async function newPattern_DbaExport(items) {
  try {
    if (!items || items.length === 0) {
      throw ERROR_TYPES.DBA_NO_ITEMS.createError();
    }

    const result = await exportToDba(items);

    return result;
  } catch (error) {
    CentralizedErrorHandler.handle('DBA_EXPORT', 'DBA export operation', error, {
      itemCount: items?.length || 0
    });
  }
}

// ============================================================================
// Example 6: Google Vision API Error Handling
// ============================================================================

// BEFORE: Specific API error handling
async function oldPattern_GoogleVisionCall(image) {
  try {
    const result = await googleVision.extractText(image);

    return result;
  } catch (error) {
    console.error('[GOOGLE_VISION] OCR processing failed:', error);

    if (error.code === 429) {
      console.error('[GOOGLE_VISION] Rate limit exceeded');
    } else if (error.message?.includes('quota')) {
      console.error('[GOOGLE_VISION] Quota exceeded');
    }

    throw error;
  }
}

// AFTER: Using error types and centralized handling
async function newPattern_GoogleVisionCall(image) {
  try {
    const result = await googleVision.extractText(image);

    return result;
  } catch (error) {
    // Error type detection and proper error creation
    let contextualError = error;

    if (error.code === 429 || error.message?.includes('rate limit')) {
      contextualError = ERROR_TYPES.GOOGLE_VISION_RATE_LIMITED.createError({ originalError: error });
    } else if (error.message?.includes('quota')) {
      contextualError = ERROR_TYPES.GOOGLE_VISION_QUOTA_EXCEEDED.createError({ originalError: error });
    }

    CentralizedErrorHandler.handle('GOOGLE_VISION', 'OCR text extraction', contextualError, {
      imageSize: image?.length || 0
    });
  }
}

// ============================================================================
// Example 7: Validation Error Handling
// ============================================================================

// BEFORE: Manual validation error formatting
function oldPattern_ValidateInput(data) {
  const errors = [];

  if (!data.name) errors.push('Name is required');
  if (!data.email) errors.push('Email is required');

  if (errors.length > 0) {
    console.error('[VALIDATION] Input validation failed:', errors);
    throw new Error(`Validation failed: ${errors.join(', ')}`);
  }
}

// AFTER: Using validation error factory
function newPattern_ValidateInput(data) {
  const errors = [];
  const fieldErrors = {};

  if (!data.name) {
    errors.push('Name is required');
    fieldErrors.name = 'Name is required';
  }
  if (!data.email) {
    errors.push('Email is required');
    fieldErrors.email = 'Email is required';
  }

  if (errors.length > 0) {
    const validationError = CentralizedErrorHandler.handleValidationError(
      'VALIDATION',
      { isValid: false, errors, fieldErrors },
      { inputData: data }
    );

    throw validationError;
  }
}

// ============================================================================
// Example 8: Service Class with Centralized Error Handling
// ============================================================================

class ModernServiceWithErrorHandling {
  constructor() {
    // Create operation-specific handlers for common patterns
    this.errorHandlers = CentralizedErrorHandler.createOperationHandlers('COLLECTION', {
      fetch: 'Collection item fetch',
      create: 'Collection item creation',
      update: 'Collection item update',
      delete: 'Collection item deletion'
    });
  }

  async fetchItem(itemId) {
    try {
      const item = await this.database.findById(itemId);

      if (!item) {
        throw ERROR_TYPES.COLLECTION_ITEM_NOT_FOUND.createError({ itemId });
      }
      return item;
    } catch (error) {
      this.errorHandlers.fetch(error, { itemId });
    }
  }

  async createItem(itemData) {
    try {
      const item = await this.database.create(itemData);

      return item;
    } catch (error) {
      this.errorHandlers.create(error, { itemData });
    }
  }
}

// ============================================================================
// Benefits Summary
// ============================================================================

/**
 * Benefits of using CentralizedErrorHandler:
 *
 * 1. DRY Elimination: Removes 200+ lines of repeated error handling code
 * 2. Consistency: Standardized error logging format across entire application
 * 3. Context Preservation: Maintains operation context and metadata
 * 4. Error Classification: Categorizes errors by type and severity
 * 5. Debug Information: Enriched error logs with request/operation context
 * 6. Maintainability: Single place to update error handling logic
 * 7. Testing: Easier to test error scenarios with standardized patterns
 * 8. Monitoring: Consistent error format enables better monitoring/alerting
 */

export {
  //ExportexamplesfordocumentationpurposesnewPattern_DatabaseOperation,
  newPattern_ComplexOperation,
  newPattern_RouteHandler,
  newPattern_DatabaseWithRetry,
  newPattern_DbaExport,
  newPattern_GoogleVisionCall,
  newPattern_ValidateInput,
  ModernServiceWithErrorHandling
};
export default //ExportexamplesfordocumentationpurposesnewPattern_DatabaseOperation;;
