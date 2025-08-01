/**
 * Centralized Logging Utility
 *
 * Provides consistent logging patterns throughout the application.
 * Replaces scattered console.log patterns with structured logging.
 *
 * Following SOLID principles:
 * - Single Responsibility: Handles all application logging
 * - Open/Closed: Extensible for new log types without modification
 * - Dependency Inversion: Abstracts logging implementation
 */
class Logger {
  /**
   * Creates a section header for operations
   * @param {string} title - Section title
   * @param {string} char - Character to use for border (default: '=')
   * @param {number} width - Width of the border (default: 80)
   */
  static section(title, char = '=', width = 80) {
    const border = char.repeat(width);

    console.log(border);
    if (title) {
      console.log(title);
      console.log(border);
    }
  }

  /**
   * Logs operation start with consistent formatting
   * @param {string} entity - Entity type (e.g., 'CARD', 'AUCTION')
   * @param {string} operation - Operation type (e.g., 'GET ALL', 'CREATE')
   * @param {Object} context - Additional context data
   */
  static operationStart(entity, operation, context = {}) {
    console.log(`=== ${operation} ${entity.toUpperCase()} START ===`);
    if (context && Object.keys(context).length > 0) {
      Object.entries(context).forEach(([key, value]) => {
        console.log(`${key}:`, value);
      });
    }
  }

  /**
   * Logs operation success with consistent formatting
   * @param {string} entity - Entity type
   * @param {string} operation - Operation type
   * @param {Object} result - Operation result data
   */
  static operationSuccess(entity, operation, result = {}) {
    if (result && Object.keys(result).length > 0) {
      Object.entries(result).forEach(([key, value]) => {
        console.log(`${key}:`, value);
      });
    }
    console.log(`=== ${operation} ${entity.toUpperCase()} END ===`);
  }

  /**
   * Logs operation error with consistent formatting
   * @param {string} entity - Entity type
   * @param {string} operation - Operation type
   * @param {Error} error - Error object
   * @param {Object} context - Additional context data
   */
  static operationError(entity, operation, error, context = {}) {
    console.error(`=== ${operation} ${entity.toUpperCase()} ERROR ===`);
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    
    if (context && Object.keys(context).length > 0) {
      Object.entries(context).forEach(([key, value]) => {
        console.error(`${key}:`, typeof value === 'object' ? JSON.stringify(value, null, 2) : value);
      });
    }
    
    console.error(`=== ${operation} ${entity.toUpperCase()} ERROR END ===`);
  }

  /**
   * Logs service-level information with structured format
   * @param {string} service - Service name
   * @param {string} method - Method name
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  static service(service, method, message, data = null) {
    console.log(`[${service.toUpperCase()} SERVICE] ${message}`);
    if (data) {
      console.log(`[${service.toUpperCase()} SERVICE] Data:`, 
        typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    }
  }

  /**
   * Logs database operation information
   * @param {string} operation - Database operation type
   * @param {string} collection - Collection name
   * @param {Object} details - Operation details
   */
  static database(operation, collection, details = {}) {
    console.log(`[DATABASE] ${operation} on ${collection}`);
    if (details && Object.keys(details).length > 0) {
      Object.entries(details).forEach(([key, value]) => {
        console.log(`[DATABASE] ${key}:`, value);
      });
    }
  }

  /**
   * Logs performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} metrics - Additional metrics
   */
  static performance(operation, duration, metrics = {}) {
    console.log(`[PERFORMANCE] ${operation}: ${duration}ms`);
    if (metrics && Object.keys(metrics).length > 0) {
      Object.entries(metrics).forEach(([key, value]) => {
        console.log(`[PERFORMANCE] ${key}:`, value);
      });
    }
  }

  /**
   * Logs debug information (only in development)
   * @param {string} component - Component name
   * @param {string} message - Debug message
   * @param {any} data - Debug data
   */
  static debug(component, message, data = null) {
    // Debug logging disabled to reduce console noise
    return;
  }

  /**
   * Logs warning messages
   * @param {string} component - Component name
   * @param {string} message - Warning message
   * @param {any} data - Additional data
   */
  static warn(component, message, data = null) {
    console.warn(`[WARNING:${component.toUpperCase()}] ${message}`);
    if (data !== null) {
      console.warn(`[WARNING:${component.toUpperCase()}] Data:`, data);
    }
  }

  /**
   * Logs error messages
   * @param {string} component - Component name
   * @param {string} message - Error message
   * @param {Error|any} error - Error object or data
   */
  static error(component, message, error = null) {
    console.error(`[ERROR:${component.toUpperCase()}] ${message}`);
    if (error) {
      if (error instanceof Error) {
        console.error(`[ERROR:${component.toUpperCase()}] ${error.message}`);
        if (process.env.NODE_ENV !== 'production') {
          console.error(`[ERROR:${component.toUpperCase()}] Stack:`, error.stack);
        }
      } else {
        console.error(`[ERROR:${component.toUpperCase()}] Data:`, error);
      }
    }
  }

  /**
   * Logs information messages
   * @param {string} component - Component name
   * @param {string} message - Info message
   * @param {any} data - Additional data
   */
  static info(component, message, data = null) {
    console.log(`[INFO:${component.toUpperCase()}] ${message}`);
    if (data !== null) {
      console.log(`[INFO:${component.toUpperCase()}] Data:`, data);
    }
  }

  /**
   * Creates a simple border for visual separation
   * @param {string} char - Character to use (default: '-')
   * @param {number} width - Width of border (default: 80)
   */
  static border(char = '-', width = 80) {
    console.log(char.repeat(width));
  }

  /**
   * Logs request/response information
   * @param {string} method - HTTP method
   * @param {string} path - Request path
   * @param {number} statusCode - Response status code
   * @param {number} duration - Request duration in ms
   */
  static request(method, path, statusCode, duration = null) {
    const durationStr = duration ? ` (${duration}ms)` : '';

    console.log(`[REQUEST] ${method} ${path} -> ${statusCode}${durationStr}`);
  }

  /**
   * Logs cache operations
   * @param {string} operation - Cache operation (HIT, MISS, SET, DELETE)
   * @param {string} key - Cache key
   * @param {Object} details - Additional details
   */
  static cache(operation, key, details = {}) {
    console.log(`[CACHE:${operation}] ${key}`);
    if (details && Object.keys(details).length > 0) {
      Object.entries(details).forEach(([k, v]) => {
        console.log(`[CACHE:${operation}] ${k}:`, v);
      });
    }
  }
}

module.exports = Logger;