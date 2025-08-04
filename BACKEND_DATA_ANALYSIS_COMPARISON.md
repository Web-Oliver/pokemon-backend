# Backend Data Analysis & Migration Comparison Document

## Overview
This document provides a comprehensive comparison between the new JSON data structure in the `new_sets` folder and `Products` categories against the existing Mongoose models. It serves as a reference guide for rebuilding the backend with proper data mapping and migration strategies.

## 1. Set Data Comparison

### New Sets JSON Structure (`data/new_sets/set-details/*.json`)

**Sample Structure from `1999-pokemon-fossil-details.json`:**
```json
{
  "set_details": {
    "set_info": {
      "name": "Pokemon Fossil",
      "year": "1999",
      "url": "https://www.psacard.com/pop/tcg-cards/1999/pokemon-fossil/57617",
      "total_cards": 186,
      "unique_set_id": 18
    },
    "total_grades": {
      "grade_1": 945,
      "grade_2": 1101,
      "grade_3": 2346,
      "grade_4": 5986,
      "grade_5": 17593,
      "grade_6": 27919,
      "grade_7": 42125,
      "grade_8": 75883,
      "grade_9": 96808,
      "grade_10": 35623,
      "total_graded": 306329
    },
    "cards": [
      {
        "unique_pokemon_id": 653,
        "name": "Aerodactyl Holo",
        "variety": "",
        "card_number": "1",
        "grades": { /* grade breakdown */ }
      }
    ]
  }
}
```

### Current Set Model (`models/Set.js`)
```javascript
{
  setName: String (required, unique),
  year: Number (required),
  setUrl: String (required),
  totalCardsInSet: Number (required),
  uniqueSetId: Number (required, unique),
  total_grades: {
    grade_1: Number (default: 0),
    grade_2: Number (default: 0),
    // ... grades 3-10
    total_graded: Number (default: 0)
  }
}
```

### **Mapping Analysis:**
✅ **Direct Mappings:**
- `set_info.name` → `setName`
- `set_info.year` → `year`
- `set_info.url` → `setUrl`
- `set_info.total_cards` → `totalCardsInSet`
- `set_info.unique_set_id` → `uniqueSetId`
- `total_grades` → `total_grades` (perfect 1:1 match)

## 2. Card Data Comparison

### New Sets Card Structure
```json
{
  "unique_pokemon_id": 653,
  "name": "Aerodactyl Holo",
  "variety": "",
  "card_number": "1",
  "grades": {
    "grade_1": 30,
    "grade_2": 35,
    // ... grades 3-10
    "grade_total": 41594
  }
}
```

### Current Card Model (`models/Card.js`)
```javascript
{
  setId: ObjectId (ref: 'Set', required),
  cardName: String (required),
  variety: String (default: ''),
  uniquePokemonId: Number (required, unique),
  uniqueSetId: Number (required),
  cardNumber: String (required),
  grades: {
    grade_1: Number (default: 0),
    // ... grades 2-10
    grade_total: Number (default: 0)
  }
}
```

### **Mapping Analysis:**
✅ **Direct Mappings:**
- `name` → `cardName`
- `variety` → `variety`
- `unique_pokemon_id` → `uniquePokemonId`
- `card_number` → `cardNumber`
- `grades` → `grades` (perfect 1:1 match)

🔄 **Derived Mappings:**
- `unique_set_id` needs to be derived from parent set → `uniqueSetId`
- `setId` needs to be resolved from `uniqueSetId` (MongoDB ObjectId - both fields exist for rebuilding capability)

## 3. Product Data Comparison

### Products JSON Structure (`data/Products/*/category.json`)

**Sample Structure from `Booster-Boxes.json`:**
```json
{
  "metadata": {
    "category": "Booster-Boxes",
    "total_products": 533,
    "last_updated": "2025-08-04T15:22:40.281Z",
    "unique_ids_added": true,
    "id_range": { "start": 401, "end": 933 }
  },
  "products": [
    {
      "uniqueProductId": 401,
      "productName": "Destined Rivals Booster Box",
      "setProductName": "Destined Rivals",
      "available": "619",
      "price": "179,99 €",
      "category": "Booster-Boxes",
      "url": "https://www.cardmarket.com/...",
      "uniqueSetProductId": 95
    }
  ]
}
```

### Current SetProduct Model (`models/SetProduct.js`)
```javascript
{
  setProductName: String (required, unique),
  uniqueSetProductId: Number (required, unique)
}
```

### Current Product Model (`models/Product.js`)
```javascript
{
  setProductId: ObjectId (ref: 'SetProduct', required),
  productName: String (required),
  available: Number (required),
  price: String (required),
  category: String (required, enum: [categories]),
  url: String (required),
  uniqueProductId: Number (required, unique)
}
```

### **Mapping Analysis:**

#### SetProduct Mappings:
✅ **Direct Mappings:**
- `setProductName` → `setProductName` (1:1)
- `uniqueSetProductId` → `uniqueSetProductId` (1:1)

#### Product Mappings:
✅ **Direct Mappings:**
- `productName` → `productName`
- `price` → `price`
- `category` → `category`
- `url` → `url`
- `uniqueProductId` → `uniqueProductId`

🔄 **Data Type Conversions:**
- `available`: String → Number (needs parsing)
- `setProductId`: MongoDB ObjectId resolved from `uniqueSetProductId` (both fields exist for rebuilding capability)

## 4. Collection Item Models Analysis

### SealedProduct Model (`models/SealedProduct.js`)
```javascript
{
  productId: ObjectId (ref: 'Product', required),
  myPrice: Decimal128 (required),
  priceHistory: [priceHistorySchema],
  images: [String],
  dateAdded: Date (default: Date.now),
  sold: Boolean (default: false),
  saleDetails: saleDetailsSchema
}
```

### PsaGradedCard Model (`models/PsaGradedCard.js`)
```javascript
{
  cardId: ObjectId (ref: 'Card', required),
  grade: Number (required),
  myPrice: Decimal128 (required),
  priceHistory: [priceHistorySchema],
  images: [String],
  dateAdded: Date (default: Date.now),
  sold: Boolean (default: false),
  saleDetails: saleDetailsSchema
}
```

### RawCard Model (`models/RawCard.js`)
```javascript
{
  cardId: ObjectId (ref: 'Card', required),
  condition: String (required),
  myPrice: Decimal128 (required),
  priceHistory: [priceHistorySchema],
  images: [String],
  dateAdded: Date (default: Date.now),
  sold: Boolean (default: false),
  saleDetails: saleDetailsSchema
}
```

**Note:** These are **collection catalog items** that represent actual user-owned items:
- **SealedProduct** → References Product (catalog of sealed products)
- **PsaGradedCard** → References Card (catalog of cards)
- **RawCard** → References Card (catalog of cards)
- **Product** and **Card** are reference/catalog data
- **SealedProduct**, **PsaGradedCard**, and **RawCard** are user collection items

**JSON Data Relationship:** The JSON data feeds the reference models (Product, Card, Set, SetProduct), while collection items have NO direct JSON equivalent.

## 5. Data Migration Strategy

### Phase 1: Set & Card Migration
1. **Parse new_sets JSON files**
2. **Create/Update Set records** using direct mappings
3. **Create/Update Card records** with proper set relationships
4. **Validate data integrity** between sets and cards

### Phase 2: Product & SetProduct Migration
1. **Extract unique SetProduct entries** from all category JSON files
2. **Create/Update SetProduct records**
3. **Create/Update Product records** with proper SetProduct relationships
4. **Handle data type conversions** (available string → number)

### Phase 3: Relationship Validation
1. **Verify Set ↔ Card relationships**
2. **Verify SetProduct ↔ Product relationships**
3. **Check referential integrity**
4. **Validate unique constraints**

## 6. Key Differences & Challenges

### Data Structure Alignment
- ✅ **Excellent alignment** between JSON and models for Set/Card data
- ✅ **Good alignment** for Product/SetProduct data
- 🔄 **Type conversions needed** for numeric strings

### Dual ID System
- **MongoDB ObjectIds**: Generated by database for relationships (setId, productId, cardId)
- **Unique Identifiers**: Preserved from JSON data for rebuilding capability (uniqueSetId, uniqueProductId, uniquePokemonId)
- **Both fields exist**: This enables database rebuilding while maintaining relationships
- Collection item models (SealedProduct, PsaGradedCard, RawCard) reference catalog models but have no JSON equivalent

### Data Integrity Considerations
- **Unique constraints** must be preserved
- **Foreign key relationships** must be properly established
- **Index optimization** already implemented in models

## 7. Implementation Recommendations

### 1. Migration Order
```
1. SetProduct creation (from all category JSONs)
2. Set creation (from new_sets JSONs)
3. Product creation (with SetProduct references)
4. Card creation (with Set references)
```

### 2. Data Validation Rules
- Validate unique IDs before insertion
- Check data type consistency
- Verify enum constraints for categories
- Ensure referential integrity

### 3. Performance Optimizations
- Use batch operations for large datasets
- Leverage existing model indexes
- Implement progress tracking
- Use transactions for data consistency

## 8. File-to-Model Mapping Summary

| JSON Source | Target Model | Relationship Type |
|-------------|--------------|-------------------|
| `data/new_sets/set-details/*.json` | Set | 1:1 per JSON file |
| `data/new_sets/set-details/*.json → cards[]` | Card | 1:Many per JSON file |
| `data/Products/*/category.json → products[]` | Product | 1:Many per JSON file |
| `data/Products/*/category.json → products[].setProductName` | SetProduct | Many:1 aggregated |
| N/A | SealedProduct | Collection item (references Product) |
| N/A | PsaGradedCard | Collection item (references Card) |
| N/A | RawCard | Collection item (references Card) |

## 9. Migration Script Structure Recommendation

```javascript
const migrationOrder = [
  'migrateSetProducts',    // From Products/*.json
  'migrateSets',          // From new_sets/*.json
  'migrateProducts',      // From Products/*.json (with SetProduct refs)
  'migrateCards',         // From new_sets/*.json (with Set refs)
  'validateIntegrity'     // Cross-reference validation
];
```

## 10. Architecture Summary

### Reference/Catalog Models (Fed by JSON Data)
- **Set** ← `data/new_sets/set-details/*.json`
- **Card** ← `data/new_sets/set-details/*.json → cards[]`  
- **SetProduct** ← `data/Products/*/category.json → products[].setProductName`
- **Product** ← `data/Products/*/category.json → products[]`

### Collection Item Models (User-Owned Items)
- **SealedProduct** → References Product (no JSON source)
- **PsaGradedCard** → References Card (no JSON source)
- **RawCard** → References Card (no JSON source)

### Key Relationships
```
Set (1) ←→ (Many) Card
  ↓ ObjectId        ↓ ObjectId
  setId            setId
  ↓ Unique ID      ↓ Unique ID  
  uniqueSetId      uniqueSetId

SetProduct (1) ←→ (Many) Product
  ↓ ObjectId           ↓ ObjectId
  _id                  setProductId
  ↓ Unique ID          ↓ Reference
  uniqueSetProductId   uniqueSetProductId

Product (1) ←→ (Many) SealedProduct
Card (1) ←→ (Many) PsaGradedCard
Card (1) ←→ (Many) RawCard
```

### Field Naming Consistency & Dual ID System
- **MongoDB ObjectIds**: `setId`, `productId`, `cardId`, `setProductId` (for relationships)
- **Unique Identifiers**: `uniquePokemonId`, `uniqueSetId`, `uniqueProductId`, `uniqueSetProductId` (for rebuilding)
- **Consistent Naming**: `cardNumber` (replaces pokemonNumber completely)
- **Both exist**: Models contain both ObjectIds for relationships AND unique IDs for rebuilding

This comparison document provides a complete roadmap for rebuilding the backend with proper data relationships and migration strategies.