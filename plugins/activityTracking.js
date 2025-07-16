/**
 * Activity Tracking Plugin
 *
 * Mongoose plugin that provides standardized activity tracking middleware
 * for models that need to track creation, updates, and sales.
 *
 * Consolidates duplicate middleware from PsaGradedCard, RawCard, SealedProduct, and Auction models.
 */

/**
 * Activity Tracking Plugin
 *
 * @param {Object} schema - Mongoose schema to apply plugin to
 * @param {Object} options - Plugin options
 * @param {string} options.itemType - Type of item (e.g., 'psa', 'raw', 'sealed', 'auction')
 * @param {Object} options.config - Configuration options
 * @param {boolean} options.config.trackCreation - Whether to track item creation (default: true)
 * @param {boolean} options.config.trackSales - Whether to track sales (default: true)
 * @param {boolean} options.config.trackPriceUpdates - Whether to track price changes (default: true)
 * @param {boolean} options.config.trackImageUpdates - Whether to track image changes (default: true)
 */
function activityTrackingPlugin(schema, options = {}) {
  const { itemType, config = {} } = options;

  if (!itemType) {
    throw new Error('activityTrackingPlugin requires an itemType option');
  }

  const {
    trackCreation = true,
    trackSales = true,
    trackPriceUpdates = true,
    trackImageUpdates = true,
  } = config;

  // Store flags for middleware context
  schema.add({
    _activityTracking: {
      wasNew: { type: Boolean, default: false },
      isSaleUpdate: { type: Boolean, default: false },
      previousState: { type: Object, default: {} },
    },
  });

  // Pre-save hook: Mark new items and sale updates
  schema.pre('save', function (next) {
    try {
      this._activityTracking.wasNew = this.isNew;

      if (trackSales && this.isModified('sold') && this.sold === true) {
        this._activityTracking.isSaleUpdate = true;
      }

      next();
    } catch (error) {
      console.error(`[ACTIVITY TRACKING] Error in ${itemType} pre-save hook:`, error);
      next(error);
    }
  });

  // Post-save hook: Track creation and sales
  schema.post('save', function (doc) {
    try {
      // Use setImmediate for non-blocking activity tracking
      setImmediate(async () => {
        try {
          const ActivityService = require('../services/activityService');

          if (trackCreation && this._activityTracking.wasNew) {
            // Track new item creation
            await ActivityService.logCardAdded(doc, itemType);
            console.log(`[ACTIVITY TRACKING] ${itemType} creation tracked:`, doc._id);
          } else if (trackSales && (this._activityTracking.isSaleUpdate || (this.isModified && this.isModified('sold') && doc.sold === true))) {
            // Track sale completion via save() method
            console.log(`[ACTIVITY TRACKING] ${itemType} Post-save - Sale detected via save()`);
            console.log('  - doc.sold:', doc.sold);
            console.log('  - this.isSaleUpdate:', this._activityTracking.isSaleUpdate);
            console.log('  - this.isModified(sold):', this.isModified ? this.isModified('sold') : 'N/A');

            await ActivityService.logSaleCompleted(doc, itemType, doc.saleDetails || {});
            console.log(`[ACTIVITY TRACKING] ${itemType} sale tracked via save():`, doc._id);
          }
        } catch (error) {
          console.error(`[ACTIVITY TRACKING] Error in ${itemType} save tracking:`, error);
        }
      });
    } catch (error) {
      console.error(`[ACTIVITY TRACKING] Error in ${itemType} post-save hook:`, error);
    }
  });

  // Pre-update hook: Store previous state for comparison
  if (trackPriceUpdates || trackImageUpdates) {
    schema.pre('findOneAndUpdate', async function () {
      try {
        const docToUpdate = await this.model.findOne(this.getQuery());

        if (docToUpdate) {
          this.previousState = {
            myPrice: docToUpdate.myPrice,
            images: docToUpdate.images || [],
          };
        }
      } catch (error) {
        console.error(`[ACTIVITY TRACKING] Error in ${itemType} pre-update hook:`, error);
      }
    });
  }

  // Post-update hook: Track price changes and image updates
  if (trackPriceUpdates || trackImageUpdates) {
    schema.post('findOneAndUpdate', async function (doc) {
      if (doc) {
        try {
          const update = this.getUpdate();
          const filter = this.getFilter();

          // Populate for rich metadata (if cardId exists)
          if (doc.cardId) {
            await doc.populate({
              path: 'cardId',
              populate: { path: 'setId', model: 'Set' },
            });
          }

          setImmediate(async () => {
            try {
              const ActivityService = require('../services/activityService');

              // Track price updates
              if (trackPriceUpdates && update.$set?.myPrice && this.previousState?.myPrice) {
                const oldPrice = parseFloat(this.previousState.myPrice.toString());
                const newPrice = parseFloat(update.$set.myPrice.toString());

                if (oldPrice !== newPrice && newPrice > 0) {
                  await ActivityService.logPriceUpdate(doc, itemType, oldPrice, newPrice);
                  console.log(`[ACTIVITY TRACKING] ${itemType} price update tracked:`, doc._id);
                }
              }

              // Track image additions/changes
              if (trackImageUpdates && update.$set?.images && this.previousState?.images) {
                const previousImageCount = this.previousState.images.length;
                const newImageCount = update.$set.images.length;

                if (newImageCount > previousImageCount) {
                  await ActivityService.logCardUpdated(doc, itemType, {
                    imagesAdded: newImageCount - previousImageCount,
                  });
                  console.log(`[ACTIVITY TRACKING] ${itemType} images added tracked:`, doc._id);
                } else if (newImageCount < previousImageCount) {
                  await ActivityService.logCardUpdated(doc, itemType, {
                    imagesRemoved: previousImageCount - newImageCount,
                  });
                  console.log(`[ACTIVITY TRACKING] ${itemType} images removed tracked:`, doc._id);
                }
              }

              // Track sale completion via findOneAndUpdate (markAsSold)
              if (trackSales && update.$set?.sold === true) {
                console.log(`[ACTIVITY TRACKING] ${itemType} Post-findOneAndUpdate - Sale detected via markAsSold`);
                console.log('  - update.$set.sold:', update.$set.sold);
                console.log('  - doc.sold:', doc.sold);
                console.log('  - saleDetails:', update.$set.saleDetails || {});

                await ActivityService.logSaleCompleted(doc, itemType, update.$set.saleDetails || {});
                console.log(`[ACTIVITY TRACKING] ${itemType} sale tracked via findOneAndUpdate:`, doc._id);
              }
            } catch (error) {
              console.error(`[ACTIVITY TRACKING] Error in ${itemType} update tracking:`, error);
            }
          });
        } catch (error) {
          console.error(`[ACTIVITY TRACKING] Error in ${itemType} post-update hook:`, error);
        }
      }
    });
  }

  // Clean up internal tracking fields before saving to database
  schema.pre('save', function (next) {
    if (this._activityTracking) {
      this._activityTracking = undefined;
    }
    next();
  });
}

module.exports = activityTrackingPlugin;
