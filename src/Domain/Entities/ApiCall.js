import mongoose from 'mongoose';
const { Schema } = mongoose;

/**
 * 🚨 CRITICAL: API Call Tracking Model
 * EVERY SINGLE API CALL MUST BE LOGGED TO PREVENT UNEXPECTED BILLING
 */
const ApiCallSchema = new Schema({
  // Core tracking
  provider: {
    type: String,
    required: true,
    enum: ['google-vision', 'openai', 'other'],
    index: true
  },
  method: {
    type: String,
    required: true,
    enum: ['extractText'],
    index: true
  },

  // Billing protection
  requestId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  cost: {
    type: Number,
    required: true,
    default: 0.0015 // $1.50 per 1000 units = $0.0015 per unit (Google Cloud Vision API TEXT_DETECTION pricing 2025)
  },

  // Timing and performance
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    index: true
  },
  responseTime: {
    type: Number, // milliseconds
    required: true
  },

  // Request details
  imageSize: {
    type: Number, // bytes
    required: true
  },
  imageCount: {
    type: Number, // number of images processed
    required: true,
    default: 1
  },

  // Response tracking
  success: {
    type: Boolean,
    required: true,
    index: true
  },
  textExtracted: {
    type: Number, // character count
    default: 0
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },

  // Error handling
  errorMessage: {
    type: String,
    default: null
  },
  errorCode: {
    type: String,
    default: null
  },

  // Quota tracking
  dailyCallNumber: {
    type: Number,
    required: true,
    index: true
  },
  monthlyCallNumber: {
    type: Number,
    required: true,
    index: true
  },

  // Safety metadata
  userAgent: {
    type: String,
    default: 'pokemon-collection-backend'
  },
  ipAddress: {
    type: String,
    default: 'localhost'
  },
  sessionId: {
    type: String,
    index: true
  }
}, {
  timestamps: true,
  collection: 'apicalls'
});

// 🚨 CRITICAL INDEXES FOR QUOTA ENFORCEMENT
ApiCallSchema.index({ provider: 1, timestamp: 1 });
ApiCallSchema.index({ provider: 1, 'timestamp': 1, success: 1 });

// 🚨 DEPRECATED: Use ApiCallTracker methods instead for independence
// 🚨 DAILY QUOTA CHECK METHOD - MOVED TO ApiCallTracker for independence
ApiCallSchema.statics.getTodaysCallCount = async function (provider = 'google-vision') {
  const startOfDay = new Date();

  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();

  endOfDay.setHours(23, 59, 59, 999);

  return await this.countDocuments({
    provider,
    timestamp: { $gte: startOfDay, $lte: endOfDay },
    success: true
  });
};

// 🚨 DEPRECATED: Use ApiCallTracker methods instead for independence
// 🚨 MONTHLY QUOTA CHECK METHOD - MOVED TO ApiCallTracker for independence
ApiCallSchema.statics.getMonthlyCallCount = async function (provider = 'google-vision') {
  const startOfMonth = new Date();

  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const endOfMonth = new Date();

  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  return await this.countDocuments({
    provider,
    timestamp: { $gte: startOfMonth, $lte: endOfMonth },
    success: true
  });
};

// 🚨 DEPRECATED: Use ApiCallTracker methods instead for independence
// 🚨 COST CALCULATION METHOD - MOVED TO ApiCallTracker for independence
ApiCallSchema.statics.getTodaysCost = async function (provider = 'google-vision') {
  const startOfDay = new Date();

  startOfDay.setHours(0, 0, 0, 0);

  const result = await this.aggregate([
    {
      $match: {
        provider,
        timestamp: { $gte: startOfDay },
        success: true
      }
    },
    {
      $group: {
        _id: null,
        totalCost: { $sum: '$cost' },
        totalCalls: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalCost: 0, totalCalls: 0 };
};

// 🚨 DEPRECATED: Use ApiCallTracker methods instead for independence
// 🚨 MONTHLY COST CALCULATION - MOVED TO ApiCallTracker for independence
ApiCallSchema.statics.getMonthlyCost = async function (provider = 'google-vision') {
  const startOfMonth = new Date();

  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const result = await this.aggregate([
    {
      $match: {
        provider,
        timestamp: { $gte: startOfMonth },
        success: true
      }
    },
    {
      $group: {
        _id: null,
        totalCost: { $sum: '$cost' },
        totalCalls: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalCost: 0, totalCalls: 0 };
};

// 🚨 DEPRECATED: Use ApiCallTracker.checkQuotaSafety() instead for independence
// 🚨 SAFETY CHECK BEFORE API CALL - MOVED TO ApiCallTracker for independence
ApiCallSchema.statics.checkQuotaSafety = async function (provider = 'google-vision') {
  console.warn('🚨 [DEPRECATED] Using deprecated ApiCall.checkQuotaSafety() - use ApiCallTracker.checkQuotaSafety() instead');

  const monthlyCount = await this.getMonthlyCallCount(provider);
  const dailyCount = await this.getTodaysCallCount(provider);
  const monthlyCost = await this.getMonthlyCost(provider);

  const FREE_TIER_LIMIT = 1000; // Google Vision free tier
  const DAILY_SAFETY_LIMIT = 100; // Conservative daily limit
  const MONTHLY_COST_LIMIT = 10.00; // $10 monthly cost limit

  const safety = {
    safe: true,
    reasons: [],
    monthlyCount,
    dailyCount,
    monthlyCost: monthlyCost.totalCost,
    deprecated: true,
    useApiCallTrackerInstead: true
  };

  if (monthlyCount >= FREE_TIER_LIMIT) {
    safety.safe = false;
    safety.reasons.push(`Monthly quota exceeded: ${monthlyCount}/${FREE_TIER_LIMIT}`);
  }

  if (dailyCount >= DAILY_SAFETY_LIMIT) {
    safety.safe = false;
    safety.reasons.push(`Daily safety limit exceeded: ${dailyCount}/${DAILY_SAFETY_LIMIT}`);
  }

  if (monthlyCost.totalCost >= MONTHLY_COST_LIMIT) {
    safety.safe = false;
    safety.reasons.push(`Monthly cost limit exceeded: $${monthlyCost.totalCost.toFixed(2)}/$${MONTHLY_COST_LIMIT}`);
  }

  return safety;
};

export default mongoose.model('ApiCall', ApiCallSchema);
