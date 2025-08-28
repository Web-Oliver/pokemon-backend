/**
 * Debug Logger Utility
 *
 * Single Responsibility: Standardized debugging output
 * Extracted from multiple controllers to eliminate duplication
 */

class DebugLogger {
  /**
   * Create a scoped debug logger for a specific context
   * @param {string} contextPrefix - Prefix for log messages (e.g., 'OCR-LABEL', 'OCR-TEXT')
   * @returns {Function} Debug logging function
   */
  static createScopedLogger(contextPrefix) {
    return (context, message, data = null) => {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${contextPrefix}-${context}] ${message}`;

      if (data) {
        console.log(logMessage, data);
      } else {
        console.log(logMessage);
      }
    };
  }

  /**
   * Generic debug log with timestamp
   * @param {string} fullContext - Complete context string
   * @param {string} message - Log message
   * @param {*} data - Optional data to log
   */
  static log(fullContext, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${fullContext}] ${message}`;

    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * Performance timing logger
   * @param {string} context - Context for the operation
   * @param {string} operation - Operation name
   * @param {number} startTime - Start time (Date.now())
   * @param {*} additionalData - Additional data to log
   */
  static logTiming(context, operation, startTime, additionalData = null) {
    const duration = Date.now() - startTime;
    const message = `${operation} completed in ${duration}ms`;

    if (additionalData) {
      this.log(context, message, { duration, ...additionalData });
    } else {
      this.log(context, message, { duration });
    }
  }

  /**
   * Error logger with context
   * @param {string} context - Context where error occurred
   * @param {string} operation - Operation that failed
   * @param {Error} error - Error object
   * @param {*} additionalData - Additional context data
   */
  static logError(context, operation, error, additionalData = null) {
    const errorData = {
      operation,
      error: error.message,
      stack: error.stack,
      ...additionalData
    };

    this.log(context, `ERROR in ${operation}`, errorData);
  }
}

export default DebugLogger;
