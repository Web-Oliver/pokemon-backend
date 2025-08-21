import { asyncHandler, ValidationError } from '@/Infrastructure/Utilities/errorHandler.js';
import SearchService from '@/Application/UseCases/Search/SearchService.js';
const searchService = new SearchService();
/**
 * Unified Search Controller
 *
 * Handles cross-domain unified search functionality
 * Single Responsibility: Manages unified search across multiple entity types
 */

/**
 * Unified search across multiple types
 */
const search = asyncHandler(async (req, res) => {
  const { query, types, type, domain, limit, page, sort, filters } = req.query;

  // Allow empty queries for unified search (consistent with individual search endpoints)
  let searchQuery = query;

  if (!query || typeof query !== 'string' || query.trim() === '') {
    searchQuery = '*'; // Use wildcard for "show all" functionality
  }

  // DOMAIN-AWARE SEARCH: Respect domain boundaries
  let searchTypes;

  if (domain) {
    // HIERARCHICAL SEARCH: Domain-specific search types
    const domainMap = {
      'cards': ['cards', 'sets'], // Card Domain: Set → Card hierarchy
      'products': ['products', 'setProducts'], // Product Domain: SetProduct → Product hierarchy
      'card-domain': ['cards', 'sets'], // Alias for clarity
      'product-domain': ['products', 'setProducts'] // Alias for clarity
    };

    searchTypes = domainMap[domain] || domainMap.cards; // Default to card domain
    console.log(`[DOMAIN SEARCH] Using domain "${domain}" with types:`, searchTypes);
  } else if (type) {
    // Frontend sends specific type - map to correct domain-specific search
    const typeMap = {
      'sets': ['sets'], // Card Domain: Set entities only
      'cards': ['cards'], // Card Domain: Card entities only
      'products': ['products'], // Product Domain: Product entities only
      'set-products': ['setProducts'], // Product Domain: SetProduct entities only
      'all': ['cards', 'products', 'sets', 'setProducts'] // All domains (fallback)
    };

    searchTypes = typeMap[type] || [type]; // Use mapping or fallback to raw type
  } else if (types) {
    // Legacy support for comma-separated types
    searchTypes = types.split(',').map(t => t.trim());
  } else {
    // CHANGED: Default to card domain only (was mixing both domains)
    searchTypes = ['cards', 'sets']; // Card domain only
    console.log('[DOMAIN SEARCH] No domain specified, defaulting to card domain');
  }

  // Parse options
  const options = {
    limit: limit ? parseInt(limit, 10) : 20,
    page: page ? parseInt(page, 10) : 1,
    sort: sort ? JSON.parse(sort) : undefined,
    filters: filters ? JSON.parse(filters) : {}
  };

  const results = await searchService.unifiedSearch(searchQuery, searchTypes, options);

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query: searchQuery,
      types: searchTypes,
      totalTypes: Object.keys(results).length
    }
  });
});

/**
 * Search suggestions across multiple types
 */
const suggest = asyncHandler(async (req, res) => {
  const { query, types, limit } = req.query;

  // Require query for suggestions (suggestions need something to search for)
  if (!query || typeof query !== 'string' || query.trim() === '') {
    throw new ValidationError('Query parameter is required and must be a string for suggestions');
  }

  const searchTypes = types ? types.split(',').map(t => t.trim()) : ['cards'];
  const suggestionLimit = limit ? parseInt(limit, 10) : 5;

  const results = {};

  // Get suggestions for each type
  for (const type of searchTypes) {
    results[type] = await searchService.getSuggestions(query, type, { limit: suggestionLimit });
  }

  res.status(200).json({
    success: true,
    data: results,
    meta: {
      query,
      types: searchTypes,
      totalSuggestions: Object.values(results).reduce((sum, suggestions) => sum + suggestions.length, 0)
    }
  });
});

/**
 * Search statistics across all searchable types
 */
const getStats = asyncHandler(async (req, res) => {
  const Card = (await import('@/Domain/Entities/Card.js')).default;
  const Set = (await import('@/Domain/Entities/Set.js')).default;
  const Product = (await import('@/Domain/Entities/Product.js')).default;
  const SetProduct = (await import('@/Domain/Entities/SetProduct.js')).default;
  const [cardCount, setCount, productCount, setProductCount] = await Promise.all([
    Card.countDocuments(),
    Set.countDocuments(),
    Product.countDocuments(),
    SetProduct.countDocuments()
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalCards: cardCount,
      totalSets: setCount,
      totalProducts: productCount,
      totalSetProducts: setProductCount,
      searchTypes: ['cards', 'products', 'sets', 'setProducts']
    }
  });
});

export {
  search,
  suggest,
  getStats
};
export default search;;
