import Set from '@/Domain/Entities/Set.js';
import { asyncHandler, NotFoundError, ValidationError   } from '@/Infrastructure/Utilities/errorHandler.js';
import SearchService from '@/Application/UseCases/Search/SearchService.js';
const searchService = new SearchService();
import ValidatorFactory from '@/Application/Validators/ValidatorFactory.js';
const getAllSets = asyncHandler(async (req, res) => {
  const sets = await Set.find();

  res.status(200).json(sets);
});

const getSetsWithPagination = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, q, year, cardsOnly } = req.query;

  // Validate pagination parameters
  const { pageNum, limitNum } = ValidatorFactory.validatePagination(page, limit, 100);

  // Build base query
  const baseQuery = {};

  if (year) {
    baseQuery.year = ValidatorFactory.validateYear(year);
  }

  // All sets in the Set model are PSA card sets (according to spec)
  // No filtering needed since SealedProduct has its own setName field

  // Get all sets matching base criteria (use existing database values)
  const allSets = await Set.find(baseQuery).select('setName year totalCardsInSet total_grades setUrl uniqueSetId').lean();

  let filteredSets = allSets;

  // Apply search if query provided
  if (q && q.trim()) {
    // Build filters
    const filters = {};

    if (year) filters.year = parseInt(year, 10);

    const searchOptions = {
      limit: limitNum,
      page: pageNum
    };

    const searchResults = await searchService.searchSets(q.trim(), filters, searchOptions);

    filteredSets = searchResults;
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
  ValidatorFactory.validateObjectId(req.params.id, 'Set ID');

  const set = await Set.findById(req.params.id);

  if (!set) {
    throw new NotFoundError('Set not found');
  }

  res.status(200).json(set);
});

export {
  getAllSets,
  getSetById,
  getSetsWithPagination
};
export default getAllSets;;
