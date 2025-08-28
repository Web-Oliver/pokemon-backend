import mongoose from 'mongoose';

/**
 * Sale Details Schema
 *
 * Shared schema component for sale transaction details.
 * Used across PsaGradedCard, RawCard, and SealedProduct models.
 *
 * Consolidates duplicate schema definitions to ensure consistency
 * and simplify maintenance.
 */
const saleDetailsSchema = {
  paymentMethod: {
    type: String,
    enum: ['CASH', 'Mobilepay', 'BankTransfer'],
    required() {
      return this.sold === true;
    }
  },
  actualSoldPrice: {
    type: mongoose.Types.Decimal128,
    required() {
      return this.sold === true;
    }
  },
  deliveryMethod: {
    type: String,
    enum: ['Sent', 'Local Meetup'],
    required() {
      return this.sold === true;
    }
  },
  source: {
    type: String,
    enum: ['Facebook', 'DBA'],
    required() {
      return this.sold === true;
    }
  },
  dateSold: {
    type: Date,
    required() {
      return this.sold === true;
    }
  },
  buyerFullName: {
    type: String,
    required() {
      return this.sold === true;
    }
  },
  buyerAddress: {
    streetName: { type: String },
    postnr: { type: String },
    city: { type: String }
  },
  buyerPhoneNumber: { type: String },
  buyerEmail: { type: String },
  trackingNumber: { type: String }
};

export default saleDetailsSchema;
