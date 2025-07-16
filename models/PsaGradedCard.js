const mongoose = require('mongoose');
const { Schema } = mongoose;

const psaGradedCardSchema = new mongoose.Schema({
  cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
  grade: { type: String, required: true },
  images: [{ type: String }],
  myPrice: { type: mongoose.Types.Decimal128, required: true },
  priceHistory: [{
    price: { type: mongoose.Types.Decimal128, required: true },
    dateUpdated: { type: Date, default: Date.now },
  }],
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
psaGradedCardSchema.pre('save', function() {
  this.wasNew = this.isNew;
  
  // For existing documents, capture previous state before save
  if (!this.isNew && this.isModified()) {
    // Store original values before changes
    this.previousSaveState = {
      sold: this.getOriginal ? this.getOriginal('sold') : this._original?.sold || false,
      myPrice: this.getOriginal ? this.getOriginal('myPrice') : this._original?.myPrice,
      grade: this.getOriginal ? this.getOriginal('grade') : this._original?.grade,
      images: this.getOriginal ? this.getOriginal('images') : this._original?.images || []
    };
    
    // If we can't get original values, use a flag to indicate this is a sale update
    if (this.isModified('sold') && this.sold === true) {
      this.isSaleUpdate = true;
    }
  }
});

// Pre-update hook: Capture previous state for comprehensive change tracking
psaGradedCardSchema.pre('findOneAndUpdate', async function() {
  const doc = await this.model.findOne(this.getFilter());
  this.previousState = {
    sold: doc?.sold || false,
    myPrice: doc?.myPrice,
    images: [...(doc?.images || [])],
    grade: doc?.grade,
    saleDetails: doc?.saleDetails
  };
  console.log('[ACTIVITY TRACKING] PSA Pre-update - Previous state:', this.previousState);
  console.log('[ACTIVITY TRACKING] PSA Pre-update - Update object:', this.getUpdate());
});

// Post-save hook: Track card creation and updates (Context7 Pattern)
psaGradedCardSchema.post('save', async function(doc) {
  try {
    // Populate card details for rich activity metadata
    await doc.populate({
      path: 'cardId',
      populate: { path: 'setId', model: 'Set' }
    });
    
    // Use setImmediate for non-blocking activity tracking
    setImmediate(async () => {
      try {
        const ActivityService = require('../services/activityService');
        
        if (this.wasNew) {
          // Track new card creation
          await ActivityService.logCardAdded(doc, 'psa');
          console.log('[ACTIVITY TRACKING] PSA card creation tracked:', doc._id);
        } else if (this.isSaleUpdate || (this.isModified && this.isModified('sold') && doc.sold === true)) {
          // Track sale completion via save() method
          console.log('[ACTIVITY TRACKING] PSA Post-save - Sale detected via save()');
          console.log('  - doc.sold:', doc.sold);
          console.log('  - this.isSaleUpdate:', this.isSaleUpdate);
          console.log('  - this.isModified(sold):', this.isModified ? this.isModified('sold') : 'N/A');
          
          await ActivityService.logSaleCompleted(doc, 'psa', doc.saleDetails || {});
          console.log('[ACTIVITY TRACKING] PSA sale tracked via save():', doc._id);
        }
      } catch (error) {
        console.error('[ACTIVITY TRACKING] Error in PSA save tracking:', error);
      }
    });
  } catch (error) {
    console.error('[ACTIVITY TRACKING] Error in PSA card post-save hook:', error);
  }
});

// Post-update hook: Track price changes and sales (Context7 Pattern)
psaGradedCardSchema.post('findOneAndUpdate', async function(doc) {
  if (doc) {
    try {
      const update = this.getUpdate();
      const filter = this.getFilter();
      
      // Populate for rich metadata
      await doc.populate({
        path: 'cardId',
        populate: { path: 'setId', model: 'Set' }
      });
      
      setImmediate(async () => {
        try {
          const ActivityService = require('../services/activityService');
          
          // Track price updates
          if (update.$set?.myPrice && this.previousState?.myPrice) {
            const oldPrice = parseFloat(this.previousState.myPrice.toString());
            const newPrice = parseFloat(update.$set.myPrice.toString());
            
            if (oldPrice !== newPrice && newPrice > 0) {
              await ActivityService.logPriceUpdate(doc, 'psa', oldPrice, newPrice);
              console.log('[ACTIVITY TRACKING] PSA price update tracked:', doc._id);
            }
          }
          
          // Track image additions/changes
          if (update.$set?.images && this.previousState?.images) {
            const previousImageCount = this.previousState.images.length;
            const newImageCount = update.$set.images.length;
            
            if (newImageCount > previousImageCount) {
              await ActivityService.logCardUpdated(doc, 'psa', { 
                imagesAdded: newImageCount - previousImageCount 
              });
              console.log('[ACTIVITY TRACKING] PSA images added tracked:', doc._id);
            } else if (newImageCount < previousImageCount) {
              await ActivityService.logCardUpdated(doc, 'psa', { 
                imagesRemoved: previousImageCount - newImageCount 
              });
              console.log('[ACTIVITY TRACKING] PSA images removed tracked:', doc._id);
            }
          }
          
          // Track grade changes
          if (update.$set?.grade && this.previousState?.grade && 
              update.$set.grade !== this.previousState.grade) {
            await ActivityService.logCardUpdated(doc, 'psa', { 
              gradeChanged: `${this.previousState.grade} → ${update.$set.grade}` 
            });
            console.log('[ACTIVITY TRACKING] PSA grade change tracked:', doc._id);
          }
          
          // Track sale completion - check if just marked as sold
          console.log('[ACTIVITY TRACKING] PSA Post-update - Checking sale tracking:');
          console.log('  - update.$set?.sold:', update.$set?.sold);
          console.log('  - this.previousState?.sold:', this.previousState?.sold);
          console.log('  - doc.sold:', doc.sold);
          
          if (update.$set?.sold === true && !this.previousState?.sold) {
            await ActivityService.logSaleCompleted(doc, 'psa', doc.saleDetails || {});
            console.log('[ACTIVITY TRACKING] PSA sale tracked:', doc._id);
          } else {
            console.log('[ACTIVITY TRACKING] PSA sale NOT tracked - conditions not met');
          }
        } catch (error) {
          console.error('[ACTIVITY TRACKING] Error in PSA update tracking:', error);
        }
      });
    } catch (error) {
      console.error('[ACTIVITY TRACKING] Error in PSA card post-update hook:', error);
    }
  }
});

// Post-delete hook: Track card removal (Context7 Pattern) 
psaGradedCardSchema.post('findOneAndDelete', async function(doc) {
  if (doc) {
    try {
      // Populate before deletion tracking
      await doc.populate({
        path: 'cardId',
        populate: { path: 'setId', model: 'Set' }
      });
      
      setImmediate(async () => {
        try {
          const ActivityService = require('../services/activityService');
          await ActivityService.logCardDeleted(doc, 'psa');
          console.log('[ACTIVITY TRACKING] PSA card deletion tracked:', doc._id);
        } catch (error) {
          console.error('[ACTIVITY TRACKING] Error logging PSA card deletion:', error);
        }
      });
    } catch (error) {
      console.error('[ACTIVITY TRACKING] Error in PSA card post-delete hook:', error);
    }
  }
});

// Transform function to convert Decimal128 to numbers in JSON responses
psaGradedCardSchema.set('toJSON', {
  transform(doc, ret) {
    // Convert Decimal128 to number for myPrice
    if (ret.myPrice) {
      if (ret.myPrice.$numberDecimal) {
        ret.myPrice = parseFloat(ret.myPrice.$numberDecimal);
      } else if (ret.myPrice.toString) {
        ret.myPrice = parseFloat(ret.myPrice.toString());
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

const PsaGradedCard = mongoose.model('PsaGradedCard', psaGradedCardSchema);

module.exports = PsaGradedCard;
