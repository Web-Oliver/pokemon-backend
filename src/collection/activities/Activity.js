/**
 * Activity Model - Context7 Premium Activity Tracking System
 *
 * Core data model for activity tracking following Single Responsibility Principle.
 * Business logic extracted to separate services for better maintainability.
 *
 * Features:
 * - Core schema definition and validation
 * - Database indexing and optimization
 * - Basic Mongoose model functionality
 */

import mongoose from 'mongoose';
import ActivityTimelineService from '@/collection/activities/ActivityTimelineService.js';
import ActivityTransformService from '@/collection/activities/ActivityTransformService.js';
// Activity Type Enum - Context7 standardized activity categories
const ACTIVITY_TYPES = {
  CARD_ADDED: 'card_added',
  CARD_UPDATED: 'card_updated',
  CARD_DELETED: 'card_deleted',
  PRICE_UPDATE: 'price_update',
  AUCTION_CREATED: 'auction_created',
  AUCTION_UPDATED: 'auction_updated',
  AUCTION_DELETED: 'auction_deleted',
  AUCTION_ITEM_ADDED: 'auction_item_added',
  AUCTION_ITEM_REMOVED: 'auction_item_removed',
  SALE_COMPLETED: 'sale_completed',
  SALE_UPDATED: 'sale_updated',
  MILESTONE: 'milestone',
  COLLECTION_STATS: 'collection_stats',
  SYSTEM: 'system',
};

// Activity Priority Levels - Context7 importance classification
const ACTIVITY_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Activity Status - Context7 state management
const ACTIVITY_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  HIDDEN: 'hidden',
};

// Context7 Activity Schema with Premium Features
const activitySchema = new mongoose.Schema(
  {
    // Core Activity Information
    type: {
      type: String,
      enum: Object.values(ACTIVITY_TYPES),
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      maxLength: 200,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      maxLength: 500,
      trim: true,
    },

    details: {
      type: String,
      maxLength: 1000,
      trim: true,
    },

    // Context7 Premium Metadata
    priority: {
      type: String,
      enum: Object.values(ACTIVITY_PRIORITIES),
      default: ACTIVITY_PRIORITIES.MEDIUM,
      index: true,
    },

    status: {
      type: String,
      enum: Object.values(ACTIVITY_STATUS),
      default: ACTIVITY_STATUS.ACTIVE,
      index: true,
    },

    // Entity References - Context7 Relationship Tracking
    entityType: {
      type: String,
      enum: ['psa_card', 'raw_card', 'sealed_product', 'auction', 'collection', 'system'],
      index: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },

    // Context7 Rich Data Structure
    metadata: {
      // Item-specific data
      cardName: String,
      setName: String,
      grade: String,
      condition: String,
      category: String,

      // Price tracking
      previousPrice: mongoose.Schema.Types.Decimal128,
      newPrice: mongoose.Schema.Types.Decimal128,
      priceChange: mongoose.Schema.Types.Decimal128,
      priceChangePercentage: Number,

      // Auction data
      auctionTitle: String,
      itemCount: Number,
      estimatedValue: mongoose.Schema.Types.Decimal128,

      // Sale information
      salePrice: mongoose.Schema.Types.Decimal128,
      paymentMethod: String,
      source: String,
      buyerName: String,

      // Milestone data
      milestoneType: String,
      milestoneValue: Number,
      milestoneUnit: String,

      // Additional context
      badges: [String],
      tags: [String],
      color: {
        type: String,
        default: 'indigo',
      },
      icon: String,
    },

    // Context7 Timeline Features
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    relativeTime: {
      type: String, // "2 hours ago", "1 day ago", etc.
      default: 'just now',
    },

    // Context7 User Context
    userAgent: String,
    ipAddress: String,
    sessionId: String,

    // Context7 Analytics
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: Date,

    // Context7 Archival System
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },

    archivedAt: Date,

    // Context7 Performance Optimization
    searchVector: String, // For full-text search optimization
  },
  {
    timestamps: {
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
    },
    // Context7 Advanced Indexing
    collection: 'activities',
    // Context7 Transform for Dynamic Fields - Uses ActivityTransformService
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        return ActivityTransformService.transformForJSON(doc, ret);
      },
    },
  },
);

// Context7 Premium Indexes for Performance
activitySchema.index({ type: 1, timestamp: -1 });
activitySchema.index({ entityType: 1, entityId: 1 });
activitySchema.index({ priority: 1, status: 1 });
activitySchema.index({ timestamp: -1, isArchived: 1 });
activitySchema.index(
  {
    title: 'text',
    description: 'text',
    details: 'text',
  },
  {
    name: 'activity_text_search',
  },
);

// Virtual Fields for better UX - Uses service-based approach
import ActivityColorService from '@/collection/activities/ActivityColorService.js';

activitySchema.virtual('formattedTimestamp').get(function () {
  return ActivityTimelineService.calculateFormattedTimestamp(this.timestamp);
});

activitySchema.virtual('colorClasses').get(function () {
  return ActivityColorService.getColorClasses(this.metadata?.color);
});

// Context7 Premium Middleware for Auto-Updates - Uses services

activitySchema.pre('save', function (next) {
  // Update relative time using service
  this.relativeTime = ActivityTimelineService.calculateFormattedTimestamp(this.timestamp);

  // Create search vector for performance using service
  this.searchVector = ActivityTransformService.createSearchVector(this);

  next();
});

// Context7 Static Methods for Activity Management - Delegates to ActivityHelpers
import ActivityHelpers from '@/collection/activities/ActivityHelpers.js';

activitySchema.statics.createActivity = async function (activityData) {
  return ActivityHelpers.createActivity(this, activityData);
};

activitySchema.statics.getRecentActivities = async function (limit = 50, filters = {}) {
  return ActivityHelpers.getRecentActivities(this, limit, filters);
};

activitySchema.statics.getActivitiesByTimeRange = async function (startDate, endDate, filters = {}) {
  return ActivityHelpers.getActivitiesByTimeRange(this, startDate, endDate, filters);
};

activitySchema.statics.getActivitiesByEntity = async function (entityType, entityId) {
  return ActivityHelpers.getActivitiesByEntity(this, entityType, entityId);
};

activitySchema.statics.searchActivities = async function (searchTerm, filters = {}) {
  return ActivityHelpers.searchActivities(this, searchTerm, filters);
};

// Context7 Instance Methods - Delegates to ActivityHelpers

activitySchema.methods.markAsRead = function () {
  return ActivityHelpers.markActivityAsRead(this);
};

activitySchema.methods.archive = function () {
  return ActivityHelpers.archiveActivity(this);
};

// Export the model with Context7 constants
const Activity = mongoose.model('Activity', activitySchema);

export {
  Activity,
  ACTIVITY_TYPES,
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUS
};
export default Activity; ;
