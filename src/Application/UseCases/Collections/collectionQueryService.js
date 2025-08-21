/**
 * Collection Query Service
 *
 * Replaces the duplicated query services:
 * - psaGradedCardQueryService.js (56 lines)
 * - rawCardQueryService.js (49 lines)
 * Total: 105 lines → ~50 lines (50% reduction)
 */

import { applyPostPopulationFilters, buildBaseSoldQuery   } from '@/Infrastructure/Utilities/cardQueryHelpers.js';
/**
 * Query operations for collection models
 */
class CollectionQueryService {
  constructor(Model, entityType) {
    this.Model = Model;
    this.entityType = entityType;
  }

  /**
   * Build query based on filters and entity type
   */
  buildQuery(filters) {
    const query = buildBaseSoldQuery(filters);

    // Entity-specific query building
    switch (this.entityType) {
      case 'PsaGradedCard':
        if (filters.grade) {
          query.grade = filters.grade;
        }
        break;
      case 'RawCard':
        if (filters.condition) {
          query.condition = filters.condition;
        }
        break;
    }

    return query;
  }

  /**
   * Find all entities with filters
   */
  async findAll(filters) {
    const query = this.buildQuery(filters);

    const results = await this.Model.find(query).populate({
      path: 'cardId',
      select: 'cardName cardNumber variety grades',
      populate: {
        path: 'setId',
        model: 'Set',
        select: 'setName year totalCardsInSet totalPsaPopulation'
      },
    });

    return applyPostPopulationFilters(results, filters);
  }

  /**
   * Find entity by ID
   */
  async findById(id) {
    // Consistent ObjectId validation
    if (!id || typeof id !== 'string' || !(/^[a-f\d]{24}$/i).test(id)) {
      throw new Error('Invalid ObjectId format');
    }

    const entity = await this.Model.findById(id).populate({
      path: 'cardId',
      select: 'cardName cardNumber variety grades',
      populate: {
        path: 'setId',
        model: 'Set',
        select: 'setName year totalCardsInSet totalPsaPopulation'
      },
    });

    if (!entity) {
      throw new Error(`${this.entityType} not found`);
    }

    return entity;
  }
}

export default CollectionQueryService;
