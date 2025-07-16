const Set = require('../models/Set');
const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const Fuse = require('fuse.js');

const getAllSets = asyncHandler(async (req, res) => {
  const sets = await Set.find();

  res.status(200).json(sets);
});

const getSetsWithPagination = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, q, year, cardsOnly } = req.query;

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ValidationError('Invalid page number');
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ValidationError('Invalid limit (must be between 1 and 100)');
  }

  // Build base query
  const baseQuery = {};

  if (year) {
    const yearNum = parseInt(year, 10);

    if (isNaN(yearNum)) {
      throw new ValidationError('Invalid year format');
    }
    baseQuery.year = yearNum;
  }

  // All sets in the Set model are PSA card sets (according to spec)
  // No filtering needed since SealedProduct has its own setName field

  // Get all sets matching base criteria (use existing database values)
  const allSets = await Set.find(baseQuery).select('setName year totalCardsInSet totalPsaPopulation setUrl').lean();

  let filteredSets = allSets;

  // Apply fuzzy search if query provided
  if (q && q.trim()) {
    const fuseOptions = {
      includeScore: true,
      threshold: 0.4,
      minMatchCharLength: 1,
      keys: [
        { name: 'setName', weight: 1.0 },
      ],
    };

    const fuse = new Fuse(allSets, fuseOptions);
    const fuseResults = fuse.search(q.trim());

    // Enhanced results with exact match bonuses
    const enhancedResults = fuseResults.map((result) => {
      const set = result.item;
      const fuseScore = result.score;

      // Exact match bonuses
      let exactMatchBonus = 0;

      if (set.setName?.toLowerCase() === q.toLowerCase()) {
        exactMatchBonus += 100;
      }
      if (set.setName?.toLowerCase().includes(q.toLowerCase())) {
        exactMatchBonus += 50;
      }

      // Combine scores: exact matches, fuzzy relevance, and year (newer first)
      const yearScore = set.year ? (set.year - 1990) * 0.1 : 0;
      const combinedScore = exactMatchBonus + (1 - fuseScore) * 100 + yearScore;

      return {
        ...set,
        combinedScore,
      };
    });

    // Sort by combined score and remove scoring field
    filteredSets = enhancedResults
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .map(({ combinedScore, ...set }) => set);
  } else {
    // Default sort when no search query
    filteredSets = allSets.sort((a, b) => {
      // Sort by year descending, then by setName ascending
      if (b.year !== a.year) {
        return (b.year || 0) - (a.year || 0);
      }
      return a.setName.localeCompare(b.setName);
    });
  }

  // Apply pagination
  const totalSets = filteredSets.length;
  const totalPages = Math.ceil(totalSets / limitNum);
  const skip = (pageNum - 1) * limitNum;
  const sets = filteredSets.slice(skip, skip + limitNum);

  res.status(200).json({
    sets,
    currentPage: pageNum,
    totalPages,
    totalSets,
    hasNextPage: pageNum < totalPages,
    hasPrevPage: pageNum > 1,
  });
});

const getSetById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const set = await Set.findById(req.params.id);

  if (!set) {
    throw new NotFoundError('Set not found');
  }

  res.status(200).json(set);
});

module.exports = {
  getAllSets,
  getSetById,
  getSetsWithPagination,
};
