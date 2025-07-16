const BaseSearchStrategy = require('./BaseSearchStrategy');
const { ValidationError } = require('../../../middleware/errorHandler');

/**
 * Set Search Strategy
 * 
 * Specialized search strategy for Pokemon Set model searches.
 * Handles official Pokemon card set searches with year filtering,
 * card count metrics, and PSA population statistics.
 * 
 * IMPORTANT: This searches the Set model (official Pokemon card sets)
 * which is completely different from CardMarketReferenceProduct.setName.
 * Set model contains official Pokemon sets like "Base Set", "Jungle", etc.
 */
class SetSearchStrategy extends BaseSearchStrategy {
  /**
   * Creates a new set search strategy instance
   * @param {BaseRepository} setRepository - Repository for Set model access
   * @param {BaseRepository} cardRepository - Repository for Card model access (for aggregation)
   * @param {Object} options - Strategy configuration options
   */
  constructor(setRepository, cardRepository, options = {}) {
    super(setRepository, {
      maxResults: options.maxResults || 30,
      enableFuzzySearch: options.enableFuzzySearch !== false,
      enableScoring: options.enableScoring !== false,
      searchFields: ['setName'],
      defaultSort: { score: -1, year: -1 },
      enableYearFiltering: options.enableYearFiltering !== false,
      enableCardCountMetrics: options.enableCardCountMetrics !== false,
      enablePsaPopulationMetrics: options.enablePsaPopulationMetrics !== false,
      minQueryLength: options.minQueryLength || 1,
      ...options
    });
    
    this.cardRepository = cardRepository;
  }

  /**
   * Performs set search with year and metrics filtering
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async search(query, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      // Apply minimum query length
      if (query.trim().length < this.options.minQueryLength) {
        return [];
      }
      
      // Use hybrid search if enabled, otherwise MongoDB search
      if (this.options.enableFuseSearch && this.options.hybridSearch) {
        return await this.performHybridSearch(query, options);
      } else {
        return await this.performMongoSearch(query, options);
      }
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Provides set search suggestions with year context
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search suggestions
   */
  async suggest(query, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      // Get suggestions with limited results
      const suggestionOptions = {
        ...options,
        limit: Math.min(options.limit || 10, 20),
        sort: { score: -1, year: -1 }
      };
      
      const suggestions = await this.search(query, suggestionOptions);
      
      // Format suggestions for autocomplete
      return suggestions.map(set => ({
        id: set._id,
        text: set.setName,
        secondaryText: set.year ? `${set.year}` : null,
        metadata: {
          year: set.year,
          totalCards: set.totalCardsInSet,
          totalPsaPopulation: set.totalPsaPopulation,
          setUrl: set.setUrl
        }
      }));
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches sets by year range
   * @param {string} query - Search query
   * @param {number} startYear - Start year
   * @param {number} endYear - End year
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchByYearRange(query, startYear, endYear, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      if (startYear > endYear) {
        throw new ValidationError('Start year cannot be greater than end year');
      }
      
      const currentYear = new Date().getFullYear();
      if (startYear > currentYear || endYear > currentYear) {
        throw new ValidationError('Year cannot be in the future');
      }
      
      // Add year range filter to options
      const yearOptions = {
        ...options,
        filters: {
          ...options.filters,
          yearRange: { start: startYear, end: endYear }
        }
      };
      
      return await this.search(query, yearOptions);
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches sets by PSA population range
   * @param {string} query - Search query
   * @param {number} minPopulation - Minimum PSA population
   * @param {number} maxPopulation - Maximum PSA population
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchByPsaPopulation(query, minPopulation, maxPopulation, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      if (minPopulation < 0 || maxPopulation < 0) {
        throw new ValidationError('PSA population values must be non-negative');
      }
      
      if (minPopulation > maxPopulation) {
        throw new ValidationError('Minimum PSA population cannot be greater than maximum');
      }
      
      // Add PSA population range filter to options
      const psaOptions = {
        ...options,
        filters: {
          ...options.filters,
          psaPopulationRange: { min: minPopulation, max: maxPopulation }
        }
      };
      
      return await this.search(query, psaOptions);
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets sets with enhanced card statistics
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results with card statistics
   */
  async searchWithCardStats(query, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);
      
      // Build enhanced pipeline with card statistics
      const pipeline = this.buildCardStatsPipeline(query, options);
      
      // Execute search
      const results = await this.repository.aggregate(pipeline);
      
      // Process and return results
      return this.processResults(results, query, options);
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets available years for filtering
   * @returns {Promise<Array>} - Available years
   */
  async getAvailableYears() {
    try {
      const years = await this.repository.aggregate([
        { $group: { _id: '$year', count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $project: { year: '$_id', count: 1, _id: 0 } }
      ]);
      
      return years;
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets set statistics summary
   * @returns {Promise<Object>} - Set statistics
   */
  async getSetStatistics() {
    try {
      const stats = await this.repository.aggregate([
        {
          $group: {
            _id: null,
            totalSets: { $sum: 1 },
            totalCards: { $sum: '$totalCardsInSet' },
            totalPsaPopulation: { $sum: '$totalPsaPopulation' },
            averageCardsPerSet: { $avg: '$totalCardsInSet' },
            averagePsaPopulation: { $avg: '$totalPsaPopulation' },
            minYear: { $min: '$year' },
            maxYear: { $max: '$year' },
            yearRange: { $push: '$year' }
          }
        },
        {
          $project: {
            _id: 0,
            totalSets: 1,
            totalCards: 1,
            totalPsaPopulation: 1,
            averageCardsPerSet: { $round: ['$averageCardsPerSet', 2] },
            averagePsaPopulation: { $round: ['$averagePsaPopulation', 2] },
            minYear: 1,
            maxYear: 1,
            yearSpan: { $subtract: ['$maxYear', '$minYear'] }
          }
        }
      ]);
      
      return stats[0] || {};
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Builds match conditions for set search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB match conditions
   */
  buildMatchConditions(query, options = {}) {
    const conditions = [];
    
    // Apply year filter if provided
    if (options.filters && options.filters.year) {
      conditions.push({
        year: options.filters.year
      });
    }
    
    // Apply year range filter if provided
    if (options.filters && options.filters.yearRange) {
      conditions.push({
        year: {
          $gte: options.filters.yearRange.start,
          $lte: options.filters.yearRange.end
        }
      });
    }
    
    // Apply PSA population range filter if provided
    if (options.filters && options.filters.psaPopulationRange) {
      conditions.push({
        totalPsaPopulation: {
          $gte: options.filters.psaPopulationRange.min,
          $lte: options.filters.psaPopulationRange.max
        }
      });
    }
    
    // Apply card count range filter if provided
    if (options.filters && options.filters.cardCountRange) {
      conditions.push({
        totalCardsInSet: {
          $gte: options.filters.cardCountRange.min,
          $lte: options.filters.cardCountRange.max
        }
      });
    }
    
    // Apply minimum PSA population filter if provided
    if (options.filters && options.filters.minPsaPopulation) {
      conditions.push({
        totalPsaPopulation: { $gte: options.filters.minPsaPopulation }
      });
    }
    
    // Apply minimum card count filter if provided
    if (options.filters && options.filters.minCardCount) {
      conditions.push({
        totalCardsInSet: { $gte: options.filters.minCardCount }
      });
    }
    
    // Build search conditions for text fields
    const textConditions = this.buildSearchConditions(query, this.options.searchFields);
    conditions.push(textConditions);
    
    // Combine all conditions
    return conditions.length > 1 ? { $and: conditions } : conditions[0];
  }

  /**
   * Builds scoring stage with set-specific relevance factors
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB scoring stage
   */
  buildScoringStage(query, options = {}) {
    const normalizedQuery = this.normalizeQuery(query);
    
    return {
      $addFields: {
        score: {
          $add: [
            // Exact set name match (highest priority)
            {
              $cond: {
                if: { $eq: [{ $toLower: '$setName' }, normalizedQuery] },
                then: 100,
                else: 0
              }
            },
            // Set name starts with query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$setName' }, regex: `^${this.escapeRegex(normalizedQuery)}` } },
                then: 80,
                else: 0
              }
            },
            // Set name contains query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$setName' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 60,
                else: 0
              }
            },
            // Word boundary match (higher relevance for complete words)
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$setName' }, regex: `\\b${this.escapeRegex(normalizedQuery)}\\b` } },
                then: 40,
                else: 0
              }
            },
            // PSA population-based scoring (more popular sets get higher scores)
            {
              $cond: {
                if: { $gt: ['$totalPsaPopulation', 0] },
                then: { $divide: ['$totalPsaPopulation', 10000] },
                else: 0
              }
            },
            // Card count-based scoring (sets with more cards get slight boost)
            {
              $cond: {
                if: { $gt: ['$totalCardsInSet', 0] },
                then: { $divide: ['$totalCardsInSet', 1000] },
                else: 0
              }
            },
            // Year-based scoring (more recent sets get slight boost)
            {
              $cond: {
                if: { $gt: ['$year', 1990] },
                then: { $divide: [{ $subtract: ['$year', 1990] }, 100] },
                else: 0
              }
            },
            // Length-based relevance score (shorter matches are more relevant)
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$setName' }, regex: this.escapeRegex(normalizedQuery) } },
                then: { $divide: [50, { $strLenCP: '$setName' }] },
                else: 0
              }
            }
          ]
        }
      }
    };
  }

  /**
   * Builds enhanced pipeline with card statistics
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} - MongoDB aggregation pipeline
   */
  buildCardStatsPipeline(query, options = {}) {
    const pipeline = [];
    
    // Add match stage
    const matchConditions = this.buildMatchConditions(query, options);
    if (matchConditions && Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }
    
    // Add lookup for card statistics
    if (this.options.enableCardCountMetrics) {
      pipeline.push({
        $lookup: {
          from: 'cards',
          localField: '_id',
          foreignField: 'setId',
          as: 'cardStats'
        }
      });
      
      // Add card count aggregation
      pipeline.push({
        $addFields: {
          actualCardCount: { $size: '$cardStats' },
          cardCountDifference: { $subtract: ['$totalCardsInSet', { $size: '$cardStats' }] }
        }
      });
    }
    
    // Add scoring stage
    if (this.options.enableScoring) {
      pipeline.push(this.buildScoringStage(query, options));
    }
    
    // Add sorting
    const sortStage = this.buildSortStage(options);
    if (sortStage) {
      pipeline.push(sortStage);
    }
    
    // Add pagination
    const paginationStages = this.buildPaginationStages(options);
    if (paginationStages.length > 0) {
      pipeline.push(...paginationStages);
    }
    
    return pipeline;
  }

  /**
   * Processes search results with set-specific enhancements
   * @param {Array} results - Raw search results
   * @param {string} query - Original search query
   * @param {Object} options - Search options
   * @returns {Array} - Processed search results
   */
  processResults(results, query, options = {}) {
    return results.map(result => {
      // Convert to plain object
      const processed = result.toObject ? result.toObject() : result;
      
      // Add computed fields
      processed.displayName = this.buildDisplayName(processed);
      processed.searchRelevance = processed.score || 0;
      
      // Add card density metrics
      if (processed.totalCardsInSet > 0) {
        processed.psaPopulationDensity = processed.totalPsaPopulation / processed.totalCardsInSet;
      }
      
      // Add era classification
      processed.era = this.classifyEra(processed.year);
      
      // Format year display
      processed.yearDisplay = processed.year ? `${processed.year}` : 'Unknown';
      
      // Clean up internal fields
      delete processed.score;
      delete processed.__v;
      delete processed.cardStats; // Remove raw card stats if present
      
      return processed;
    });
  }

  /**
   * Builds display name for set search results
   * @param {Object} set - Set object
   * @returns {string} - Display name
   */
  buildDisplayName(set) {
    let displayName = set.setName;
    
    if (set.year) {
      displayName += ` (${set.year})`;
    }
    
    return displayName;
  }

  /**
   * Classifies set era based on year
   * @param {number} year - Set year
   * @returns {string} - Era classification
   */
  classifyEra(year) {
    if (!year) return 'Unknown';
    
    if (year >= 1996 && year <= 2000) return 'Wizards Era';
    if (year >= 2001 && year <= 2003) return 'e-Card Era';
    if (year >= 2004 && year <= 2006) return 'Ex Era';
    if (year >= 2007 && year <= 2010) return 'Diamond & Pearl Era';
    if (year >= 2011 && year <= 2013) return 'Black & White Era';
    if (year >= 2014 && year <= 2016) return 'XY Era';
    if (year >= 2017 && year <= 2019) return 'Sun & Moon Era';
    if (year >= 2020 && year <= 2022) return 'Sword & Shield Era';
    if (year >= 2023) return 'Scarlet & Violet Era';
    
    return 'Unknown Era';
  }

  /**
   * Gets search type identifier
   * @returns {string} - Search type identifier
   */
  getSearchType() {
    return 'sets';
  }

  /**
   * Gets Fuse.js keys configuration for set search
   * @returns {Array} - Fuse.js keys configuration
   */
  getFuseKeys() {
    return [
      { name: 'setName', weight: 3 },
      { name: 'year', weight: 1.5 }
    ];
  }

  /**
   * Calculates custom scoring factors for set search
   * @param {Object} result - Search result
   * @param {string} query - Search query
   * @returns {number} - Custom score
   */
  calculateCustomScore(result, query) {
    let score = 0;
    
    // PSA population scoring (higher population = higher score)
    if (result.totalPsaPopulation && result.totalPsaPopulation > 0) {
      score += Math.min(30, Math.log10(result.totalPsaPopulation) * 6);
    }
    
    // Card count scoring (larger sets get slight boost)
    if (result.totalCardsInSet && result.totalCardsInSet > 0) {
      score += Math.min(15, Math.log10(result.totalCardsInSet) * 5);
    }
    
    // Era popularity scoring
    if (result.year) {
      if (result.year >= 1998 && result.year <= 2003) {
        score += 20; // Classic era bonus
      } else if (result.year >= 2016 && result.year <= 2021) {
        score += 15; // Modern era bonus
      } else if (result.year >= 1996 && result.year <= 1997) {
        score += 25; // Base set era bonus
      }
    }
    
    // Year match scoring
    if (result.year && query.includes(result.year.toString())) {
      score += 10;
    }
    
    return Math.min(100, score);
  }

  /**
   * Gets supported search options
   * @returns {Object} - Supported search options
   */
  getSupportedOptions() {
    return {
      ...super.getSupportedOptions(),
      filters: {
        type: 'object',
        properties: {
          year: { type: 'number', minimum: 1996 },
          yearRange: {
            type: 'object',
            properties: {
              start: { type: 'number', minimum: 1996 },
              end: { type: 'number', minimum: 1996 }
            }
          },
          psaPopulationRange: {
            type: 'object',
            properties: {
              min: { type: 'number', minimum: 0 },
              max: { type: 'number', minimum: 0 }
            }
          },
          cardCountRange: {
            type: 'object',
            properties: {
              min: { type: 'number', minimum: 1 },
              max: { type: 'number', minimum: 1 }
            }
          },
          minPsaPopulation: { type: 'number', minimum: 0 },
          minCardCount: { type: 'number', minimum: 1 }
        }
      }
    };
  }
}

module.exports = SetSearchStrategy;