const RawCard = require('../models/RawCard');
const mongoose = require('mongoose');

const buildQuery = (filters) => {
  const { sold } = filters;
  const query = {};

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

const findAllRawCards = async (filters) => {
  const query = buildQuery(filters);

  const rawCards = await RawCard.find(query).populate({
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set',
    },
  });

  return applyPostPopulationFilters(rawCards, filters);
};

const findRawCardById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error('Invalid ObjectId format');
  }

  const rawCard = await RawCard.findById(id).populate({
    path: 'cardId',
    populate: {
      path: 'setId',
      model: 'Set',
    },
  });

  if (!rawCard) {
    throw new Error('Raw card not found');
  }

  return rawCard;
};

module.exports = {
  buildQuery,
  applyPostPopulationFilters,
  findAllRawCards,
  findRawCardById,
};
