/**
 * Unified Search Query Builder Service
 *
 * Single Responsibility: Constructs MongoDB queries and aggregation pipelines
 * for unified search functionality across all entity types.
 *
 * Eliminates duplication by providing reusable query building patterns
 * based on entity-specific configurations.
 */

import { SEARCH_CONFIGS, FILTER_OPERATORS } from '@/search/services/searchConfigurations.js';
class UnifiedSearchQueryBuilder {
  constructor() {
    this.configs = SEARCH_CONFIGS;
    this.operators = FILTER_OPERATORS;
  }

  /**
   * Builds search conditions for simple populate-based queries (Cards approach)
   * @param {string} entityType - Entity type (cards, setProducts)
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Object} Search conditions and populate options
   */
  buildSimpleSearchConditions(entityType, query, filters = {}) {
    const config = this.configs[entityType];

    if (!config) {
      throw new Error(`No search configuration found for entity type: ${entityType}`);
    }

    const searchConditions = {};
    let populateConfig = null;

    // Build text search conditions
    if (query && config.fields) {
      const textSearchConditions = config.fields.map(field => ({
        [field.name]: this.operators.regex(query)
      }));

      if (textSearchConditions.length > 0) {
        searchConditions.$or = textSearchConditions;
      }
    }

    // Build direct field filters
    if (config.filters?.direct) {
      config.filters.direct.forEach(field => {
        if (filters[field] !== undefined) {
          searchConditions[field] = filters[field];
        }
      });
    }

    // Build regex filters
    if (config.filters?.regex) {
      config.filters.regex.forEach(field => {
        if (filters[field] !== undefined) {
          searchConditions[field] = this.operators.regex(filters[field]);
        }
      });
    }

    // Build range filters
    if (config.filters?.range) {
      config.filters.range.forEach(field => {
        if (field === 'minGradedPopulation' && filters.minGradedPopulation) {
          searchConditions['grades.grade_total'] = this.operators.gte(filters.minGradedPopulation);
        }
      });
    }

    // Handle grade-specific filters
    if (config.filters?.gradeSpecific) {
      if (filters.grade && filters.minGradeCount !== undefined) {
        const gradeField = `grades.grade_${filters.grade}`;

        searchConditions[gradeField] = this.operators.gte(filters.minGradeCount || 1);
      }
    }

    // Build populate configuration
    if (config.population) {
      populateConfig = {
        path: config.population.path,
        model: config.population.model
      };

      // Add conditional matching for populate
      if (config.population.conditionalFields) {
        const populateMatch = {};
        let hasPopulateFilter = false;

        config.population.conditionalFields.forEach(field => {
          if (filters[field] !== undefined) {
            if (field === 'setName') {
              populateMatch.setName = this.operators.regex(filters[field]);
            } else if (field === 'year') {
              populateMatch.year = filters[field];
            }
            hasPopulateFilter = true;
          }
        });

        if (hasPopulateFilter) {
          populateConfig.match = populateMatch;
        }
      }
    }

    return {
      searchConditions,
      populateConfig,
      needsPopulateFiltering: Boolean(populateConfig?.match)
    };
  }

  /**
   * Builds aggregation pipeline for complex search queries (Sets, Products approach)
   * @param {string} entityType - Entity type (sets, products)
   * @param {string} query - Search query
   * @param {Object} filters - Search filters
   * @returns {Array} MongoDB aggregation pipeline
   */
  buildAggregationPipeline(entityType, query, filters = {}) {
    const config = this.configs[entityType];

    if (!config) {
      throw new Error(`No search configuration found for entity type: ${entityType}`);
    }

    const pipeline = [];

    // Add computed fields if needed (e.g., priceNumeric for products)
    if (config.filters?.computed?.includes('priceNumeric')) {
      pipeline.push({
        $addFields: {
          priceNumeric: { $toDouble: '$price' }
        }
      });
    }

    // Add population stage if needed
    if (config.population) {
      const lookupStage = {
        $lookup: {
          from: `${config.population.model.toLowerCase()}s`, // setproducts
          localField: config.population.path,
          foreignField: '_id',
          as: config.population.alias || config.population.path.replace('Id', '')
        }
      };

      pipeline.push(lookupStage);

      // Unwind populated documents
      pipeline.push({
        $unwind: `$${config.population.alias || config.population.path.replace('Id', '')}`
      });
    }

    // Build match conditions
    const matchConditions = this._buildMatchConditions(config, query, filters);

    if (matchConditions.length > 0) {
      pipeline.push({
        $match: matchConditions.length > 1 ? { $and: matchConditions } : matchConditions[0]
      });
    }

    // Add scoring stage if query provided
    if (query && config.scoring?.algorithm === 'aggregation') {
      const scoringStage = this._buildScoringStage(config, query);

      pipeline.push(scoringStage);
    }

    // Add sorting stage
    const sortStage = query && config.scoring?.querySort
      ? { $sort: config.scoring.querySort }
      : { $sort: config.scoring?.defaultSort || { _id: 1 } };

    pipeline.push(sortStage);

    return pipeline;
  }

  /**
   * Builds match conditions for aggregation pipeline
   * @private
   */
  _buildMatchConditions(config, query, filters) {
    const matchConditions = [];

    // Text search across configured fields
    if (query) {
      const textConditions = [];

      config.fields?.forEach(field => {
        textConditions.push({ [field.name]: this.operators.regex(query) });
      });

      // Add search fields from population
      if (config.population?.searchFields) {
        config.population.searchFields.forEach(field => {
          textConditions.push({ [field]: this.operators.regex(query) });
        });
      }

      if (textConditions.length > 0) {
        matchConditions.push({ $or: textConditions });
      }
    }

    // Direct field filters
    if (config.filters?.direct) {
      config.filters.direct.forEach(field => {
        if (filters[field] !== undefined) {
          if (field === 'category') {
            matchConditions.push({ [field]: this.operators.regex(filters[field]) });
          } else {
            matchConditions.push({ [field]: filters[field] });
          }
        }
      });
    }

    // Range filters
    if (config.filters?.range) {
      config.filters.range.forEach(field => {
        if (field === 'minGradedPopulation' && filters.minGradedPopulation) {
          matchConditions.push({ 'total_grades.total_graded': this.operators.gte(filters.minGradedPopulation) });
        } else if (field === 'minCardCount' && filters.minCardCount) {
          matchConditions.push({ totalCardsInSet: this.operators.gte(filters.minCardCount) });
        } else if (field === 'minGrade10Count' && filters.minGrade10Count) {
          matchConditions.push({ 'total_grades.grade_10': this.operators.gte(filters.minGrade10Count) });
        } else if (field === 'minAvailable' && filters.minAvailable) {
          matchConditions.push({ available: this.operators.gte(filters.minAvailable) });
        } else if (field === 'priceRange' && filters.priceRange) {
          matchConditions.push({
            priceNumeric: {
              $gte: filters.priceRange.min,
              $lte: filters.priceRange.max
            }
          });
        }
      });
    }

    // Range field filters (yearRange, gradedPopulationRange, etc.)
    if (config.filters?.rangeFields) {
      config.filters.rangeFields.forEach(rangeField => {
        if (filters[rangeField]) {
          const range = filters[rangeField];

          if (rangeField === 'yearRange') {
            matchConditions.push({
              year: { $gte: range.start, $lte: range.end }
            });
          } else if (rangeField === 'gradedPopulationRange') {
            matchConditions.push({
              'total_grades.total_graded': { $gte: range.min, $lte: range.max }
            });
          } else if (rangeField === 'cardCountRange') {
            matchConditions.push({
              totalCardsInSet: { $gte: range.min, $lte: range.max }
            });
          }
        }
      });
    }

    // Boolean filters
    if (config.filters?.boolean) {
      config.filters.boolean.forEach(field => {
        if (field === 'availableOnly' && filters.availableOnly) {
          matchConditions.push({ available: this.operators.gt(0) });
        }
      });
    }

    return matchConditions;
  }

  /**
   * Builds scoring stage for aggregation pipeline
   * @private
   */
  _buildScoringStage(config, query) {
    const scoreConditions = [];

    if (config.scoring?.stages) {
      config.scoring.stages.forEach(stage => {
        const condition = this._buildScoreCondition(stage, query);

        if (condition) {
          scoreConditions.push(condition);
        }
      });
    }

    return {
      $addFields: {
        score: {
          $add: scoreConditions
        }
      }
    };
  }

  /**
   * Builds individual score condition
   * @private
   */
  _buildScoreCondition(stage, query) {
    switch (stage.type) {
      case 'exactMatch':
        return {
          $cond: {
            if: { $eq: [{ $toLower: `$${stage.field}` }, query.toLowerCase()] },
            then: stage.score,
            else: 0
          }
        };

      case 'startsWith':
        return {
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${stage.field}` },
                regex: `^${query.toLowerCase()}`
              }
            },
            then: stage.score,
            else: 0
          }
        };

      case 'contains':
        return {
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${stage.field}` },
                regex: query.toLowerCase()
              }
            },
            then: stage.score,
            else: 0
          }
        };

      case 'wordBoundary':
        return {
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${stage.field}` },
                regex: `\\b${query.toLowerCase()}\\b`
              }
            },
            then: stage.score,
            else: 0
          }
        };

      case 'popularity':
        return {
          $cond: {
            if: { $gt: [`$${stage.field}`, 0] },
            then: { $divide: [`$${stage.field}`, stage.divisor] },
            else: 0
          }
        };

      case 'lengthPenalty':
        return {
          $cond: {
            if: {
              $regexMatch: {
                input: { $toLower: `$${stage.field}` },
                regex: query.toLowerCase()
              }
            },
            then: { $divide: [stage.base, { $strLenCP: `$${stage.field}` }] },
            else: 0
          }
        };

      case 'priceScore':
        return {
          $cond: {
            if: { $gt: [`$${stage.field}`, 0] },
            then: { $divide: [stage.base, `$${stage.field}`] },
            else: 0
          }
        };

      case 'availabilityScore':
        return {
          $cond: {
            if: { $gt: [`$${stage.field}`, 0] },
            then: { $divide: [`$${stage.field}`, stage.divisor] },
            else: 0
          }
        };

      default:
        return null;
    }
  }

  /**
   * Builds client-side scoring logic for simple searches
   * @param {string} entityType - Entity type
   * @param {Array} results - Search results
   * @param {string} query - Search query
   * @returns {Array} Scored and sorted results
   */
  buildClientSideScoring(entityType, results, query) {
    const config = this.configs[entityType];

    if (!config || !query) {
      return results;
    }

    const lowerQuery = query.toLowerCase();

    return results
      .map(item => {
        let score = 0;

        // Apply field-based scoring
        config.fields?.forEach(field => {
          const fieldValue = item[field.name];

          if (fieldValue) {
            const lowerFieldValue = fieldValue.toLowerCase();

            if (lowerFieldValue === lowerQuery) {
              score += field.exactMatchBonus || 100;
            } else if (lowerFieldValue.startsWith(lowerQuery)) {
              score += Math.floor((field.exactMatchBonus || 100) * 0.8);
            } else if (lowerFieldValue.includes(lowerQuery)) {
              score += Math.floor((field.exactMatchBonus || 100) * 0.6);
            }
          }
        });

        // Apply bonus scoring from configuration
        if (config.scoring?.bonusFields) {
          config.scoring.bonusFields.forEach(bonus => {
            const bonusValue = this._getNestedValue(item, bonus.field);

            if (bonusValue > 0) {
              score += Math.min(bonusValue / bonus.divisor, bonus.max);
            }
          });
        }

        return { ...item, score };
      })
      .sort((a, b) => {
        // Primary sort by score
        if (b.score !== a.score) return b.score - a.score;

        // Secondary sort by configuration
        if (config.scoring?.querySort) {
          const sortKeys = Object.keys(config.scoring.querySort);

          for (const key of sortKeys) {
            if (key === 'score') continue;

            const aVal = this._getNestedValue(a, key) || 0;
            const bVal = this._getNestedValue(b, key) || 0;
            const direction = config.scoring.querySort[key];

            if (aVal !== bVal) {
              return direction === 1 ? aVal - bVal : bVal - aVal;
            }
          }
        }

        return 0;
      });
  }

  /**
   * Gets nested value from object using dot notation
   * @private
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key] !== undefined ? current[key] : null, obj);
  }

  /**
   * Formats suggestions based on entity configuration
   * @param {string} entityType - Entity type
   * @param {Array} results - Search results
   * @returns {Array} Formatted suggestions
   */
  formatSuggestions(entityType, results) {
    const config = this.configs[entityType];

    if (!config?.suggestions) {
      return results;
    }

    return results.map(item => {
      const suggestion = {
        id: item._id,
        text: this._getNestedValue(item, config.suggestions.primaryText),
        secondaryText: config.suggestions.secondaryText
          ? (this._getNestedValue(item, config.suggestions.secondaryText) || config.suggestions.defaultSecondary || null)
          : null,
        metadata: {}
      };

      // Build metadata
      if (config.suggestions.metadata) {
        config.suggestions.metadata.forEach(field => {
          if (field === 'grades' && item.grades) {
            suggestion.metadata.grades = {
              grade_10: item.grades.grade_10,
              grade_9: item.grades.grade_9,
              grade_8: item.grades.grade_8,
              grade_total: item.grades.grade_total
            };
          } else if (field === 'totalGraded') {
            suggestion.metadata.totalGraded = item.grades?.grade_total || item.total_grades?.total_graded;
          } else if (field === 'totalCards') {
            suggestion.metadata.totalCards = item.totalCardsInSet;
          } else if (field === 'era') {
            suggestion.metadata.era = item.year || 'Unknown';
          } else if (field === 'isAvailable') {
            suggestion.metadata.isAvailable = item.available > 0;
          } else {
            const value = this._getNestedValue(item, field);

            if (value !== null && value !== undefined) {
              suggestion.metadata[field] = value;
            }
          }
        });
      }

      return suggestion;
    });
  }

  // Legacy static methods for backward compatibility with existing SearchQueryBuilder usage

  /**
   * Build MongoDB text search query with regex patterns
   * @deprecated Use buildSimpleSearchConditions instead
   * @static
   */
  static buildTextSearchQuery(query, searchFields) {
    if (!query || !query.trim()) {
      return {};
    }

    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    const regexConditions = [];

    // Create regex patterns for each search term
    searchTerms.forEach(term => {
      if (term.length === 0) return;

      // Escape special regex characters
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTerm, 'i');

      if (searchFields && searchFields.length > 0) {
        // Search in specific fields
        const fieldConditions = searchFields.map(field => ({
          [field]: { $regex: regex }
        }));

        regexConditions.push({ $or: fieldConditions });
      } else {
        // Generic search - will be customized by caller
        regexConditions.push({ $regex: regex });
      }
    });

    // Combine all conditions with AND logic
    if (regexConditions.length > 0) {
      return regexConditions.length === 1 ? regexConditions[0] : { $and: regexConditions };
    }

    return {};
  }
}

export default UnifiedSearchQueryBuilder;
