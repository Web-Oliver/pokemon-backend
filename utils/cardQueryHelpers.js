/**
 * Shared Card Query Helpers
 * 
 * Common utility functions for card queries to eliminate duplication
 * between PSA Graded Card and Raw Card query services.
 */

/**
 * Apply post-population filters to card collections
 * @param {Array} cards - Array of card documents with populated cardId
 * @param {Object} filters - Filter criteria
 * @param {string} filters.setName - Filter by set name (case-insensitive partial match)
 * @param {string} filters.cardName - Filter by card name (case-insensitive partial match)
 * @returns {Array} Filtered array of cards
 */
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

/**
 * Build base query for sold filter (common to both card types)
 * @param {Object} filters - Filter criteria
 * @param {boolean|string} filters.sold - Filter by sold status
 * @returns {Object} MongoDB query object
 */
const buildBaseSoldQuery = (filters) => {
  const { sold } = filters;
  const query = {};

  if (sold !== undefined) {
    query.sold = sold === 'true';
  }

  return query;
};

module.exports = {
  applyPostPopulationFilters,
  buildBaseSoldQuery,
};