/**
 * Unified Pagination Middleware
 *
 * Implements standardized pagination following API analysis recommendations:
 * - Cursor-based pagination for large datasets
 * - Offset-based pagination for smaller datasets
 * - RFC 5988 Web Linking (Link header) support
 * - Standardized pagination metadata
 */

/**
 * Pagination configuration constants
 */
const PAGINATION_DEFAULTS = {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
    MIN_LIMIT: 1,
    DEFAULT_PAGE: 1,
    CURSOR_THRESHOLD: 10000 // Use cursor-based pagination for collections > 10k items
};

/**
 * Pagination types
 */
const PAGINATION_TYPES = {
    OFFSET: 'offset',
    CURSOR: 'cursor'
};

/**
 * Pagination utility class
 */
class PaginationUtils {
    /**
     * Parses pagination parameters from request
     * @param {Object} query - Request query parameters
     * @returns {Object} Parsed pagination params
     */
    static parseParams(query) {
        const {
            page = PAGINATION_DEFAULTS.DEFAULT_PAGE,
            limit = PAGINATION_DEFAULTS.DEFAULT_LIMIT,
            cursor,
            direction = 'ASCENDING',
            sort = '_id'
        } = query;

        return {
            page: Math.max(1, parseInt(page, 10) || PAGINATION_DEFAULTS.DEFAULT_PAGE),
            limit: Math.min(
                PAGINATION_DEFAULTS.MAX_LIMIT,
                Math.max(PAGINATION_DEFAULTS.MIN_LIMIT, parseInt(limit, 10) || PAGINATION_DEFAULTS.DEFAULT_LIMIT)
            ),
            cursor,
            direction: direction.toUpperCase(),
            sort,
            offset: (Math.max(1, parseInt(page, 10) || PAGINATION_DEFAULTS.DEFAULT_PAGE) - 1) *
                Math.min(PAGINATION_DEFAULTS.MAX_LIMIT, Math.max(PAGINATION_DEFAULTS.MIN_LIMIT, parseInt(limit, 10) || PAGINATION_DEFAULTS.DEFAULT_LIMIT))
        };
    }

    /**
     * Determines appropriate pagination type based on collection size
     * @param {number} totalCount - Total items in collection
     * @returns {string} Pagination type
     */
    static determinePaginationType(totalCount) {
        return totalCount > PAGINATION_DEFAULTS.CURSOR_THRESHOLD
            ? PAGINATION_TYPES.CURSOR
            : PAGINATION_TYPES.OFFSET;
    }

    /**
     * Creates pagination metadata for offset-based pagination
     * @param {Object} params - Pagination parameters
     * @param {number} totalCount - Total items
     * @param {string} baseUrl - Base URL for links
     * @returns {Object} Pagination metadata
     */
    static createOffsetMetadata(params, totalCount, baseUrl) {
        const { page, limit } = params;
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return {
            type: PAGINATION_TYPES.OFFSET,
            page,
            limit,
            total: totalCount,
            pages: totalPages,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? page + 1 : null,
            prevPage: hasPrevPage ? page - 1 : null,
            links: this.createOffsetLinks(params, totalCount, baseUrl)
        };
    }

    /**
     * Creates pagination metadata for cursor-based pagination
     * @param {Object} params - Pagination parameters
     * @param {Array} items - Current page items
     * @param {boolean} hasMore - Whether more items exist
     * @param {string} baseUrl - Base URL for links
     * @returns {Object} Pagination metadata
     */
    static createCursorMetadata(params, items, hasMore, baseUrl) {
        const { limit, cursor, direction, sort } = params;

        let nextCursor = null;
        let prevCursor = null;

        if (items.length > 0 && hasMore) {
            const lastItem = items[items.length - 1];

            nextCursor = this.encodeCursor({
                [sort]: lastItem[sort],
                id: lastItem._id || lastItem.id,
                direction: 'ASCENDING',
                element: 'EXCLUDED'
            });
        }

        if (cursor && items.length > 0) {
            const firstItem = items[0];

            prevCursor = this.encodeCursor({
                [sort]: firstItem[sort],
                id: firstItem._id || firstItem.id,
                direction: 'DESCENDING',
                element: 'EXCLUDED'
            });
        }

        return {
            type: PAGINATION_TYPES.CURSOR,
            limit,
            cursor,
            direction,
            sort,
            hasMore,
            nextCursor,
            prevCursor,
            links: this.createCursorLinks(params, nextCursor, prevCursor, baseUrl)
        };
    }

    /**
     * Creates RFC 5988 Web Links for offset-based pagination
     * @param {Object} params - Pagination parameters
     * @param {number} totalCount - Total items
     * @param {string} baseUrl - Base URL
     * @returns {Object} Link object
     */
    static createOffsetLinks(params, totalCount, baseUrl) {
        const { page, limit } = params;
        const totalPages = Math.ceil(totalCount / limit);
        const links = {};

        // Self link
        links.self = `${baseUrl}?page=${page}&limit=${limit}`;

        // First link
        links.first = `${baseUrl}?page=1&limit=${limit}`;

        // Last link
        links.last = `${baseUrl}?page=${totalPages}&limit=${limit}`;

        // Previous link
        if (page > 1) {
            links.prev = `${baseUrl}?page=${page - 1}&limit=${limit}`;
        }

        // Next link
        if (page < totalPages) {
            links.next = `${baseUrl}?page=${page + 1}&limit=${limit}`;
        }

        return links;
    }

    /**
     * Creates RFC 5988 Web Links for cursor-based pagination
     * @param {Object} params - Pagination parameters
     * @param {string} nextCursor - Next cursor
     * @param {string} prevCursor - Previous cursor
     * @param {string} baseUrl - Base URL
     * @returns {Object} Link object
     */
    static createCursorLinks(params, nextCursor, prevCursor, baseUrl) {
        const { limit, sort } = params;
        const links = {};

        // Self link
        if (params.cursor) {
            links.self = `${baseUrl}?cursor=${encodeURIComponent(params.cursor)}&limit=${limit}&sort=${sort}`;
        } else {
            links.self = `${baseUrl}?limit=${limit}&sort=${sort}`;
        }

        // Next link
        if (nextCursor) {
            links.next = `${baseUrl}?cursor=${encodeURIComponent(nextCursor)}&limit=${limit}&sort=${sort}`;
        }

        // Previous link
        if (prevCursor) {
            links.prev = `${baseUrl}?cursor=${encodeURIComponent(prevCursor)}&limit=${limit}&sort=${sort}`;
        }

        return links;
    }

    /**
     * Encodes cursor data
     * @param {Object} cursorData - Cursor data
     * @returns {string} Encoded cursor
     */
    static encodeCursor(cursorData) {
        return Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    /**
     * Decodes cursor data
     * @param {string} cursor - Encoded cursor
     * @returns {Object} Decoded cursor data
     */
    static decodeCursor(cursor) {
        try {
            return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        } catch {
            throw new Error('Invalid cursor format');
        }
    }

    /**
     * Builds MongoDB query for cursor-based pagination
     * @param {string} cursor - Encoded cursor
     * @param {string} sortField - Sort field
     * @returns {Object} MongoDB query
     */
    static buildCursorQuery(cursor, sortField = '_id') {
        if (!cursor) return {};

        const cursorData = this.decodeCursor(cursor);
        const { direction = 'ASCENDING', element = 'EXCLUDED' } = cursorData;

        const query = {};
        const sortValue = cursorData[sortField];
        const { id } = cursorData;

        if (direction === 'ASCENDING') {
            if (element === 'EXCLUDED') {
                query.$or = [
                    { [sortField]: { $gt: sortValue } },
                    { [sortField]: sortValue, _id: { $gt: id } }
                ];
            } else {
                query.$or = [
                    { [sortField]: { $gte: sortValue } },
                    { [sortField]: sortValue, _id: { $gte: id } }
                ];
            }
        } else if (element === 'EXCLUDED') {
            query.$or = [
                { [sortField]: { $lt: sortValue } },
                { [sortField]: sortValue, _id: { $lt: id } }
            ];
        } else {
            query.$or = [
                { [sortField]: { $lte: sortValue } },
                { [sortField]: sortValue, _id: { $lte: id } }
            ];
        }

        return query;
    }
}

/**
 * Creates pagination middleware
 * @param {Object} options - Middleware options
 * @returns {Function} Express middleware
 */
function createPaginationMiddleware() {
    return (req, res, next) => {
        // Parse pagination parameters
        req.pagination = PaginationUtils.parseParams(req.query);

        // Add utility methods to request object
        req.buildPaginatedResponse = (items, totalCount) => {
            const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
            const paginationType = PaginationUtils.determinePaginationType(totalCount);

            let pagination;

            if (paginationType === PAGINATION_TYPES.CURSOR && req.query.cursor) {
                pagination = PaginationUtils.createCursorMetadata(
                    req.pagination,
                    items,
                    items.length === req.pagination.limit, // hasMore estimate
                    baseUrl
                );
            } else {
                pagination = PaginationUtils.createOffsetMetadata(
                    req.pagination,
                    totalCount,
                    baseUrl
                );
            }

            // Set Link header (RFC 5988)
            if (pagination.links) {
                const linkHeader = Object.entries(pagination.links)
                    .map(([rel, url]) => `<${url}>; rel="${rel}"`)
                    .join(', ');

                res.set('Link', linkHeader);
            }

            return {
                success: true,
                data: items,
                pagination,
                meta: {
                    timestamp: new Date().toISOString(),
                    version: '1.0'
                }
            };
        };

        // Add cursor query builder to request
        req.buildCursorQuery = (filters = {}, sortField = '_id') => {
            const cursorQuery = req.query.cursor
                ? PaginationUtils.buildCursorQuery(req.query.cursor, sortField)
                : {};

            return { ...filters, ...cursorQuery };
        };

        next();
    };
}

/**
 * Pagination presets for different use cases
 */
const paginationPresets = {
    // Standard API pagination
    api: createPaginationMiddleware({
        enableCursor: true,
        enableLinks: true
    }),

    // High-performance pagination (minimal metadata)
    minimal: createPaginationMiddleware({
        enableCursor: false,
        enableLinks: false
    }),

    // Collection-focused pagination
    collection: createPaginationMiddleware({
        enableCursor: true,
        enableLinks: true,
        defaultLimit: 50
    })
};

export {
    PaginationUtils,
    createPaginationMiddleware,
    paginationPresets,
    PAGINATION_DEFAULTS,
    PAGINATION_TYPES
};
export default PaginationUtils;

