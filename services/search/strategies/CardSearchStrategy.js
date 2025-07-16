const BaseSearchStrategy = require('./BaseSearchStrategy');
const { ValidationError } = require('../../../middleware/errorHandler');

/**
 * Card Search Strategy
 *
 * Specialized search strategy for Pokemon Card model searches.
 * Handles card-specific search patterns including set context, popularity scoring,
 * and advanced card matching with Pokemon numbers, varieties, and names.
 *
 * IMPORTANT: This searches the Card model (official Pokemon cards) which references
 * the Set model. This is different from CardMarketReferenceProduct which has its own
 * setName field that is NOT related to the Set model.
 */
class CardSearchStrategy extends BaseSearchStrategy {
  /**
   * Creates a new card search strategy instance
   * @param {BaseRepository} cardRepository - Repository for Card model access
   * @param {BaseRepository} setRepository - Repository for Set model access
   * @param {Object} options - Strategy configuration options
   */
  constructor(cardRepository, setRepository, options = {}) {
    super(cardRepository, {
      maxResults: options.maxResults || 50,
      enableFuzzySearch: options.enableFuzzySearch !== false,
      enableScoring: options.enableScoring !== false,
      searchFields: ['cardName', 'baseName', 'pokemonNumber', 'variety'],
      defaultSort: { score: -1, psaTotalGradedForCard: -1 },
      enableSetContext: options.enableSetContext !== false,
      enablePopularityScoring: options.enablePopularityScoring !== false,
      minQueryLength: options.minQueryLength || 1,
      ...options,
    });

    this.setRepository = setRepository;
  }

  /**
   * Performs card search with set context and popularity scoring
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
      }
      return await this.performMongoSearch(query, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Provides card search suggestions with set context
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
        sort: { score: -1, psaTotalGradedForCard: -1 },
      };

      const suggestions = await this.search(query, suggestionOptions);

      // Format suggestions for autocomplete
      return suggestions.map((card) => ({
        id: card._id,
        text: card.cardName,
        secondaryText: card.baseName !== card.cardName ? card.baseName : null,
        metadata: {
          pokemonNumber: card.pokemonNumber,
          variety: card.variety,
          setName: card.setInfo?.setName,
          year: card.setInfo?.year,
          totalGraded: card.psaTotalGradedForCard,
        },
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches for best matching cards using advanced scoring
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @returns {Promise<Array>} - Best matching cards
   */
  async searchBestMatch(query, filters = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, filters);

      // Build advanced search pipeline
      const pipeline = this.buildBestMatchPipeline(query, filters);

      // Execute search
      const results = await this.repository.aggregate(pipeline);

      // Process results with enhanced scoring
      return this.processResults(results, query, filters);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Searches cards within a specific set context
   * @param {string} query - Search query
   * @param {string} setId - Set ID to search within
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async searchInSet(query, setId, options = {}) {
    try {
      // Validate input
      this.validateSearchInput(query, options);

      // Add set filter to options
      const setOptions = {
        ...options,
        filters: {
          ...options.filters,
          setId,
        },
      };

      return await this.search(query, setOptions);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Builds match conditions for card search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB match conditions
   */
  buildMatchConditions(query, options = {}) {
    const conditions = [];

    // Apply set context filter if provided
    if (options.filters && options.filters.setId) {
      conditions.push({
        setId: options.filters.setId,
      });
    }

    // NOTE: setInfo-based filters moved to separate method to handle after lookup
    // setName and year filtering now handled in buildSetFilterConditions after lookup

    // Apply Pokemon number filter if provided
    if (options.filters && options.filters.pokemonNumber) {
      conditions.push({
        pokemonNumber: options.filters.pokemonNumber,
      });
    }

    // Apply variety filter if provided
    if (options.filters && options.filters.variety) {
      conditions.push({
        variety: new RegExp(this.escapeRegex(options.filters.variety), 'i'),
      });
    }

    // Apply minimum grade population filter if provided
    if (options.filters && options.filters.minGradedPopulation) {
      conditions.push({
        psaTotalGradedForCard: { $gte: options.filters.minGradedPopulation },
      });
    }

    // Build search conditions for text fields
    const textConditions = this.buildSearchConditions(query, this.options.searchFields);

    conditions.push(textConditions);

    // Combine all conditions
    return conditions.length > 1 ? { $and: conditions } : conditions[0];
  }

  /**
   * Builds search pipeline with correct order for set filtering
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Array} - MongoDB aggregation pipeline
   */
  buildSearchPipeline(query, options = {}) {
    const pipeline = [];

    // Step 1: Add initial match conditions (excluding setInfo fields)
    const initialMatchConditions = this.buildMatchConditions(query, options);

    if (initialMatchConditions && Object.keys(initialMatchConditions).length > 0) {
      pipeline.push({ $match: initialMatchConditions });
    }

    // Step 2: Add lookup stages to get set information
    const lookupStages = this.buildLookupStages(options);

    if (lookupStages.length > 0) {
      pipeline.push(...lookupStages);
    }

    // Step 3: Add set-based filtering AFTER lookup
    const setFilterConditions = this.buildSetFilterConditions(options);

    if (setFilterConditions && Object.keys(setFilterConditions).length > 0) {
      pipeline.push({ $match: setFilterConditions });
    }

    // Step 4: Add scoring stage
    if (this.options.enableScoring) {
      pipeline.push(this.buildScoringStage(query, options));
    }

    // Step 5: Add sorting
    const sortStage = this.buildSortStage(options);

    if (sortStage) {
      pipeline.push(sortStage);
    }

    // Step 6: Add pagination
    const paginationStages = this.buildPaginationStages(options);

    if (paginationStages.length > 0) {
      pipeline.push(...paginationStages);
    }

    return pipeline;
  }

  /**
   * Builds set-based filter conditions (after lookup)
   * @param {Object} options - Search options
   * @returns {Object} - MongoDB match conditions for set fields
   */
  buildSetFilterConditions(options = {}) {
    const conditions = [];

    // Apply set name filter if provided (after lookup)
    if (options.filters && options.filters.setName) {
      conditions.push({
        'setInfo.setName': new RegExp(this.escapeRegex(options.filters.setName), 'i'),
      });
    }

    // Apply year filter if provided (after lookup)
    if (options.filters && options.filters.year) {
      conditions.push({
        'setInfo.year': options.filters.year,
      });
    }

    // Combine all conditions
    return conditions.length > 1 ? { $and: conditions } : conditions.length === 1 ? conditions[0] : {};
  }

  /**
   * Builds scoring stage with card-specific relevance factors
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
            // Exact card name match (highest priority)
            {
              $cond: {
                if: { $eq: [{ $toLower: '$cardName' }, normalizedQuery] },
                then: 100,
                else: 0,
              },
            },
            // Exact base name match
            {
              $cond: {
                if: { $eq: [{ $toLower: '$baseName' }, normalizedQuery] },
                then: 90,
                else: 0,
              },
            },
            // Pokemon number exact match
            {
              $cond: {
                if: { $eq: [{ $toLower: '$pokemonNumber' }, normalizedQuery] },
                then: 80,
                else: 0,
              },
            },
            // Card name starts with query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$cardName' }, regex: `^${this.escapeRegex(normalizedQuery)}` } },
                then: 70,
                else: 0,
              },
            },
            // Base name starts with query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$baseName' }, regex: `^${this.escapeRegex(normalizedQuery)}` } },
                then: 60,
                else: 0,
              },
            },
            // Card name contains query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$cardName' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 50,
                else: 0,
              },
            },
            // Base name contains query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$baseName' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 40,
                else: 0,
              },
            },
            // Variety contains query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$variety' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 30,
                else: 0,
              },
            },
            // Pokemon number contains query
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$pokemonNumber' }, regex: this.escapeRegex(normalizedQuery) } },
                then: 25,
                else: 0,
              },
            },
            // Popularity score (if enabled)
            ...this.options.enablePopularityScoring
              ? [{
                $cond: {
                  if: { $gt: ['$psaTotalGradedForCard', 0] },
                  then: { $divide: ['$psaTotalGradedForCard', 1000] },
                  else: 0,
                },
              }]
              : [],
            // Length-based relevance score (shorter matches are more relevant)
            {
              $cond: {
                if: { $regexMatch: { input: { $toLower: '$cardName' }, regex: this.escapeRegex(normalizedQuery) } },
                then: { $divide: [20, { $strLenCP: '$cardName' }] },
                else: 0,
              },
            },
          ],
        },
      },
    };
  }

  /**
   * Builds lookup stages for set information population
   * @param {Object} options - Search options
   * @returns {Array} - MongoDB lookup stages
   */
  buildLookupStages(options = {}) {
    const stages = [];

    // Always include set information for cards
    if (this.options.enableSetContext) {
      stages.push({
        $lookup: {
          from: 'sets',
          localField: 'setId',
          foreignField: '_id',
          as: 'setInfo',
        },
      });

      // Unwind set information
      stages.push({
        $unwind: {
          path: '$setInfo',
          preserveNullAndEmptyArrays: true,
        },
      });
    }

    return stages;
  }

  /**
   * Builds advanced search pipeline for best match functionality
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @returns {Array} - MongoDB aggregation pipeline
   */
  buildBestMatchPipeline(query, filters = {}) {
    const pipeline = [];

    // Add lookup stages first
    pipeline.push(...this.buildLookupStages(filters));

    // Add match stage
    const matchConditions = this.buildMatchConditions(query, { filters });

    if (matchConditions && Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Add enhanced scoring stage
    pipeline.push(this.buildEnhancedScoringStage(query, filters));

    // Add sorting
    pipeline.push({
      $sort: {
        score: -1,
        psaTotalGradedForCard: -1,
        'setInfo.year': -1,
        cardName: 1,
      },
    });

    // Add pagination
    const limit = Math.min(filters.limit || 25, 100);

    pipeline.push({ $limit: limit });

    return pipeline;
  }

  /**
   * Builds enhanced scoring stage for best match search
   * @param {string} query - Search query
   * @param {Object} filters - Additional filters
   * @returns {Object} - MongoDB scoring stage
   */
  buildEnhancedScoringStage(query, filters = {}) {
    const normalizedQuery = this.normalizeQuery(query);
    const queryWords = normalizedQuery.split(' ');

    const scoreConditions = [];

    // Word-based scoring
    queryWords.forEach((word, index) => {
      const wordWeight = queryWords.length - index; // Earlier words have higher weight

      scoreConditions.push(
        // Exact word match in card name
        {
          $cond: {
            if: { $regexMatch: { input: { $toLower: '$cardName' }, regex: `\\b${this.escapeRegex(word)}\\b` } },
            then: 20 * wordWeight,
            else: 0,
          },
        },
        // Exact word match in base name
        {
          $cond: {
            if: { $regexMatch: { input: { $toLower: '$baseName' }, regex: `\\b${this.escapeRegex(word)}\\b` } },
            then: 15 * wordWeight,
            else: 0,
          },
        },
      );
    });

    // Add base scoring
    const baseScoring = this.buildScoringStage(query, filters);

    return {
      $addFields: {
        score: {
          $add: [
            ...baseScoring.$addFields.score.$add,
            ...scoreConditions,
          ],
        },
      },
    };
  }

  /**
   * Processes search results with card-specific enhancements
   * @param {Array} results - Raw search results
   * @param {string} query - Original search query
   * @param {Object} options - Search options
   * @returns {Array} - Processed search results
   */
  processResults(results, query, options = {}) {
    return results.map((result) => {
      // Convert to plain object
      const processed = result.toObject ? result.toObject() : result;

      // Format card-specific fields
      if (processed.setInfo && processed.setInfo.length > 0) {
        processed.setInfo = processed.setInfo[0];
      }

      // Add computed fields
      processed.displayName = this.buildDisplayName(processed);
      processed.searchRelevance = processed.score || 0;

      // Clean up internal fields
      delete processed.score;
      delete processed.__v;

      return processed;
    });
  }

  /**
   * Builds display name for card search results
   * @param {Object} card - Card object
   * @returns {string} - Display name
   */
  buildDisplayName(card) {
    let displayName = card.cardName;

    if (card.pokemonNumber) {
      displayName = `#${card.pokemonNumber} ${displayName}`;
    }

    if (card.variety && card.variety.trim()) {
      displayName += ` (${card.variety})`;
    }

    if (card.setInfo && card.setInfo.setName) {
      displayName += ` - ${card.setInfo.setName}`;
    }

    return displayName;
  }

  /**
   * Gets search type identifier
   * @returns {string} - Search type identifier
   */
  getSearchType() {
    return 'cards';
  }

  /**
   * Gets Fuse.js keys configuration for card search
   * @returns {Array} - Fuse.js keys configuration
   */
  getFuseKeys() {
    return [
      { name: 'cardName', weight: 3 },
      { name: 'baseName', weight: 2.5 },
      { name: 'pokemonNumber', weight: 2 },
      { name: 'variety', weight: 1.5 },
      { name: 'setName', weight: 1.2 },
    ];
  }

  /**
   * Calculates custom scoring factors for card search
   * @param {Object} result - Search result
   * @param {string} query - Search query
   * @returns {number} - Custom score
   */
  calculateCustomScore(result, query) {
    let score = 0;

    // PSA population scoring (higher population = higher score)
    if (result.psaTotalGradedForCard && result.psaTotalGradedForCard > 0) {
      score += Math.min(25, Math.log10(result.psaTotalGradedForCard) * 5);
    }

    // Pokemon number exact match
    if (result.pokemonNumber && query.includes(result.pokemonNumber)) {
      score += 15;
    }

    // Set year scoring (newer sets get slight boost)
    if (result.year && result.year > 2000) {
      score += Math.min(10, (result.year - 2000) / 5);
    }

    // Variety scoring (common varieties get lower scores)
    if (result.variety) {
      const commonVarieties = ['normal', 'regular', 'common'];

      if (!commonVarieties.includes(result.variety.toLowerCase())) {
        score += 10;
      }
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
          setId: { type: 'string' },
          setName: { type: 'string' },
          year: { type: 'number' },
          pokemonNumber: { type: 'string' },
          variety: { type: 'string' },
          minGradedPopulation: { type: 'number', min: 0 },
        },
      },
    };
  }
}

module.exports = CardSearchStrategy;
