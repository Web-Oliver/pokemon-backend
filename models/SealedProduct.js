const mongoose = require('mongoose');
const { Schema } = mongoose;

const sealedProductSchema = new mongoose.Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'CardMarketReferenceProduct', required: true },
  category: {
    type: String,
    required: true,
    enum: [
      'Blisters',
      'Booster-Boxes',
      'Boosters',
      'Box-Sets',
      'Elite-Trainer-Boxes',
      'Theme-Decks',
      'Tins',
      'Trainer-Kits',
    ],
  },
  setName: { type: String, required: true },
  name: { type: String, required: true },
  availability: { type: Number, required: true },
  cardMarketPrice: { type: mongoose.Types.Decimal128, required: true },
  myPrice: { type: mongoose.Types.Decimal128, required: true },
  priceHistory: [{
    price: { type: mongoose.Types.Decimal128, required: true },
    dateUpdated: { type: Date, default: Date.now },
  }],
  images: [{ type: String }],
  dateAdded: { type: Date, default: Date.now },
  sold: { type: Boolean, default: false },
  saleDetails: {
    paymentMethod: { type: String, enum: ['CASH', 'Mobilepay', 'BankTransfer'] },
    actualSoldPrice: { type: mongoose.Types.Decimal128 },
    deliveryMethod: { type: String, enum: ['Sent', 'Local Meetup'] },
    source: { type: String, enum: ['Facebook', 'DBA'] },
    dateSold: { type: Date },
    buyerFullName: { type: String },
    buyerAddress: {
      streetName: { type: String },
      postnr: { type: String },
      city: { type: String },
    },
    buyerPhoneNumber: { type: String },
    buyerEmail: { type: String },
    trackingNumber: { type: String },
  },
});

// Context7 Non-Intrusive Activity Tracking - Post Middleware Hooks
// Following Context7 best practices for database event tracking

// Pre-save hook: Capture isNew state and previous values for change tracking
sealedProductSchema.pre('save', function() {
  this.wasNew = this.isNew;
  
  // For existing documents, capture previous state before save
  if (!this.isNew && this.isModified()) {
    // If we can't get original values, use a flag to indicate this is a sale update
    if (this.isModified('sold') && this.sold === true) {
      this.isSaleUpdate = true;
    }
  }
});

// Pre-update hook: Capture previous state for comprehensive change tracking
sealedProductSchema.pre('findOneAndUpdate', async function() {
  const doc = await this.model.findOne(this.getFilter());
  this.previousState = {
    sold: doc?.sold || false,
    myPrice: doc?.myPrice,
    images: [...(doc?.images || [])],
    availability: doc?.availability,
    category: doc?.category,
    saleDetails: doc?.saleDetails
  };
});

// Post-save hook: Track sealed product creation and sales (Context7 Pattern)
sealedProductSchema.post('save', async function(doc) {
  try {
    // Populate product details for rich activity metadata
    await doc.populate('productId');
    
    // Use setImmediate for non-blocking activity tracking
    setImmediate(async () => {
      try {
        const ActivityService = require('../services/activityService');
        
        if (this.wasNew) {
          // Track new sealed product creation
          await ActivityService.logCardAdded(doc, 'sealed');
          console.log('[ACTIVITY TRACKING] Sealed product creation tracked:', doc._id);
        } else if (this.isSaleUpdate || (this.isModified && this.isModified('sold') && doc.sold === true)) {
          // Track sale completion via save() method
          console.log('[ACTIVITY TRACKING] Sealed Post-save - Sale detected via save()');
          console.log('  - doc.sold:', doc.sold);
          console.log('  - this.isSaleUpdate:', this.isSaleUpdate);
          console.log('  - this.isModified(sold):', this.isModified ? this.isModified('sold') : 'N/A');
          
          await ActivityService.logSaleCompleted(doc, 'sealed', doc.saleDetails || {});
          console.log('[ACTIVITY TRACKING] Sealed sale tracked via save():', doc._id);
        }
      } catch (error) {
        console.error('[ACTIVITY TRACKING] Error in Sealed save tracking:', error);
      }
    });
  } catch (error) {
    console.error('[ACTIVITY TRACKING] Error in Sealed product post-save hook:', error);
  }
});

// Post-update hook: Track price changes and sales (Context7 Pattern)
sealedProductSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    try {
      const update = this.getUpdate();
      
      // Populate for rich metadata
      await doc.populate('productId');
      
      setImmediate(async () => {
        try {
          const ActivityService = require('../services/activityService');
          
          // Track price updates
          if (update.$set?.myPrice && this.previousState?.myPrice) {
            const oldPrice = parseFloat(this.previousState.myPrice.toString());
            const newPrice = parseFloat(update.$set.myPrice.toString());
            
            if (oldPrice !== newPrice && newPrice > 0) {
              await ActivityService.logPriceUpdate(doc, 'sealed', oldPrice, newPrice);
              console.log('[ACTIVITY TRACKING] Sealed price update tracked:', doc._id);
            }
          }
          
          // Track image additions/changes
          if (update.$set?.images && this.previousState?.images) {
            const previousImageCount = this.previousState.images.length;
            const newImageCount = update.$set.images.length;
            
            if (newImageCount > previousImageCount) {
              await ActivityService.logCardUpdated(doc, 'sealed', { 
                imagesAdded: newImageCount - previousImageCount 
              });
              console.log('[ACTIVITY TRACKING] Sealed images added tracked:', doc._id);
            } else if (newImageCount < previousImageCount) {
              await ActivityService.logCardUpdated(doc, 'sealed', { 
                imagesRemoved: previousImageCount - newImageCount 
              });
              console.log('[ACTIVITY TRACKING] Sealed images removed tracked:', doc._id);
            }
          }
          
          // Track availability changes
          if (update.$set?.availability !== undefined && this.previousState?.availability !== undefined && 
              update.$set.availability !== this.previousState.availability) {
            await ActivityService.logCardUpdated(doc, 'sealed', { 
              availabilityChanged: `${this.previousState.availability} → ${update.$set.availability}` 
            });
            console.log('[ACTIVITY TRACKING] Sealed availability change tracked:', doc._id);
          }
          
          // Track category changes
          if (update.$set?.category && this.previousState?.category && 
              update.$set.category !== this.previousState.category) {
            await ActivityService.logCardUpdated(doc, 'sealed', { 
              categoryChanged: `${this.previousState.category} → ${update.$set.category}` 
            });
            console.log('[ACTIVITY TRACKING] Sealed category change tracked:', doc._id);
          }
          
          // Track sale completion - check if just marked as sold
          console.log('[ACTIVITY TRACKING] Sealed Post-update - Checking sale tracking:');
          console.log('  - update.$set?.sold:', update.$set?.sold);
          console.log('  - this.previousState?.sold:', this.previousState?.sold);
          console.log('  - doc.sold:', doc.sold);
          
          if (update.$set?.sold === true && !this.previousState?.sold) {
            await ActivityService.logSaleCompleted(doc, 'sealed', doc.saleDetails || {});
            console.log('[ACTIVITY TRACKING] Sealed sale tracked:', doc._id);
          } else {
            console.log('[ACTIVITY TRACKING] Sealed sale NOT tracked - conditions not met');
          }
        } catch (error) {
          console.error('[ACTIVITY TRACKING] Error in Sealed update tracking:', error);
        }
      });
    } catch (error) {
      console.error('[ACTIVITY TRACKING] Error in Sealed product post-update hook:', error);
    }
  }
});

// Post-delete hook: Track sealed product removal (Context7 Pattern) 
sealedProductSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      // Populate before deletion tracking
      await doc.populate('productId');
      
      setImmediate(async () => {
        try {
          const ActivityService = require('../services/activityService');
          await ActivityService.logCardDeleted(doc, 'sealed');
          console.log('[ACTIVITY TRACKING] Sealed product deletion tracked:', doc._id);
        } catch (error) {
          console.error('[ACTIVITY TRACKING] Error logging Sealed product deletion:', error);
        }
      });
    } catch (error) {
      console.error('[ACTIVITY TRACKING] Error in Sealed product post-delete hook:', error);
    }
  }
});

// Transform function to convert Decimal128 to numbers in JSON responses
sealedProductSchema.set('toJSON', {
  transform(doc, ret) {
    // Convert Decimal128 to number for myPrice
    if (ret.myPrice) {
      if (ret.myPrice.$numberDecimal) {
        ret.myPrice = parseFloat(ret.myPrice.$numberDecimal);
      } else if (ret.myPrice.toString) {
        ret.myPrice = parseFloat(ret.myPrice.toString());
      }
    }

    // Convert Decimal128 to number for cardMarketPrice
    if (ret.cardMarketPrice) {
      if (ret.cardMarketPrice.$numberDecimal) {
        ret.cardMarketPrice = parseFloat(ret.cardMarketPrice.$numberDecimal);
      } else if (ret.cardMarketPrice.toString) {
        ret.cardMarketPrice = parseFloat(ret.cardMarketPrice.toString());
      }
    }

    // Convert Decimal128 to number for saleDetails.actualSoldPrice
    if (ret.saleDetails && ret.saleDetails.actualSoldPrice) {
      if (ret.saleDetails.actualSoldPrice.$numberDecimal) {
        ret.saleDetails.actualSoldPrice = parseFloat(ret.saleDetails.actualSoldPrice.$numberDecimal);
      } else if (ret.saleDetails.actualSoldPrice.toString) {
        ret.saleDetails.actualSoldPrice = parseFloat(ret.saleDetails.actualSoldPrice.toString());
      }
    }

    // Convert Decimal128 to number for priceHistory
    if (ret.priceHistory && Array.isArray(ret.priceHistory)) {
      ret.priceHistory = ret.priceHistory.map((item) => {
        if (item.price) {
          if (item.price.$numberDecimal) {
            item.price = parseFloat(item.price.$numberDecimal);
          } else if (item.price.toString) {
            item.price = parseFloat(item.price.toString());
          }
        }
        return item;
      });
    }
    return ret;
  },
});

const SealedProduct = mongoose.model('SealedProduct', sealedProductSchema);

module.exports = SealedProduct;
