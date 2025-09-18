/**
 * OperationManager - Standardized Operation Execution
 *
 * Eliminates repeated operation patterns across ICR and other domains by
 * providing consistent operation lifecycle management (start, process, complete).
 *
 * BEFORE: Repeated patterns in ~8 ICR services:
 * - Logger.operationStart/Success/Error with context
 * - Try-catch with error handling and duration tracking
 * - Similar result formatting and metadata collection
 *
 * AFTER: Centralized operation management with hooks and consistent patterns
 */

import Logger from '@/system/logging/Logger.js';
import { StandardResponseBuilder } from './StandardResponseBuilder.js';
import { AppError, DatabaseError, ValidationError } from '@/system/errors/ErrorTypes.js';

export class OperationManager {
    /**
     * Execute an operation with standardized lifecycle management
     * @param {Object} context - Operation context
     * @param {string} context.service - Service name for logging
     * @param {string} context.operation - Operation name
     * @param {Object} context.data - Initial operation data
     * @param {Function} operationFn - Function that performs the actual operation
     * @param {Object} options - Operation options
     * @returns {Promise<Object>} Standardized operation result
     */
    static async executeOperation(context, operationFn, options = {}) {
        const { service, operation, data = {} } = context;
        const { useStandardResponse = true, trackDuration = true } = options;

        const startTime = trackDuration ? Date.now() : null;
        const operationId = this.generateOperationId(service, operation);

        Logger.operationStart(service, operation, data);

        try {
            // Execute before hooks if provided
            if (options.beforeOperation) {
                await options.beforeOperation(context);
            }

            // Execute the main operation
            const result = await operationFn();

            // Calculate duration
            const duration = trackDuration ? Date.now() - startTime : null;

            // Execute after hooks if provided
            if (options.afterOperation) {
                await options.afterOperation(result, context);
            }

            // Log success with metadata
            Logger.operationSuccess(service, operation, {
                operationId,
                duration: duration ? `${duration}ms` : null,
                resultType: typeof result,
                ...this.extractResultMetadata(result)
            });

            // Return standardized response if requested
            if (useStandardResponse) {
                return StandardResponseBuilder.success(result, {
                    operation: {
                        service,
                        operation,
                        operationId,
                        duration,
                        completedAt: new Date().toISOString()
                    }
                });
            }

            return result;

        } catch (error) {
            const duration = trackDuration ? Date.now() - startTime : null;

            // Execute error hooks if provided
            if (options.onError) {
                await options.onError(error, context);
            }

            // Log error with context
            Logger.operationError(service, operation, error, {
                operationId,
                duration: duration ? `${duration}ms` : null,
                data: this.sanitizeErrorData(data)
            });

            // Re-throw with additional context and proper error types
            error.operationContext = { service, operation, operationId, duration };

            // Enhance error with proper typing if not already typed
            if (!(error instanceof AppError)) {
                if (error.name === 'ValidationError' || error.message?.includes('validation')) {
                    throw new ValidationError(error.message, { originalError: error, ...error.operationContext });
                } else if (error.name === 'MongoError' || error.name === 'CastError' || error.code === 11000) {
                    throw new DatabaseError(error.message, { originalError: error, ...error.operationContext });
                }
                // For other errors, wrap in AppError
                throw new AppError(error.message, 500, { originalError: error, ...error.operationContext });
            }

            throw error;
        }
    }

    /**
     * Execute batch operation with standardized result formatting
     * @param {Object} context - Operation context
     * @param {Array} items - Items to process
     * @param {Function} processFn - Function to process each item
     * @param {Object} options - Batch options
     * @returns {Promise<Object>} Batch operation result
     */
    static async executeBatchOperation(context, items, processFn, options = {}) {
        const { service, operation } = context;
        const { continueOnError = true, maxConcurrent = 5 } = options;

        return this.executeOperation(context, async () => {
            const results = [];
            const errors = [];
            const skipped = [];

            Logger.info(service, `Starting batch ${operation}`, {
                totalItems: items.length,
                maxConcurrent
            });

            // Process items in batches to control concurrency
            for (let i = 0; i < items.length; i += maxConcurrent) {
                const batch = items.slice(i, i + maxConcurrent);

                const batchPromises = batch.map(async (item, batchIndex) => {
                    const itemIndex = i + batchIndex;
                    try {
                        const result = await processFn(item, itemIndex);
                        results.push({
                            index: itemIndex,
                            item: this.sanitizeItemForLogging(item),
                            result
                        });
                    } catch (error) {
                        if (continueOnError) {
                            errors.push({
                                index: itemIndex,
                                item: this.sanitizeItemForLogging(item),
                                error: error.message,
                                stack: error.stack
                            });
                        } else {
                            throw error;
                        }
                    }
                });

                await Promise.all(batchPromises);
            }

            Logger.info(service, `Batch ${operation} completed`, {
                successful: results.length,
                failed: errors.length,
                skipped: skipped.length,
                total: items.length
            });

            return StandardResponseBuilder.batchOperation(
                results,
                errors,
                items.length,
                {
                    operation,
                    service,
                    processingMethod: 'batch',
                    maxConcurrent
                }
            ).data; // Return just the data portion for internal use

        }, { useStandardResponse: false, ...options });
    }

    /**
     * Execute file operation with standardized handling
     * @param {Object} context - Operation context
     * @param {Object} fileInfo - File information
     * @param {Function} operationFn - File operation function
     * @param {Object} options - File operation options
     * @returns {Promise<Object>} File operation result
     */
    static async executeFileOperation(context, fileInfo, operationFn, options = {}) {
        const enhancedContext = {
            ...context,
            data: {
                ...context.data,
                fileName: fileInfo.fileName || fileInfo.name,
                fileSize: fileInfo.size || fileInfo.fileSize,
                mimeType: fileInfo.mimeType || fileInfo.type
            }
        };

        return this.executeOperation(enhancedContext, operationFn, {
            afterOperation: (result) => {
                // Add file-specific metadata to result
                if (result && typeof result === 'object') {
                    result.fileMetadata = {
                        originalName: fileInfo.fileName || fileInfo.name,
                        processedAt: new Date().toISOString(),
                        size: fileInfo.size || fileInfo.fileSize
                    };
                }
            },
            ...options
        });
    }

    /**
     * Create operation context from request/service parameters
     * @param {string} service - Service name
     * @param {string} operation - Operation name
     * @param {Object} data - Operation data
     * @param {Object} additionalContext - Additional context
     * @returns {Object} Standardized operation context
     */
    static createContext(service, operation, data = {}, additionalContext = {}) {
        return {
            service: service.toUpperCase(),
            operation: operation.toUpperCase().replace(/([A-Z])/g, '_$1').replace(/^_/, ''),
            data: this.sanitizeContextData(data),
            ...additionalContext
        };
    }

    /**
     * Generate unique operation ID for tracking
     * @param {string} service - Service name
     * @param {string} operation - Operation name
     * @returns {string} Unique operation ID
     */
    static generateOperationId(service, operation) {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${service}_${operation}_${timestamp}_${random}`.toLowerCase();
    }

    /**
     * Extract metadata from operation result for logging
     * @param {*} result - Operation result
     * @returns {Object} Extracted metadata
     * @private
     */
    static extractResultMetadata(result) {
        if (!result || typeof result !== 'object') {
            return { resultSize: typeof result };
        }

        const metadata = {};

        // Common result patterns
        if (Array.isArray(result)) {
            metadata.resultCount = result.length;
        } else {
            if (result.results && Array.isArray(result.results)) {
                metadata.resultCount = result.results.length;
            }
            if (result.successful !== undefined) {
                metadata.successCount = result.successful;
            }
            if (result.failed !== undefined) {
                metadata.failureCount = result.failed;
            }
            if (result.itemCount !== undefined) {
                metadata.itemCount = result.itemCount;
            }
        }

        return metadata;
    }

    /**
     * Sanitize data for error logging (remove sensitive info)
     * @param {Object} data - Data to sanitize
     * @returns {Object} Sanitized data
     * @private
     */
    static sanitizeErrorData(data) {
        const sanitized = { ...data };

        // Remove potentially sensitive fields
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        return sanitized;
    }

    /**
     * Sanitize item for logging (limit size and remove sensitive data)
     * @param {*} item - Item to sanitize
     * @returns {*} Sanitized item
     * @private
     */
    static sanitizeItemForLogging(item) {
        if (typeof item !== 'object' || !item) {
            return item;
        }

        // Return basic identifying info
        return {
            id: item.id || item._id || '[no-id]',
            name: item.name || item.fileName || item.originalFileName || '[no-name]',
            type: item.type || item.itemType || '[no-type]'
        };
    }

    /**
     * Sanitize context data (remove large objects, sensitive data)
     * @param {Object} data - Context data
     * @returns {Object} Sanitized context data
     * @private
     */
    static sanitizeContextData(data) {
        const sanitized = { ...data };

        // Limit array sizes for logging
        Object.keys(sanitized).forEach(key => {
            if (Array.isArray(sanitized[key]) && sanitized[key].length > 5) {
                sanitized[key] = `[Array(${sanitized[key].length})]`;
            }
        });

        return this.sanitizeErrorData(sanitized);
    }
}

export default OperationManager;