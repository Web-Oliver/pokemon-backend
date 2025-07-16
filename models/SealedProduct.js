const mongoose = require('mongoose');
const { Schema } = mongoose;
const activityTrackingPlugin = require('../plugins/activityTracking');

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
