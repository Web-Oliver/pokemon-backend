/**
 * StandardResponseBuilder - Unified Response Patterns
 *
 * Eliminates response format duplication across domains by providing
 * consistent response builders for all API endpoints.
 *
 * BEFORE: Multiple inconsistent patterns:
 * - ICR: { successful: X, failed: Y, results: [], errors: [] }
 * - Marketplace: { success: true, data: {...}, exportType: 'X' }
 * - Search: { results: [], metadata: {...}, pagination: {...} }
 *
 * AFTER: Standardized patterns with context-specific metadata
 */

import { AppError, NotFoundError, ValidationError } from '@/system/errors/ErrorTypes.js';

export class StandardResponseBuilder {
    /**
     * Create successful response with data and metadata
     * @param {*} data - Response data
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Standardized success response
     */
    static success(data, metadata = {}) {
        return {
            success: true,
            data,
            metadata: {
                ...metadata,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Create error response with details
     * @param {string} message - Error message
     * @param {Object} details - Error details
     * @param {number} statusCode - HTTP status code
     * @returns {Object} Standardized error response
     */
    static error(message, details = {}, statusCode = 500) {
        return {
            success: false,
            error: {
                message,
                statusCode,
                details,
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Create error response from Error instance with proper typing
     * @param {Error} error - Error instance
     * @param {Object} additionalDetails - Additional error details
     * @returns {Object} Standardized error response
     */
    static errorFromException(error, additionalDetails = {}) {
        let statusCode = 500;
        let errorType = 'internal_error';

        // Determine status code and type based on error instance
        if (error instanceof ValidationError) {
            statusCode = 400;
            errorType = 'validation_error';
        } else if (error instanceof NotFoundError) {
            statusCode = 404;
            errorType = 'not_found';
        } else if (error instanceof AppError) {
            statusCode = error.statusCode || 500;
            errorType = error.type || 'application_error';
        }

        return {
            success: false,
            error: {
                message: error.message,
                statusCode,
                type: errorType,
                details: {
                    ...additionalDetails,
                    ...(error.details || {}),
                    ...(error.operationContext && { operationContext: error.operationContext })
                },
                timestamp: new Date().toISOString(),
                ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
            }
        };
    }

    /**
     * Create batch operation response (ICR services pattern)
     * @param {Array} successful - Successfully processed items
     * @param {Array} failed - Failed items with errors
     * @param {number} total - Total items processed
     * @param {Object} metadata - Additional operation metadata
     * @returns {Object} Standardized batch response
     */
    static batchOperation(successful, failed, total, metadata = {}) {
        return this.success({
            processed: total,
            successful: successful.length,
            failed: failed.length,
            results: successful,
            errors: failed
        }, {
            operation: 'batch',
            successRate: total > 0 ? ((successful.length / total) * 100).toFixed(1) + '%' : '0%',
            ...metadata
        });
    }

    /**
     * Create search results response with pagination
     * @param {Array} results - Search results
     * @param {Object} pagination - Pagination info
     * @param {Object} searchMetadata - Search-specific metadata
     * @returns {Object} Standardized search response
     */
    static searchResults(results, pagination = {}, searchMetadata = {}) {
        return this.success({
            results,
            pagination: {
                page: pagination.page || 1,
                limit: pagination.limit || 50,
                total: pagination.total || results.length,
                hasMore: pagination.hasMore || false,
                ...pagination
            }
        }, {
            search: {
                resultCount: results.length,
                searchTime: searchMetadata.searchTime || null,
                searchMethod: searchMetadata.searchMethod || 'unknown',
                ...searchMetadata
            }
        });
    }

    /**
     * Create export operation response (Marketplace services pattern)
     * @param {Object} exportData - Export data
     * @param {string} exportType - Type of export (zip, dba, etc.)
     * @param {Object} exportMetadata - Export-specific metadata
     * @returns {Object} Standardized export response
     */
    static exportOperation(exportData, exportType, exportMetadata = {}) {
        return this.success(exportData, {
            export: {
                type: exportType,
                itemCount: exportData.itemCount || 0,
                ...exportMetadata
            }
        });
    }

    /**
     * Create file operation response
     * @param {Object} fileInfo - File information
     * @param {string} operation - Operation type (upload, download, etc.)
     * @param {Object} fileMetadata - File-specific metadata
     * @returns {Object} Standardized file response
     */
    static fileOperation(fileInfo, operation, fileMetadata = {}) {
        return this.success(fileInfo, {
            file: {
                operation,
                size: fileInfo.size || null,
                mimeType: fileInfo.mimeType || null,
                ...fileMetadata
            }
        });
    }

    /**
     * Create OCR operation response (ICR domain pattern)
     * @param {Object} ocrData - OCR results
     * @param {string} phase - OCR phase (upload, extract, stitch, process, match)
     * @param {Object} ocrMetadata - OCR-specific metadata
     * @returns {Object} Standardized OCR response
     */
    static ocrOperation(ocrData, phase, ocrMetadata = {}) {
        return this.success(ocrData, {
            ocr: {
                phase,
                confidence: ocrData.confidence || null,
                processingTime: ocrMetadata.processingTime || null,
                ...ocrMetadata
            }
        });
    }

    /**
     * Create validation error response
     * @param {string} field - Field that failed validation
     * @param {string} message - Validation error message
     * @param {*} value - Invalid value
     * @returns {Object} Standardized validation error response
     */
    static validationError(field, message, value = null) {
        return this.error('Validation Error', {
            field,
            message,
            value,
            type: 'validation'
        }, 400);
    }

    /**
     * Create not found error response
     * @param {string} resource - Resource type that wasn't found
     * @param {*} identifier - Resource identifier
     * @returns {Object} Standardized not found response
     */
    static notFound(resource, identifier = null) {
        return this.error('Resource Not Found', {
            resource,
            identifier,
            type: 'not_found'
        }, 404);
    }

    /**
     * Wrap Express.js response with standardized format
     * @param {Object} res - Express response object
     * @param {Function} builderMethod - ResponseBuilder method
     * @param {Array} args - Arguments for builder method
     * @param {number} statusCode - HTTP status code (default: 200)
     */
    static sendResponse(res, builderMethod, args, statusCode = 200) {
        const response = builderMethod.apply(this, args);
        res.status(response.success ? statusCode : (response.error?.statusCode || 500));
        res.json(response);
    }

    /**
     * Create legacy format response for backward compatibility
     * @param {*} data - Response data
     * @param {string} message - Success message
     * @param {Object} additionalFields - Additional response fields
     * @returns {Object} Legacy format response
     */
    static legacy(data, message = 'Success', additionalFields = {}) {
        return {
            success: true,
            message,
            data,
            ...additionalFields
        };
    }
}

export default StandardResponseBuilder;