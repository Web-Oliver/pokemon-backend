import mongoose from 'mongoose';
const { Schema } = mongoose;
import activityTrackingPlugin from '@/collection/activities/activityTracking.js';
import { auctionTransform } from '@/system/schemas/transforms.js';
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
  items: [
    {
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
    },
  ],
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

// Apply shared transform function for JSON responses
auctionSchema.set('toJSON', {
  transform: auctionTransform,
  getters: true, // Enable getters for JSON serialization
});

// Apply activity tracking plugin
auctionSchema.plugin(activityTrackingPlugin, {
  itemType: 'auction',
  config: {
    trackCreation: true,
    trackSales: true,
    trackPriceUpdates: false,
    trackImageUpdates: false,
  },
});

const Auction = mongoose.model('Auction', auctionSchema);

export default Auction;
