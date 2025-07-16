const mongoose = require('mongoose');
const { Schema } = mongoose;

const cardSchema = new mongoose.Schema(
  {
    setId: { type: Schema.Types.ObjectId, ref: 'Set', required: true },
    pokemonNumber: { type: String, required: false, default: '' },
    cardName: { type: String, required: true },
    baseName: { type: String, required: true },
    variety: { type: String, default: '' },
    psaGrades: {
      psa_1: { type: Number, default: 0 },
      psa_2: { type: Number, default: 0 },
      psa_3: { type: Number, default: 0 },
      psa_4: { type: Number, default: 0 },
      psa_5: { type: Number, default: 0 },
      psa_6: { type: Number, default: 0 },
      psa_7: { type: Number, default: 0 },
      psa_8: { type: Number, default: 0 },
      psa_9: { type: Number, default: 0 },
      psa_10: { type: Number, default: 0 },
    },
    psaTotalGradedForCard: { type: Number, required: true },
  },
  { versionKey: false },
);

// Compound index to ensure uniqueness for cards within a set
cardSchema.index({ setId: 1, cardName: 1, pokemonNumber: 1, variety: 1 }, { unique: true });

// Text search index for efficient search across card name and pokemon number
cardSchema.index(
  {
    cardName: 'text',
    baseName: 'text',
    pokemonNumber: 'text',
    variety: 'text',
  },
  {
    weights: {
      cardName: 10,
      baseName: 8,
      pokemonNumber: 5,
      variety: 3,
    },
    name: 'card_text_search',
  },
);

// Optimized indexes for common search patterns
cardSchema.index({ cardName: 1 });
cardSchema.index({ baseName: 1 });
cardSchema.index({ setId: 1, cardName: 1 });
cardSchema.index({ setId: 1, pokemonNumber: 1 });

const Card = mongoose.model('Card', cardSchema);

module.exports = Card;
