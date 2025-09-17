import mongoose from 'mongoose';
import activityTrackingPlugin from '@/collection/activities/activityTracking.js';
import {priceHistorySchema, saleDetailsSchema, sealedProductTransform} from '@/system/schemas/index.js';

const {Schema} = mongoose;
const sealedProductSchema = new mongoose.Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    myPrice: {type: mongoose.Types.Decimal128, required: true},
    priceHistory: priceHistorySchema,
    images: [{type: String}],
    dateAdded: {type: Date, default: Date.now},
    sold: {type: Boolean, default: false},
    saleDetails: saleDetailsSchema
});

// Add product-specific indexes for optimal query performance
sealedProductSchema.index({productId: 1, sold: 1}); // Product filtering with sale status
sealedProductSchema.index({myPrice: 1}); // User price range queries
sealedProductSchema.index({sold: 1}); // Sale status filtering
sealedProductSchema.index({dateAdded: -1, sold: 1}); // Recent items with sale status

// Apply activity tracking plugin
sealedProductSchema.plugin(activityTrackingPlugin, {
    itemType: 'sealed',
    config: {
        trackCreation: true,
        trackSales: true,
        trackPriceUpdates: true,
        trackImageUpdates: true
    }
});

// Apply shared transform function for JSON responses
sealedProductSchema.set('toJSON', {
    transform: sealedProductTransform
});

const SealedProduct = mongoose.model('SealedProduct', sealedProductSchema);

export default SealedProduct;
