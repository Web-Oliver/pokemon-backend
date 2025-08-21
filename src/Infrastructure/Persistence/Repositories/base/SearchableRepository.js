import BaseRepository from './BaseRepository.js';
import UnifiedSearchQueryBuilder from '@/Application/UseCases/Search/search/UnifiedSearchQueryBuilder.js';
import { SEARCH_CONFIGS   } from '@/Infrastructure/Configuration/searchConfigurations.js';
/**
 * Searchable Repository Base Class
 *
 * Extends BaseRepository with unified search functionality.
 * Eliminates duplication by providing configurable search methods
 * based on entity-specific configurations.
 *
 * Following SOLID and DRY principles:
 * - Single Responsibility: Handles searchable data access operations
 * - Open/Closed: Extensible for entity-specific search needs
 * - Don't Repeat Yourself: Centralizes search logic from all repositories
 */
class SearchableRepository extends BaseRepository {
  /**
   * Creates a new searchable repository instance
   * @param {mongoose.Model} model - The Mongoose model to operate on
   * @param {Object} options - Repository configuration options
   */
  constructor(model, options = {}) {
    super(model, options);

    // Initialize search query builder
    this.searchQueryBuilder = new UnifiedSearchQueryBuilder();

    // Determine entity type from model name or explicit option
    this.entityType = options.entityType || model.modelName.toLowerCase();

    // Validate entity type has search configuration
    if (!SEARCH_CONFIGS[this.entityType]) {
      throw new Error(`No search configuration found for entity type: ${this.entityType}`);
    }

    this.searchConfig = SEARCH_CONFIGS[this.entityType];
  }

  /**
   * Advanced search with unified functionality
   * Replaces duplicated searchAdvanced methods across repositories
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Promise<Array>} - Search results
   */
  async searchAdvanced(query, filters = {}) {
    try {
      const config = this.searchConfig;

      // Choose search strategy based on configuration
      if (config.scoring?.algorithm === 'aggregation') {
        return await this._performAggregationSearch(query, filters);
      }
        return await this._performSimpleSearch(query, filters);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Performs aggregation-based search (Sets, Products)
   * @private
   */
  async _performAggregationSearch(query, filters) {
    const pipeline = this.searchQueryBuilder.buildAggregationPipeline(
      this.entityType,
      query,
      filters
    );

    // Apply limit if specified
    if (filters.limit) {
      pipeline.push({ $limit: filters.limit });
    }

    return await this.aggregate(pipeline);
  }

  /**
   * Performs simple populate-based search (Cards, SetProducts)
   * @private
   */
  async _performSimpleSearch(query, filters) {
    const {
      searchConditions,
      populateConfig,
      needsPopulateFiltering
    } = this.searchQueryBuilder.buildSimpleSearchConditions(
      this.entityType,
      query,
      filters
    );

    // Build mongoose query
    let mongooseQuery = this.model.find(searchConditions);

    // Apply population if configured
    if (populateConfig) {
      mongooseQuery = mongooseQuery.populate(populateConfig);
    }

    // Use lean() for better performance
    mongooseQuery = mongooseQuery.lean();

    // Apply sorting
    const sortOptions = query && this.searchConfig.scoring?.querySort
      ? this.searchConfig.scoring.querySort
      : filters.sort || this.options.defaultSort;

    mongooseQuery = mongooseQuery.sort(sortOptions);

    // Apply limit
    if (filters.limit) {
      mongooseQuery = mongooseQuery.limit(filters.limit);
    }

    const results = await mongooseQuery;

    // Filter out results where populate didn't match (for conditional population)
    let filteredResults = results;

    if (needsPopulateFiltering) {
      filteredResults = results.filter(item => {
        // If populate filters were applied and populate didn't match, populated field will be null
        const populatedField = populateConfig.path.replace('Id', '');

        return item[populatedField] !== null;
      });
    }

    // Apply client-side scoring if configured
    if (query && this.searchConfig.scoring?.algorithm === 'cardSpecific') {
      return this.searchQueryBuilder.buildClientSideScoring(
        this.entityType,
        filteredResults,
        query
      );
    }

    return filteredResults;
  }

  /**
   * Gets entity suggestions for autocomplete
   * Replaces duplicated getSuggestions methods across repositories
   * @param {string} query - Search query
   * @param {Object} options - Options
   * @returns {Promise<Array>} - Entity suggestions
   */
  async getSuggestions(query, options = {}) {
    try {
      const results = await this.searchAdvanced(query, {
        limit: options.limit || 10,
      });

      return this.searchQueryBuilder.formatSuggestions(this.entityType, results);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validates search configuration
   * Ensures entity type has proper search configuration
   * @returns {boolean} - True if configuration is valid
   */
  validateSearchConfiguration() {
    const config = this.searchConfig;

    // Check required configuration properties
    if (!config.fields || !Array.isArray(config.fields) || config.fields.length === 0) {
      throw new Error(`Entity type ${this.entityType} must have searchable fields configured`);
    }

    if (!config.scoring || !config.scoring.algorithm) {
      throw new Error(`Entity type ${this.entityType} must have scoring algorithm configured`);
    }

    if (!config.suggestions) {
      throw new Error(`Entity type ${this.entityType} must have suggestions configuration`);
    }

    return true;
  }

  /**
   * Gets search configuration for debugging
   * @returns {Object} - Search configuration
   */
  getSearchConfiguration() {
    return {
      entityType: this.entityType,
      config: this.searchConfig,
      hasAggregationSearch: this.searchConfig.scoring?.algorithm === 'aggregation',
      hasClientSideScoring: this.searchConfig.scoring?.algorithm === 'cardSpecific',
      hasPopulation: Boolean(this.searchConfig.population),
      searchableFields: this.searchConfig.fields?.map(f => f.name) || []
    };
  }

  /**
   * Searches with basic text matching
   * For simple search needs (like SetProductRepository.search)
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} - Search results
   */
  async search(query, options = {}) {
    try {
      if (!query || !query.trim()) {
        return await this.findAll({}, options);
      }

      // Use first configured field for simple search
      const primaryField = this.searchConfig.fields[0];

      if (!primaryField) {
        throw new Error(`No searchable fields configured for ${this.entityType}`);
      }

      const searchConditions = {
        [primaryField.name]: { $regex: query, $options: 'i' }
      };

      return await this.findAll(searchConditions, options);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Counts search results without returning data
   * Useful for pagination and metrics
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Promise<number>} - Count of matching results
   */
  async countSearchResults(query, filters = {}) {
    try {
      const config = this.searchConfig;

      if (config.scoring?.algorithm === 'aggregation') {
        // For aggregation searches, we need to build the pipeline and count
        const pipeline = this.searchQueryBuilder.buildAggregationPipeline(
          this.entityType,
          query,
          filters
        );

        // Replace sort and add count
        pipeline.pop(); // Remove sort stage
        pipeline.push({ $count: 'total' });

        const result = await this.aggregate(pipeline);

        return result[0]?.total || 0;
      }
        // For simple searches, use regular count
        const {
          searchConditions,
          populateConfig,
          needsPopulateFiltering
        } = this.searchQueryBuilder.buildSimpleSearchConditions(
          this.entityType,
          query,
          filters
        );

        // If we need populate filtering, we can't use simple count
        if (needsPopulateFiltering) {
          const results = await this._performSimpleSearch(query, filters);

          return results.length;
        }
          return await this.count(searchConditions);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Performs search with pagination
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @param {Object} paginationOptions - Pagination options
   * @returns {Promise<Object>} - Paginated search results
   */
  async searchWithPagination(query, filters = {}, paginationOptions = {}) {
    try {
      const { page = 1, limit = this.options.defaultLimit } = paginationOptions;
      const skip = (page - 1) * limit;

      // Get total count
      const totalCount = await this.countSearchResults(query, filters);

      // Get paginated results
      const results = await this.searchAdvanced(query, {
        ...filters,
        limit,
        skip
      });

      const totalPages = Math.ceil(totalCount / limit);

      return {
        data: results,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      throw error;
    }
  }
}

export default SearchableRepository;
