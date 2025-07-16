const PsaGradedCard = require('../models/PsaGradedCard');
const mongoose = require('mongoose');

const buildQuery = (filters) => {
  const { grade, sold } = filters;
  const query = {};

  if (grade) {
    query.grade = grade;
  }
  if (sold !== undefined) {
    query.sold = sold === 'true';
  }

  return query;
};

const applyPostPopulationFilters = (cards, filters) => {
  const { setName, cardName } = filters;
  let filteredCards = cards;

  if (setName) {
    filteredCards = filteredCards.filter((card) =>
      card.cardId?.setId?.setName?.toLowerCase().includes(setName.toLowerCase()),
    );
  }
  if (cardName) {
    filteredCards = filteredCards.filter((card) =>
      card.cardId?.cardName?.toLowerCase().includes(cardName.toLowerCase()),
    );
  }

  return filteredCards;
};

const findAllPsaGradedCards = async (filters) => {
  const query = buildQuery(filters);

  const psaGradedCards = await PsaGradedCard.find(query).populate({
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set',
    },
  });

  return applyPostPopulationFilters(psaGradedCards, filters);
};

const findPsaGradedCardById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }

  const psaGradedCard = await PsaGradedCard.findById(id).populate({
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set',
    },
  });

  if (!psaGradedCard) {
    throw new Error('PSA graded card not found');
  }

  return psaGradedCard;
};

module.exports = {
  buildQuery,
  applyPostPopulationFilters,
  findAllPsaGradedCards,
  findPsaGradedCardById,
};
