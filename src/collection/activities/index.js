/**
 * Activity Routes - Context7 Premium API Endpoints
 *
 * RESTful API routes for activity management following Context7 patterns.
 * Provides comprehensive CRUD operations, filtering, search, and analytics.
 *
 * Features:
 * - RESTful endpoint design
 * - Advanced filtering and pagination
 * - Real-time activity streaming
 * - Analytics and statistics
 * - Context7 error handling
 */

import express from 'express';
import ActivityService from '@/collection/activities/activityService.js';
import {Activity, ACTIVITY_PRIORITIES, ACTIVITY_TYPES} from '@/collection/activities/Activity.js';
import {cachePresets} from '@/system/middleware/cachePresets.js';

const router = express.Router();
// Context7 Error Handler Middleware
const handleActivityError = (error, req, res, next) => {
    console.error('[ACTIVITY API] Error:', error);

    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: error.message,
            details: error.errors
        });
    }

    if (error.name === 'CastError') {
        return res.status(400).json({
            success: false,
            error: 'Invalid ID',
            message: 'Invalid activity ID format'
        });
    }

    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing activities'
    });
};

// Context7 Request Validation Middleware
const validateActivityFilters = (req, res, next) => {
    const {type, priority, dateRange, limit, offset} = req.query;

    // Validate activity type
    if (type && !Object.values(ACTIVITY_TYPES).includes(type)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Filter',
            message: `Invalid activity type. Must be one of: ${Object.values(ACTIVITY_TYPES).join(', ')}`
        });
    }

    // Validate priority
    if (priority && !Object.values(ACTIVITY_PRIORITIES).includes(priority)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Filter',
            message: `Invalid priority. Must be one of: ${Object.values(ACTIVITY_PRIORITIES).join(', ')}`
        });
    }

    // Validate date range
    if (dateRange && !['today', 'week', 'month', 'quarter', 'all'].includes(dateRange)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Filter',
            message: 'Invalid date range. Must be one of: today, week, month, quarter, all'
        });
    }

    // Validate pagination
    if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Pagination',
            message: 'Limit must be a number between 1 and 100'
        });
    }

    if (offset && (isNaN(offset) || offset < 0)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Pagination',
            message: 'Offset must be a number greater than or equal to 0'
        });
    }

    next();
};

// Context7 Premium Routes

/**
 * GET /api/activities
 * Retrieve activities with advanced filtering and pagination
 * Query Parameters:
 * - limit: Number of results (1-100, default 50)
 * - offset: Results offset (default 0)
 * - type: Activity type filter
 * - entityType: Entity type filter
 * - entityId: Entity ID filter
 * - priority: Priority filter
 * - dateRange: Date range filter (today, week, month, quarter, all)
 * - search: Search term for full-text search
 */
router.get('/', cachePresets.activityData, validateActivityFilters, async (req, res, next) => {
    try {
        console.log('[ACTIVITY API] GET /activities - Query:', req.query);

        const options = {
            limit: parseInt(req.query.limit, 10) || 50,
            offset: parseInt(req.query.offset, 10) || 0,
            type: req.query.type,
            entityType: req.query.entityType,
            entityId: req.query.entityId,
            priority: req.query.priority,
            dateRange: req.query.dateRange,
            search: req.query.search
        };

        const result = await ActivityService.getActivities(options);

        res.json({
            success: true,
            data: result.activities,
            meta: {
                total: result.total,
                limit: result.limit,
                offset: result.offset,
                hasMore: result.hasMore,
                page: Math.floor(result.offset / result.limit) + 1,
                totalPages: Math.ceil(result.total / result.limit)
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/activities/stats
 * Get activity statistics and analytics
 */
router.get('/stats', cachePresets.activityStats, async (req, res, next) => {
    try {
        console.log('[ACTIVITY API] GET /activities/stats');

        const stats = await ActivityService.getActivityStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/activities/types
 * Get available activity types and their metadata
 */
router.get('/types', (req, res) => {
    const activityTypes = Object.entries(ACTIVITY_TYPES).map(([key, value]) => ({
        key,
        value,
        label: key
            .split('_')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
    }));

    const priorities = Object.entries(ACTIVITY_PRIORITIES).map(([key, value]) => ({
        key,
        value,
        label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
    }));

    res.json({
        success: true,
        data: {
            types: activityTypes,
            priorities,
            dateRanges: [
                {value: 'today', label: 'Today'},
                {value: 'week', label: 'This Week'},
                {value: 'month', label: 'This Month'},
                {value: 'quarter', label: 'This Quarter'},
                {value: 'all', label: 'All Time'}
            ]
        }
    });
});

/**
 * GET /api/activities/recent
 * Get recent activities (last 10 by default)
 */
router.get('/recent', cachePresets.activityData, async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;

        console.log('[ACTIVITY API] GET /activities/recent - Limit:', limit);

        const activities = await Activity.getRecentActivities(limit);

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/activities/entity/:entityType/:entityId
 * Get activities for a specific entity
 */
router.get('/entity/:entityType/:entityId', cachePresets.activityData, async (req, res, next) => {
    try {
        const {entityType, entityId} = req.params;

        console.log(`[ACTIVITY API] GET /activities/entity/${entityType}/${entityId}`);

        const activities = await Activity.getActivitiesByEntity(entityType, entityId);

        res.json({
            success: true,
            data: activities
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/activities/search
 * Search activities with full-text search
 */
router.get('/search', async (req, res, next) => {
    try {
        const {q: searchTerm, ...filters} = req.query;

        if (!searchTerm || searchTerm.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Search',
                message: 'Search term must be at least 2 characters long'
            });
        }

        console.log('[ACTIVITY API] GET /activities/search - Term:', searchTerm);

        // Convert query filters
        const queryFilters = {};

        if (filters.type) {
            queryFilters.type = filters.type;
        }
        if (filters.priority) {
            queryFilters.priority = filters.priority;
        }
        if (filters.entityType) {
            queryFilters.entityType = filters.entityType;
        }

        const activities = await Activity.searchActivities(searchTerm.trim(), queryFilters);

        res.json({
            success: true,
            data: activities,
            meta: {
                searchTerm: searchTerm.trim(),
                resultCount: activities.length
            }
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/activities/:id
 * Get a specific activity by ID
 */
router.get('/:id', cachePresets.activityData, async (req, res, next) => {
    try {
        const {id} = req.params;

        console.log(`[ACTIVITY API] GET /activities/${id}`);

        const activity = await Activity.findById(id).lean();

        if (!activity) {
            return res.status(404).json({
                success: false,
                error: 'Activity Not Found',
                message: 'The requested activity could not be found'
            });
        }

        res.json({
            success: true,
            data: activity
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/activities
 * Create a new activity (manual activity creation)
 */
router.post('/', async (req, res, next) => {
    try {
        console.log('[ACTIVITY API] POST /activities - Body:', req.body);

        const activityData = req.body;

        // Validate required fields
        if (!activityData.type || !activityData.title || !activityData.description) {
            return res.status(400).json({
                success: false,
                error: 'Missing Required Fields',
                message: 'Activity must have type, title, and description'
            });
        }

        const activity = await ActivityService.createActivity(activityData);

        res.status(201).json({
            success: true,
            data: activity,
            message: 'Activity created successfully'
        });
    } catch (error) {
        next(error);
    }
});

// Mark as read handler for DRY compliance
const markAsReadHandler = async (req, res, next) => {
    try {
        const {id} = req.params;

        console.log(`[ACTIVITY API] ${req.method} /activities/${id}/read`);

        const activity = await Activity.findById(id);

        if (!activity) {
            return res.status(404).json({
                success: false,
                error: 'Activity Not Found',
                message: 'The requested activity could not be found'
            });
        }

        await activity.markAsRead();

        res.json({
            success: true,
            data: activity,
            message: 'Activity marked as read'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * PATCH /api/activities/:id/read
 * Mark an activity as read (RESTful standard)
 */
router.patch('/:id/read', markAsReadHandler);

/**
 * PUT /api/activities/:id/read
 * Mark an activity as read (Frontend compatibility)
 */
router.put('/:id/read', markAsReadHandler);

/**
 * DELETE /api/activities/:id
 * Archive an activity (soft delete)
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const {id} = req.params;

        console.log(`[ACTIVITY API] DELETE /activities/${id}`);

        const activity = await Activity.findById(id);

        if (!activity) {
            return res.status(404).json({
                success: false,
                error: 'Activity Not Found',
                message: 'The requested activity could not be found'
            });
        }

        await activity.archive();

        res.json({
            success: true,
            message: 'Activity archived successfully'
        });
    } catch (error) {
        next(error);
    }
});


/**
 * POST /api/activities/generate-historical
 * Generate historical activities for existing collection items (maintenance endpoint)
 */
router.post('/generate-historical', async (req, res, next) => {
    try {
        console.log('[ACTIVITY API] POST /activities/generate-historical');

        const totalGenerated = await ActivityService.generateHistoricalActivities();

        res.json({
            success: true,
            data: {
                activitiesGenerated: totalGenerated
            },
            message: `Generated ${totalGenerated} historical activities`
        });
    } catch (error) {
        next(error);
    }
});

// Context7 Error Handler
router.use(handleActivityError);

export default router;
