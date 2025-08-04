# Pokemon Collection Backend - Migration Todo List

## Migration Overview
Migrating from old data structure to new improved format with both `unique_set_id`/`unique_pokemon_id` from source data AND auto-generated MongoDB ObjectIds for maximum flexibility and rebuild capability.

## High Priority Tasks ⚡

### 1. Update Database Models
- [x] **Update Set.js model** - Add new fields while keeping MongoDB ObjectId
  - [x] Add `unique_set_id` (Number, required, unique)
  - [x] Add `total_grades` object (grade_1 through grade_10, total_graded)
  - [x] Keep existing `_id` (auto-generated MongoDB ObjectId)
  - [x] Update indexes for new fields
  - [x] Add validation for new structure

- [x] **Update Card.js model** - Add new fields while keeping MongoDB ObjectId
  - [x] Add `unique_pokemon_id` (Number, required, unique)
  - [x] Add `grades` object (grade_1 through grade_10, grade_total)
  - [x] Add `card_number` field (String)
  - [x] Keep existing `_id` (auto-generated MongoDB ObjectId)
  - [x] Update compound indexes
  - [x] Add validation for new structure

### 2. Core Infrastructure
- [x] **Create field mapping utilities** (`utils/fieldMapper.js`)
  - [x] Map old field names to new field names
  - [x] Handle grade field transformations (psa_X → grade_X)
  - [x] Create reverse mapping for backward compatibility

- [ ] **Update import coordinator** (`utils/importers/importCoordinator.js`)
  - [ ] Add support for new data structure
  - [ ] Handle both old and new formats during transition
  - [ ] Add comprehensive logging for migration process

- [ ] **Create new data importer** (`utils/importers/newSetDataImporter.js`)
  - [ ] Parse new set-details JSON format
  - [ ] Import set-level total_grades
  - [ ] Import cards with new unique_pokemon_id structure
  - [ ] Handle variety and card_number fields correctly

## Medium Priority Tasks 🔄

### 3. Business Logic Updates
- [ ] **Update controllers** (backward compatibility approach)
  - [ ] `controllers/setsController.js` - Support new field names
  - [ ] `controllers/cardsController.js` - Handle new card structure
  - [ ] `controllers/psaGradedCardsController.js` - Update references
  - [ ] `controllers/rawCardsController.js` - Update references

- [ ] **Update search service** (`services/searchService.js`)
  - [ ] Modify search queries for new field names
  - [ ] Update text search indexes
  - [ ] Handle grade filtering with new structure

- [ ] **Update validation utilities** (`utils/validationUtils.js`)
  - [ ] Add validation for unique_set_id and unique_pokemon_id
  - [ ] Validate new grade structure format
  - [ ] Ensure data integrity during import

### 4. Testing & Validation
- [ ] **Test import process**
  - [ ] Import sample sets from new_sets/set-details/
  - [ ] Verify unique_set_id and unique_pokemon_id are properly set
  - [ ] Validate grade data integrity
  - [ ] Test MongoDB ObjectId generation and uniqueness

## Low Priority Tasks 📋

### 5. API & Frontend Integration
- [ ] **Update API endpoints**
  - [ ] Return new field format in responses
  - [ ] Maintain backward compatibility if needed
  - [ ] Update API documentation

## File Structure Reference

```
pokemon-collection-backend/
├── models/
│   ├── Set.js                    ✏️ UPDATE - Add unique_set_id, total_grades
│   └── Card.js                   ✏️ UPDATE - Add unique_pokemon_id, grades, card_number
├── utils/
│   ├── fieldMapper.js            ➕ CREATE - Field mapping utilities
│   ├── validationUtils.js        ✏️ UPDATE - New field validation
│   └── importers/
│       ├── importCoordinator.js  ✏️ UPDATE - Support new format
│       └── newSetDataImporter.js ➕ CREATE - New data importer
├── controllers/
│   ├── setsController.js         ✏️ UPDATE - New field support
│   ├── cardsController.js        ✏️ UPDATE - New card structure
│   ├── psaGradedCardsController.js ✏️ UPDATE - Reference updates
│   └── rawCardsController.js     ✏️ UPDATE - Reference updates
├── services/
│   └── searchService.js          ✏️ UPDATE - New field queries
└── data/
    └── new_sets/
        └── set-details/          📁 SOURCE - New data files (835 sets)
```

## Data Structure Comparison

### NEW Format (Target)
```javascript
// Set Structure
{
  _id: ObjectId("..."),           // MongoDB auto-generated (for rebuilds)
  unique_set_id: 418,             // From source data (required, unique)
  name: "Pokemon Xy",
  year: 2014,
  url: "https://...",
  total_cards: 49,
  total_grades: {
    grade_1: 33, grade_2: 17, ..., grade_10: 741,
    total_graded: 6480
  }
}

// Card Structure  
{
  _id: ObjectId("..."),           // MongoDB auto-generated (for rebuilds)
  unique_pokemon_id: 17827,       // From source data (required, unique)
  setId: ObjectId("..."),         // Reference to Set._id
  name: "Venusaur EX",
  variety: "",
  card_number: "1",
  grades: {
    grade_1: 1, grade_2: 0, ..., grade_10: 40,
    grade_total: 1288
  }
}
```

## Key Benefits of This Approach

✅ **Dual ID System**: Both source unique IDs and MongoDB ObjectIds for maximum flexibility  
✅ **Rebuild Safe**: Can always reconstruct database from source data using unique IDs  
✅ **Referential Integrity**: MongoDB ObjectIds maintain relationships  
✅ **Performance**: Optimized indexes on both ID systems  
✅ **Backward Compatible**: Can support both old and new field names during transition

## Execution Order

1. **Phase 1**: Update models and create utilities (Tasks 1-2)
2. **Phase 2**: Create import infrastructure (Tasks 3-5) 
3. **Phase 3**: Update business logic (Tasks 6-8)
4. **Phase 4**: Test and validate (Task 9)
5. **Phase 5**: API updates (Task 10)

## Progress Tracking

- **High Priority**: 0/5 completed
- **Medium Priority**: 0/4 completed  
- **Low Priority**: 0/1 completed
- **Total Progress**: 0/10 completed (0%)

---
**Last Updated**: 2025-01-08  
**Migration Target**: 835 new set files from `/data/new_sets/set-details/`