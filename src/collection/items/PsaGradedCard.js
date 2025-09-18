import mongoose from 'mongoose';
import activityTrackingPlugin from '@/collection/activities/activityTracking.js';
import { collectionItemTransform, priceHistorySchema, saleDetailsSchema } from '@/system/schemas/index.js';

const { Schema } = mongoose;
const psaGradedCardSchema = new mongoose.Schema({
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
    grade: { type: String, required: true },
    certNumber: { type: String }, // Optional PSA certification number
    images: [{ type: String }],
    myPrice: { type: mongoose.Types.Decimal128, required: true },
    priceHistory: priceHistorySchema,
    dateAdded: { type: Date, default: Date.now },
    sold: { type: Boolean, default: false },
    saleDetails: saleDetailsSchema
});

// Apply activity tracking plugin
psaGradedCardSchema.plugin(activityTrackingPlugin, {
    itemType: 'psa',
    config: {
        trackCreation: true,
        trackSales: true,
        trackPriceUpdates: true,
        trackImageUpdates: true
    }
});

// Apply shared transform function for JSON responses
psaGradedCardSchema.set('toJSON', {
    transform: collectionItemTransform,
    getters: true // Enable getters for JSON serialization
});

const PsaGradedCard = mongoose.model('PsaGradedCard', psaGradedCardSchema);

export default PsaGradedCard;
