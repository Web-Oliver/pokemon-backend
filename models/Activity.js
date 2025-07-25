/**
 * Activity Model - Context7 Premium Activity Tracking System
 *
 * Comprehensive activity logging for all collection management actions.
 * Follows Context7 design patterns for data modeling and API structure.
 *
 * Features:
 * - Automatic activity generation
 * - Rich metadata tracking
 * - Timeline-based organization
 * - Flexible filtering capabilities
 */

const mongoose = require('mongoose');

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
    // Context7 Transform for Dynamic Fields
    toJSON: {
      virtuals: true,
       
      transform(doc, ret) {
        // Calculate relative time dynamically for every JSON response
        const now = new Date();
        const diff = now - ret.timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);

        if (minutes < 1) {
          ret.relativeTime = 'just now';
        } else if (minutes < 60) {
          ret.relativeTime = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (hours < 24) {
          ret.relativeTime = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (days < 7) {
          ret.relativeTime = `${days} day${days > 1 ? 's' : ''} ago`;
        } else if (weeks < 4) {
          ret.relativeTime = `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        } else if (months < 12) {
          ret.relativeTime = `${months} month${months > 1 ? 's' : ''} ago`;
        } else {
          ret.relativeTime = new Date(ret.timestamp).toLocaleDateString();
        }

        return ret;
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

// Context7 Virtual Fields for Enhanced UX
// eslint-disable-next-line func-names
activitySchema.virtual('formattedTimestamp').get(function () {
  const now = new Date();
  const diff = now - this.timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (days < 7) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (days < 30) {
    return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  }
  return this.timestamp.toLocaleDateString();
});

// eslint-disable-next-line func-names
activitySchema.virtual('colorClasses').get(function () {
  const colorMap = {
    emerald: {
      bg: 'from-emerald-500 to-teal-600',
      badge: 'bg-emerald-100 text-emerald-800',
      dot: 'bg-emerald-400',
    },
    amber: {
      bg: 'from-amber-500 to-orange-600',
      badge: 'bg-amber-100 text-amber-800',
      dot: 'bg-amber-400',
    },
    purple: {
      bg: 'from-purple-500 to-violet-600',
      badge: 'bg-purple-100 text-purple-800',
      dot: 'bg-purple-400',
    },
    indigo: {
      bg: 'from-indigo-500 to-blue-600',
      badge: 'bg-indigo-100 text-indigo-800',
      dot: 'bg-indigo-400',
    },
    red: {
      bg: 'from-red-500 to-rose-600',
      badge: 'bg-red-100 text-red-800',
      dot: 'bg-red-400',
    },
  };

  return colorMap[this.metadata?.color] || colorMap.indigo;
});

// Context7 Premium Middleware for Auto-Updates
// eslint-disable-next-line func-names
activitySchema.pre('save', function (next) {
  // Update relative time
  this.relativeTime = this.formattedTimestamp;

  // Create search vector for performance
  this.searchVector = [
    this.title,
    this.description,
    this.details,
    this.metadata?.cardName,
    this.metadata?.setName,
    ...(this.metadata?.tags || []),
    ...(this.metadata?.badges || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  next();
});

// Context7 Static Methods for Activity Management
// eslint-disable-next-line func-names
activitySchema.statics.createActivity = async function (activityData) {
  const activity = new this(activityData);

  await activity.save();
  return activity;
};

// eslint-disable-next-line func-names
activitySchema.statics.getRecentActivities = async function (limit = 50, filters = {}) {
  const query = { status: ACTIVITY_STATUS.ACTIVE, ...filters };

  return this.find(query).sort({ timestamp: -1 }).limit(limit).lean();
};

// eslint-disable-next-line func-names
activitySchema.statics.getActivitiesByTimeRange = async function (startDate, endDate, filters = {}) {
  const query = {
    timestamp: { $gte: startDate, $lte: endDate },
    status: ACTIVITY_STATUS.ACTIVE,
    ...filters,
  };

  return this.find(query).sort({ timestamp: -1 }).lean();
};

// eslint-disable-next-line func-names
activitySchema.statics.getActivitiesByEntity = async function (entityType, entityId) {
  return this.find({
    entityType,
    entityId,
    status: ACTIVITY_STATUS.ACTIVE,
  })
    .sort({ timestamp: -1 })
    .lean();
};

// eslint-disable-next-line func-names
activitySchema.statics.searchActivities = async function (searchTerm, filters = {}) {
  const query = {
    $and: [
      {
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { details: { $regex: searchTerm, $options: 'i' } },
          { searchVector: { $regex: searchTerm, $options: 'i' } },
        ],
      },
      { status: ACTIVITY_STATUS.ACTIVE },
      filters,
    ],
  };

  return this.find(query).sort({ timestamp: -1 }).lean();
};

// Context7 Instance Methods
// eslint-disable-next-line func-names
activitySchema.methods.markAsRead = function () {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

// eslint-disable-next-line func-names
activitySchema.methods.archive = function () {
  this.isArchived = true;
  this.status = ACTIVITY_STATUS.ARCHIVED;
  this.archivedAt = new Date();
  return this.save();
};

// Export the model with Context7 constants
const Activity = mongoose.model('Activity', activitySchema);

module.exports = {
  Activity,
  ACTIVITY_TYPES,
  ACTIVITY_PRIORITIES,
  ACTIVITY_STATUS,
};
