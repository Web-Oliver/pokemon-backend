const Card = require('../models/Card');
const mongoose = require('mongoose');
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorHandler');
const container = require('../container');

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

  try {
    // Use the unified search system for consistent results
    const searchFactory = container.resolve('searchFactory');
    const cardStrategy = searchFactory.getStrategy('cards');

    // Build filters for the unified search
    const filters = {};
    
    if (pokemonNumber) {
      filters.pokemonNumber = pokemonNumber;
    }
    
    if (setName) {
      filters.setName = setName;
    }
    
    if (year) {
      filters.year = parseInt(year, 10);
    }

    // Use unified search with enhanced filtering
    const searchOptions = {
      limit: 15,
      includeSetInfo: true,
      filters,
      enhancedScoring: true // Enable PSA popularity scoring
    };

    let results;
    
    if (!q) {
      // If no query, get popular cards with applied filters
      results = await cardStrategy.searchByPopularity(searchOptions);
    } else {
      // Use unified search with query
      results = await cardStrategy.search(q, searchOptions);
    }

    res.status(200).json({ 
      success: true, 
      data: results.data || results,
      meta: results.meta || {
        source: 'unified-search',
        totalResults: (results.data || results).length
      }
    });

  } catch (error) {
    console.error('Search best match error:', error);
    
    // Fallback to basic search if unified search fails
    const basicQuery = {};
    
    if (pokemonNumber) {
      basicQuery.pokemonNumber = pokemonNumber;
    }
    
    if (q) {
      basicQuery.$or = [
        { cardName: { $regex: q, $options: 'i' } },
        { baseName: { $regex: q, $options: 'i' } },
        { variety: { $regex: q, $options: 'i' } }
      ];
    }

    const cards = await Card.find(basicQuery)
      .populate('setId', 'setName year')
      .limit(15)
      .lean();

    res.status(200).json({ success: true, data: cards });
  }
});

module.exports = {
  getAllCards,
  getCardById,
  getCardsBySetId,
  searchBestMatch,
};
