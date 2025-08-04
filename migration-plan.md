# Pokemon Collection Backend Data Migration Plan

## Executive Summary

This document outlines the comprehensive plan for migrating from the current Pokemon card data structure to a new, improved format. The migration represents a significant architectural evolution from a compound key-based system to a normalized model using unique identifiers, which will enhance data integrity, simplify queries, and improve long-term maintainability.

**Migration Scope**: 835 new set files vs 811 current files  
**Estimated Impact**: High strategic value with manageable execution risk  
**Recommended Approach**: Phased migration leveraging existing import infrastructure

## Current vs New Data Structure Analysis

### Current Structure (Legacy)
```javascript
// Set Model (Set.js)
{
  setName: String (unique),
  year: Number,
  setUrl: String,
  totalCardsInSet: Number,
  totalPsaPopulation: Number
}

// Card Model (Card.js)
{
  setId: ObjectId (ref to Set),
  pokemonNumber: String (optional),
  cardName: String,
  baseName: String,
  variety: String,
  psaGrades: {
    psa_1: Number, psa_2: Number, ..., psa_10: Number
  },
  psaTotalGradedForCard: Number
}

// Data Organization
/data/sets/
  ├── 2019/
  │   ├── 2019_all_sets.json
  │   └── pokemon_japanese_sun_moon_alter_genesis.json
  └── 2014/
      └── pokemon_xy.json
```

### New Structure (Target)
```javascript
// New Set Structure
{
  "set_details": {
    "set_info": {
      "name": String,
      "year": String,
      "url": String,
      "total_cards": Number,
      "unique_set_id": Number  // NEW
    },
    "total_grades": {  // NEW - Set-level aggregation
      "grade_1": Number, ..., "grade_10": Number,
      "total_graded": Number
    },
    "cards": [
      {
        "unique_pokemon_id": Number,  // NEW
        "name": String,
        "variety": String,
        "card_number": String,  // Renamed from pokemonNumber
        "grades": {  // Renamed from psaGrades
          "grade_1": Number, ..., "grade_10": Number,
          "grade_total": Number
        }
      }
    ]
  }
}

// Data Organization
/data/new_sets/
  └── set-details/
      ├── 2019-pokemon-japanese-sun-moon-alter-genesis-details.json
      └── 2014-pokemon-xy-details.json
```

## Critical Migration Challenges

### 1. **HIGH RISK**: Identifier System Transformation
**Challenge**: Migration from compound keys to unique integer IDs
- Current: Uses `spec_id` and compound keys for identification
- New: Uses `unique_set_id` and `unique_pokemon_id`

**Risk**: Data loss if mapping fails between old and new identifiers

**Solution**: Implement a "Transitional Schema" approach
```javascript
// Updated Mongoose schemas (transition period)
const setSchema = new mongoose.Schema({
  // Existing fields
  setName: { type: String, required: true, unique: true },
  year: { type: Number, required: true },
  setUrl: { type: String, required: true },
  totalCardsInSet: { type: Number, required: true },
  totalPsaPopulation: { type: Number, required: true },
  
  // New fields (optional during migration)
  unique_set_id: { type: Number, required: false },
  total_grades: {
    grade_1: { type: Number, default: 0 },
    grade_2: { type: Number, default: 0 },
    // ... grade_3 through grade_10
    grade_10: { type: Number, default: 0 },
    total_graded: { type: Number, default: 0 }
  }
});

const cardSchema = new mongoose.Schema({
  // Existing fields
  setId: { type: Schema.Types.ObjectId, ref: 'Set', required: true },
  pokemonNumber: { type: String, required: false, default: '' },
  cardName: { type: String, required: true },
  baseName: { type: String, required: true },
  variety: { type: String, default: '' },
  psaGrades: {
    psa_1: { type: Number, default: 0 },
    // ... psa_2 through psa_10
    psa_10: { type: Number, default: 0 }
  },
  psaTotalGradedForCard: { type: Number, required: true },
  
  // New fields (optional during migration)
  unique_pokemon_id: { type: Number, required: false },
  card_number: { type: String, required: false },
  grades: {
    grade_1: { type: Number, default: 0 },
    // ... grade_2 through grade_10
    grade_10: { type: Number, default: 0 },
    grade_total: { type: Number, default: 0 }
  }
});
```

### 2. **MEDIUM RISK**: Field Name Changes
**Challenge**: Inconsistent field naming between old and new structures
- `psaGrades` → `grades`
- `pokemonNumber` → `card_number`
- `psa_X` → `grade_X`

**Solution**: API Abstraction Layer
```javascript
// Field mapping utility
const FIELD_MAPPINGS = {
  // Set mappings
  setName: 'name',
  totalCardsInSet: 'total_cards',
  totalPsaPopulation: 'total_graded',
  
  // Card mappings
  pokemonNumber: 'card_number',
  cardName: 'name',
  psaGrades: 'grades',
  psaTotalGradedForCard: 'grade_total',
  
  // Grade mappings
  psa_1: 'grade_1',
  psa_2: 'grade_2',
  // ... through psa_10: 'grade_10'
};

// API transformation layer
const transformCardForAPI = (card) => {
  return {
    id: card._id,
    unique_pokemon_id: card.unique_pokemon_id || null,
    name: card.cardName,
    variety: card.variety,
    card_number: card.card_number || card.pokemonNumber,
    grades: card.grades || transformPsaGrades(card.psaGrades),
    grade_total: card.grades?.grade_total || card.psaTotalGradedForCard
  };
};
```

### 3. **MEDIUM RISK**: Data Aggregation Model Change
**Challenge**: Set-level totals moved from special "TOTAL POPULATION" cards to dedicated set fields

**Solution**: Aggregation transformation during migration
```javascript
// Migration logic for set-level totals
const migrateSetTotals = (newSetData, existingSet) => {
  const { total_grades } = newSetData.set_details;
  
  return {
    ...existingSet,
    total_grades: {
      grade_1: total_grades.grade_1,
      grade_2: total_grades.grade_2,
      // ... through grade_10
      grade_10: total_grades.grade_10,
      total_graded: total_grades.total_graded
    }
  };
};
```

## Migration Strategy

### Phase 1: Preparation & Schema Updates
**Duration**: 1-2 days  
**Risk Level**: Low

1. **Update Mongoose Models**
   - Add new optional fields to Set.js and Card.js
   - Maintain backward compatibility
   - Deploy schema changes to staging/production

2. **Create Migration Infrastructure**
   ```javascript
   // services/migrationService.js
   class MigrationService {
     constructor() {
       this.logger = require('../utils/Logger');
       this.validator = require('../utils/ValidatorFactory');
     }
     
     async migrateSet(newSetData) {
       // Implementation for set migration
     }
     
     async migrateCard(newCardData, setId) {
       // Implementation for card migration
     }
     
     async validateMigration(originalData, migratedData) {
       // Validation logic
     }
   }
   ```

3. **Field Mapping Utilities**
   ```javascript
   // utils/fieldMapper.js
   class FieldMapper {
     static mapSetFields(newSetData) {
       // Map new set structure to current schema
     }
     
     static mapCardFields(newCardData) {
       // Map new card structure to current schema
     }
     
     static createUniqueIdMapping(oldData, newData) {
       // Create mapping between old spec_id and new unique_pokemon_id
     }
   }
   ```

### Phase 2: Data Migration Execution
**Duration**: 2-3 days  
**Risk Level**: High (Critical data operation)

1. **Pre-Migration Validation**
   - Complete database backup
   - Validate new data integrity
   - Test migration on staging environment
   - Prepare rollback procedures

2. **Migration Process**
   ```javascript
   // Migration execution flow
   const executeMigration = async () => {
     const migrationService = new MigrationService();
     const newSetFiles = await getAllNewSetFiles();
     
     for (const setFile of newSetFiles) {
       try {
         // 1. Load new set data
         const newSetData = JSON.parse(fs.readFileSync(setFile));
         
         // 2. Find existing set by compound key lookup
         const existingSet = await Set.findOne({
           setName: normalizeSetName(newSetData.set_details.set_info.name),
           year: parseInt(newSetData.set_details.set_info.year)
         });
         
         if (existingSet) {
           // 3. Update existing set with new fields
           await migrationService.migrateSet(existingSet, newSetData);
           
           // 4. Migrate cards
           for (const newCard of newSetData.set_details.cards) {
             await migrationService.migrateCard(newCard, existingSet._id);
           }
         } else {
           // 5. Create new set if not found
           await migrationService.createNewSet(newSetData);
         }
         
         // 6. Validation
         await migrationService.validateMigration(existingSet, newSetData);
         
       } catch (error) {
         Logger.operationError('MIGRATION_ERROR', `Failed to migrate ${setFile}`, error);
         // Continue or halt based on error severity
       }
     }
   };
   ```

3. **ID Mapping Strategy**
   ```javascript
   // Critical: Map old identifiers to new ones
   const createIdMapping = async (oldCard, newCard) => {
     const mapping = {
       old_spec_id: oldCard.spec_id,
       new_unique_pokemon_id: newCard.unique_pokemon_id,
       object_id: oldCard._id, // Preserve MongoDB ObjectId
       card_name: newCard.name,
       set_id: oldCard.setId
     };
     
     // Store mapping for validation and rollback
     await IdMapping.create(mapping);
     return mapping;
   };
   ```

### Phase 3: Validation & Testing
**Duration**: 1-2 days  
**Risk Level**: Medium

1. **Data Integrity Validation**
   ```javascript
   // Comprehensive validation checks
   const validateMigration = async () => {
     // 1. Count validation
     const oldSetCount = await Set.countDocuments({ unique_set_id: null });
     const newSetCount = await Set.countDocuments({ unique_set_id: { $ne: null } });
     
     // 2. Referential integrity
     const orphanedCards = await Card.find({
       setId: { $exists: true },
       unique_pokemon_id: null
     });
     
     // 3. Data consistency
     const inconsistentGrades = await Card.find({
       $expr: {
         $ne: ['$psaTotalGradedForCard', '$grades.grade_total']
       }
     });
     
     return {
       oldSetCount,
       newSetCount,
       orphanedCards: orphanedCards.length,
       inconsistentGrades: inconsistentGrades.length
     };
   };
   ```

2. **API Testing**
   - Test all existing endpoints with new data structure
   - Validate API response format consistency
   - Performance benchmark comparison

### Phase 4: API Abstraction & Cleanup
**Duration**: 2-3 days  
**Risk Level**: Low

1. **Implement API Abstraction Layer**
   ```javascript
   // controllers/setsController.js - Updated
   const getSetsWithPagination = asyncHandler(async (req, res) => {
     const sets = await Set.find(query).lean();
     
     // Transform to consistent API format
     const transformedSets = sets.map(set => ({
       id: set._id,
       name: set.setName,
       year: set.year,
       url: set.setUrl,
       total_cards: set.totalCardsInSet,
       total_graded: set.total_grades?.total_graded || set.totalPsaPopulation,
       unique_set_id: set.unique_set_id
     }));
     
     res.status(200).json(transformedSets);
   });
   ```

2. **Gradual Field Migration**
   - Update business logic to use new fields
   - Maintain dual-field support during transition
   - Monitor for any remaining old field usage

### Phase 5: Final Cleanup
**Duration**: 1 day  
**Risk Level**: Low

1. **Remove Deprecated Fields**
   ```javascript
   // Final cleanup script (run after full validation)
   const removeDeprecatedFields = async () => {
     await Set.updateMany({}, {
       $unset: {
         totalCardsInSet: 1,
         totalPsaPopulation: 1
       }
     });
     
     await Card.updateMany({}, {
       $unset: {
         pokemonNumber: 1,
         psaGrades: 1,
         psaTotalGradedForCard: 1
       }
     });
   };
   ```

2. **Update Mongoose Schemas**
   - Remove deprecated fields from schema definitions
   - Update indexes as needed
   - Deploy final schema changes

## Risk Mitigation & Rollback Plan

### Pre-Migration Safeguards
1. **Complete Database Backup**
   ```bash
   # MongoDB backup command
   mongodump --host localhost:27017 --db pokemon_collection --out ./backup_pre_migration_$(date +%Y%m%d_%H%M%S)
   ```

2. **Staging Environment Testing**
   - Execute full migration on staging with production data copy
   - Performance testing with new data structure
   - API compatibility validation

3. **Migration Monitoring**
   ```javascript
   // Monitor migration progress
   const migrationMetrics = {
     totalSetsToMigrate: 835,
     setsProcessed: 0,
     cardsProcessed: 0,
     errors: [],
     startTime: new Date(),
     estimatedCompletion: null
   };
   ```

### Rollback Procedures
1. **Immediate Rollback** (if critical errors occur)
   ```javascript
   const rollbackMigration = async () => {
     // 1. Stop migration process
     migrationService.stop();
     
     // 2. Restore from backup
     // mongorestore --host localhost:27017 --db pokemon_collection ./backup_pre_migration_TIMESTAMP
     
     // 3. Clear new fields
     await Set.updateMany({}, {
       $unset: { unique_set_id: 1, total_grades: 1 }
     });
     
     await Card.updateMany({}, {
       $unset: { unique_pokemon_id: 1, card_number: 1, grades: 1 }
     });
   };
   ```

2. **Gradual Rollback** (if issues discovered post-migration)
   - Revert API changes first
   - Restore old field usage in business logic
   - Remove new fields after validation

## Performance Considerations

### Expected Improvements
1. **Query Performance**
   - Unique ID lookups vs compound key searches
   - Reduced data duplication
   - Better indexing opportunities

2. **Data Storage**
   - Eliminate duplicate "TOTAL POPULATION" cards
   - More efficient aggregation storage

### Migration Performance
- **Estimated Processing Time**: 2-4 hours for full migration
- **Database Downtime**: Minimize with online migration approach
- **Memory Usage**: Monitor during bulk operations

## Success Criteria

### Technical Success Metrics
- [ ] All 835 new sets successfully migrated
- [ ] Zero data loss (validated through checksums)
- [ ] All existing API endpoints function correctly
- [ ] No performance degradation (< 5% slower response times)
- [ ] Referential integrity maintained (PsaGradedCard, RawCard collections)

### Business Success Metrics
- [ ] No user-facing disruption
- [ ] Improved query performance on set/card searches
- [ ] Reduced technical debt in data model
- [ ] Foundation for future enhancements

## Implementation Timeline

| Phase | Duration | Key Milestones |
|-------|----------|----------------|
| **Phase 1: Preparation** | 1-2 days | Schema updates, migration infrastructure |
| **Phase 2: Migration** | 2-3 days | Data migration execution, ID mapping |
| **Phase 3: Validation** | 1-2 days | Integrity checks, API testing |
| **Phase 4: Abstraction** | 2-3 days | API layer, business logic updates |
| **Phase 5: Cleanup** | 1 day | Remove deprecated fields |
| **Total** | **7-11 days** | Complete migration with validation |

## Next Steps

1. **Immediate Actions**
   - [ ] Review and approve migration plan
   - [ ] Set up staging environment with production data copy
   - [ ] Implement transitional schema changes
   - [ ] Create migration service infrastructure

2. **Pre-Migration Checklist**
   - [ ] Complete database backup
   - [ ] Test migration scripts on staging
   - [ ] Prepare monitoring and alerting
   - [ ] Document rollback procedures
   - [ ] Schedule maintenance window

3. **Execution Prerequisites**
   - [ ] All team members trained on migration process
   - [ ] Rollback procedures tested and validated
   - [ ] Monitoring systems in place
   - [ ] Communication plan for stakeholders

---

**Migration Plan Version**: 1.0  
**Last Updated**: 2025-01-08  
**Next Review**: Before execution phase