import SearchableRepository from '@/system/database/SearchableRepository.js';
import Set from '@/pokemon/sets/Set.js';
import { ValidationError } from '@/system/errors/ErrorTypes.js';
/**
 * Set Repository
 *
 * Specialized repository for Set model operations.
 * Extends SearchableRepository with unified search functionality.
 *
 * IMPORTANT: This handles the Set model (official Pokemon card sets)
 * which is different from the Product model's SetProduct relationship.
 *
 * REFACTORED: Now uses unified search abstraction, eliminating ~180 lines of duplicated search code.
 */
class SetRepository extends SearchableRepository {
  /**
   * Creates a new set repository instance
   */
  constructor() {
    super(Set, {
      entityType: 'sets', // Use search configuration key
      defaultSort: { year: -1, setName: 1 }
    });
  }

  // searchAdvanced method now inherited from SearchableRepository
  // Eliminates ~180 lines of duplicated search logic including complex aggregation pipeline
  // All original functionality preserved through search configuration

  // getSuggestions method now inherited from SearchableRepository
  // Eliminates ~35 lines of duplicated suggestion formatting logic
  // All original functionality preserved through search configuration

}

export default SetRepository;
