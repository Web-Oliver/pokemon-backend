const mongoose = require('mongoose');
const { Schema } = mongoose;

const auctionSchema = new mongoose.Schema({
  topText: {
    type: String,
    required: true,
  },
  bottomText: {
    type: String,
    required: true,
  },
  auctionDate: {
    type: Date,
    required: false,
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'sold', 'expired'],
    default: 'draft',
  },
  generatedFacebookPost: {
    type: String,
    required: false,
  },
  // Legacy field for backwards compatibility
  isActive: {
    type: Boolean,
    default: true,
  },
  items: [{
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'items.itemCategory',
    },
    itemCategory: {
      type: String,
      required: true,
      enum: ['SealedProduct', 'PsaGradedCard', 'RawCard'],
    },
    sold: {
      type: Boolean,
      default: false,
    },
    soldPrice: {
      type: Number,
      required: false,
    },
    soldDate: {
      type: Date,
      required: false,
    },
  }],
  totalValue: {
    type: Number,
    required: false,
  },
  soldValue: {
    type: Number,
    required: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Context7 Non-Intrusive Activity Tracking - Post Middleware Hooks
// Following Context7 best practices for database event tracking

// Pre-save hook: Capture isNew state and previous state for change tracking
auctionSchema.pre('save', function() {
  this.wasNew = this.isNew;
  this.updatedAt = new Date();
  
  // Capture previous state for comparison
  if (!this.wasNew && this.isModified()) {
    this.previousState = {
      status: this.status,
      items: [...(this.items || [])],
      totalValue: this.totalValue,
      auctionDate: this.auctionDate
    };
  }
});

// Pre-update hook: Capture previous state for auction updates
auctionSchema.pre('findOneAndUpdate', async function() {
  const doc = await this.model.findOne(this.getFilter());
  this.previousState = {
    status: doc?.status,
    items: [...(doc?.items || [])],
    totalValue: doc?.totalValue,
    auctionDate: doc?.auctionDate,
    topText: doc?.topText,
    bottomText: doc?.bottomText
  };
});

// Post-save hook: Track auction creation and updates (Context7 Pattern)
auctionSchema.post('save', async function(doc) {
  try {
    // Use setImmediate for non-blocking activity tracking
    setImmediate(async () => {
      try {
        const ActivityService = require('../services/activityService');
        
        if (this.wasNew) {
          // Track new auction creation
          await ActivityService.logAuctionCreated(doc);
          console.log('[ACTIVITY TRACKING] Auction creation tracked:', doc._id);
        } else if (this.previousState) {
          // Track auction updates
          await ActivityService.logAuctionUpdated(doc, this.previousState);
          console.log('[ACTIVITY TRACKING] Auction update tracked:', doc._id);
        }
      } catch (error) {
        console.error('[ACTIVITY TRACKING] Error in auction tracking:', error);
      }
    });
  } catch (error) {
    console.error('[ACTIVITY TRACKING] Error in auction post-save hook:', error);
  }
});

// Post-update hook: Track auction updates via findOneAndUpdate (Context7 Pattern)
auctionSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    try {
      const update = this.getUpdate();
      
      setImmediate(async () => {
        try {
          const ActivityService = require('../services/activityService');
          
          // Track auction status changes, item modifications, etc.
          await ActivityService.logAuctionUpdated(doc, this.previousState, update);
          console.log('[ACTIVITY TRACKING] Auction findOneAndUpdate tracked:', doc._id);
        } catch (error) {
          console.error('[ACTIVITY TRACKING] Error in auction update tracking:', error);
        }
      });
    } catch (error) {
      console.error('[ACTIVITY TRACKING] Error in auction post-update hook:', error);
    }
  }
});

// Post-delete hook: Track auction removal (Context7 Pattern)
auctionSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      setImmediate(async () => {
        try {
          const ActivityService = require('../services/activityService');
          await ActivityService.logAuctionDeleted(doc);
          console.log('[ACTIVITY TRACKING] Auction deletion tracked:', doc._id);
        } catch (error) {
          console.error('[ACTIVITY TRACKING] Error logging auction deletion:', error);
        }
      });
    } catch (error) {
      console.error('[ACTIVITY TRACKING] Error in auction post-delete hook:', error);
    }
  }
});

const Auction = mongoose.model('Auction', auctionSchema);

module.exports = Auction;
