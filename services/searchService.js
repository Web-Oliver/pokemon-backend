const Card = require('../models/Card');
const CardMarketReferenceProduct = require('../models/CardMarketReferenceProduct');
const { searchCache } = require('../middleware/searchCache');

// Enhanced search utilities for word order and special character handling
class SearchUtility {
  // Normalize search query by removing special characters and handling word order
  static normalizeQuery(query) {
    if (!query || typeof query !== 'string') return '';
    
    // Remove special characters but keep spaces and alphanumeric
    const normalized = query
      .replace(/[^\w\s-]/g, ' ')  // Replace special chars with spaces
      .replace(/\s+/g, ' ')       // Multiple spaces to single space
      .trim()                     // Remove leading/trailing spaces
      .toLowerCase();             // Convert to lowercase
    
    return normalized;
  }

  // Create fuzzy search patterns that ignore word order and special characters
  static createFuzzyPatterns(query) {
    const normalized = this.normalizeQuery(query);
    if (!normalized) return [];
    
    const words = normalized.split(' ').filter(word => word.length > 0);
    if (words.length === 0) return [];
    
    const patterns = [];
    
    // Original query pattern (for exact matches)
    patterns.push(normalized);
    
    // Individual word patterns (for partial matches)
    words.forEach(word => {
      patterns.push(word);
    });
    
    // All permutations of words (for order-independent matching)
    if (words.length > 1 && words.length <= 4) { // Limit to prevent explosion
      const permutations = this.generatePermutations(words);
      permutations.forEach(perm => {
        patterns.push(perm.join(' '));
      });
    }
    
    return [...new Set(patterns)]; // Remove duplicates
  }

  // Generate all permutations of words array
  static generatePermutations(arr) {
    if (arr.length <= 1) return [arr];
    
    const result = [];
    for (let i = 0; i < arr.length; i++) {
      const current = arr[i];
      const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
      const perms = this.generatePermutations(remaining);
      
      perms.forEach(perm => {
        result.push([current].concat(perm));
      });
    }
    
    return result;
  }

  // Create MongoDB regex patterns for flexible matching
  static createMongoRegexPatterns(query) {
    const patterns = this.createFuzzyPatterns(query);
    const regexPatterns = [];
    
    patterns.forEach(pattern => {
      // Escape special regex characters
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regexPatterns.push(new RegExp(escapedPattern, 'i'));
      
      // Also add word boundary patterns for better matching
      if (pattern.includes(' ')) {
        const wordBoundaryPattern = escapedPattern.replace(/\s+/g, '\\s+');
        regexPatterns.push(new RegExp(wordBoundaryPattern, 'i'));
      }
    });
    
    return regexPatterns;
  }

  // Score search results based on relevance to original query
  static calculateRelevanceScore(text, originalQuery) {
    if (!text || !originalQuery) return 0;
    
    const normalizedText = this.normalizeQuery(text);
    const normalizedQuery = this.normalizeQuery(originalQuery);
    
    let score = 0;
    
    // Exact match bonus
    if (normalizedText === normalizedQuery) {
      score += 100;
    }
    
    // Starts with query bonus
    if (normalizedText.startsWith(normalizedQuery)) {
      score += 50;
    }
    
    // Contains all words bonus
    const queryWords = normalizedQuery.split(' ');
    const textWords = normalizedText.split(' ');
    let wordMatches = 0;
    
    queryWords.forEach(queryWord => {
      if (textWords.some(textWord => textWord.includes(queryWord))) {
        wordMatches++;
      }
    });
    
    const wordMatchRatio = queryWords.length > 0 ? wordMatches / queryWords.length : 0;
    score += wordMatchRatio * 30;
    
    // Length similarity bonus (prefer shorter, more relevant results)
    const lengthDiff = Math.abs(normalizedText.length - normalizedQuery.length);
    const lengthScore = Math.max(0, 20 - lengthDiff);
    score += lengthScore;
    
    return score;
  }
}

// Export the utility for use in other modules
module.exports.SearchUtility = SearchUtility;

// In-flight request tracking to prevent duplicate requests
const inflightRequests = new Map();

class SearchService {
  constructor() {
    this.debounceTimers = new Map();
    this.requestDeduplication = new Map();
  }

  // Request deduplication - if same query is already being processed, return that promise
  async deduplicateRequest(key, requestFn) {
    if (this.requestDeduplication.has(key)) {
      return this.requestDeduplication.get(key);
    }

    const promise = requestFn();

    this.requestDeduplication.set(key, promise);

    try {
      const result = await promise;

      this.requestDeduplication.delete(key);
      return result;
    } catch (error) {
      this.requestDeduplication.delete(key);
      throw error;
    }
  }

  // Optimized card search with aggregation pipeline
  async searchCards(query, options = {}) {
    const { limit = 15, includeSetInfo = true, setName } = options;
    const maxLimit = Math.min(limit, 50);

    const requestKey = `cards:${JSON.stringify({ query, limit, includeSetInfo, setName })}`;

    return this.deduplicateRequest(requestKey, async () => {
      const startTime = Date.now();

      try {
        // CRITICAL FIX: Build pipeline to handle setContext filtering correctly
        const pipeline = [];

        // Step 1: Enhanced match using SearchUtility for better fuzzy matching
        const fuzzyPatterns = SearchUtility.createMongoRegexPatterns(query);
        const originalQuery = query;
        
        // Create enhanced search patterns that handle word order and special characters
        const matchConditions = [];
        
        // Add original regex patterns for backward compatibility
        matchConditions.push(
          { cardName: { $regex: query, $options: 'i' } },
          { baseName: { $regex: query, $options: 'i' } },
          { pokemonNumber: { $regex: query, $options: 'i' } },
          { variety: { $regex: query, $options: 'i' } }
        );
        
        // Add enhanced fuzzy patterns for better matching
        fuzzyPatterns.forEach(pattern => {
          matchConditions.push(
            { cardName: pattern },
            { baseName: pattern },
            { variety: pattern }
          );
        });

        pipeline.push({
          $match: {
            $or: matchConditions
          }
        });

        // Step 2: Add enhanced scoring with improved fuzzy matching
        const normalizedQuery = SearchUtility.normalizeQuery(query);
        
        pipeline.push({
          $addFields: {
            score: {
              $cond: {
                if: { $eq: [{ $toLower: '$cardName' }, query.toLowerCase()] },
                then: 100,
                else: {
                  $cond: {
                    if: { $eq: [{ $indexOfCP: [{ $toLower: '$cardName' }, query.toLowerCase()] }, 0] },
                    then: 50,
                    else: {
                      $add: [
                        // Base score for any match
                        10,
                        // Bonus for contains match in cardName
                        {
                          $cond: {
                            if: { $regexMatch: { input: { $toLower: '$cardName' }, regex: normalizedQuery, options: 'i' } },
                            then: 20,
                            else: 0
                          }
                        },
                        // Bonus for contains match in baseName
                        {
                          $cond: {
                            if: { $regexMatch: { input: { $toLower: '$baseName' }, regex: normalizedQuery, options: 'i' } },
                            then: 15,
                            else: 0
                          }
                        }
                      ]
                    }
                  }
                }
              }
            }
          }
        });

        // Step 3: Add set lookup for filtering and info
        if (includeSetInfo || setName) {
          pipeline.push({
            $lookup: {
              from: 'sets',
              localField: 'setId',
              foreignField: '_id',
              as: 'setInfo',
              pipeline: [
                { $project: { setName: 1, year: 1 } },
              ],
            },
          });

          // Step 4: Add setInfo field (keeping original setId as ObjectId)
          pipeline.push({
            $addFields: {
              setInfo: { $arrayElemAt: ['$setInfo', 0] }
            },
          });
        }

        // Step 5: CRITICAL FIX - Apply setName filter using the correct path
        // Only apply filter if setName is provided and not empty
        if (setName && setName.trim() !== '') {
          if (process.env.NODE_ENV === 'development') {
            console.log(`[DEBUG] Applying setContext filter for: "${setName}"`);
          }
          pipeline.push({
            $match: {
              'setInfo.setName': { $regex: setName.trim(), $options: 'i' }
            },
          });
        }

        // Step 6: Add sorting and limiting
        pipeline.push({
          $sort: {
            score: -1,
            cardName: 1,
          },
        });

        pipeline.push({
          $limit: maxLimit,
        });

        // Step 7: Project needed fields (include setInfo when requested)
        const projection = {
          cardName: 1,
          baseName: 1,
          pokemonNumber: 1,
          variety: 1,
          setId: 1,
          score: 1,
        };

        if (includeSetInfo) {
          projection.setInfo = 1;
        }

        pipeline.push({
          $project: projection,
        });

        // Debug logging for development
        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] Card search pipeline for query="${query}", setName="${setName}":`, JSON.stringify(pipeline, null, 2));
        }

        const results = await Card.aggregate(pipeline);
        const queryTime = Date.now() - startTime;

        if (process.env.NODE_ENV === 'development') {
          console.log(`[DEBUG] Card search results: ${results.length} results in ${queryTime}ms`);
          if (results.length > 0 && results.length <= 3) {
            console.log('[DEBUG] Sample results:', results.map(r => ({
              cardName: r.cardName,
              setInfo: r.setInfo,
              score: r.score
            })));
          }
        }

        return {
          success: true,
          data: results,
          meta: {
            query,
            setName,
            totalResults: results.length,
            queryTime,
            optimized: true,
            cached: false,
            pipeline: process.env.NODE_ENV === 'development' ? pipeline : undefined,
          },
        };
      } catch (error) {
        console.error('Search error:', error);
        throw error;
      }
    });
  }

  // Optimized card market reference product search - INDEPENDENT search, no hierarchical filtering
  async searchCardMarketProducts(query, options = {}) {
    const { category, limit = 15 } = options;
    const maxLimit = Math.min(limit, 50);

    const requestKey = `cardmarket:${JSON.stringify({ query, category, limit })}`;

    return this.deduplicateRequest(requestKey, async () => {
      const startTime = Date.now();

      try {
        const pipeline = [];

        // Build match stage for INDEPENDENT product search with enhanced fuzzy matching
        const matchStage = {};

        if (category) {
          matchStage.category = category;
        }

        if (query) {
          // Use both text search and fuzzy patterns for better results
          const fuzzyPatterns = SearchUtility.createMongoRegexPatterns(query);
          const nameConditions = [
            { $text: { $search: query } }, // Original text search
            { name: { $regex: query, $options: 'i' } }, // Original regex search
            { setName: { $regex: query, $options: 'i' } } // Original set search
          ];
          
          // Add fuzzy pattern matches
          fuzzyPatterns.forEach(pattern => {
            nameConditions.push(
              { name: pattern },
              { setName: pattern }
            );
          });
          
          matchStage.$or = nameConditions;
        }

        if (Object.keys(matchStage).length > 0) {
          pipeline.push({ $match: matchStage });
        }

        // Add enhanced scoring for text search with fuzzy matching
        if (query) {
          const normalizedQuery = SearchUtility.normalizeQuery(query);
          
          pipeline.push({
            $addFields: {
              textScore: { $ifNull: [{ $meta: 'textScore' }, 0] },
              fuzzyScore: {
                $add: [
                  // Exact match bonuses
                  {
                    $cond: {
                      if: { $eq: [{ $toLower: '$name' }, query.toLowerCase()] },
                      then: 50,
                      else: 0
                    }
                  },
                  // Starts with bonuses
                  {
                    $cond: {
                      if: { $eq: [{ $indexOfCP: [{ $toLower: '$name' }, query.toLowerCase()] }, 0] },
                      then: 30,
                      else: 0
                    }
                  },
                  // Contains bonuses with normalized matching
                  {
                    $cond: {
                      if: { $regexMatch: { input: { $toLower: '$name' }, regex: normalizedQuery, options: 'i' } },
                      then: 20,
                      else: 0
                    }
                  },
                  // Set name bonuses
                  {
                    $cond: {
                      if: { $regexMatch: { input: { $toLower: '$setName' }, regex: normalizedQuery, options: 'i' } },
                      then: 15,
                      else: 0
                    }
                  }
                ]
              }
            },
          });
        }

        // Enhanced sorting with availability and price
        pipeline.push({
          $addFields: {
            availabilityScore: {
              $cond: {
                if: { $gt: ['$available', 0] },
                then: { $multiply: ['$available', 2] },
                else: 0,
              },
            },
            priceScore: {
              $cond: {
                if: {
                  $and: [
                    { $gt: [{ $toDouble: { $ifNull: ['$price', 0] } }, 0] },
                  ],
                },
                then: { $divide: [1000, { $toDouble: '$price' }] }, // Lower price = higher score
                else: 0,
              },
            },
          },
        });

        pipeline.push({
          $addFields: {
            combinedScore: {
              $add: [
                { $ifNull: ['$textScore', 0] },
                { $ifNull: ['$fuzzyScore', 0] },
                '$availabilityScore',
                { $multiply: ['$priceScore', 0.1] },
              ],
            },
          },
        });

        // Sort by combined score
        pipeline.push({
          $sort: {
            combinedScore: -1,
            name: 1,
          },
        });

        pipeline.push({ $limit: maxLimit });

        // Project needed fields
        pipeline.push({
          $project: {
            name: 1,
            setName: 1,
            category: 1,
            price: 1,
            available: 1,
            url: 1,
            combinedScore: 1,
          },
        });

        const results = await CardMarketReferenceProduct.aggregate(pipeline);
        const queryTime = Date.now() - startTime;

        return {
          success: true,
          data: results,
          meta: {
            query,
            category,
            totalResults: results.length,
            queryTime,
            optimized: true,
            cached: false,
          },
        };
      } catch (error) {
        console.error('CardMarket search error:', error);
        throw error;
      }
    });
  }

  // Global search across multiple collections
  async globalSearch(query, options = {}) {
    const { limit = 15 } = options;
    const requestKey = `global:${JSON.stringify({ query, limit })}`;

    return this.deduplicateRequest(requestKey, async () => {
      const startTime = Date.now();

      try {
        // Run searches in parallel
        const [cardResults, productResults] = await Promise.all([
          this.searchCards(query, { limit, includeSetInfo: true }),
          this.searchCardMarketProducts(query, { limit }),
        ]);

        const queryTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            cards: cardResults.data.slice(0, limit),
            products: productResults.data.slice(0, limit),
          },
          meta: {
            query,
            totalResults: cardResults.data.length + productResults.data.length,
            queryTime,
            sources: ['cards', 'cardmarket'],
            optimized: true,
            cached: false,
          },
        };
      } catch (error) {
        console.error('Global search error:', error);
        throw error;
      }
    });
  }

  // Get search suggestions/autocomplete
  async getSearchSuggestions(query, options = {}) {
    const { limit = 15, type = 'cards' } = options;
    const requestKey = `suggestions:${type}:${query}:${limit}`;

    return this.deduplicateRequest(requestKey, async () => {
      const startTime = Date.now();

      try {
        let pipeline;
        let Model;

        if (type === 'cards') {
          Model = Card;
          const fuzzyPatterns = SearchUtility.createMongoRegexPatterns(query);
          const matchConditions = [
            { cardName: new RegExp(`^${query}`, 'i') },
            { baseName: new RegExp(`^${query}`, 'i') },
          ];
          
          // Add fuzzy pattern matches for suggestions
          fuzzyPatterns.forEach(pattern => {
            matchConditions.push(
              { cardName: pattern },
              { baseName: pattern }
            );
          });
          
          pipeline = [
            {
              $match: {
                $or: matchConditions,
              },
            },
            {
              $group: {
                _id: null,
                cardNames: { $addToSet: '$cardName' },
                baseNames: { $addToSet: '$baseName' },
              },
            },
            {
              $project: {
                suggestions: {
                  $setUnion: ['$cardNames', '$baseNames'],
                },
              },
            },
          ];
        } else {
          Model = CardMarketReferenceProduct;
          const fuzzyPatterns = SearchUtility.createMongoRegexPatterns(query);
          const matchConditions = [
            { name: new RegExp(`^${query}`, 'i') },
          ];
          
          // Add fuzzy pattern matches for suggestions
          fuzzyPatterns.forEach(pattern => {
            matchConditions.push({ name: pattern });
          });
          
          pipeline = [
            {
              $match: {
                $or: matchConditions,
              },
            },
            {
              $group: {
                _id: null,
                suggestions: { $addToSet: '$name' },
              },
            },
          ];
        }

        const results = await Model.aggregate(pipeline);
        const suggestions = results[0]?.suggestions || [];
        
        // Enhanced filtering and ranking using SearchUtility
        const scoredSuggestions = suggestions
          .map(suggestion => ({
            text: suggestion,
            score: SearchUtility.calculateRelevanceScore(suggestion, query)
          }))
          .filter(item => item.score > 0) // Only include relevant suggestions
          .sort((a, b) => b.score - a.score) // Sort by relevance score
          .slice(0, limit)
          .map(item => item.text); // Extract just the text
        
        const filteredSuggestions = scoredSuggestions;

        const queryTime = Date.now() - startTime;

        return {
          success: true,
          data: filteredSuggestions,
          meta: {
            query,
            type,
            totalResults: filteredSuggestions.length,
            queryTime,
            cached: false,
          },
        };
      } catch (error) {
        console.error('Suggestions error:', error);
        throw error;
      }
    });
  }

  // Clear all in-flight requests (useful for testing)
  clearInflightRequests() {
    this.requestDeduplication.clear();
  }
}

const searchServiceInstance = new SearchService();

module.exports = searchServiceInstance;
module.exports.SearchUtility = SearchUtility;
