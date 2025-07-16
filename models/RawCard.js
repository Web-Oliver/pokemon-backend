const mongoose = require('mongoose');
const { Schema } = mongoose;
const activityTrackingPlugin = require('../plugins/activityTracking');

const rawCardSchema = new mongoose.Schema({
  cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
  condition: { type: String, required: true },
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


// Transform function to convert Decimal128 to numbers in JSON responses
rawCardSchema.set('toJSON', {
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

const RawCard = mongoose.model('RawCard', rawCardSchema);

module.exports = RawCard;
