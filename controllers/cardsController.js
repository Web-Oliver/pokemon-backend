const Card = require('../models/Card');
const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const Fuse = require('fuse.js');
const searchService = require('../services/searchService');

const getAllCards = asyncHandler(async (req, res) => {
  const { setId, cardName, baseName } = req.query;
  const query = {};

  if (setId) {
    if (!mongoose.Types.ObjectId.isValid(setId)) {
      throw new ValidationError('Invalid setId format');
    }
    query.setId = setId;
  }
  if (cardName) {
    query.cardName = new RegExp(cardName, 'i');
  }
  if (baseName) {
    query.baseName = new RegExp(baseName, 'i');
  }

  const cards = await Card.find(query).populate('setId');

  res.status(200).json({ success: true, data: cards });
});


const getCardById = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    throw new ValidationError('Invalid ObjectId format');
  }

  const card = await Card.findById(req.params.id).populate('setId');

  if (!card) {
    throw new NotFoundError('Card not found');
  }

  res.status(200).json({ success: true, data: card });
});

const getCardsBySetId = asyncHandler(async (req, res) => {
  const { setId } = req.params;
  const { page = 1, limit = 15, q, pokemonNumber } = req.query;

  if (!mongoose.Types.ObjectId.isValid(setId)) {
    throw new ValidationError('Invalid setId format');
  }

  const query = { setId };

  if (q) {
    query.$or = [
      { cardName: new RegExp(q, 'i') },
      { baseName: new RegExp(q, 'i') },
      { variety: new RegExp(q, 'i') },
    ];
  }
  if (pokemonNumber) {
    query.pokemonNumber = pokemonNumber;
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  
  // Use aggregation to handle N/A pokemonNumber values properly
  const cards = await Card.aggregate([
    { $match: query },
    {
      $lookup: {
        from: 'sets',
        localField: 'setId',
        foreignField: '_id',
        as: 'setId'
      }
    },
    { $unwind: { path: '$setId', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        numericPokemonNumber: {
          $cond: {
            if: { $eq: ["$pokemonNumber", "N/A"] },
            then: 999999,  // Put N/A values at the end
            else: { 
              $convert: { 
                input: "$pokemonNumber", 
                to: "int", 
                onError: 999999,  // Handle conversion errors
                onNull: 999999 
              } 
            }
          }
        }
      }
    },
    { $sort: { sortOrder: 1, numericPokemonNumber: 1, cardName: 1 } },
    { $skip: skip },
    { $limit: parseInt(limit, 10) },
    {
      $project: {
        numericPokemonNumber: 0  // Remove the temporary field
      }
    }
  ]);
  const totalCards = await Card.countDocuments(query);
  const totalPages = Math.ceil(totalCards / parseInt(limit, 10));
  const currentPage = parseInt(page, 10);

  res.status(200).json({
    success: true,
    data: {
      cards,
      currentPage,
      totalPages,
      totalCards,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
      setId,
    },
  });
});

const searchBestMatch = asyncHandler(async (req, res) => {
  const { q, pokemonNumber, setName, year } = req.query;

  // Get all cards with set information
  const pipeline = [
    {
      $lookup: {
        from: 'sets',
        localField: 'setId',
        foreignField: '_id',
        as: 'set',
      },
    },
    { $unwind: '$set' },
  ];

  // Apply basic filters first to reduce dataset
  const preFilterStage = {};

  if (pokemonNumber) {
    preFilterStage.pokemonNumber = pokemonNumber;
  }
  
  // CRITICAL FIX: Filter by set name and year AFTER lookup but before processing
  const postLookupFilter = {};
  if (setName) {
    postLookupFilter['set.setName'] = new RegExp(setName, 'i');
  }
  if (year) {
    postLookupFilter['set.year'] = parseInt(year, 10);
  }

  // Add pre-lookup filters
  if (Object.keys(preFilterStage).length > 0) {
    pipeline.splice(0, 0, { $match: preFilterStage }); // Add at beginning before lookup
  }

  // Add post-lookup filters
  if (Object.keys(postLookupFilter).length > 0) {
    pipeline.push({ $match: postLookupFilter });
  }

  const cards = await Card.aggregate(pipeline);

  // If no search query, return with basic scoring
  if (!q) {
    const sortedCards = cards
      .sort((a, b) => {
        // Sort by PSA popularity
        const aPopularity = (a.psaTotalGradedForCard || 0) + ((a.psaGrades?.psa_10 || 0) * 10);
        const bPopularity = (b.psaTotalGradedForCard || 0) + ((b.psaGrades?.psa_10 || 0) * 10);

        return bPopularity - aPopularity;
      })
      .slice(0, 15);

    return res.status(200).json({ success: true, data: sortedCards });
  }

  // Configure Fuse.js for fuzzy searching
  const fuseOptions = {
    includeScore: true,
    threshold: 0.4, // Lower = more strict matching
    minMatchCharLength: 1,
    keys: [
      {
        name: 'cardName',
        weight: 0.4,
      },
      {
        name: 'baseName',
        weight: 0.3,
      },
      {
        name: 'variety',
        weight: 0.2,
      },
      {
        name: 'set.setName',
        weight: 0.1,
      },
    ],
  };

  const fuse = new Fuse(cards, fuseOptions);
  const fuseResults = fuse.search(q);

  // Enhance results with custom popularity scoring
  const enhancedResults = fuseResults.map((result) => {
    const card = result.item;
    const fuseScore = result.score; // Lower is better for Fuse.js

    // Calculate popularity score (higher is better)
    const popularityScore
      = ((card.psaGrades?.psa_10 || 0) * 10) // PSA 10s are highly valued
      + ((card.psaGrades?.psa_9 || 0) * 5) // PSA 9s are also valuable
      + ((card.psaTotalGradedForCard || 0) * 0.1); // General popularity

    // Exact match bonuses
    let exactMatchBonus = 0;

    if (card.cardName?.toLowerCase() === q.toLowerCase()) {
      exactMatchBonus += 100;
    }
    if (card.baseName?.toLowerCase() === q.toLowerCase()) {
      exactMatchBonus += 50;
    }

    // Combined score: prioritize exact matches, then fuzzy relevance, then popularity
    const combinedScore = exactMatchBonus + ((1 - fuseScore) * 100) + (popularityScore * 0.1);

    return {
      ...card,
      fuseScore,
      popularityScore,
      exactMatchBonus,
      combinedScore,
    };
  });

  // Sort by combined score and limit results
  const finalResults = enhancedResults
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, 15)
    .map(({ fuseScore, popularityScore, exactMatchBonus, combinedScore, ...card }) => card);

  res.status(200).json({ success: true, data: finalResults });
});

module.exports = {
  getAllCards,
  getCardById,
  getCardsBySetId,
  searchBestMatch,
};
