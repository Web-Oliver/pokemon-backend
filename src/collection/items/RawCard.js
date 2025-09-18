import mongoose from 'mongoose';
import activityTrackingPlugin from '@/collection/activities/activityTracking.js';
import { collectionItemTransform, priceHistorySchema, saleDetailsSchema } from '@/system/schemas/index.js';

const { Schema } = mongoose;
const rawCardSchema = new mongoose.Schema({
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
    condition: { type: String, required: true },
    images: [{ type: String }],
    myPrice: { type: mongoose.Types.Decimal128, required: true },
    priceHistory: priceHistorySchema,
    dateAdded: { type: Date, default: Date.now },
    sold: { type: Boolean, default: false },
    saleDetails: saleDetailsSchema
});

// Apply activity tracking plugin
rawCardSchema.plugin(activityTrackingPlugin, {
    itemType: 'raw',
    config: {
        trackCreation: true,
        trackSales: true,
        trackPriceUpdates: true,
        trackImageUpdates: true
    }
});

// Apply shared transform function for JSON responses
rawCardSchema.set('toJSON', {
    transform: collectionItemTransform
});

const RawCard = mongoose.model('RawCard', rawCardSchema);

export default RawCard;
