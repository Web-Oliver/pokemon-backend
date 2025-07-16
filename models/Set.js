const mongoose = require('mongoose');

const setSchema = new mongoose.Schema(
  {
    setName: { type: String, required: true, unique: true },
    year: { type: Number, required: true },
    setUrl: { type: String, required: true },
    totalCardsInSet: { type: Number, required: true },
    totalPsaPopulation: { type: Number, required: true },
  },
  { versionKey: false },
);

const Set = mongoose.model('Set', setSchema);

module.exports = Set;
